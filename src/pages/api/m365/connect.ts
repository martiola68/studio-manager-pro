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
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
  return `${proto}://${host}`;
}

function randomState(len = 32) {
  // state semplice, url-safe
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // 1) Verifica utente (Supabase access token)
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing Authorization Bearer token" });

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return res.status(401).json({ error: "Utente non autenticato" });
    }
    const authUser = userRes.user;

    // 2) Mappa su tbutenti (se il tuo id coincide con auth.uid usa quello; altrimenti usa email)
    // Qui assumo che tbutenti.id = auth.uid (comune). Se non è così, cambia la query a .eq("email", authUser.email)
    const { data: utente, error: uErr } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id, email")
      .eq("id", authUser.id)
      .maybeSingle();

    const userRow = utente ?? null;

    if (!userRow?.studio_id) {
      // fallback: prova per email se non trovi per id
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

      // usa questo come userId “interno”
      // NB: per coerenza con callback che cerca state->user_id, salviamo user_id = utenteByEmail.id
      const userId = utenteByEmail.id;
      const studioId = utenteByEmail.studio_id;

      // 3) Leggi config studio (client_id, tenant_id)
      const { data: cfg, error: cfgErr } = await supabaseAdmin
        .from("microsoft365_config")
        .select("client_id, tenant_id, enabled")
        .eq("studio_id", studioId)
        .maybeSingle();

      if (cfgErr || !cfg?.client_id) return res.status(400).json({ error: "Configurazione Microsoft 365 incompleta" });
      if (cfg.enabled === false) return res.status(400).json({ error: "Microsoft 365 disabilitato per lo studio" });

      const tenant = cfg.tenant_id || "common";
      const state = randomState(48);

      // 4) Salva lo state in tbmicrosoft_settings (NO PKCE: niente code_verifier)
      await supabaseAdmin
        .from("tbmicrosoft_settings")
        .upsert(
          {
            user_id: userId,
            m365_oauth_state: state,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      // 5) Costruisci URL authorize (NO PKCE)
      const redirectUri = `${appBaseUrl(req)}/api/m365/callback`;

      const params = new URLSearchParams({
        client_id: cfg.client_id,
        response_type: "code",
        redirect_uri: redirectUri,
        response_mode: "query",
        scope: "offline_access User.Read Mail.Read Calendars.Read",
        state,
      });

      const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
      return res.status(200).json({ url });
    }

    // caso normale: trovato per id
    const userId = userRow.id;
    const studioId = userRow.studio_id;

    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("microsoft365_config")
      .select("client_id, tenant_id, enabled")
      .eq("studio_id", studioId)
      .maybeSingle();

    if (cfgErr || !cfg?.client_id) return res.status(400).json({ error: "Configurazione Microsoft 365 incompleta" });
    if (cfg.enabled === false) return res.status(400).json({ error: "Microsoft 365 disabilitato per lo studio" });

    const tenant = cfg.tenant_id || "common";
    const state = randomState(48);

    await supabaseAdmin
      .from("tbmicrosoft_settings")
      .upsert(
        {
          user_id: userId,
          m365_oauth_state: state,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    const redirectUri = `${appBaseUrl(req)}/api/m365/callback`;

    const params = new URLSearchParams({
      client_id: cfg.client_id,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: "offline_access User.Read Mail.Read Calendars.Read",
      state,
    });

    const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
    return res.status(200).json({ url });
  } catch (e: any) {
    console.error("[m365/connect] fatal", e);
    return res.status(500).json({ error: e?.message || "Errore interno" });
  }
}
