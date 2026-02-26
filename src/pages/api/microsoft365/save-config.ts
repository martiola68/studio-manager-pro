export const config = { runtime: "nodejs" };

import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { encrypt } from "@/lib/encryption365";
import { tokenCache } from "@/services/tokenCacheService";
import { z } from "zod";

/**
 * API: Save Microsoft 365 Configuration
 * POST /api/microsoft365/save-config
 *
 * Encrypts and saves M365 credentials for a studio using supabaseAdmin (service role).
 */

const SaveConfigRequestSchema = z.object({
  studioId: z.string().uuid(),
  clientId: z.string().min(1),
  clientSecret: z.string().optional(), // optional: can keep existing
  tenantId: z.string().min(1),
  organizerEmail: z.string().email().optional().or(z.literal("")),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const parseResult = SaveConfigRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: parseResult.error.flatten(),
      });
    }

    const { studioId, clientId, clientSecret, tenantId, organizerEmail } = parseResult.data;

    const supabaseAdmin = getSupabaseAdmin();

    // 1) Verify studio exists (ADMIN, no RLS issues)
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

    // 2) Check existing config
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

    // 3) Build update/insert payload
    const basePayload: any = {
      studio_id: studioId,
      client_id: clientId,
      tenant_id: tenantId,
      enabled: true,
      organizer_email: organizerEmail || null,
    };

    // Only update secret if provided and non-empty
    if (typeof clientSecret === "string" && clientSecret.trim().length > 0) {
      basePayload.client_secret = encrypt(clientSecret.trim());
    }

    if (existingConfig) {
      // Update existing
      const { error: updateError } = await supabaseAdmin
        .from("microsoft365_config")
        .update(basePayload)
        .eq("studio_id", studioId);

      if (updateError) {
        return res.status(500).json({
          success: false,
          error: "Failed to update Microsoft 365 configuration",
          details: updateError.message,
        });
      }
    } else {
      // Insert new: secret is required
      if (!basePayload.client_secret) {
        return res.status(400).json({
          success: false,
          error: "Client secret is required for new configuration",
        });
      }

      const { error: insertError } = await supabaseAdmin
        .from("microsoft365_config")
        .insert(basePayload);

      if (insertError) {
        return res.status(500).json({
          success: false,
          error: "Failed to insert Microsoft 365 configuration",
          details: insertError.message,
        });
      }
    }

    // 4) Read back saved config (for UI)
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

    // 5) Invalidate token cache
    tokenCache.invalidate(studioId);

    return res.status(200).json({
      success: true,
      message: "Microsoft 365 configuration saved successfully",
      config: savedConfig,
    });
  } catch (error: unknown) {
    console.error("[M365 Config] Fatal error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to save Microsoft 365 configuration",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
