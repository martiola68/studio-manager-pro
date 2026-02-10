import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Endpoint per avviare il flusso OAuth Microsoft
 * GET /api/auth/microsoft/login?user_id=xxx
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user_id } = req.query;

    if (!user_id || typeof user_id !== "string") {
      return res.status(400).json({ error: "user_id is required" });
    }

    // Credenziali Microsoft da environment variables
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const tenantId = process.env.MICROSOFT_TENANT_ID;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

    if (!clientId || !tenantId || !redirectUri) {
      console.error("❌ Missing Microsoft 365 configuration");
      return res.status(500).json({ error: "Microsoft 365 not configured" });
    }

    // Scopes necessari per Graph API
    const scopes = [
      "User.Read",
      "Mail.Send",
      "Mail.Send.Shared",
      "Calendars.ReadWrite",
      "Calendars.ReadWrite.Shared",
      "Contacts.ReadWrite",
      "Contacts.ReadWrite.Shared",
      "Channel.ReadBasic.All",
      "ChannelMessage.Send",
      "Chat.ReadWrite",
      "Chat.ReadWrite.All",
      "Team.ReadBasic.All",
      "offline_access" // Per refresh token
    ].join(" ");

    // Costruisci URL di autorizzazione Microsoft
    const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
    
    authUrl.searchParams.append("client_id", clientId);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("response_mode", "query");
    authUrl.searchParams.append("scope", scopes);
    authUrl.searchParams.append("state", user_id); // Pass user_id tramite state

    console.log("🔐 [Microsoft Login] Redirecting to:", authUrl.toString());

    // Redirect a Microsoft login
    res.redirect(authUrl.toString());
  } catch (error: any) {
    console.error("❌ Error in Microsoft login:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
}