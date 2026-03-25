// src/pages/api/microsoft365/connect.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1) Auth utente tramite token Supabase
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

    // 2) Trova utente in tbutenti: prima per id, poi fallback su email
    let userRow: {
      id: string;
      studio_id: string | null;
      email: string;
      microsoft_connection_id: string | null;
    } | null = null;

    {
      const { data, error } = await supabaseAdmin
        .from("tbutenti")
        .select("id, studio_id, email, microsoft_connection_id")
        .eq("id", authUser.id)
        .maybeSingle();

      if (!error && data) {
        userRow = data;
      }
    }

    if (!userRow?.studio_id) {
      if (!authUser.email) {
        return res.status(400).json({
          error: "Impossibile determinare l'utente (email mancante)",
        });
      }

      const { data, error } = await supabaseAdmin
        .from("tbutenti")
        .select("id, studio_id, email, microsoft_connection_id")
        .eq("email", authUser.email)
        .maybeSingle();

      if (error || !data?.studio_id) {
        return res.status(400).json({ error: "Studio utente non trovato" });
      }

      userRow = data;
    }

    const userId = userRow.id;
    const studioId = userRow.studio_id;

    if (!studioId) {
      return res.status(400).json({ error: "Studio utente non trovato" });
    }

    // 3) Recupera microsoft_connection_id dalla richiesta
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

    // 4) Verifica connessione Microsoft selezionata
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

    // 5) Salva state in tbmicrosoft_settings SENZA upsert
    const { data: existingSettings, error: existingSettingsErr } =
      await supabaseAdmin
        .from("tbmicrosoft_settings")
        .select("id")
        .eq("user_id", userId)
        .eq("microsoft_connection_id", microsoftConnectionId)
        .maybeSingle();

    if (existingSettingsErr) {
      return res.status(500).json({
        error: `Errore lettura settings Microsoft: ${existingSettingsErr.message}`,
      });
    }

    if (existingSettings?.id) {
      const { error: updateErr } = await supabaseAdmin
        .from("tbmicrosoft_settings")
        .update({
          m365_oauth_state: state,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSettings.id);

      if (updateErr) {
        return res.status(500).json({
          error: `Errore salvataggio state: ${updateErr.message}`,
        });
      }
    } else {
      const { error: insertErr } = await supabaseAdmin
        .from("tbmicrosoft_settings")
        .insert({
          user_id: userId,
          microsoft_connection_id: microsoftConnectionId,
          m365_oauth_state: state,
          updated_at: new Date().toISOString(),
        });

      if (insertErr) {
        return res.status(500).json({
          error: `Errore salvataggio state: ${insertErr.message}`,
        });
      }
    }

    // 6) Costruisci authorize URL Microsoft
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

    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;

    // 7) Redirect per GET, JSON per POST
    if (req.method === "GET") {
      res.writeHead(302, { Location: url });
      return res.end();
    }

    return res.status(200).json({ url });
  } catch (e: any) {
    console.error("[m365/connect] fatal", e);
    return res.status(500).json({
      error: e?.message || "Errore interno",
    });
  }
}
