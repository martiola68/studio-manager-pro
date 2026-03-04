import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Estrae il bearer token (Supabase access_token) dagli header.
 */
function getBearerToken(req: NextApiRequest) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function appBaseUrl(req: NextApiRequest) {
  const proto =
    (req.headers["x-forwarded-proto"] as string) ||
    (req.headers["x-forwarded-protocol"] as string) ||
    "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
  return `${proto}://${host}`;
}

function randomState(len = 32) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("[m365/connect] HIT", { method: req.method });

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1) Verifica utente (Supabase access token)
    const token = getBearerToken(req) || (req.query.token as string) || null;
    if (!token) {
      return res.status(401).json({ error: "Missing Authorization Bearer token" });
    }

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return res.status(401).json({ error: "Utente non autenticato" });
    }
    const authUser = userRes.user;

    // 2) Recupera riga utente su tbutenti: prima per id, fallback per email
    const { data: utenteById, error: uErr } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id, email")
      .eq("id", authUser.id)
      .maybeSingle();

    let userRow = utenteById ?? null;

    if (!userRow?.studio_id) {
      if (!authUser.email) {
        return res.status(400).json({ error: "Impossibile determinare l'utente (email mancante)" });
      }

      const { data: utenteByEmail, error: u2Err } = await supabaseAdmin
        .from("tbutenti")
        .select("id, studio_id, email")
        .eq("email", authUser.email)
        .maybeSingle();

      if (u2Err || !utenteByEmail?.studio_id) {
        return res.status(400).json({ error: "Studio utente non trovato" });
      }

      userRow = utenteByEmail; // usa fallback
    }

    // ✅ Da qui in poi: userId/studioId ESISTONO sempre
    const userId = userRow.id;
    const studioId = userRow.studio_id;

    // 3) Leggi config studio
    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("microsoft365_config")
      .select("client_id, tenant_id, enabled")
      .eq("studio_id", studioId)
      .maybeSingle();

    if (cfgErr || !cfg?.client_id || !cfg?.tenant_id) {
      return res.status(400).json({ error: "Configurazione Microsoft 365 incompleta" });
    }
    if (cfg.enabled === false) {
      return res.status(400).json({ error: "Microsoft 365 disabilitato per lo studio" });
    }

    const tenantId = cfg.tenant_id;
    const state = randomState(48);

    // 4) Salva lo state in tbmicrosoft_settings
    const { error: upStateErr } = await supabaseAdmin
      .from("tbmicrosoft_settings")
      .upsert(
        {
          user_id: userId,
          m365_oauth_state: state,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upStateErr) {
      return res.status(500).json({ error: `Errore salvataggio state: ${upStateErr.message}` });
    }

    // 5) Costruisci authorize URL (delegated)
    const redirectUri = `${appBaseUrl(req)}/api/microsoft365/callback`;

    const params = new URLSearchParams({
      client_id: cfg.client_id,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: "openid profile offline_access User.Read Calendars.ReadWrite Mail.Send",
      prompt: "consent",
      state,
    });

    console.log("[m365/connect] authorize tenant:", tenantId);

    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;

    // 6) Redirect o JSON
    if (req.method === "GET") {
      res.writeHead(302, { Location: url });
      return res.end();
    }

    return res.status(200).json({ url });
  } catch (e: any) {
    console.error("[m365/connect] fatal", e);
    return res.status(500).json({ error: e?.message || "Errore interno" });
  }
}
