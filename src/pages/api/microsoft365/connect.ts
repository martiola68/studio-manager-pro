// src/pages/api/microsoft365/connect.ts
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

  const host =
    (req.headers["x-forwarded-host"] as string) || req.headers.host;

  return `${proto}://${host}`;
}

function randomState(len = 48) {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("[m365/connect] HIT", { method: req.method });

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1) Verifica utente (Supabase access token)
    const token = getBearerToken(req) || (req.query.token as string) || null;

    if (!token) {
      return res
        .status(401)
        .json({ error: "Missing Authorization Bearer token" });
    }

    const { data: userRes, error: userErr } =
      await supabaseAdmin.auth.getUser(token);

    if (userErr || !userRes?.user) {
      return res.status(401).json({ error: "Utente non autenticato" });
    }

    const authUser = userRes.user;

    // 2) Recupera riga utente su tbutenti: prima per id, fallback per email
    const { data: utenteById } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id, email")
      .eq("id", authUser.id)
      .maybeSingle();

    let userRow = utenteById ?? null;

    if (!userRow?.studio_id) {
      if (!authUser.email) {
        return res.status(400).json({
          error: "Impossibile determinare l'utente (email mancante)",
        });
      }

      const { data: utenteByEmail, error: u2Err } = await supabaseAdmin
        .from("tbutenti")
        .select("id, studio_id, email")
        .eq("email", authUser.email)
        .maybeSingle();

      if (u2Err || !utenteByEmail?.studio_id) {
        return res.status(400).json({ error: "Studio utente non trovato" });
      }

      userRow = utenteByEmail;
    }

    const userId = userRow.id as string;
    const studioId = userRow.studio_id as string;

    // 3) Recupera connessione selezionata
    const microsoftConnectionId =
      typeof req.query.microsoft_connection_id === "string"
        ? req.query.microsoft_connection_id
        : typeof req.body?.microsoft_connection_id === "string"
        ? req.body.microsoft_connection_id
        : null;

    if (!microsoftConnectionId) {
      return res.status(400).json({
        error: "microsoft_connection_id mancante",
      });
    }

    const { data: conn, error: connErr } = await supabaseAdmin
      .from("microsoft365_connections")
      .select(
        "id, studio_id, nome_connessione, tenant_id, client_id, client_secret, enabled"
      )
      .eq("id", microsoftConnectionId)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (connErr || !conn) {
      return res.status(400).json({
        error: "Connessione Microsoft 365 non trovata",
      });
    }

    if (!conn.client_id || !conn.tenant_id) {
      return res.status(400).json({
        error: "Configurazione connessione Microsoft 365 incompleta",
      });
    }

    if (conn.enabled === false) {
      return res.status(400).json({
        error: "Connessione Microsoft 365 disabilitata",
      });
    }

    const tenantId = conn.tenant_id;
    const state = randomState(48);

    // 4) Salva lo state + connection_id in tbmicrosoft_settings
    const { error: upStateErr } = await supabaseAdmin
      .from("tbmicrosoft_settings")
      .upsert(
    {
      user_id: userId,
      m365_oauth_state: state,
      microsoft_connection_id: microsoftConnectionId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,microsoft_connection_id" }
  );

    if (upStateErr) {
      return res.status(500).json({
        error: `Errore salvataggio state: ${upStateErr.message}`,
      });
    }

    // 5) Costruisci authorize URL sulla connessione selezionata
    const redirectUri = `${appBaseUrl(req)}/api/microsoft365/callback`;

    const params = new URLSearchParams({
      client_id: conn.client_id,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope:
        "openid profile offline_access User.Read Calendars.ReadWrite Mail.Send",
      prompt: "select_account",
      state,
    });

    console.log("[m365/connect] authorize tenant:", tenantId);
    console.log(
      "[m365/connect] microsoft_connection_id:",
      microsoftConnectionId
    );
    console.log("[m365/connect] nome_connessione:", conn.nome_connessione);

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
