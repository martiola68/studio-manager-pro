import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
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

    const supabaseAdmin = getSupabaseAdmin();
    const { data: existingData } = await supabaseAdmin
      .from("microsoft365_config")
      .select("id")
      .eq("studio_id", studioId)
      .maybeSingle();

    if (existingData) {
      const updateData: {
        client_id: string;
        tenant_id: string;
        enabled: boolean;
        client_secret?: string;
      } = {
        client_id: clientId,
        tenant_id: tenantId,
        enabled: true,
      };

      if (clientSecret) {
        updateData.client_secret = encrypt(clientSecret);
      }

      const { error: updateError } = await supabaseAdmin
        .from("microsoft365_config")
        .update(updateData)
        .eq("studio_id", studioId);

      if (updateError) {
        console.error("[M365 Config] Update error:", updateError);
        throw updateError;
      }
    } else {
      if (!clientSecret) {
        return res.status(400).json({
          error: "Client secret is required for new configuration",
        });
      }

      const { error: insertError } = await supabaseAdmin
        .from("microsoft365_config")
        .insert({
          studio_id: studioId,
          client_id: clientId,
          client_secret: encrypt(clientSecret),
          tenant_id: tenantId,
          enabled: true,
        });

      if (insertError) {
        console.error("[M365 Config] Insert error:", insertError);
        throw insertError;
      }
    }

    const { data: savedConfig, error: selectError } = await supabaseAdmin
      .from("microsoft365_config")
      .select("id, studio_id, client_id, tenant_id, organizer_email, enabled")
      .eq("studio_id", studioId)
      .single();

    if (selectError || !savedConfig) {
      console.error("[M365 Config] Select error after save:", selectError);
      throw new Error("Failed to retrieve saved configuration");
    }

    tokenCache.invalidate(studioId);
    console.log("[M365 Config] Token cache invalidated for studio:", studioId);

    return res.status(200).json({
      success: true,
      message: "Microsoft 365 configuration saved successfully",
      config: {
        id: savedConfig.id,
        studio_id: savedConfig.studio_id,
        client_id: savedConfig.client_id,
        tenant_id: savedConfig.tenant_id,
        organizer_email: savedConfig.organizer_email,
        enabled: savedConfig.enabled,
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