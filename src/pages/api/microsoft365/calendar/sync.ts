// src/pages/api/microsoft365/calendar/sync.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/encryption365";
import { ConfidentialClientApplication, LogLevel, AccountInfo } from "@azure/msal-node";
import { getDecryptedClientSecret } from "../graph";

function getBearerToken(req: NextApiRequest): string | null {
  const header =
    typeof req.headers.authorization === "string"
      ? req.headers.authorization
      : "";

  if (!header) return null;

  const lower = header.toLowerCase();
  if (!lower.startsWith("bearer ")) return null;

  const token = header.slice(7).trim();
  return token || null;
}

async function getAuthUser(req: NextApiRequest) {
  const token = getBearerToken(req);
  if (!token) return { error: "Missing Authorization Bearer token" as const };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { error: "Utente non autenticato" as const };

  return { user: data.user, token };
}

async function getUtenteStudio(authUser: { id: string; email?: string | null }) {
  const { data: utente, error } = await supabaseAdmin
    .from("tbutenti")
    .select("id, studio_id, email")
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

    return {
      accessToken: result.accessToken,
      account,
      newSerializedCache: opts.msalApp.getTokenCache().serialize(),
    };
  } catch (e: any) {
    return {
      error:
        "Impossibile ottenere token silent: riconnetti Microsoft 365 (token scaduto o consenso mancante)" as const,
      details: e?.message ?? String(e),
    };
  }
}

async function persistCacheIfChanged(
  studioId: string,
  userId: string,
  oldSerialized: string,
  newSerialized: string
) {
  if (!newSerialized || newSerialized === oldSerialized) return;

  const newEncryptedCache = encrypt(newSerialized);

  await supabaseAdmin
    .from("tbmicrosoft365_user_tokens")
    .update({
      token_cache_encrypted: newEncryptedCache,
      updated_at: new Date().toISOString(),
    })
    .eq("studio_id", studioId)
    .eq("user_id", userId);
}

type TokenUserRow = {
  user_id: string;
  token_cache_encrypted: string;
  revoked_at: string | null;
  microsoft_connection_id: string | null;
};

function buildCalendarViewUrl(rangeDays: number) {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + rangeDays);

  return (
    `https://graph.microsoft.com/v1.0/me/calendarView` +
    `?startDateTime=${encodeURIComponent(start.toISOString())}` +
    `&endDateTime=${encodeURIComponent(end.toISOString())}` +
    `&$top=50` +
    `&$orderby=start/dateTime`
  );
}

function getSyncStartIso() {
  return new Date().toISOString();
}

