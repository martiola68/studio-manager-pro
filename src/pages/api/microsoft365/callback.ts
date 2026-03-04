// src/pages/api/microsoft365/callback.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encrypt, decrypt } from "@/lib/encryption365";
import { ConfidentialClientApplication, LogLevel } from "@azure/msal-node";

/* =======================
   Utils
======================= */

function appBaseUrl(req: NextApiRequest) {
  const proto =
    (req.headers["x-forwarded-proto"] as string) ||
    (req.headers["x-forwarded-protocol"] as string) ||
    "https";

  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;

  return `${proto}://${host}`;
}

function redirectOk(res: NextApiResponse) {
  res.writeHead(302, { Location: "/microsoft365?m365=connected" });
  res.end();
}

function redirectErr(res: NextApiResponse, msg: string) {
  const m = encodeURIComponent(msg);
  res.writeHead(302, { Location: `/microsoft365?error=true&message=${m}` });
  res.end();
}

/**
 * Serializza una "token cache" MSAL reale a partire dalla response di acquireTokenByCode.
 * Questo serve perché poi lato server userai MSAL acquireTokenSilent con token_cache_encrypted.
 */
async function buildMsalSerializedCache(params: {
  clientId: string;
  tenantId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ serializedCache: string; scopes: string }> {
  const msalApp = new ConfidentialClientApplication({
    auth: {
      clientId: params.clientId,
      authority: `https://login.microsoftonline.com/${params.tenantId}`,
      clientSecret: params.clientSecret,
    },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Error,
        piiLoggingEnabled: false,
      },
    },
  });

  // Scope OIDC + permessi che ti servono (aggiungi/togli in base a cosa usi)
  // - offline_access: refresh token
  // - Calendars.ReadWrite: eventi
  // - OnlineMeetings.ReadWrite: meeting Teams via /me/onlineMeetings
  // - Chat.ReadWrite: chat/messages (se lo usi)
  // - ChannelMessage.Send: post nei canali (se lo usi)
 const scopes = [
  "openid",
  "profile",
  "offline_access",
  "User.Read",
  "Calendars.ReadWrite",
  "Mail.Send",
].join(" ");

  // acquire token by code (delegated)
  await msalApp.acquireTokenByCode({
    code: params.code,
    redirectUri: params.redirectUri,
    scopes: scopes.split(" "),
  });

  // A questo punto MSAL ha popolato la cache (access token, refresh token, account, ecc.)
  const serializedCache = msalApp.getTokenCache().serialize();

  return { serializedCache, scopes };
}

/* =======================
   Handler
======================= */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).send("Method not allowed");

  try {
    /* =======================
       Parametri OAuth
    ======================= */
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;

    const msError = typeof req.query.error === "string" ? req.query.error : null;
    const msErrorDesc =
      typeof req.query.error_description === "string" ? req.query.error_description : null;

    if (msError) return redirectErr(res, msErrorDesc || msError);
    if (!code || !state) return redirectErr(res, "Parametri OAuth mancanti");

    /* =======================
       1) Recupero user_id dallo state
       (salvato in fase di connect)
    ======================= */
    const { data: stateRow, error: stateErr } = await supabaseAdmin
      .from("tbmicrosoft_settings")
      .select("user_id")
      .eq("m365_oauth_state", state)
      .single();

    if (stateErr || !stateRow?.user_id) {
      return redirectErr(res, "State OAuth non valido o scaduto");
    }

    const userId = stateRow.user_id;

    /* =======================
       2) Recupero studio_id
    ======================= */
    const { data: userRow, error: userErr } = await supabaseAdmin
      .from("tbutenti")
      .select("studio_id")
      .eq("id", userId)
      .maybeSingle();

    if (userErr || !userRow?.studio_id) {
      return redirectErr(res, "Studio utente non trovato");
    }

    const studioId = userRow.studio_id;

    /* =======================
       3) Config Microsoft 365 (client credentials)
       NB: allinea il nome tabella al resto del progetto.
       Qui uso tbmicrosoft_settings (come nel graph service).
    ======================= */
   // ✅ 3) Leggi config studio
const { data: cfg, error: cfgErr } = await supabaseAdmin
  .from("microsoft365_config")
  .select("client_id, tenant_id, client_secret, enabled")
  .eq("studio_id", studioId)
  .maybeSingle();

console.log("CFG ERR:", cfgErr);
console.log("CFG KEYS:", cfg ? Object.keys(cfg) : null);
console.log("CLIENT_ID OK:", !!cfg?.client_id, "LEN:", cfg?.client_id?.length);
console.log("CLIENT_SECRET OK:", !!cfg?.client_secret, "LEN:", cfg?.client_secret?.length);
     
if (cfgErr || !cfg?.client_id || !cfg?.client_secret) {
  return res.redirect(
    "/microsoft365?error=true&message=" +
      encodeURIComponent("Configurazione Microsoft 365 incompleta")
  );
}

if (cfg.enabled === false) {
  return res.redirect(
    "/microsoft365?error=true&message=" +
      encodeURIComponent("Microsoft 365 disabilitato per lo studio")
  );
}

    const tenantId = cfg.tenant_id || "common";
    const redirectUri = `${appBaseUrl(req)}/api/microsoft365/callback`;
    const clientSecret = decrypt(cfg.client_secret);

console.log("[m365] clientSecret len:", clientSecret?.length);
console.log("[m365] clientSecret starts:", (clientSecret || "").slice(0, 4));
     
    /* =======================
       4) Exchange CODE → MSAL token cache (vera)
       (così poi graphApiCall può fare acquireTokenSilent)
    ======================= */
    const { serializedCache, scopes } = await buildMsalSerializedCache({
      clientId: cfg.client_id,
      tenantId,
      clientSecret,
      redirectUri,
      code,
    });

    const encryptedCache = encrypt(serializedCache);

    /* =======================
       5) Salvataggio token utente
    ======================= */
    const { error: upErr } = await supabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .upsert(
        {
          studio_id: studioId,
          user_id: userId,
          token_cache_encrypted: encryptedCache,
          scopes,
          connected_at: new Date().toISOString(),
          revoked_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "studio_id,user_id" }
      );

    if (upErr) {
      return redirectErr(res, `Errore DB token: ${upErr.message}`);
    }

    /* =======================
       6) Cleanup OAuth state
    ======================= */
    await supabaseAdmin
      .from("tbmicrosoft_settings")
      .update({
        m365_oauth_state: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return redirectOk(res);
  } catch (e: any) {
    console.error("[m365 callback]", e);
    return redirectErr(res, e?.message || "Errore callback Microsoft 365");
  }
}
