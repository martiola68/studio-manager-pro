import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "HEAD") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const userId = req.query.user_id as string;

    if (!userId) {
      return res.status(400).json({ error: "Missing user_id parameter" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: utente, error: utenteError } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", userId)
      .single();

    if (utenteError || !utente?.studio_id) {
      return res.status(404).json({ error: "User or studio not found" });
    }

    const { data: config, error: configError } = await supabase
      .from("microsoft365_config")
      .select("client_id, tenant_id")
      .eq("studio_id", utente.studio_id)
      .single();

    if (configError || !config?.client_id || !config?.tenant_id) {
      return res.status(400).json({ 
        error: "Microsoft 365 not configured for this studio. Please configure credentials in Settings." 
      });
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://studio-manager-pro.vercel.app"}/api/auth/microsoft/callback`;

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
        user_id: userId,
        studio_id: utente.studio_id,
        timestamp: Date.now(),
      })
    ).toString("base64");

    const authUrl = `https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/authorize?` +
      `client_id=${config.client_id}` +
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