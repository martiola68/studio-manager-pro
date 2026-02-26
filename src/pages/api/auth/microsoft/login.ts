// src/pages/api/auth/microsoft/login.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

function getBaseUrl(req: NextApiRequest) {
  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const host = req.headers.host;
  return `${proto}://${host}`;
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    // 1) token Supabase
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const { data: userData, error: userErr } =
      await supabaseAdmin.auth.getUser(token);

    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const userId = userData.user.id;

    // 2) studio_id
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("tbutenti")
      .select("studio_id")
      .eq("id", userId)
      .single();

    if (uerr || !urow?.studio_id) {
      return res.status(400).json({ error: "Studio non trovato" });
    }

    const studioId = urow.studio_id as string;

    // 3) config Microsoft
    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("tbmicrosoft365_config" as any)
      .select("client_id, tenant_id, enabled")
      .eq("studio_id", studioId)
      .single();

    if (cfgErr || !cfg) {
      return res.status(400).json({ error: "Config Microsoft365 mancante" });
    }
    if (!cfg.enabled) {
      return res.status(400).json({ error: "Microsoft365 disabilitato" });
    }

    // 4) state + cookie
    const state = crypto.randomBytes(16).toString("hex");
    const payload = JSON.stringify({ state, studioId, userId, t: Date.now() });
    const cookie = Buffer.from(payload).toString("base64url");

    res.setHeader(
      "Set-Cookie",
      `m365_state=${cookie}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    );

    // 5) URL authorize
    const redirectUri = `${getBaseUrl(req)}/api/auth/microsoft/callback`;

    const scopes = [
      "openid",
      "profile",
      "offline_access",
      "User.Read",
      "Calendars.ReadWrite",
      "Mail.Send",
      "OnlineMeetings.ReadWrite",
    ];

    const params = new URLSearchParams({
      client_id: cfg.client_id,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: scopes.join(" "),
      state,
    });

    const authorizeUrl = `https://login.microsoftonline.com/${cfg.tenant_id}/oauth2/v2.0/authorize?${params.toString()}`;

    return res.status(200).json({ url: authorizeUrl });
  } catch (e) {
    console.error("[m365 login] error", e);
    return res.status(500).json({ error: "Internal error" });
  }
}