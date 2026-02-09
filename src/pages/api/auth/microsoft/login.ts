import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // ⚡ Supporto HEAD method per preflight checks
  if (req.method === "HEAD") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
    const tenantId = process.env.MICROSOFT_TENANT_ID || "common";

    if (!clientId || !redirectUri) {
      return res.status(500).json({ error: "Microsoft 365 not configured" });
    }

    const scope = [
      "openid",
      "profile",
      "email",
      "offline_access",
      "User.Read",
      "Calendars.ReadWrite",
      "Mail.Send",
      "Mail.Read",
      "OnlineMeetings.ReadWrite",
    ].join(" ");

    const state = Buffer.from(
      JSON.stringify({
        timestamp: Date.now(),
        redirect: req.query.redirect || "/impostazioni/microsoft365",
      })
    ).toString("base64");

    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${clientId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_mode=query` +
      `&scope=${encodeURIComponent(scope)}` +
      `&state=${state}`;

    res.redirect(authUrl);
  } catch (error) {
    console.error("Microsoft login error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}