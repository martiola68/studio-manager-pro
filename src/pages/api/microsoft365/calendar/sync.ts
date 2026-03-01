import type { NextApiRequest, NextApiResponse } from "next"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { decrypt, encrypt } from "@/lib/encryption365"

/* =======================
   TIPI
======================= */

type TokenCache = {
  access_token: string
  refresh_token: string | null
  scope: string | null
  token_type: string | null
  expires_at: string
  obtained_at: string
}

/* =======================
   UTILS
======================= */

function getBearerToken(req: NextApiRequest) {
  const h = req.headers.authorization || ""
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m?.[1] || null
}

function iso(d: Date) {
  return d.toISOString()
}

async function graphFetch(accessToken: string, url: string) {
  const r = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: 'outlook.timezone="Europe/Rome"',
    },
  })

  const data = await r.json().catch(() => null)
  return { ok: r.ok, status: r.status, data }
}

/* =======================
   REFRESH TOKEN
======================= */

async function refreshAccessToken(studioId: string, userId: string) {
  const { data: cfg } = await supabaseAdmin
    .from("microsoft365_config")
    .select("client_id, tenant_id, client_secret, enabled")
    .eq("studio_id", studioId)
    .maybeSingle()

  if (!cfg?.enabled) throw new Error("Microsoft 365 non abilitato")
  if (!cfg.client_id || !cfg.client_secret) throw new Error("Config M365 incompleta")

  const { data: tokRow } = await supabaseAdmin
    .from("tbmicrosoft365_user_tokens")
    .select("token_cache_encrypted")
    .eq("studio_id", studioId)
    .eq("user_id", userId)
    .maybeSingle()

  if (!tokRow?.token_cache_encrypted) throw new Error("Token mancante")

  const cache = JSON.parse(decrypt(tokRow.token_cache_encrypted)) as TokenCache
  if (!cache.refresh_token) throw new Error("Refresh token mancante")

  const tenant = cfg.tenant_id || "common"
  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.client_id,
      client_secret: decrypt(cfg.client_secret),
      grant_type: "refresh_token",
      refresh_token: cache.refresh_token,
    }),
  })

  const json = await resp.json()
  if (!resp.ok || !json.access_token) {
    throw new Error(json?.error_description || "Refresh token fallito")
  }

  const now = Date.now()
  const newCache: TokenCache = {
    access_token: json.access_token,
    refresh_token: json.refresh_token || cache.refresh_token,
    scope: json.scope || cache.scope,
    token_type: json.token_type || "Bearer",
    expires_at: new Date(now + (json.expires_in ?? 3600) * 1000).toISOString(),
    obtained_at: new Date(now).toISOString(),
  }

  await supabaseAdmin
    .from("tbmicrosoft365_user_tokens")
    .update({
      token_cache_encrypted: encrypt(JSON.stringify(newCache)),
      scopes: newCache.scope,
      updated_at: iso(new Date()),
      revoked_at: null,
    })
    .eq("studio_id", studioId)
    .eq("user_id", userId)

  return newCache.access_token
}

/* =======================
   HANDLER
======================= */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    /* ===== AUTH ===== */
    const bearer = getBearerToken(req)
    if (!bearer) return res.status(401).json({ error: "Missing token" })

    const { data: auth } = await supabaseAdmin.auth.getUser(bearer)
    if (!auth?.user) return res.status(401).json({ error: "Unauthorized" })

    /* ===== TROVA UTENTE + STUDIO ===== */
    const { data: utente } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id")
      .or(`id.eq.${auth.user.id},email.eq.${auth.user.email}`)
      .maybeSingle()

    if (!utente?.studio_id) {
      return res.status(400).json({ error: "Studio non trovato" })
    }

    const userId = utente.id
    const studioId = utente.studio_id

    /* ===== TOKEN ===== */
    const { data: tok } = await supabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .select("token_cache_encrypted, revoked_at")
      .eq("studio_id", studioId)
      .eq("user_id", userId)
      .maybeSingle()

    if (!tok?.token_cache_encrypted || tok.revoked_at) {
      return res.status(400).json({ error: "Account Microsoft non connesso" })
    }

    let accessToken = (JSON.parse(decrypt(tok.token_cache_encrypted)) as TokenCache).access_token

    /* ===== RANGE ===== */
    const start = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const end = new Date(Date.now() + 90 * 24 * 3600 * 1000)

    /* ===== GRAPH ===== */
    let url =
      "https://graph.microsoft.com/v1.0/me/calendarView?" +
      new URLSearchParams({
        startDateTime: iso(start),
        endDateTime: iso(end),
        $top: "200",
        $orderby: "start/dateTime",
        $select:
          "id,subject,bodyPreview,start,end,isAllDay,location,webLink,lastModifiedDateTime",
      }).toString()

    const events: any[] = []

    while (url) {
      let g = await graphFetch(accessToken, url)

      if (!g.ok && (g.status === 401 || g.status === 403)) {
        accessToken = await refreshAccessToken(studioId, userId)
        g = await graphFetch(accessToken, url)
      }

      if (!g.ok) {
        return res.status(400).json({ error: g.data?.error?.message })
      }

      events.push(...(g.data?.value ?? []))
      url = g.data?.["@odata.nextLink"] ?? ""
    }

    /* ===== UPSERT tbagenda ===== */
    const rows = events.map((ev) => ({
      studio_id: studioId,
      utente_id: userId,

      external_id: ev.id,
      provider: "microsoft365",

      titolo: ev.subject ?? "",
      descrizione: ev.bodyPreview ?? null,

      data_inizio: ev.start?.dateTime
        ? new Date(ev.start.dateTime).toISOString()
        : null,

      data_fine: ev.end?.dateTime
        ? new Date(ev.end.dateTime).toISOString()
        : null,

      tutto_giorno: !!ev.isAllDay,
      luogo: ev.location?.displayName ?? null,

      updated_at: ev.lastModifiedDateTime
        ? new Date(ev.lastModifiedDateTime).toISOString()
        : new Date().toISOString(),
    }))

    const { error: upErr } = await supabaseAdmin
      .from("tbagenda")
      .upsert(rows, { onConflict: "provider,external_id" })

    if (upErr) {
      return res.status(400).json({ error: upErr.message })
    }

    return res.status(200).json({
      success: true,
      synced: rows.length,
    })
  } catch (e: any) {
    console.error("[calendar/sync]", e)
    return res.status(500).json({ error: e.message || "Errore interno" })
  }
}
