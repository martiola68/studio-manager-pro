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
  clientSecret?: string; // Optional during update
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
    if (!studioId || !clientId || !tenantId) {
      return res.status(400).json({
        error: "Missing required fields: studioId, clientId, tenantId",
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

    // Check if config already exists
    const { data: existingConfig } = await supabase
      .from("tbmicrosoft365_config" as any)
      .select("id")
      .eq("studio_id", studioId)
      .single();

    let result;

    if (existingConfig) {
      // Update existing config
      console.log("[M365 Config] Updating existing config for studio:", studioId);
      
      // Prepare update data
      const updateData: Record<string, unknown> = {
        client_id: clientId,
        tenant_id: tenantId,
        organizer_email: organizerEmail || null,
        enabled: true,
        updated_at: new Date().toISOString(),
      };

      // Only update secret if provided
      if (clientSecret) {
        console.log("[M365 Config] Encrypting new client secret...");
        updateData.client_secret_encrypted = encrypt(clientSecret);
      }

      const { data, error } = await supabase
        .from("tbmicrosoft365_config" as any)
        .update(updateData)
        .eq("studio_id", studioId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert new config - secret is required
      if (!clientSecret) {
        return res.status(400).json({
          error: "Client secret is required for new configuration",
        });
      }

      console.log("[M365 Config] Creating new config for studio:", studioId);
      console.log("[M365 Config] Encrypting client secret...");
      const encryptedSecret = encrypt(clientSecret);

      const { data, error } = await supabase
        .from("tbmicrosoft365_config" as any)
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