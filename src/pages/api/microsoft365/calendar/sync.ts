// src/pages/api/microsoft365/calendar/sync.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/encryption365";
import { ConfidentialClientApplication, LogLevel, AccountInfo } from "@azure/msal-node";
import { getDecryptedClientSecret } from "../graph";

function getBearerToken(req: NextApiRequest): string | null {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function getAuthUser(req: NextApiRequest) {
  const token = getBearerToken(req);
  if (!token) return { error: "Missing Authorization Bearer token" as const };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { error: "Utente non autenticato" as const };

  return { user: data.user, token };
}

// Serve: studio_id + controllo "responsabile"
async function getUtenteStudio(authUser: { id: string; email?: string | null }) {
  const { data: utente, error } = await supabaseAdmin
    .from("tbutenti")
    .select("id, studio_id, email, responsabile")
    .or(`id.eq.${authUser.id},email.eq.${authUser.email}`)
    .maybeSingle();

  if (error || !utente?.studio_id) return { error: "Studio utente non trovato" as const };
  return { utente };
}

async function getM365Config(studioId: string) {
  const { data: cfg, error } = await supabaseAdmin
    .from("microsoft365_config")
    .select("client_id, tenant_id, client_secret, enabled")
    .eq("studio_id", studioId)
    .maybeSingle();

  if (error || !cfg?.client_id) return { error: "Configurazione Microsoft 365 incompleta" as const };
  if (cfg.enabled === false) return { error: "Microsoft 365 disabilitato per lo studio" as const };

  return { cfg };
}

function buildMsalApp(params: { clientId: string; tenantId: string; clientSecret: string }) {
  return new ConfidentialClientApplication({
    auth: {
      clientId: params.clientId,
      authority: `https://login.microsoftonline.com/${params.tenantId || "common"}`,
      clientSecret: params.clientSecret,
    },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Error,
        piiLoggingEnabled: false,
      },
    },
  });
}

async function acquireAccessTokenFromCache(opts: {
  msalApp: ConfidentialClientApplication;
  serializedCache: string;
  scopes: string[];
}) {
  opts.msalApp.getTokenCache().deserialize(opts.serializedCache);

  const accounts = await opts.msalApp.getTokenCache().getAllAccounts();
  const account: AccountInfo | undefined = accounts?.[0];

  if (!account) {
    return { error: "Account MSAL non trovato in cache: riconnetti Microsoft 365" as const };
  }

  try {
    const result = await opts.msalApp.acquireTokenSilent({
      account,
      scopes: opts.scopes,
    });

    if (!result?.accessToken) return { error: "Access token mancante" as const };

    const newSerializedCache = opts.msalApp.getTokenCache().serialize();
    return {
      accessToken: result.accessToken,
      account,
      newSerializedCache,
    };
  } catch (e: any) {
    return {
      error:
        "Impossibile ottenere token silent: riconnetti Microsoft 365 (token scaduto o consenso mancante)" as const,
      details: e?.message ?? String(e),
    };
  }
}

async function persistCacheIfChanged(studioId: string, userId: string, oldSerialized: string, newSerialized: string) {
  if (!newSerialized || newSerialized === oldSerialized) return;

  const newEncryptedCache = encrypt(newSerialized);

  await supabaseAdmin
    .from("tbmicrosoft365_user_tokens")
    .update({ token_cache_encrypted: newEncryptedCache, updated_at: new Date().toISOString() })
    .eq("studio_id", studioId)
    .eq("user_id", userId);
}

type TokenUserRow = {
  user_id: string;
  token_cache_encrypted: string;
  revoked_at: string | null;
};

