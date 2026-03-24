// pages/api/microsoft365/save-config.ts
export const config = { runtime: "nodejs" };

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/encryption365";
import { tokenCache } from "@/services/tokenCacheService";

/**
 * API: Save Microsoft 365 Configuration (Studio-level)
 * POST /api/microsoft365/save-config
 *
 * - Richiede utente autenticato (cookie Supabase).
 * - Consente salvataggio SOLO per lo studio dell'utente.
 * - Salva/aggiorna la config con service role (supabaseAdmin).
 * - Client Secret viene cifrato prima del salvataggio.
 * - Invalida token cache dello studio.
 */

const SaveConfigRequestSchema = z.object({
  studioId: z.string().uuid(),
  clientId: z.string().min(1),
  clientSecret: z.string().optional(), // opzionale: update può mantenere esistente
  tenantId: z.string().min(1),
  organizerEmail: z.string().email().optional().or(z.literal("")),
});

type ApiOk = {
  success: true;
  message: string;
  config: {
    id: string;
    studio_id: string;
    client_id: string;
    tenant_id: string;
    organizer_email: string | null;
    enabled: boolean;
  };
};

type ApiErr = {
  success: false;
  error: string;
  details?: any;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiOk | ApiErr>) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  // (opzionale) ping rapido per debug routing
  if (req.query.ping === "1") {
    return res.status(200).json({ success: true, message: "PING_OK" } as any);
  }

  try {
    // 1) Auth (cookie-based) + autorizzazione sullo studio
    const supabase = createClient(req, res);
    const {
      data: { session },
      error: sessionErr,
    } = await supabase.auth.getSession();

    if (sessionErr || !session?.user) {
      return res.status(401).json({ success: false, error: "Non autenticato. Effettua il login." });
    }

    const parseResult = SaveConfigRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: parseResult.error.flatten(),
      });
    }

    const { studioId, clientId, clientSecret, tenantId, organizerEmail } = parseResult.data;
    const rawSecret = (clientSecret ?? "").toString().trim();

    // Verifica che l'utente appartenga allo studio richiesto
    const { data: userRow, error: userErr } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", session.user.id)
      .single();

    if (userErr || !userRow?.studio_id) {
      return res.status(403).json({ success: false, error: "Studio utente non valido o non trovato." });
    }

    if (userRow.studio_id !== studioId) {
      return res.status(403).json({ success: false, error: "Operazione non autorizzata per questo studio." });
    }

    // 2) Verifica che lo studio esista (admin, no RLS)
    const { data: studio, error: studioError } = await supabaseAdmin
      .from("tbstudio")
      .select("id")
      .eq("id", studioId)
      .maybeSingle();

    if (studioError) {
      return res.status(500).json({
        success: false,
        error: "Failed to verify studio",
        details: studioError.message,
      });
    }

    if (!studio) {
      return res.status(404).json({ success: false, error: "Studio not found" });
    }

    // 3) Leggi config esistente
    const { data: existingConfig, error: existingError } = await supabaseAdmin
      .from("microsoft365_config")
      .select("id")
      .eq("studio_id", studioId)
      .maybeSingle();

    if (existingError) {
      return res.status(500).json({
        success: false,
        error: "Failed to read existing configuration",
        details: existingError.message,
      });
    }

    // 4) Payload base
    const payload: Record<string, any> = {
      studio_id: studioId,
      client_id: clientId,
      tenant_id: tenantId,
      enabled: true,
      organizer_email: organizerEmail ? organizerEmail : null,
    };

    // Secret: salva solo se presente (update può mantenerlo)
    if (rawSecret.length > 0) {
      payload.client_secret = encrypt(rawSecret);
    }

    // 5) Insert / Update
    if (existingConfig) {
      const { error: updateError } = await supabaseAdmin
        .from("microsoft365_config")
        .update(payload)
        .eq("studio_id", studioId);

      if (updateError) {
        return res.status(500).json({
          success: false,
          error: "Failed to update Microsoft 365 configuration",
          details: updateError.message,
        });
      }
    } else {
      // New config: secret obbligatorio
      if (!payload.client_secret) {
        return res.status(400).json({
          success: false,
          error: "Client secret is required for new configuration",
        });
      }

      const { error: insertError } = await supabaseAdmin.from("microsoft365_config").insert(payload);

      if (insertError) {
        return res.status(500).json({
          success: false,
          error: "Failed to insert Microsoft 365 configuration",
          details: insertError.message,
        });
      }
    }

    // 6) Read-back (per UI)
    const { data: savedConfig, error: selectError } = await supabaseAdmin
      .from("microsoft365_config")
      .select("id, studio_id, client_id, tenant_id, organizer_email, enabled")
      .eq("studio_id", studioId)
      .single();

    if (selectError || !savedConfig) {
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve saved configuration",
        details: selectError?.message || "Unknown select error",
      });
    }

    // 7) Invalidate cache
    tokenCache.invalidate(studioId);

    return res.status(200).json({
      success: true,
      message: "Microsoft 365 configuration saved successfully",
      config: savedConfig,
    });
  } catch (error: unknown) {
    console.error("[M365 save-config] Fatal error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to save Microsoft 365 configuration",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
