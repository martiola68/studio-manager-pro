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
 * contro authority "common" e NON contro il tenant fisso di configurazione studio.
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

  const graphScopes = [
    "User.Read",
    "Calendars.ReadWrite",
    "Mail.Send",
  ];

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
    /* =======================
       Parametri OAuth
    ======================= */
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
       1) Recupero user_id dallo state
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
       3) Config Microsoft 365 studio
    ======================= */
    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("microsoft365_config")
      .select("client_id, tenant_id, client_secret, enabled")
      .eq("studio_id", studioId)
      .maybeSingle();

    console.log("CFG ERR:", cfgErr);
    console.log("CFG KEYS:", cfg ? Object.keys(cfg) : null);
    console.log(
      "CLIENT_ID OK:",
      !!cfg?.client_id,
      "LEN:",
      cfg?.client_id?.length
    );
    console.log(
      "CLIENT_SECRET OK:",
      !!cfg?.client_secret,
      "LEN:",
      cfg?.client_secret?.length
    );

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

    /**
     * FIX MULTITENANT:
     * NON usare cfg.tenant_id per il token exchange del code.
     * Il code può provenire da tenant diversi, quindi usiamo "common".
     */
    const redirectUri = `${appBaseUrl(req)}/api/microsoft365/callback`;
    const clientSecret = getDecryptedClientSecret(cfg.client_secret);

    console.log("[m365] redirectUri:", redirectUri);
    console.log("[m365] configured tenant_id:", cfg.tenant_id || null);
    console.log("[m365] token authority: common");
    console.log("[m365] clientSecret len:", clientSecret?.length);
    console.log(
      "[m365] clientSecret starts:",
      (clientSecret || "").slice(0, 4)
    );

    /* =======================
       4) Exchange CODE -> token cache MSAL
    ======================= */
    const { serializedCache, scopes } = await buildMsalSerializedCache({
      clientId: cfg.client_id,
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
    return redirectErr(
      res,
      e?.message || "Errore callback Microsoft 365"
    );
  }
}