function buildCalendarViewUrl(rangeDays: number) {
  const start = new Date(); // oggi
  const end = new Date();
  end.setDate(end.getDate() + rangeDays);

  const startIso = start.toISOString();
  const endIso = end.toISOString();

  // calendarView = eventi in un range date
  return (
    `https://graph.microsoft.com/v1.0/me/calendarView` +
    `?startDateTime=${encodeURIComponent(startIso)}` +
    `&endDateTime=${encodeURIComponent(endIso)}` +
    `&$top=50` +
    `&$orderby=start/dateTime`
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // 1) Auth utente (Supabase access token)
    const auth = await getAuthUser(req);
    if ("error" in auth) return res.status(401).json({ error: auth.error });

    // 2) Mappa su tbutenti + verifica responsabile
    const mapped = await getUtenteStudio({ id: auth.user.id, email: auth.user.email });
    if ("error" in mapped) return res.status(400).json({ error: mapped.error });

    const requesterUserId = mapped.utente.id;
    const studioId = mapped.utente.studio_id;

    if (!mapped.utente.responsabile) {
      return res.status(403).json({ error: "Permesso negato: solo il Responsabile può eseguire la sync dello studio." });
    }

    // 3) Config studio MSAL
    const cfgRes = await getM365Config(studioId);
    if ("error" in cfgRes) return res.status(400).json({ error: cfgRes.error });

    const tenantId = cfgRes.cfg.tenant_id || "common";
    const clientSecret = getDecryptedClientSecret(cfgRes.cfg.client_secret);
    if (!clientSecret) return res.status(400).json({ error: "client_secret mancante in configurazione Microsoft 365" });

    // 4) Prendi tutti gli utenti dello studio con token attivo
    const { data: tokenUsers, error: tokenUsersErr } = await supabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .select("user_id, token_cache_encrypted, revoked_at")
      .eq("studio_id", studioId)
      .is("revoked_at", null);

    if (tokenUsersErr) {
      return res.status(500).json({ error: "Errore lettura utenti Microsoft", details: tokenUsersErr.message });
    }

    const rows = (tokenUsers || []) as TokenUserRow[];

    if (rows.length === 0) {
      return res.status(200).json({
        ok: true,
        studio_id: studioId,
        users_processed: 0,
        totalFetched: 0,
        totalSaved: 0,
        perUser: [],
        errors: [],
        message: "Nessun utente con connessione Microsoft attiva nello studio.",
      });
    }

    // 5) Loop utenti: sync per ognuno
    const scopes = ["User.Read", "Calendars.ReadWrite"];
    const RANGE_DAYS = 60;

    let totalFetched = 0;
    let totalSaved = 0;

    const perUser: Array<{ user_id: string; ok: boolean; fetched?: number; saved?: number; error?: string }> = [];
    const errors: Array<{ user_id: string; event_id?: string; message: string }> = [];

    for (const row of rows) {
      const targetUserId = row.user_id;

      try {
        // A) Deserializza cache utente
        const oldSerializedCache = decrypt(row.token_cache_encrypted);

        // B) MSAL app
        const msalApp = buildMsalApp({
          clientId: cfgRes.cfg.client_id,
          tenantId,
          clientSecret,
        });

        // C) access token (silent)
        const tokenRes = await acquireAccessTokenFromCache({
          msalApp,
          serializedCache: oldSerializedCache,
          scopes,
        });

        if ("error" in tokenRes) {
          perUser.push({ user_id: targetUserId, ok: false, error: tokenRes.error });
          continue;
        }

        // D) Graph calendarView (oggi -> +60 giorni) con paginazione
        let graphUrl = buildCalendarViewUrl(RANGE_DAYS);

        let fetchedThisUser = 0;
        let savedThisUser = 0;

        while (graphUrl) {
          const graphRes = await fetch(graphUrl, {
            headers: {
              Authorization: `Bearer ${tokenRes.accessToken}`,
              Accept: "application/json",
            },
          });

          const body = await graphRes.json();

          if (!graphRes.ok) {
            throw new Error(`Graph error ${graphRes.status}: ${JSON.stringify(body).slice(0, 300)}`);
          }

          const events = Array.isArray(body?.value) ? body.value : [];
          fetchedThisUser += events.length;

          // E) Salva su tbagenda (chiave unica provider+external_id)
          for (const e of events) {
            const { error: upErr } = await supabaseAdmin
              .from("tbagenda")
              .upsert(
                {
                  titolo: e.subject || "(senza titolo)",
                  data_inizio: e.start?.dateTime,
                  data_fine: e.end?.dateTime,

                  // campi collegamento Microsoft
                  microsoft_event_id: e.id,
                  provider: "microsoft",
                  external_id: e.id,

                  // IMPORTANTI: legame con studio e utente
                  studio_id: studioId,
                  utente_id: targetUserId,

                  outlook_synced: true,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "provider,external_id" }
              );

            if (upErr) {
              errors.push({ user_id: targetUserId, event_id: e.id, message: upErr.message });
            } else {
              savedThisUser++;
            }
          }

          graphUrl = body?.["@odata.nextLink"] || "";
        }

        // F) Salva cache se cambiata
        await persistCacheIfChanged(studioId, targetUserId, oldSerializedCache, tokenRes.newSerializedCache);

        totalFetched += fetchedThisUser;
        totalSaved += savedThisUser;

        perUser.push({ user_id: targetUserId, ok: true, fetched: fetchedThisUser, saved: savedThisUser });
      } catch (e: any) {
        perUser.push({ user_id: targetUserId, ok: false, error: e?.message || String(e) });
      }
    }

    // 6) Risposta per UI
    return res.status(200).json({
      ok: true,
      studio_id: studioId,
      requested_by: requesterUserId,
      users_processed: rows.length,
      range_days: 60,
      totalFetched,
      totalSaved,
      perUser,
      errors,
    });
  } catch (e: any) {
    console.error("[calendar/sync]", e);
    return res.status(500).json({ error: e?.message || "Errore interno sync" });
  }
}
