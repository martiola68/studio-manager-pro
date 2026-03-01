import type { NextApiRequest, NextApiResponse } from "next"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { encrypt, decrypt } from "@/lib/encryption365"

/* =======================
   Utils
======================= */

function appBaseUrl(req: NextApiRequest) {
  const proto =
    (req.headers["x-forwarded-proto"] as string) ||
    (req.headers["x-forwarded-protocol"] as string) ||
    "https"

  const host =
    (req.headers["x-forwarded-host"] as string) ||
    req.headers.host

  return `${proto}://${host}`
}

function redirectOk(res: NextApiResponse) {
  res.writeHead(302, {
    Location: "/microsoft365?m365=connected",
  })
  res.end()
}

function redirectErr(res: NextApiResponse, msg: string) {
  const m = encodeURIComponent(msg)
  res.writeHead(302, {
    Location: `/microsoft365?error=true&message=${m}`,
  })
  res.end()
}

/* =======================
   Handler
======================= */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed")
  }

  try {
    /* =======================
       Parametri OAuth
    ======================= */
    const code = typeof req.query.code === "string" ? req.query.code : null
    const state = typeof req.query.state === "string" ? req.query.state : null

    const msError =
      typeof req.query.error === "string" ? req.query.error : null

    const msErrorDesc =
      typeof req.query.error_description === "string"
        ? req.query.error_description
        : null

    if (msError) {
      return redirectErr(res, msErrorDesc || msError)
    }

    if (!code || !state) {
      return redirectErr(res, "Parametri OAuth mancanti")
    }

    /* =======================
       1) Recupero user_id dallo state
       (salvato in fase di connect)
    ======================= */
    const { data: stateRow, error: stateErr } = await supabaseAdmin
      .from("tbmicrosoft_settings")
      .select("user_id")
      .eq("m365_oauth_state", state)
      .maybeSingle()

    if (stateErr || !stateRow?.user_id) {
      return redirectErr(res, "State OAuth non valido o scaduto")
    }

    const userId = stateRow.user_id

    /* =======================
       2) Recupero studio_id
    ======================= */
    const { data: userRow, error: userErr } = await supabaseAdmin
      .from("tbutenti")
      .select("studio_id")
      .eq("id", userId)
      .maybeSingle()

    if (userErr || !userRow?.studio_id) {
      return redirectErr(res, "Studio utente non trovato")
    }

    const studioId = userRow.studio_id

    /* =======================
       3) Config Microsoft 365
    ======================= */
    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("microsoft365_config")
      .select("client_id, tenant_id, client_secret, enabled")
      .eq("studio_id", studioId)
      .maybeSingle()

    if (cfgErr || !cfg?.client_id || !cfg.client_secret) {
      return redirectErr(res, "Configurazione Microsoft 365 incompleta")
    }

    if (cfg.enabled === false) {
      return redirectErr(res, "Microsoft 365 disabilitato per lo studio")
    }

    const tenant = cfg.tenant_id || "common"

    const redirectUri = `${appBaseUrl(req)}/api/m365/callback`

    /* =======================
       4) Exchange CODE → TOKEN
    ======================= */
    const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`

    const tokenResp = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: cfg.client_id,
        client_secret: decrypt(cfg.client_secret),
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    })

    const tokenJson = await tokenResp.json()

    if (!tokenResp.ok || !tokenJson.access_token) {
      return redirectErr(
        res,
        tokenJson?.error_description ||
          tokenJson?.error ||
          "Token exchange fallito"
      )
    }

    /* =======================
       5) Costruzione token cache
    ======================= */
    const now = Date.now()

    const tokenCache = {
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token || null,
      scope: tokenJson.scope || null,
      token_type: tokenJson.token_type || "Bearer",
      expires_at: new Date(
        now + (tokenJson.expires_in ?? 3600) * 1000
      ).toISOString(),
      obtained_at: new Date(now).toISOString(),
    }

    const encrypted = encrypt(JSON.stringify(tokenCache))

    /* =======================
       6) Salvataggio token utente
    ======================= */
    const { error: upErr } = await supabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .upsert(
        {
          studio_id: studioId,
          user_id: userId,
          token_cache_encrypted: encrypted,
          scopes: tokenCache.scope,
          connected_at: new Date().toISOString(),
          revoked_at: null,
        },
        { onConflict: "studio_id,user_id" }
      )

    if (upErr) {
      return redirectErr(res, `Errore DB token: ${upErr.message}`)
    }

    /* =======================
       7) Cleanup OAuth state
    ======================= */
    await supabaseAdmin
      .from("tbmicrosoft_settings")
      .update({
        m365_oauth_state: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)

    /* =======================
       OK
    ======================= */
    return redirectOk(res)
  } catch (e: any) {
    console.error("[m365 callback]", e)
    return redirectErr(res, e?.message || "Errore callback Microsoft 365")
  }
}