function getSyncEndIso(rangeDays: number) {
  const end = new Date();
  end.setDate(end.getDate() + rangeDays);
  return end.toISOString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const auth = await getAuthUser(req);
    if ("error" in auth) return res.status(401).json({ error: auth.error });

    const mapped = await getUtenteStudio({ id: auth.user.id, email: auth.user.email });
    if ("error" in mapped) return res.status(400).json({ error: mapped.error });

    const requesterUserId = mapped.utente.id;
    const studioId = mapped.utente.studio_id;

    const cfgRes = await getM365Config(studioId);
    if ("error" in cfgRes) return res.status(400).json({ error: cfgRes.error });

    const tenantId = cfgRes.cfg.tenant_id || "common";
    const clientSecret = getDecryptedClientSecret(cfgRes.cfg.client_secret);
    if (!clientSecret) {
      return res.status(400).json({ error: "client_secret mancante in configurazione Microsoft 365" });
    }

    const { data: tokenUsers, error: tokenUsersErr } = await supabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .select("user_id, token_cache_encrypted, revoked_at, microsoft_connection_id")
      .eq("studio_id", studioId)
      .is("revoked_at", null)
      .not("microsoft_connection_id", "is", null);

    if (tokenUsersErr) {
      return res.status(500).json({
        error: "Errore lettura utenti Microsoft",
        details: tokenUsersErr.message,
      });
    }

    const rows = (tokenUsers || []) as TokenUserRow[];

    if (rows.length === 0) {
      return res.status(200).json({
        ok: true,
        studio_id: studioId,
        users_processed: 0,
        totalFetched: 0,
        totalSaved: 0,
        totalDeleted: 0,
        perUser: [],
        errors: [],
        message: "Nessun utente con connessione Microsoft attiva nello studio.",
      });
    }

    const scopes = ["User.Read", "Calendars.ReadWrite", "Mail.Send"];
    const RANGE_DAYS = 60;

    let totalFetched = 0;
    let totalSaved = 0;
    let totalDeleted = 0;

    const perUser: Array<{
      user_id: string;
      ok: boolean;
      fetched?: number;
      saved?: number;
      deleted?: number;
      error?: string;
    }> = [];

    const errors: Array<{ user_id: string; event_id?: string; message: string }> = [];

    for (const row of rows) {
      const targetUserId = row.user_id;

      try {
        const oldSerializedCache = decrypt(row.token_cache_encrypted);

        if (!row.microsoft_connection_id) {
          perUser.push({
            user_id: targetUserId,
            ok: false,
            error: "microsoft_connection_id mancante sul token",
          });
          continue;
        }

        const { data: connection, error: connectionError } = await supabaseAdmin
          .from("microsoft365_connections")
          .select("tenant_id, client_id, client_secret")
          .eq("id", row.microsoft_connection_id)
          .eq("studio_id", studioId)
          .eq("enabled", true)
          .maybeSingle();

        if (
          connectionError ||
          !connection?.client_id ||
          !connection?.tenant_id ||
          !connection?.client_secret
        ) {
          perUser.push({
            user_id: targetUserId,
            ok: false,
            error: "Connessione Microsoft non trovata o incompleta",
          });
          continue;
        }

        const connectionClientSecret = getDecryptedClientSecret(connection.client_secret);

        const msalApp = buildMsalApp({
          clientId: connection.client_id,
          tenantId: connection.tenant_id || tenantId,
          clientSecret: connectionClientSecret || clientSecret,
        });

        const tokenRes = await acquireAccessTokenFromCache({
          msalApp,
          serializedCache: oldSerializedCache,
          scopes,
        });

        if ("error" in tokenRes) {
          perUser.push({ user_id: targetUserId, ok: false, error: tokenRes.error });
          continue;
        }

        let graphUrl = buildCalendarViewUrl(RANGE_DAYS);

        let fetchedThisUser = 0;
        let savedThisUser = 0;
        let deletedThisUser = 0;

        const microsoftEventIds = new Set<string>();

        while (graphUrl) {
          const graphRes = await fetch(graphUrl, {
            headers: {
              Authorization: `Bearer ${tokenRes.accessToken}`,
              Accept: "application/json",
              Prefer: 'outlook.timezone="W. Europe Standard Time"',
            },
          });

          const body = await graphRes.json();

          if (!graphRes.ok) {
            throw new Error(`Graph error ${graphRes.status}: ${JSON.stringify(body).slice(0, 300)}`);
          }

          const events = Array.isArray(body?.value) ? body.value : [];
          fetchedThisUser += events.length;

          for (const e of events) {
            if (!studioId || !targetUserId) {
              errors.push({
                user_id: targetUserId || "MISSING",
                message: "SALVATAGGIO BLOCCATO: studio_id o utente_id mancante",
              });
              continue;
            }

            if (!e?.id) continue;

            microsoftEventIds.add(e.id);

            if (!e?.start?.dateTime || !e?.end?.dateTime) continue;

            const isAllDay = !!e.isAllDay;
            const startDateTime = e.start?.dateTime ?? null;
            const endDateTime = e.end?.dateTime ?? null;

            const oraInizio = isAllDay ? null : startDateTime?.substring(11, 19) ?? null;
            const oraFine = isAllDay ? null : endDateTime?.substring(11, 19) ?? null;

            const agendaPayload = {
              titolo: e.subject || "(senza titolo)",
              descrizione: e.bodyPreview || null,

              data_inizio: startDateTime,
              data_fine: endDateTime,

              ora_inizio: oraInizio,
              ora_fine: oraFine,

              tutto_giorno: isAllDay,
              luogo: e.location?.displayName || null,

              microsoft_event_id: e.id,
              provider: "microsoft",
              external_id: e.id,

              studio_id: studioId,
              utente_id: targetUserId,

              outlook_synced: true,

              riunione_teams: !!e.isOnlineMeeting,
              link_teams: e.onlineMeetingUrl || null,

              updated_at: new Date().toISOString(),
            };

            const { error: upErr } = await supabaseAdmin
              .from("tbagenda")
              .upsert(agendaPayload, { onConflict: "provider,external_id" });

            if (upErr) {
              errors.push({
                user_id: targetUserId,
                event_id: e.id,
                message: upErr.message,
              });
            } else {
              savedThisUser++;
            }
          }

          graphUrl = body?.["@odata.nextLink"] || "";
        }

        const { data: localEvents, error: localEventsError } = await supabaseAdmin
          .from("tbagenda")
          .select("id, microsoft_event_id, external_id")
          .eq("studio_id", studioId)
          .eq("utente_id", targetUserId)
          .eq("provider", "microsoft")
          .gte("data_inizio", getSyncStartIso())
          .lte("data_inizio", getSyncEndIso(RANGE_DAYS));

        if (localEventsError) {
          errors.push({
            user_id: targetUserId,
            message: `Errore lettura eventi locali Microsoft: ${localEventsError.message}`,
          });
        } else {
          const idsToDelete = (localEvents || [])
            .filter((item: any) => {
              const externalId = item.external_id || item.microsoft_event_id;
              return externalId && !microsoftEventIds.has(externalId);
            })
            .map((item: any) => item.id);

          if (idsToDelete.length > 0) {
            const { error: deleteError } = await supabaseAdmin
              .from("tbagenda")
              .delete()
              .in("id", idsToDelete);

            if (deleteError) {
              errors.push({
                user_id: targetUserId,
                message: `Errore eliminazione eventi cancellati da Outlook: ${deleteError.message}`,
              });
            } else {
              deletedThisUser = idsToDelete.length;
            }
          }
        }

        await persistCacheIfChanged(
          studioId,
          targetUserId,
          oldSerializedCache,
          tokenRes.newSerializedCache
        );

        totalFetched += fetchedThisUser;
        totalSaved += savedThisUser;
        totalDeleted += deletedThisUser;

        perUser.push({
          user_id: targetUserId,
          ok: true,
          fetched: fetchedThisUser,
          saved: savedThisUser,
          deleted: deletedThisUser,
        });
      } catch (e: any) {
        perUser.push({
          user_id: targetUserId,
          ok: false,
          error: e?.message || String(e),
        });
      }
    }

    return res.status(200).json({
      ok: true,
      studio_id: studioId,
      requested_by: requesterUserId,
      users_processed: rows.length,
      range_days: RANGE_DAYS,
      totalFetched,
      totalSaved,
      totalDeleted,
      updated: totalSaved,
      deleted: totalDeleted,
      perUser,
      errors,
    });
  } catch (e: any) {
    console.error("[calendar/sync]", e);
    return res.status(500).json({ error: e?.message || "Errore interno sync" });
  }
}
