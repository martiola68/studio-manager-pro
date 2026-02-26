import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { decrypt } from "@/lib/encryption365";
import { z } from "zod";

/**
 * API: Test Microsoft 365 Connection
 * App-only (client credentials) test.
 */

const RequestSchema = z.object({
  studioId: z.string().uuid(),
});

const DbConfigSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  tenant_id: z.string().min(1),
  enabled: z.boolean(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // ❌ Metodo
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    /* =========================
       1. Validate input
    ========================= */
    const parsedReq = RequestSchema.safeParse(req.body);
    if (!parsedReq.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
      });
    }

    const { studioId } = parsedReq.data;

    /* =========================
       2. Load config (service role)
    ========================= */
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("microsoft365_config")
      .select("client_id, client_secret, tenant_id, enabled")
      .eq("studio_id", studioId)
      .maybeSingle();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Microsoft 365 configuration not found",
      });
    }

    const parsedConfig = DbConfigSchema.safeParse(data);
    if (!parsedConfig.success) {
      return res.status(500).json({
        success: false,
        error: "Invalid configuration data in database",
      });
    }

    const config = parsedConfig.data;

    if (!config.enabled) {
      return res.status(400).json({
        success: false,
        error: "Microsoft 365 integration is disabled",
      });
    }

    /* =========================
       3. Decrypt secret
    ========================= */
    let clientSecret: string;
    try {
      clientSecret = decrypt(config.client_secret);
    } catch (e) {
      throw new Error(
        "Failed to decrypt client secret (wrong key or corrupted data)"
      );
    }

    /* =========================
       4. Get access token
    ========================= */
    const tokenUrl = `https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`;

    const tokenParams = new URLSearchParams({
      client_id: config.client_id,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });

    let tokenResponse: Response;
    try {
      tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString(),
      });
    } catch {
      throw new Error("Network error while contacting Microsoft login endpoint");
    }

    const tokenJson = await tokenResponse.json().catch(() => null);

    if (!tokenResponse.ok) {
      return res.status(401).json({
        success: false,
        error: "Failed to obtain access token",
        details:
          tokenJson?.error_description ||
          tokenJson?.error ||
          "Invalid credentials or tenant",
      });
    }

    const accessToken = tokenJson?.access_token;
    if (!accessToken) {
      throw new Error("Access token missing in Microsoft response");
    }

    /* =========================
       5. Test Graph API
    ========================= */
    let graphResponse: Response;
    try {
      graphResponse = await fetch(
        "https://graph.microsoft.com/v1.0/organization",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
    } catch {
      throw new Error("Network error while calling Microsoft Graph");
    }

    const graphJson = await graphResponse.json().catch(() => null);

    if (!graphResponse.ok) {
      return res.status(403).json({
        success: false,
        error: "Graph API call failed",
        details: "Token valid but insufficient permissions",
      });
    }

    const orgName =
      graphJson?.value?.[0]?.displayName ?? "Unknown organization";

    /* =========================
       6. SUCCESS
    ========================= */
    return res.status(200).json({
      success: true,
      message: "Microsoft 365 connection successful",
      organization: orgName,
      tenant_id: config.tenant_id,
    });

  } catch (err: unknown) {
    // 🔴 ULTIMA RETE DI SICUREZZA
    console.error("[M365 Test] Fatal error:", err);

    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: err instanceof Error ? err.message : "Unknown error",
    });
  }
}