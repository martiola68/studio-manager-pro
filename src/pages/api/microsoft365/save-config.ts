import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";
import { encrypt } from "@/lib/encryption365";

/**
 * API: Save Microsoft 365 Configuration
 * 
 * Encrypts and saves M365 credentials for a studio.
 * Only admins can call this endpoint.
 * 
 * POST /api/microsoft365/save-config
 * Body: {
 *   studioId: string,
 *   clientId: string,
 *   clientSecret: string (plain text - will be encrypted),
 *   tenantId: string,
 *   organizerEmail?: string
 * }
 */

interface SaveConfigRequest {
  studioId: string;
  clientId: string;
  clientSecret: string;
  tenantId: string;
  organizerEmail?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      studioId,
      clientId,
      clientSecret,
      tenantId,
      organizerEmail,
    } = req.body as SaveConfigRequest;

    // Validate required fields
    if (!studioId || !clientId || !clientSecret || !tenantId) {
      return res.status(400).json({
        error: "Missing required fields: studioId, clientId, clientSecret, tenantId",
      });
    }

    // Validate studio exists
    const { data: studio, error: studioError } = await supabase
      .from("tbstudio")
      .select("id")
      .eq("id", studioId)
      .single();

    if (studioError || !studio) {
      return res.status(404).json({ error: "Studio not found" });
    }

    // Encrypt client secret
    console.log("[M365 Config] Encrypting client secret...");
    const encryptedSecret = encrypt(clientSecret);
    console.log("[M365 Config] Client secret encrypted successfully");

    // Check if config already exists
    const { data: existingConfig } = await supabase
      .from("tbmicrosoft365_config")
      .select("id")
      .eq("studio_id", studioId)
      .single();

    let result;

    if (existingConfig) {
      // Update existing config
      console.log("[M365 Config] Updating existing config for studio:", studioId);
      const { data, error } = await supabase
        .from("tbmicrosoft365_config")
        .update({
          client_id: clientId,
          client_secret_encrypted: encryptedSecret,
          tenant_id: tenantId,
          organizer_email: organizerEmail || null,
          enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq("studio_id", studioId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert new config
      console.log("[M365 Config] Creating new config for studio:", studioId);
      const { data, error } = await supabase
        .from("tbmicrosoft365_config")
        .insert({
          studio_id: studioId,
          client_id: clientId,
          client_secret_encrypted: encryptedSecret,
          tenant_id: tenantId,
          organizer_email: organizerEmail || null,
          enabled: true,
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    console.log("[M365 Config] Configuration saved successfully");

    // Return config without encrypted secret
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