import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Ok = { url: string };
type Err = { error: string; details?: any };

function baseUrl(req: NextApiRequest) {
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
  return `${proto}://${host}`;
}

function getBearer(req: NextApiRequest) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function b64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1) Auth utente (Bearer Supabase)
    const bearer = getBearer(req);
    if (!bearer) return res.status(401).json({ error: "Missing Authorization Bearer token" });

    const { data: u, error: uErr } = await supabaseAdmin.auth.getUser(bearer);
    if (uErr || !u?.user) return res.status(401).json({ error: "Invalid session" });

    const userId = u.user.id;

    // 2) studio_id utente
    const { data: userRow, error: userErr } = await supabaseAdmin
      .from("tbutenti")
      .select("studio_id")
      .eq("id", userId)
      .single();

    if (userErr || !userRow?.studio_id) {
      return res.status(400).json({ error: "Studio non trovato per l'utente" });
    }

    // 3) config studio M365
    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("microsoft365_config")
      .select("client_id, tenant_id, enabled")
      .eq("studio_id", userRow.studio_id)
      .maybeSingle();

    if (cfgErr) return res.status(500).json({ error: "DB error", details: cfgErr.message });
    if (!cfg) return res.status(400).json({ error: "Configurazione Microsoft 365 mancante per lo studio" });
    if (!cfg.enabled) return res.status(400).json({ error: "Microsoft 365 è disabilitato per questo studio" });

    // 4) PKCE + state
    const state = crypto.randomBytes(24).toString("hex");
    const codeVerifier = b64url(crypto.randomBytes(32));
    const codeChallenge = b64url(crypto.createHash("sha256").update(codeVerifier).digest());

    // 5) salva state/verifier in tbmicrosoft_settings (upsert 1:1)
    const { error: upErr } = await supabaseAdmin
      .from("tbmicrosoft_settings")
      .upsert(
        {
          user_id: userId,
          m365_oauth_state: state,
          m365_code_verifier: codeVerifier,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upErr) {
      return res.status(500).json({ error: "Failed to persist oauth state", details: upErr.message });
    }

    // 6) build authorize URL (DELEGATED)
    const redirectUri = `${baseUrl(req)}/api/m365/callback`;

    const params = new URLSearchParams({
      client_id: cfg.client_id,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: ["openid", "profile", "offline_access", "User.Read"].join(" "),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    });

    const tenant = cfg.tenant_id || "common";
    const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;

    return res.status(200).json({ url });
  } catch (e: any) {
    console.error("[m365 connect] error", e);
    return res.status(500).json({ error: "Internal error", details: e?.message });
  }
}
