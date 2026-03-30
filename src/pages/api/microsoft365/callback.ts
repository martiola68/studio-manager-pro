// src/pages/api/microsoft365/callback.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/encryption365";
import { ConfidentialClientApplication, LogLevel } from "@azure/msal-node";
import { getDecryptedClientSecret } from "./graph";

/* =======================
   Utils
======================= */

function appBaseUrl(req: NextApiRequest) {
  const proto =
    (req.headers["x-forwarded-proto"] as string) ||
    (req.headers["x-forwarded-protocol"] as string) ||
    "https";

  const host =
    (req.headers["x-forwarded-host"] as string) || req.headers.host;

  return `${proto}://${host}`;
}

function redirectOk(res: NextApiResponse) {
  res.writeHead(302, { Location: "/microsoft365?m365=connected" });
  res.end();
}

function redirectErr(res: NextApiResponse, msg: string) {
  const m = encodeURIComponent(msg);
  res.writeHead(302, {
    Location: `/microsoft365?error=true&message=${m}`,
  });
  res.end();
}

/**
 * Crea una vera token cache MSAL a partire dal code OAuth.
 * Per supportare utenti di tenant diversi, il code viene riscattato
 * contro authority "common".
 */
async function buildMsalSerializedCache(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ serializedCache: string; scopes: string }> {
  const msalApp = new ConfidentialClientApplication({
    auth: {
      clientId: params.clientId,
      authority: "https://login.microsoftonline.com/common",
      clientSecret: params.clientSecret,
    },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Error,
        piiLoggingEnabled: false,
      },
    },
  });

  const loginScopes = [
    "openid",
    "profile",
    "offline_access",
    "User.Read",
    "Calendars.ReadWrite",
    "Mail.Send",
  ];

  const graphScopes = ["User.Read", "Calendars.ReadWrite", "Mail.Send"];

  await msalApp.acquireTokenByCode({
    code: params.code,
    redirectUri: params.redirectUri,
    scopes: loginScopes,
  });

  const serializedCache = msalApp.getTokenCache().serialize();

  return {
    serializedCache,
    scopes: graphScopes.join(" "),
  };
}

/* =======================
   Handler
======================= */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;

    const msError =
      typeof req.query.error === "string" ? req.query.error : null;

    const msErrorDesc =
      typeof req.query.error_description === "string"
        ? req.query.error_description
        : null;

    if (msError) {
      return redirectErr(res, msErrorDesc || msError);
    }

    if (!code || !state) {
      return redirectErr(res, "Parametri OAuth mancanti");
    }

    /* =======================
       1) Recupero user_id + connection_id dallo state
    ======================= */
    const { data: stateRow, error: stateErr } = await supabaseAdmin
      .from("tbmicrosoft_settings")
      .select("user_id, microsoft_connection_id")
      .eq("m365_oauth_state", state)
      .single();

    if (stateErr || !stateRow?.user_id) {
      return redirectErr(res, "State OAuth non valido o scaduto");
    }

    const userId = stateRow.user_id as string;
    const microsoftConnectionId = stateRow.microsoft_connection_id as
      | string
      | null;

    if (!microsoftConnectionId) {
      return redirectErr(
        res,
        "Connessione Microsoft non associata allo state OAuth"
      );
    }

    /* =======================
       2) Recupero studio_id
    ======================= */
    const { data: userRow, error: userErr } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id")
      .eq("id", userId)
      .maybeSingle();

    if (userErr || !userRow?.studio_id) {
      return redirectErr(res, "Studio utente non trovato");
    }

    const studioId = userRow.studio_id as string;

    /* =======================
       3) Recupero connessione selezionata
    ======================= */
    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("microsoft365_connections")
      .select(
        "id, studio_id, nome_connessione, tenant_id, client_id, client_secret, enabled"
      )
      .eq("id", microsoftConnectionId)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (cfgErr || !cfg) {
      return redirectErr(res, "Connessione Microsoft 365 non trovata");
    }

    if (!cfg.client_id || !cfg.client_secret) {
      return redirectErr(res, "Configurazione Microsoft 365 incompleta");
    }

    if (cfg.enabled === false) {
      return redirectErr(res, "Connessione Microsoft 365 disabilitata");
    }

    const redirectUri = `${appBaseUrl(req)}/api/microsoft365/callback`;
    const clientSecret = getDecryptedClientSecret(cfg.client_secret);

    /* =======================
       4) Exchange CODE -> token cache MSAL
    ======================= */
    const { serializedCache, scopes } = await buildMsalSerializedCache({
      clientId: cfg.client_id,
      clientSecret,
      redirectUri,
      code,
    });

    if (!serializedCache) {
      return redirectErr(res, "Token cache Microsoft vuota");
    }

    const encryptedCache = encrypt(serializedCache);

    /* =======================
       5) Salvataggio token utente collegato alla connessione
    ======================= */
    const { error: upErr } = await supabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .upsert(
        {
          studio_id: studioId,
          user_id: userId,
          microsoft_connection_id: microsoftConnectionId,
          token_cache_encrypted: encryptedCache,
          scopes,
          connected_at: new Date().toISOString(),
          revoked_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "studio_id,user_id,microsoft_connection_id" }
      );

    if (upErr) {
      return redirectErr(res, `Errore DB token: ${upErr.message}`);
    }

    /* =======================
       6) Salvo connessione attiva sull'utente
    ======================= */
    await supabaseAdmin
      .from("tbutenti")
      .update({
        microsoft_connection_id: microsoftConnectionId,
      })
      .eq("id", userId);

    /* =======================
       7) Cleanup OAuth state
    ======================= */
    await supabaseAdmin
      .from("tbmicrosoft_settings")
      .update({
        m365_oauth_state: null,
        microsoft_connection_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return redirectOk(res);
  } catch (e: any) {
    console.error("[m365 callback]", e);
    return redirectErr(res, e?.message || "Errore callback Microsoft 365");
  }
}
