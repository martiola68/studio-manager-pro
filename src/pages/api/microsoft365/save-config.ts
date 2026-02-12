import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { encrypt } from "@/lib/encryption365";
import { tokenCache } from "@/services/tokenCacheService";
import { z } from "zod";

/**
 * API: Save Microsoft 365 Configuration
 * 
 * Encrypts and saves M365 credentials for a studio.
 * Uses supabaseAdmin (service role) to bypass RLS.
 * 
 * POST /api/microsoft365/save-config
 */

const SaveConfigRequestSchema = z.object({
  studioId: z.string().uuid(),
  clientId: z.string().min(1),
  clientSecret: z.string().optional(),
  tenantId: z.string().min(1),
  organizerEmail: z.string().email().optional().or(z.literal("")),
});

const ConfigRowSchema = z.object({
  id: z.string(),
  studio_id: z.string(),
  client_id: z.string(),
  tenant_id: z.string(),
  organizer_email: z.string().nullable(),
  enabled: z.boolean(),
  client_secret: z.string(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const parseResult = SaveConfigRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Invalid request data", 
        details: parseResult.error.flatten() 
      });
    }

    const {
      studioId,
      clientId,
      clientSecret,
      tenantId,
      organizerEmail,
    } = parseResult.data;

    const { data: studio, error: studioError } = await supabase
      .from("tbstudio")
      .select("id")
      .eq("id", studioId)
      .single();

    if (studioError || !studio) {
      return res.status(404).json({ error: "Studio not found" });
    }

    const { data: existingData, error: checkError } = await supabaseAdmin
      .from("microsoft365_config")
      .select("id")
      .eq("studio_id", studioId)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    let resultData: unknown;

    if (existingData) {
      const updateData: Record<string, unknown> = {
        client_id: clientId,
        tenant_id: tenantId,
        organizer_email: organizerEmail || null,
        enabled: true,
        updated_at: new Date().toISOString(),
      };

      if (clientSecret) {
        updateData.client_secret = encrypt(clientSecret);
      }

      const { data, error } = await supabaseAdmin
        .from("microsoft365_config")
        .update(updateData)
        .eq("studio_id", studioId)
        .select()
        .single();

      if (error) {
        throw error;
      }
      resultData = data;
    } else {
      if (!clientSecret) {
        return res.status(400).json({
          error: "Client secret is required for new configuration",
        });
      }

      const encryptedSecret = encrypt(clientSecret);

      const { data, error } = await supabaseAdmin
        .from("microsoft365_config")
        .insert({
          studio_id: studioId,
          client_id: clientId,
          client_secret: encryptedSecret,
          tenant_id: tenantId,
          organizer_email: organizerEmail || null,
          enabled: true,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }
      resultData = data;
    }

    const parsedDB = ConfigRowSchema.safeParse(resultData);
    if (!parsedDB.success) {
      console.error("Database mismatch:", parsedDB.error);
      throw new Error("Database returned unexpected data shape");
    }
    
    const result = parsedDB.data;

    tokenCache.invalidate(studioId);
    console.log("[M365 Config] Token cache invalidated for studio:", studioId);

    return res.status(200).json({
      success: true,
      message: "Microsoft 365 configuration saved successfully",
      config: {
        id: result.id,
        studio_id: result.studio_id,
        client_id: result.client_id,
        tenant_id: result.tenant_id,
        organizer_email: result.organizer_email,
        enabled: result.enabled,
      },
    });

  } catch (error: unknown) {
    console.error("[M365 Config] Error saving configuration:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      error: "Failed to save Microsoft 365 configuration",
      details: errorMessage,
    });
  }
}