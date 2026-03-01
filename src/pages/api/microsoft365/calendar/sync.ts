import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/encryption365";

type TokenCache = {
  access_token: string;
  refresh_token: string | null;
  scope: string | null;
  token_type: string | null;
  expires_at: string; // ISO
  obtained_at: string; // ISO
};

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

function iso(d: Date) {
  return d.toISOString();
}

async function graphFetch(accessToken: string, url: string) {
  const r = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: 'outlook.timezone="Europe/Rome"',
    },
  });

  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

async function refreshAccessToken(studioId: string, userId: string) {
  // 1) leggi config studio (client_id/tenant_id/secret)
  const { data: cfg, error: cfgErr } = await supabaseAdmin
    .from("microsoft365_config")
    .select("client_id, tenant_id, client_secret, enabled")
    .eq("studio_id", studioId)
    .maybeSingle();

  if (cfgErr) throw new Error(`Config read error: ${cfgErr.message}`);
  if (!cfg?.enabled) throw new Error("Microsoft 365 disabilitato per lo studio");
  if (!cfg.client_id || !cfg.client_secret) throw new Error("Config M365 incompleta");

  // 2) leggi token utente
  const { data: tokRow, error: tokErr } = await supabaseAdmin
    .from("tbmicrosoft365_user_tokens")
    .select("token_cache_encrypted")
    .eq("studio_id", studioId)
    .eq("user_id", userId)
    .maybeSingle();

  if (tokErr) throw new Error(`Token read error: ${tokErr.message}`);
  if (!tokRow?.token_cache_encrypted) throw new Error("Token utente mancante");

  const cache = JSON.parse(decrypt(tokRow.token_cache_encrypted)) as TokenCache;
  if (!cache.refresh_token) throw new Error("Refresh token mancante (offline_access?)");

  const tenant = cfg.tenant_id || "common";
  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

  const clientSecret = decrypt(cfg.client_secret);

  const body = new URLSearchParams({
    client_id: cfg.client_id,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: cache.refresh_token,
    // scope opzionale: se lo metti, deve includere quelli originali + offline_access
    // scope: "offline_access User.Read Mail.Read Calendars.Read Calendars.ReadWrite",
  });

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await resp.json().catch(() => null);

  if (!resp.ok || !json?.access_token) {
    const msg = json?.error_description || json?.error || `HTTP ${resp.status}`;
    throw new Error(`Refresh token fallito: ${msg}`);
  }

  const now = Date.now();
  const expiresAt = new Date(now + (json.expires_in ?? 3600) * 1000).toISOString();

  const newCache: TokenCache = {
    access_token: json.access_token,
    refresh_token: json.refresh_token || cache.refresh_token, // spesso non torna: tieni il vecchio
    scope: json.scope || cache.scope || null,
    token_type: json.token_type || cache.token_type || "Bearer",
    expires_at: expiresAt,
    obtained_at: new Date(now).toISOString(),
  };

  const encrypted = encrypt(JSON.stringify(newCache));

  const { error: upErr } = await supabaseAdmin
    .from("tbmicrosoft365_user_tokens")
    .update({
      token_cache_encrypted: encrypted,
      scopes: newCache.scope,
      updated_at: new Date().toISOString(),
      revoked_at: null,
    } as any)
    .eq("studio_id", studioId)
    .eq("user_id", userId);

  if (upErr) throw new Error(`Salvataggio token refresh fallito: ${upErr.message}`);

  return newCache.access_token;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // 0) auth utente (Supabase)
    const bearer = getBearerToken(req);
    if (!bearer) return res.status(401).json({ error: "Missing Authorization token" });

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(bearer);
    if (userErr || !userRes?.user) return res.status(401).json({ error: "Utente non autenticato" });

    const authUser = userRes.user;

    // 1) trova tbutenti (id o email fallback)
    let userId: string | null = null;
    let studioId: string | null = null;

    const byId = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id, email")
      .eq("id", authUser.id)
      .maybeSingle();

    if (byId.data?.studio_id) {
      userId = byId.data.id;
      studioId = byId.data.studio_id;
    } else if (authUser.email) {
      const byEmail = await supabaseAdmin
        .from("tbutenti")
        .select("id, studio_id, email")
        .eq("email", authUser.email)
        .maybeSingle();
      if (byEmail.data?.studio_id) {
        userId = byEmail.data.id;
        studioId = byEmail.data.studio_id;
      }
    }

    if (!userId || !studioId) {
      return res.status(400).json({ error: "Studio utente non trovato" });
    }

    // 2) leggi token delegato
    const { data: tok, error: tokErr } = await supabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .select("token_cache_encrypted, revoked_at")
      .eq("studio_id", studioId)
      .eq("user_id", userId)
      .maybeSingle();

    if (tokErr) return res.status(400).json({ error: tokErr.message });
    if (!tok?.token_cache_encrypted || tok.revoked_at) {
      return res.status(400).json({ error: "Account Microsoft non connesso" });
    }

    const cache = JSON.parse(decrypt(tok.token_cache_encrypted)) as TokenCache;
    let accessToken = cache.access_token;

    // 3) range sync (default: -30 giorni / +90 giorni)
    const body = (req.body ?? {}) as { start?: string; end?: string };
    const start = body.start ? new Date(body.start) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const end = body.end ? new Date(body.end) : new Date(Date.now() + 90 * 24 * 3600 * 1000);

    // 4) chiama Graph calendarView (meglio di /me/events per range)
    const base = "https://graph.microsoft.com/v1.0/me/calendarView";
    const params = new URLSearchParams({
      startDateTime: iso(start),
      endDateTime: iso(end),
      $top: "200",
      $orderby: "start/dateTime",
      $select:
        "id,subject,bodyPreview,start,end,isAllDay,location,organizer,attendees,webLink,lastModifiedDateTime,createdDateTime",
    });

    let url = `${base}?${params.toString()}`;

    let events: any[] = [];
    while (url) {
      let g = await graphFetch(accessToken, url);

      // se token scaduto → refresh e riprova 1 volta
      if (!g.ok && (g.status === 401 || g.status === 403)) {
        accessToken = await refreshAccessToken(studioId, userId);
        g = await graphFetch(accessToken, url);
      }

      if (!g.ok) {
        const msg = g.data?.error?.message || JSON.stringify(g.data);
        return res.status(400).json({ error: `Graph error: ${msg}` });
      }

      events = events.concat(g.data?.value ?? []);
      url = g.data?.["@odata.nextLink"] ?? "";
    }

    // 5) upsert su DB
    // =========================
    // ✅ ADATTA QUI (1 MINUTO)
    // =========================
    // Cambia i campi in base alle colonne REALI di tbagenda
    const rows = events.map((ev) => ({
      // consigliato tenere sempre:
      studio_id: studioId,
      user_id: userId,

      // identificatore esterno per upsert
      external_id: ev.id,

      titolo: ev.subject ?? "",
      descrizione: ev.bodyPreview ?? null,
      data_inizio: ev.start?.dateTime ? new Date(ev.start.dateTime).toISOString() : null,
      data_fine: ev.end?.dateTime ? new Date(ev.end.dateTime).toISOString() : null,
      tutto_giorno: !!ev.isAllDay,
      luogo: ev.location?.displayName ?? null,
      weblink: ev.webLink ?? null,
      provider: "microsoft365",
      last_modified_at: ev.lastModifiedDateTime ?? null,

      // utile: salvataggio raw per debug/audit
      raw: ev,
      updated_at: new Date().toISOString(),
    }));

    // ⚠️ se tbagenda NON ha questi campi, cambia mapping sopra.
    // ⚠️ se non hai vincolo unico su (studio_id,user_id,external_id), crealo o cambia onConflict.
    const { error: upErr } = await supabaseAdmin
      .from("tbagenda")
      .upsert(rows as any, { onConflict: "studio_id,user_id,external_id" });

    if (upErr) {
      return res.status(400).json({
        error:
          "Upsert fallito su tbagenda. Probabile mismatch colonne o onConflict. " +
          upErr.message,
      });
    }

    return res.status(200).json({
      success: true,
      synced: rows.length,
      range: { start: iso(start), end: iso(end) },
      redirectUriUsed: `${appBaseUrl(req)}/api/m365/callback`,
    });
  } catch (e: any) {
    console.error("[calendar/sync] fatal", e);
    return res.status(500).json({ error: e?.message || "Errore interno" });
  }
}
