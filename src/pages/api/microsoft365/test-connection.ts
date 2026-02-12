import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
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
  value: z.array(z.object({
    displayName: z.string().optional().nullable(),
  })).min(1),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const parseResult = TestRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid studioId" });
    }
    const { studioId } = parseResult.data;

    console.log("[M365 Test] Testing connection for studio:", studioId);

    const { data, error } = await supabaseAdmin
      .from("microsoft365_config")
      .select("client_id, client_secret, tenant_id, enabled")
      .eq("studio_id", studioId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Microsoft 365 not configured for this studio",
      });
    }

    const dbParse = DBConfigSchema.safeParse(data);
    if (!dbParse.success) {
      return res.status(500).json({ error: "Invalid database configuration data" });
    }
    const config = dbParse.data;

    if (!config.enabled) {
      return res.status(400).json({
        success: false,
        error: "Microsoft 365 integration is disabled",
      });
    }

    const clientSecret = decrypt(config.client_secret);

    console.log("[M365 Test] Obtaining access token...");
    const tokenUrl = `https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: config.client_id,
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
      const err = await tokenResponse.json().catch(() => ({}));
      return res.status(401).json({
        success: false,
        error: "Failed to obtain access token",
        details: err.error_description || "Invalid credentials",
      });
    }

    const tokenJson = await tokenResponse.json();
    const tokenParsed = TokenResponseSchema.safeParse(tokenJson);
    if (!tokenParsed.success) {
      return res.status(500).json({ error: "Invalid token response from Microsoft" });
    }
    const { access_token, expires_in } = tokenParsed.data;

    console.log("[M365 Test] Testing Graph API call...");
    const graphResponse = await fetch("https://graph.microsoft.com/v1.0/organization", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!graphResponse.ok) {
      return res.status(403).json({
        success: false,
        error: "Graph API call failed",
        details: "Token obtained but permissions denied",
      });
    }

    const graphJson = await graphResponse.json();
    const graphParsed = GraphOrgSchema.safeParse(graphJson);
    
    let orgName = "Unknown";
    if (graphParsed.success) {
      orgName = graphParsed.data.value[0].displayName || "Unknown";
    }

    return res.status(200).json({
      success: true,
      message: "Microsoft 365 connection successful",
      organization: orgName,
      tenant_id: config.tenant_id,
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