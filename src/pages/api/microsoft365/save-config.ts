export const config = { runtime: "nodejs" };

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/encryption365";
import { tokenCache } from "@/services/tokenCacheService";

const SaveConfigRequestSchema = z.object({
  studioId: z.string().uuid(),
  connectionId: z.string().uuid().optional(),
  clientId: z.string().min(1),
  clientSecret: z.string().optional(),
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiOk | ApiErr>
) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const supabase = createClient(req, res);
    const {
      data: { session },
      error: sessionErr,
    } = await supabase.auth.getSession();

    if (sessionErr || !session?.user) {
      return res.status(401).json({
        success: false,
        error: "Non autenticato. Effettua il login.",
      });
    }

    const parseResult = SaveConfigRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: parseResult.error.flatten(),
      });
    }

    const {
      studioId,
      connectionId,
      clientId,
      clientSecret,
      tenantId,
      organizerEmail,
    } = parseResult.data;

    const rawSecret = (clientSecret ?? "").toString().trim();

    const { data: userRow, error: userErr } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", session.user.id)
      .single();

    if (userErr || !userRow?.studio_id) {
      return res.status(403).json({
        success: false,
        error: "Studio utente non valido o non trovato.",
      });
    }

    if (userRow.studio_id !== studioId) {
      return res.status(403).json({
        success: false,
        error: "Operazione non autorizzata per questo studio.",
      });
    }

    if (!connectionId) {
      return res.status(400).json({
        success: false,
        error: "connectionId obbligatorio per il salvataggio multi-tenant.",
      });
    }

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("microsoft365_connections")
      .select("id, studio_id, enabled")
      .eq("id", connectionId)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (connectionError) {
      return res.status(500).json({
        success: false,
        error: "Errore verifica connessione Microsoft 365",
        details: connectionError.message,
      });
    }

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: "Connessione Microsoft 365 non trovata per questo studio.",
      });
    }

    const payload: Record<string, any> = {
      client_id: clientId,
      tenant_id: tenantId,
      organizer_email: organizerEmail ? organizerEmail : null,
      enabled: true,
      updated_at: new Date().toISOString(),
    };

    if (rawSecret.length > 0) {
      payload.client_secret = encrypt(rawSecret);
    }

    const { error: updateConnectionError } = await supabaseAdmin
      .from("microsoft365_connections")
      .update(payload)
      .eq("id", connectionId)
      .eq("studio_id", studioId);

    if (updateConnectionError) {
      return res.status(500).json({
        success: false,
        error: "Failed to update Microsoft 365 connection",
        details: updateConnectionError.message,
      });
    }

    // Compatibilità con codice legacy che legge ancora microsoft365_config
    const legacyPayload: Record<string, any> = {
      studio_id: studioId,
      client_id: clientId,
      tenant_id: tenantId,
      organizer_email: organizerEmail ? organizerEmail : null,
      enabled: true,
    };

    if (rawSecret.length > 0) {
      legacyPayload.client_secret = encrypt(rawSecret);
    }

    const { data: existingConfig, error: existingError } = await supabaseAdmin
      .from("microsoft365_config")
      .select("id")
      .eq("studio_id", studioId)
      .maybeSingle();

    if (existingError) {
      return res.status(500).json({
        success: false,
        error: "Failed to read legacy Microsoft 365 configuration",
        details: existingError.message,
      });
    }

    if (existingConfig) {
      const { error: legacyUpdateError } = await supabaseAdmin
        .from("microsoft365_config")
        .update(legacyPayload)
        .eq("studio_id", studioId);

      if (legacyUpdateError) {
        return res.status(500).json({
          success: false,
          error: "Failed to update legacy Microsoft 365 configuration",
          details: legacyUpdateError.message,
        });
      }
    } else {
      if (!legacyPayload.client_secret) {
        // nessun insert legacy senza secret
      } else {
        const { error: legacyInsertError } = await supabaseAdmin
          .from("microsoft365_config")
          .insert(legacyPayload);

        if (legacyInsertError) {
          return res.status(500).json({
            success: false,
            error: "Failed to insert legacy Microsoft 365 configuration",
            details: legacyInsertError.message,
          });
        }
      }
    }

    const { data: savedConnection, error: selectError } = await supabaseAdmin
      .from("microsoft365_connections")
      .select("id, studio_id, client_id, tenant_id, organizer_email, enabled")
      .eq("id", connectionId)
      .eq("studio_id", studioId)
      .single();

    if (selectError || !savedConnection) {
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve saved connection",
        details: selectError?.message || "Unknown select error",
      });
    }

    tokenCache.invalidate(studioId);

    return res.status(200).json({
      success: true,
      message: "Microsoft 365 connection saved successfully",
      config: savedConnection,
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
