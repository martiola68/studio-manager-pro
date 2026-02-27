import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/encryption365"; // <-- usa la tua encrypt AES-256-GCM

type TokenResponse = {
  token_type: string;
  scope?: string;
  expires_in?: number;
  ext_expires_in?: number;
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
};

function appBaseUrl(req: NextApiRequest) {
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
  return `${proto}://${host}`;
}

function redirectOk(res: NextApiResponse) {
  res.writeHead(302, { Location: "/impostazioni/microsoft365?m365=connected" });
  res.end();
}

function redirectErr(res: NextApiResponse, msg: string) {
  const m = encodeURIComponent(msg);
  res.writeHead(302, { Location: `/impostazioni/microsoft365?error=true&message=${m}` });
  res.end();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Microsoft chiama in GET
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;

    // errori OAuth di Microsoft
    const msErr = typeof req.query.error === "string" ? req.query.error : null;
    const msErrDesc = typeof req.query.error_description === "string" ? req.query.error_description : null;

    if (msErr) {
      return redirectErr(res, msErrDesc || msErr || "Errore Microsoft OAuth");
    }

    if (!code || !state) {
      return redirectErr(res, "Parametri OAuth mancanti (code/state)");
    }

    // 1) Trova user_id dal state salvato in tbmicrosoft_settings
    const { data: settings, error: sErr } = await supabaseAdmin
      .from("tbmicrosoft_settings")
      .select("user_id, m365_oauth_state, m365_code_verifier")
      .eq("m365_oauth_state", state)
      .maybeSingle();

    if (sErr) return redirectErr(res, `DB error (settings): ${sErr.message}`);
    if (!settings?.user_id || !settings?.m365_code_verifier) {
      return redirectErr(res, "State non valido o scaduto. Riprova la connessione.");
    }

    const userId = settings.user_id;
    const codeVerifier = settings.m365_code_verifier;

    // 2) Recupera studio_id dell'utente
    const { data: userRow, error: uErr } = await supabaseAdmin
      .from("tbutenti")
      .select("studio_id")
      .eq("id", userId)
      .single();

    if (uErr || !userRow?.studio_id) {
      return redirectErr(res, "Studio utente non trovato");
    }

    const studioId = userRow.studio_id;

    // 3) Recupera config studio (client_id + tenant_id)
    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("microsoft365_config")
      .select("client_id, tenant_id, enabled")
      .eq("studio_id", studioId)
      .maybeSingle();

    if (cfgErr) return redirectErr(res, `DB error (config): ${cfgErr.message}`);
    if (!cfg?.client_id) return redirectErr(res, "Configurazione Microsoft 365 mancante (client_id)");
    if (cfg.enabled === false) return redirectErr(res, "Microsoft 365 disabilitato per questo studio");

    const tenant = cfg.tenant_id || "common";
    const redirectUri = `${appBaseUrl(req)}/api/m365/callback`;

    // 4) Scambio code -> token (PKCE)
    const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

    const tokenParams = new URLSearchParams({
      client_id: cfg.client_id,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    const tokenResp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    const tokenJson = (await tokenResp.json().catch(() => null)) as TokenResponse | null;

    if (!tokenResp.ok || !tokenJson?.access_token) {
      const details =
        (tokenJson as any)?.error_description ||
        (tokenJson as any)?.error ||
        `HTTP ${tokenResp.status}`;
      return redirectErr(res, `Token exchange fallito: ${details}`);
    }

    // 5) Crea token cache (da cifrare)
    const now = Date.now();
    const expiresIn = Number(tokenJson.expires_in || 3600);
    const expiresAt = new Date(now + expiresIn * 1000).toISOString();

    const tokenCache = {
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token || null,
      id_token: tokenJson.id_token || null,
      scope: tokenJson.scope || null,
      token_type: tokenJson.token_type || "Bearer",
      expires_at: expiresAt,
      obtained_at: new Date(now).toISOString(),
    };

    const token_cache_encrypted = encrypt(JSON.stringify(tokenCache));
    const scopes = tokenJson.scope || null;

    // 6) Upsert tbmicrosoft365_user_tokens
    const { error: upErr } = await supabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .upsert(
        {
          studio_id: studioId,
          user_id: userId,
          token_cache_encrypted,
          scopes,
          connected_at: new Date().toISOString(),
          revoked_at: null,
        },
        { onConflict: "studio_id,user_id" }
      );

    if (upErr) {
      return redirectErr(res, `Salvataggio token fallito: ${upErr.message}`);
    }

    // 7) Pulisci state/verifier per evitare replay
    await supabaseAdmin
      .from("tbmicrosoft_settings")
      .update({
        m365_oauth_state: null,
        m365_code_verifier: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return redirectOk(res);
  } catch (e: any) {
    console.error("[m365 callback] fatal", e);
    return redirectErr(res, e?.message || "Errore callback");
  }
}
