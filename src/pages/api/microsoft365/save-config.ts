import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";
import { encrypt } from "@/lib/encryption365";
import { z } from "zod";

/**
 * API: Save Microsoft 365 Configuration
 * 
 * Encrypts and saves M365 credentials for a studio.
 * Uses Zod for payload and database validation.
 * 
 * POST /api/microsoft365/save-config
 */

// Schema for request body
const SaveConfigRequestSchema = z.object({
  studioId: z.string().uuid(),
  clientId: z.string().min(1),
  clientSecret: z.string().optional(),
  tenantId: z.string().min(1),
  organizerEmail: z.string().email().optional().or(z.literal("")),
});

// Schema for database result
const ConfigRowSchema = z.object({
  id: z.string(),
  studio_id: z.string(),
  client_id: z.string(),
  tenant_id: z.string(),
  organizer_email: z.string().nullable(),
  enabled: z.boolean(),
  client_secret_encrypted: z.string(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Validate Request Body
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

    // 2. Validate Studio Existence
    const { data: studio, error: studioError } = await supabase
      .from("tbstudio")
      .select("id")
      .eq("id", studioId)
      .single();

    if (studioError || !studio) {
      return res.status(404).json({ error: "Studio not found" });
    }

    // 3. Check for existing config
    const { data: existingData, error: checkError } = await supabase
      .from("tbmicrosoft365_config" as any)
      .select("id")
      .eq("studio_id", studioId)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    let resultData: unknown;

    // 4. Update or Insert
    if (existingData) {
      console.log("[M365 Config] Updating existing config for studio:", studioId);
      
      const updateData: Record<string, unknown> = {
        client_id: clientId,
        tenant_id: tenantId,
        organizer_email: organizerEmail || null,
        enabled: true,
        updated_at: new Date().toISOString(),
      };

      if (clientSecret) {
        updateData.client_secret_encrypted = encrypt(clientSecret);
      }

      const { data, error } = await supabase
        .from("tbmicrosoft365_config" as any)
        .update(updateData)
        .eq("studio_id", studioId)
        .select()
        .single();

      if (error) throw error;
      resultData = data;
    } else {
      if (!clientSecret) {
        return res.status(400).json({
          error: "Client secret is required for new configuration",
        });
      }

      console.log("[M365 Config] Creating new config for studio:", studioId);
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
      resultData = data;
    }

    // 5. Validate Database Result
    const parsedDB = ConfigRowSchema.safeParse(resultData);
    if (!parsedDB.success) {
      console.error("Database mismatch:", parsedDB.error);
      throw new Error("Database returned unexpected data shape");
    }
    
    const result = parsedDB.data;

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