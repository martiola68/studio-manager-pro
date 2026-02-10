import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";
import { decrypt } from "@/lib/encryption365";

/**
 * API: Test Microsoft 365 Connection
 * 
 * Tests M365 connection using client_credentials flow (app-only).
 * Validates credentials and obtains an access token.
 * 
 * POST /api/microsoft365/test-connection
 * Body: { studioId: string }
 */

interface TestConnectionRequest {
  studioId: string;
}

interface M365ConfigRow {
  id: string;
  studio_id: string;
  client_id: string;
  client_secret_encrypted: string;
  tenant_id: string;
  organizer_email: string | null;
  enabled: boolean;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { studioId } = req.body as TestConnectionRequest;

    if (!studioId) {
      return res.status(400).json({ error: "Missing studioId" });
    }

    console.log("[M365 Test] Testing connection for studio:", studioId);

    // Get config
    const { data, error } = await supabase
      .from("tbmicrosoft365_config")
      .select("*")
      .eq("studio_id", studioId)
      .maybeSingle();

    if (error) {
      console.error("[M365 Test] Database error:", error);
      throw error;
    }

    if (!data) {
      console.error("[M365 Test] Config not found");
      return res.status(404).json({
        success: false,
        error: "Microsoft 365 not configured for this studio",
      });
    }

    const config = data as M365ConfigRow;

    if (!config.enabled) {
      return res.status(400).json({
        success: false,
        error: "Microsoft 365 integration is disabled",
      });
    }

    // Decrypt secret
    if (!config.client_secret_encrypted) {
      return res.status(400).json({ error: "Configuration invalid: missing secret" });
    }

    // Decrypt client secret
    console.log("[M365 Test] Decrypting client secret...");
    const clientSecret = decrypt(config.client_secret_encrypted);

    // Test connection with client_credentials flow
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
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error("[M365 Test] Token request failed:", errorData);
      return res.status(401).json({
        success: false,
        error: "Failed to obtain access token",
        details: errorData.error_description || "Invalid credentials",
      });
    }

    const tokenData: TokenResponse = await tokenResponse.json();
    console.log("[M365 Test] Access token obtained successfully");

    // Test Graph API call to verify permissions
    console.log("[M365 Test] Testing Graph API call...");
    const graphResponse = await fetch("https://graph.microsoft.com/v1.0/organization", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!graphResponse.ok) {
      const errorData = await graphResponse.json().catch(() => ({}));
      console.error("[M365 Test] Graph API call failed:", errorData);
      return res.status(403).json({
        success: false,
        error: "Graph API call failed",
        details: "Token obtained but insufficient permissions",
      });
    }

    const orgData = await graphResponse.json();
    console.log("[M365 Test] Graph API call successful");

    return res.status(200).json({
      success: true,
      message: "Microsoft 365 connection successful",
      organization: orgData.value?.[0]?.displayName || "Unknown",
      tenant_id: config.tenant_id,
      expires_in: tokenData.expires_in,
    });
  } catch (error: unknown) {
    console.error("[M365 Test] Error testing connection:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: errorMessage,
    });
  }
}