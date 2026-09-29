import { randomUUID } from "crypto";
import { getMobileUser, mobileError, mobileSupabaseAdmin } from "@/lib/mobileApiAuth";

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)));
}

function graphLocalDateTime(isoValue: string): string {
  const d = new Date(isoValue);
  if (Number.isNaN(d.getTime())) throw new Error("Data evento non valida.");
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

async function graphCall(
  request: Request,
  userId: string,
  microsoftConnectionId: string,
  endpoint: string,
  method: string,
  body?: any
) {
  const auth = request.headers.get("authorization") || "";
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/microsoft365/graph`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
    },
    body: JSON.stringify({
      userId,
      endpoint,
      method,
      microsoftConnectionId,
      body: body == null ? undefined : JSON.stringify(body),
    }),
  });

  if (res.status === 204) return {};
  const raw = await res.text();
  let parsed: any = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = { error: raw };
  }
  if (!res.ok) {
    throw new Error(parsed?.error || parsed?.message || `Errore Microsoft Graph (${res.status})`);
  }
  return parsed;
}

async function syncOrganizerRowToOutlook(
  request: Request,
  row: any,
  connectionId: string
) {
  const graphEvent = {
    subject: row.titolo || "",
    start: {
      dateTime: graphLocalDateTime(row.data_inizio),
      timeZone: "Europe/Rome",
    },
    end: {
      dateTime: graphLocalDateTime(row.data_fine),
      timeZone: "Europe/Rome",
    },
    isAllDay: Boolean(row.tutto_giorno),
    body: {
      contentType: "Text",
      content: row.descrizione || "",
    },
    location: row.luogo ? { displayName: row.luogo } : undefined,
  };

  const created = await graphCall(
    request,
    String(row.utente_id),
    connectionId,
    "/me/calendar/events",
    "POST",
    graphEvent
  );

  if (!created?.id) throw new Error("Evento Outlook creato senza identificativo.");

  const { error } = await mobileSupabaseAdmin
    .from("tbagenda")
    .update({
      microsoft_event_id: created.id,
      microsoft_connection_id: connectionId,
      external_id: created.id,
      provider: "microsoft",
      outlook_synced: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (error) throw error;
  return created.id as string;
}

export async function GET(request: Request) {
  try {
    const { utente } = await getMobileUser(request);

    const [{ data: utenti, error: utentiError }, { data: clienti, error: clientiError }, { data: eventi, error: eventiError }] =
      await Promise.all([
        mobileSupabaseAdmin
          .from("tbutenti")
          .select("id,nome,cognome,email,settore,attivo,studio_id,microsoft_connection_id")
          .eq("studio_id", utente.studio_id)
          .eq("attivo", true)
          .order("cognome", { ascending: true }),
        mobileSupabaseAdmin
          .from("tbclienti")
          .select("id,ragione_sociale,attivo")
          .eq("studio_id", utente.studio_id)
          .eq("attivo", true)
          .eq("cliente", true)
          .order("ragione_sociale", { ascending: true }),
        mobileSupabaseAdmin
          .from("tbagenda")
          .select("id,titolo,descrizione,data_inizio,data_fine,ora_inizio,ora_fine,luogo,sala,in_sede,utente_id,studio_id,riunione_teams,link_teams,evento_generico,ricorrente,partecipanti,microsoft_event_id,outlook_synced")
          .eq("studio_id", utente.studio_id)
          .order("data_inizio", { ascending: true })
          .limit(1000),
      ]);

    if (utentiError) throw utentiError;
    if (clientiError) throw clientiError;
    if (eventiError) throw eventiError;

    return Response.json({
      success: true,
      utenti: utenti || [],
      clienti: clienti || [],
      eventi: eventi || [],
      utente_corrente: utente,
    });
  } catch (error) {
    return mobileError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { utente } = await getMobileUser(request);
    const body = await request.json();

    const titolo = String(body?.titolo || "").trim();
    const organizerId = String(body?.utente_id || "").trim();
    const startIso = String(body?.data_inizio || "").trim();
    const endIso = String(body?.data_fine || "").trim();

    if (!titolo) {
      return Response.json({ success: false, error: "Titolo obbligatorio." }, { status: 400 });
    }
    if (!organizerId) {
      return Response.json({ success: false, error: "Organizzatore obbligatorio." }, { status: 400 });
    }
    if (!startIso || !endIso) {
      return Response.json({ success: false, error: "Data inizio e fine obbligatorie." }, { status: 400 });
    }

    const { data: organizer, error: organizerError } = await mobileSupabaseAdmin
      .from("tbutenti")
      .select("id,studio_id,email,microsoft_connection_id")
      .eq("id", organizerId)
      .eq("studio_id", utente.studio_id)
      .eq("attivo", true)
      .maybeSingle();

    if (organizerError) throw organizerError;
    if (!organizer) {
      return Response.json({ success: false, error: "Organizzatore non valido." }, { status: 400 });
    }

    const participantIds = uniqueStrings([
      organizerId,
      ...((Array.isArray(body?.partecipanti) ? body.partecipanti : []) as unknown[]),
    ]);

    const externalEmails = uniqueStrings(
      (Array.isArray(body?.email_partecipanti_esterni) ? body.email_partecipanti_esterni : []) as unknown[]
    );

    let teamsLink = String(body?.link_teams || "").trim();
    const wantsTeams = Boolean(body?.riunione_teams);
    const connectionId = organizer.microsoft_connection_id
      ? String(organizer.microsoft_connection_id)
      : "";

    if (wantsTeams && !teamsLink) {
      if (!connectionId) {
        return Response.json(
          { success: false, error: "Microsoft 365 non connesso per l'organizzatore." },
          { status: 400 }
        );
      }

      const meeting = await graphCall(
        request,
        organizerId,
        connectionId,
        "/me/onlineMeetings",
        "POST",
        {
          subject: titolo,
          startDateTime: new Date(startIso).toISOString(),
          endDateTime: new Date(endIso).toISOString(),
        }
      );

      teamsLink = String(meeting?.joinUrl || "").trim();
      if (!teamsLink) {
        throw new Error("Meeting Teams creato ma link non disponibile.");
      }
    }

    const recurring = Boolean(body?.ricorrente);
    const frequencyDays = Math.max(1, Number(body?.frequenza_giorni || 7));
    const durationDays = Math.max(1, Number(body?.durata_giorni || 180));

    const occurrences: Array<{ start: Date; end: Date }> = [];
    const firstStart = new Date(startIso);
    const firstEnd = new Date(endIso);
    if (Number.isNaN(firstStart.getTime()) || Number.isNaN(firstEnd.getTime())) {
      return Response.json({ success: false, error: "Data evento non valida." }, { status: 400 });
    }

    if (recurring) {
      const limit = new Date(firstStart);
      limit.setDate(limit.getDate() + durationDays);
      let currentStart = new Date(firstStart);
      let currentEnd = new Date(firstEnd);
      while (currentStart <= limit) {
        occurrences.push({ start: new Date(currentStart), end: new Date(currentEnd) });
        currentStart.setDate(currentStart.getDate() + frequencyDays);
        currentEnd.setDate(currentEnd.getDate() + frequencyDays);
      }
    } else {
      occurrences.push({ start: firstStart, end: firstEnd });
    }

    const insertedRows: any[] = [];
    const organizerRows: any[] = [];

    for (const occurrence of occurrences) {
      const gruppoEvento = randomUUID();
      const payloads = participantIds.map((participantId) => ({
        gruppo_evento: gruppoEvento,
        titolo,
        descrizione: body?.descrizione || null,
        data_inizio: occurrence.start.toISOString(),
        data_fine: occurrence.end.toISOString(),
        ora_inizio: body?.tutto_giorno ? null : body?.ora_inizio || null,
        ora_fine: body?.tutto_giorno ? null : body?.ora_fine || null,
        tutto_giorno: Boolean(body?.tutto_giorno),
        cliente_id: body?.evento_generico ? null : body?.cliente_id || null,
        utente_id: participantId,
        in_sede: Boolean(body?.in_sede),
        sala: body?.in_sede ? body?.sala || null : null,
        luogo: body?.in_sede ? null : body?.luogo || null,
        evento_generico: Boolean(body?.evento_generico),
        riunione_teams: wantsTeams,
        link_teams: teamsLink || null,
        partecipanti: participantIds,
        email_partecipanti_esterni: externalEmails,
        ricorrente: recurring,
        frequenza_giorni: recurring ? frequencyDays : null,
        durata_giorni: recurring ? durationDays : null,
        studio_id: utente.studio_id,
        microsoft_connection_id: participantId === organizerId && connectionId ? connectionId : null,
        updated_at: new Date().toISOString(),
      }));

      const { data: inserted, error } = await mobileSupabaseAdmin
        .from("tbagenda")
        .insert(payloads)
        .select("*");

      if (error) throw error;
      for (const row of inserted || []) {
        insertedRows.push(row);
        if (String(row.utente_id) === organizerId) organizerRows.push(row);
      }
    }

    const syncResults: any[] = [];
    if (connectionId) {
      for (const row of organizerRows) {
        try {
          const microsoftEventId = await syncOrganizerRowToOutlook(request, row, connectionId);
          syncResults.push({ id: row.id, success: true, microsoft_event_id: microsoftEventId });
        } catch (error: any) {
          console.error("Errore sincronizzazione Outlook evento mobile:", error);
          syncResults.push({ id: row.id, success: false, error: error?.message || String(error) });
        }
      }
    }

    return Response.json({
      success: true,
      data: insertedRows,
      teams_link: teamsLink || null,
      outlook: {
        attempted: Boolean(connectionId),
        synced: syncResults.filter((r) => r.success).length,
        failed: syncResults.filter((r) => !r.success).length,
        results: syncResults,
      },
    });
  } catch (error) {
    return mobileError(error);
  }
}
