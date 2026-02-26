import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseClient } from "@/lib/supabase/client";
import { decrypt } from "@/lib/encryption365";
import { z } from "zod";

/**
 * API: Test Microsoft 365 Connection
 * Tests client_credentials flow.
 * Uses supabaseAdmin (service role) to bypass RLS.
 */

const TestRequestSchema = z.object({
  studioId: z.string().uuid(),
});

const DBConfigSchema = z.object({
  client_id: z.string(),
  client_secret: z.string(),
  tenant_id: z.string(),
  enabled: z.boolean(),
});

const TokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
});

const GraphOrgSchema = z.object({
  value: z
    .array(
      z.object({
        displayName: z.string().optional().nullable(),
      })
    )
    .min(1),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 🔹 Validate request
    const parseResult = TestRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid studioId" });
    }

    const { studioId } = parseResult.data;
    console.log("[M365 Test] Testing connection for studio:", studioId);

    // 🔹 Load config from DB (service role)
    const supabaseAdmin = getSupabaseAdmin();
    const { data: config, error: configError } = await supabaseAdmin
      .from("microsoft365_config")
      .select("client_id, client_secret, tenant_id, enabled")
      .eq("studio_id", studioId)
      .maybeSingle();

    if (configError) throw configError;

    if (!config) {
      return res.status(404).json({
        success: false,
        error: "Microsoft 365 not configured for this studio",
      });
    }

    const dbParse = DBConfigSchema.safeParse(config);
    if (!dbParse.success) {
      return res.status(500).json({
        success: false,
        error: "Invalid database configuration data",
      });
    }

    const configData = dbParse.data;

    if (!configData.enabled) {
      return res.status(400).json({
        success: false,
        error: "Microsoft 365 integration is disabled",
      });
    }

    // 🔹 DECRYPT INSIDE TRY (critical)
    const clientSecret = decrypt(configData.client_secret);

    // 🔹 Obtain access token
    console.log("[M365 Test] Obtaining access token...");
    const tokenUrl = `https://login.microsoftonline.com/${configData.tenant_id}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: configData.client_id,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      let errBody: any = {};
      try {
        errBody = await tokenResponse.json();
      } catch {
        /* ignore */
      }

      return res.status(401).json({
        success: false,
        error: "Failed to obtain access token",
        details:
          errBody.error_description ||
          errBody.error ||
          "Invalid client credentials or tenant",
      });
    }

    const tokenJson = await tokenResponse.json();
    const tokenParsed = TokenResponseSchema.safeParse(tokenJson);
    if (!tokenParsed.success) {
      return res.status(500).json({
        success: false,
        error: "Invalid token response from Microsoft",
      });
    }

    const { access_token, expires_in } = tokenParsed.data;

    // 🔹 Test Graph API
    console.log("[M365 Test] Testing Graph API call...");
    const graphResponse = await fetch(
      "https://graph.microsoft.com/v1.0/organization",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    if (!graphResponse.ok) {
      return res.status(403).json({
        success: false,
        error: "Graph API call failed",
        details: "Token valid but permissions missing (Directory.Read.All)",
      });
    }

    const graphJson = await graphResponse.json();
    const graphParsed = GraphOrgSchema.safeParse(graphJson);

    const orgName =
      graphParsed.success
        ? graphParsed.data.value[0]?.displayName || "Unknown"
        : "Unknown";

    // ✅ SUCCESS
    return res.status(200).json({
      success: true,
      message: "Microsoft 365 connection successful",
      organization: orgName,
      tenant_id: configData.tenant_id,
      expires_in,
    });

  } catch (error: unknown) {
    console.error("[M365 Test] Error:", error);

    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}