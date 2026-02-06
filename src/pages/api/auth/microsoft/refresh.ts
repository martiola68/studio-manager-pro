import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: "Refresh token required" });
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const tenantId = process.env.MICROSOFT_TENANT_ID || "common";

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: "Microsoft 365 not configured" });
    }

    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token,
          grant_type: "refresh_token",
        }),
      }
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      console.error("Token refresh error:", error);
      return res.status(401).json({ error: "Failed to refresh token" });
    }

    const tokens = await tokenResponse.json();

    res.status(200).json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || refresh_token,
      expires_in: tokens.expires_in,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}