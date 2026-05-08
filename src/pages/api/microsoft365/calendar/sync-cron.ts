import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/encryption365";
import {
  ConfidentialClientApplication,
  LogLevel,
  AccountInfo,
} from "@azure/msal-node";
import { getDecryptedClientSecret } from "../graph";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

type TokenUserRow = {
  studio_id: string;
  user_id: string;
  token_cache_encrypted: string;
  revoked_at: string | null;
  microsoft_connection_id: string | null;
};

function buildMsalApp(params: {
  clientId: string;
  tenantId: string;
  clientSecret: string;
}) {
  return new ConfidentialClientApplication({
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
    return { error: "Account MSAL non trovato in cache" as const };
  }

  try {
    const result = await opts.msalApp.acquireTokenSilent({
      account,
      scopes: opts.scopes,
    });

    if (!result?.accessToken) {
      return { error: "Access token mancante" as const };
    }

    return {
      accessToken: result.accessToken,
      newSerializedCache: opts.msalApp.getTokenCache().serialize(),
    };
  } catch (e: any) {
    return {
      error: "Impossibile ottenere token silent" as const,
      details: e?.message ?? String(e),
    };
  }
}

async function persistCacheIfChanged(params: {
  studioId: string;
  userId: string;
  microsoftConnectionId: string;
  oldSerialized: string;
  newSerialized: string;
}) {
  if (!params.newSerialized || params.newSerialized === params.oldSerialized) {
    return;
  }

  const newEncryptedCache = encrypt(params.newSerialized);

  await supabaseAdmin
    .from("tbmicrosoft365_user_tokens")
    .update({
      token_cache_encrypted: newEncryptedCache,
      updated_at: new Date().toISOString(),
    })
    .eq("studio_id", params.studioId)
    .eq("user_id", params.userId)
    .eq("microsoft_connection_id", params.microsoftConnectionId);
}

function buildCalendarViewUrl(rangeDays: number) {
  const start = new Date();
  const end = new Date();

  end.setDate(end.getDate() + rangeDays);

  const selectFields = [
    "id",
    "subject",
    "bodyPreview",
    "start",
    "end",
    "isAllDay",
    "location",
    "isOnlineMeeting",
    "onlineMeetingUrl",
  ].join(",");

  return (
    `https://graph.microsoft.com/v1.0/me/calendarView` +
    `?startDateTime=${encodeURIComponent(start.toISOString())}` +
    `&endDateTime=${encodeURIComponent(end.toISOString())}` +
    `&$select=${encodeURIComponent(selectFields)}` +
    `&$top=100` +
    `&$orderby=start/dateTime`
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Metodo non consentito",
    });
  }

  const querySecret =
    typeof req.query.secret === "string" ? req.query.secret : null;

  const authHeader = req.headers.authorization;

  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const receivedSecret = querySecret || bearerToken;

  if (!process.env.CRON_SECRET || receivedSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({
      ok: false,
      error: "Non autorizzato",
    });
  }

  try {
    const filterUserId =
  typeof req.query.userId === "string" ? req.query.userId : null;

const filterConnectionId =
  typeof req.query.microsoftConnectionId === "string"
    ? req.query.microsoftConnectionId
    : null;

let tokenQuery = supabaseAdmin
  .from("tbmicrosoft365_user_tokens")
  .select(
    "studio_id, user_id, token_cache_encrypted, revoked_at, microsoft_connection_id"
  )
  .is("revoked_at", null)
  .not("microsoft_connection_id", "is", null);

if (filterUserId) {
  tokenQuery = tokenQuery.eq("user_id", filterUserId);
}

if (filterConnectionId) {
  tokenQuery = tokenQuery.eq("microsoft_connection_id", filterConnectionId);
}

const { data: tokenUsers, error: tokenUsersErr } = await tokenQuery;
    if (tokenUsersErr) {
      return res.status(500).json({
        ok: false,
        error: tokenUsersErr.message,
      });
    }

    const rows = ((tokenUsers || []) as unknown) as TokenUserRow[];

    const scopes = ["User.Read", "Calendars.ReadWrite", "Mail.Send"];
    const RANGE_DAYS = 20;

    let totalFetched = 0;
    let totalSaved = 0;

    const perUser: Array<{
      studio_id: string;
      user_id: string;
      ok: boolean;
      fetched?: number;
      saved?: number;
      error?: string;
    }> = [];

    const errors: Array<{
      studio_id: string;
      user_id: string;
      event_id?: string;
      message: string;
    }> = [];

    for (const row of rows) {
      const studioId = row.studio_id;
      const targetUserId = row.user_id;

      try {
        if (!row.microsoft_connection_id) {
          perUser.push({
            studio_id: studioId,
            user_id: targetUserId,
            ok: false,
            error: "microsoft_connection_id mancante",
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
            studio_id: studioId,
            user_id: targetUserId,
            ok: false,
            error: "Connessione Microsoft non trovata o incompleta",
          });
          continue;
        }

        const oldSerializedCache = decrypt(row.token_cache_encrypted);

        const msalApp = buildMsalApp({
          clientId: connection.client_id,
          tenantId: connection.tenant_id,
          clientSecret: getDecryptedClientSecret(connection.client_secret),
        });

        const tokenRes = await acquireAccessTokenFromCache({
          msalApp,
          serializedCache: oldSerializedCache,
          scopes,
        });

        if ("error" in tokenRes) {
          perUser.push({
            studio_id: studioId,
            user_id: targetUserId,
            ok: false,
            error: tokenRes.error,
          });
          continue;
        }

        let graphUrl = buildCalendarViewUrl(RANGE_DAYS);

        let fetchedThisUser = 0;
        let savedThisUser = 0;

        const agendaPayloads: any[] = [];

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
    throw new Error(
      `Graph error ${graphRes.status}: ${JSON.stringify(body).slice(0, 300)}`
    );
  }

  const events = Array.isArray(body?.value) ? body.value : [];
  fetchedThisUser += events.length;

  for (const e of events) {
    if (!e?.id) continue;
    if (!e?.start?.dateTime || !e?.end?.dateTime) continue;

    const isAllDay = !!e.isAllDay;
    const startDateTime = e.start?.dateTime ?? null;
    const endDateTime = e.end?.dateTime ?? null;

    agendaPayloads.push({
      titolo: e.subject || "(senza titolo)",
      descrizione: e.bodyPreview || null,
      data_inizio: startDateTime,
      data_fine: endDateTime,
      ora_inizio: isAllDay ? null : startDateTime?.substring(11, 19) ?? null,
      ora_fine: isAllDay ? null : endDateTime?.substring(11, 19) ?? null,
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
    });
  }

  graphUrl = body?.["@odata.nextLink"] || "";
}

if (agendaPayloads.length > 0) {
  const { error: upsertBatchError } = await supabaseAdmin
    .from("tbagenda")
    .upsert(agendaPayloads, {
      onConflict: "provider,external_id",
    });

  if (upsertBatchError) {
    errors.push({
      studio_id: studioId,
      user_id: targetUserId,
      message: upsertBatchError.message,
    });
  } else {
    savedThisUser = agendaPayloads.length;
  }
}

        const microsoftEventIds = new Set(
  agendaPayloads
    .map((item) => item.external_id || item.microsoft_event_id)
    .filter(Boolean)
);

const syncStart = new Date();
syncStart.setHours(0, 0, 0, 0);

const syncEnd = new Date();
syncEnd.setDate(syncEnd.getDate() + RANGE_DAYS);
syncEnd.setHours(23, 59, 59, 999);

const { data: localEvents, error: localEventsError } = await supabaseAdmin
  .from("tbagenda")
  .select("id, microsoft_event_id, external_id")
  .eq("studio_id", studioId)
  .eq("utente_id", targetUserId)
  .eq("provider", "microsoft")
  .eq("outlook_synced", true)
  .gte("data_inizio", syncStart.toISOString())
  .lte("data_inizio", syncEnd.toISOString());

if (localEventsError) {
  errors.push({
    studio_id: studioId,
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
        studio_id: studioId,
        user_id: targetUserId,
        message: `Errore eliminazione eventi cancellati da Outlook: ${deleteError.message}`,
      });
    }
  }
}

await persistCacheIfChanged({
          studioId,
          userId: targetUserId,
          microsoftConnectionId: row.microsoft_connection_id,
          oldSerialized: oldSerializedCache,
          newSerialized: tokenRes.newSerializedCache,
        });

        totalFetched += fetchedThisUser;
        totalSaved += savedThisUser;

        perUser.push({
          studio_id: studioId,
          user_id: targetUserId,
          ok: true,
          fetched: fetchedThisUser,
          saved: savedThisUser,
        });
      } catch (e: any) {
        perUser.push({
          studio_id: studioId,
          user_id: targetUserId,
          ok: false,
          error: e?.message || String(e),
        });
      }
    }

    return res.status(200).json({
      ok: true,
      users_processed: rows.length,
      range_days: RANGE_DAYS,
      totalFetched,
      totalSaved,
      updated: totalSaved,
      perUser,
      errors,
    });
  } catch (e: any) {
    console.error("[calendar/sync-cron]", e);

    return res.status(500).json({
      ok: false,
      error: e?.message || "Errore interno sync cron calendario",
    });
  }
}
