import { graphApiCall, hasMicrosoft365 } from "./microsoftGraphService";
import { supabase } from "@/lib/supabase/client";

/**
 * Calendar Sync Service
 * Sincronizza eventi tra Outlook Calendar e Agenda app
 */

interface OutlookEvent {
  id: string;
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  body?: {
    contentType: string;
    content: string;
  };
  bodyPreview?: string;
  location?: {
    displayName: string;
  };
  attendees?: Array<{
    emailAddress: {
      address: string;
      name: string;
    };
    type: string;
  }>;
}

interface AppEvent {
  id: string;
  titolo: string;
  data_inizio: string;
  data_fine: string;
  descrizione?: string;
  luogo?: string;
  cliente_id?: string;
  utente_id: string;
  microsoft_event_id?: string;
  tutto_giorno?: boolean;
}

/**
 * Helper: Converte DateTime Outlook in Timestamp locale
 */
function convertOutlookToLocal(dateTime: string): string {
  return new Date(dateTime).toISOString();
}

/**
 * Helper: Converte una data ISO/UTC in formato locale compatibile con Microsoft Graph
 * Graph vuole dateTime senza offset quando è presente anche timeZone.
 */
function convertLocalToGraphDateTime(dateValue: string): string {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}`;
}

/**
 * Helper: recupera connessione Microsoft attiva per utente
 * Nel progetto la connessione è salvata su tbutenti.microsoft_connection_id
 */
async function getActiveMicrosoftConnectionId(userId: string): Promise<string> {
  if (!userId) return "";

  const { data: utente, error } = await supabase
    .from("tbutenti")
    .select("microsoft_connection_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("❌ Errore recupero connessione Microsoft:", error);
    return "";
  }

  return utente?.microsoft_connection_id || "";
}

/**
 * Sincronizza eventi da Outlook ad Agenda app
 */
async function syncFromOutlook(
  userId: string,
  microsoftConnectionId: string
): Promise<number> {
  console.log("🔄 Sincronizzazione da Outlook ad Agenda...");

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 90);

    const filter = `start/dateTime ge '${startDate.toISOString()}' and end/dateTime le '${endDate.toISOString()}'`;

    const response = await graphApiCall<{ value: OutlookEvent[] }>(
      userId,
      `/me/calendar/events?$filter=${encodeURIComponent(filter)}&$top=100`,
      {
        microsoftConnectionId,
      }
    );

    const outlookEvents = response.value ?? [];
    console.log(`📅 Trovati ${outlookEvents.length} eventi in Outlook`);

    let syncedCount = 0;

    for (const outlookEvent of outlookEvents) {
      const { data: existing } = await supabase
        .from("tbagenda")
        .select("id")
        .eq("microsoft_event_id", outlookEvent.id)
        .eq("utente_id", userId)
        .maybeSingle();

      const eventData = {
        titolo: outlookEvent.subject || "(senza titolo)",
        data_inizio: convertOutlookToLocal(outlookEvent.start.dateTime),
        data_fine: convertOutlookToLocal(outlookEvent.end.dateTime),
        descrizione: outlookEvent.bodyPreview || outlookEvent.body?.content || null,
        luogo: outlookEvent.location?.displayName || null,
        external_id: outlookEvent.id,
        provider: "microsoft",
        outlook_synced: true,
        updated_at: new Date().toISOString(),
      };

      if (existing?.id) {
        await supabase.from("tbagenda").update(eventData).eq("id", existing.id);

        console.log(`✅ Aggiornato evento: ${outlookEvent.subject}`);
      } else {
        await supabase.from("tbagenda").insert({
          ...eventData,
          utente_id: userId,
          microsoft_event_id: outlookEvent.id,
          microsoft_connection_id: microsoftConnectionId || null,
          created_at: new Date().toISOString(),
          tutto_giorno: false,
          in_sede: true,
        });

        console.log(`✅ Creato nuovo evento: ${outlookEvent.subject}`);
      }

      syncedCount++;
    }

    console.log(`✅ Sincronizzazione completata: ${syncedCount} eventi`);
    return syncedCount;
  } catch (error: any) {
    console.error("❌ Errore sincronizzazione da Outlook:", error);
    throw new Error(`Errore sincronizzazione: ${error.message}`);
  }
}

/**
 * Crea evento in Outlook da evento Agenda app
 */
async function createOutlookEvent(
  userId: string,
  microsoftConnectionId: string,
  appEvent: AppEvent
): Promise<string> {
  console.log("📅 Creazione evento in Outlook...");

  try {
    const outlookEvent = {
      subject: appEvent.titolo,
      start: {
        dateTime: convertLocalToGraphDateTime(appEvent.data_inizio),
        timeZone: "Europe/Rome",
      },
      end: {
        dateTime: convertLocalToGraphDateTime(appEvent.data_fine),
        timeZone: "Europe/Rome",
      },
      isAllDay: appEvent.tutto_giorno || false,
      body: {
        contentType: "Text",
        content: appEvent.descrizione || "",
      },
      location: appEvent.luogo
        ? {
            displayName: appEvent.luogo,
          }
        : undefined,
    };

    const response = await graphApiCall<OutlookEvent>(
      userId,
      "/me/calendar/events",
      {
        method: "POST",
        microsoftConnectionId,
        body: JSON.stringify(outlookEvent),
      }
    );

    console.log("✅ Evento creato in Outlook:", response.id);

    await supabase
      .from("tbagenda")
      .update({
        microsoft_event_id: response.id,
        microsoft_connection_id: microsoftConnectionId,
        external_id: response.id,
        provider: "microsoft",
        outlook_synced: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appEvent.id);

    return response.id;
  } catch (error: any) {
    console.error("❌ Errore creazione evento Outlook:", error);
    throw new Error(`Errore creazione evento: ${error.message}`);
  }
}

/**
 * Aggiorna evento in Outlook
 */
async function updateOutlookEvent(
  userId: string,
  microsoftConnectionId: string,
  microsoftEventId: string,
  appEvent: AppEvent
): Promise<void> {
  console.log("📝 Aggiornamento evento in Outlook...");

  try {
    const outlookEvent = {
      subject: appEvent.titolo,
      start: {
        dateTime: convertLocalToGraphDateTime(appEvent.data_inizio),
        timeZone: "Europe/Rome",
      },
      end: {
        dateTime: convertLocalToGraphDateTime(appEvent.data_fine),
        timeZone: "Europe/Rome",
      },
      isAllDay: appEvent.tutto_giorno || false,
      body: {
        contentType: "Text",
        content: appEvent.descrizione || "",
      },
      location: appEvent.luogo
        ? {
            displayName: appEvent.luogo,
          }
        : undefined,
    };

    await graphApiCall(userId, `/me/calendar/events/${microsoftEventId}`, {
      method: "PATCH",
      microsoftConnectionId,
      body: JSON.stringify(outlookEvent),
    });

    console.log("✅ Evento aggiornato in Outlook");

    await supabase
      .from("tbagenda")
      .update({
        microsoft_connection_id: microsoftConnectionId,
        outlook_synced: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appEvent.id);
  } catch (error: any) {
    console.error("❌ Errore aggiornamento evento Outlook:", error);
    throw new Error(`Errore aggiornamento evento: ${error.message}`);
  }
}

/**
 * Elimina evento da Outlook
 */
async function deleteOutlookEvent(
  userId: string,
  microsoftConnectionId: string,
  microsoftEventId: string
): Promise<void> {
  console.log("🗑️ Eliminazione evento da Outlook...");

  try {
    await graphApiCall(userId, `/me/calendar/events/${microsoftEventId}`, {
      method: "DELETE",
      microsoftConnectionId,
    });

    console.log("✅ Evento eliminato da Outlook");
  } catch (error: any) {
    console.error("❌ Errore eliminazione evento Outlook:", error);
    throw new Error(`Errore eliminazione evento: ${error.message}`);
  }
}

/**
 * Sincronizza un singolo evento verso Outlook
 */
async function syncEventToOutlook(
  userId: string,
  eventoId: string
): Promise<boolean> {
  try {
    console.log("🔄 syncEventToOutlook START", { userId, eventoId });

    const { data: evento, error } = await supabase
      .from("tbagenda")
      .select("*")
      .eq("id", eventoId)
      .single();

    if (error || !evento) {
      console.error("❌ Evento non trovato:", error);
      return false;
    }

    console.log("📌 Evento caricato", {
      id: evento.id,
      utente_id: evento.utente_id,
      microsoft_event_id: evento.microsoft_event_id,
      microsoft_connection_id: (evento as any)?.microsoft_connection_id || null,
      outlook_synced: evento.outlook_synced,
    });

    let microsoftConnectionId = (evento as any)?.microsoft_connection_id || "";

    if (!microsoftConnectionId) {
      microsoftConnectionId = await getActiveMicrosoftConnectionId(userId);
    }

    console.log("🔎 Connection risolta", {
      userId,
      eventoId,
      microsoftConnectionId,
    });

    if (!microsoftConnectionId) {
      console.warn("⚠️ Nessuna connessione Microsoft attiva trovata", {
        userId,
        eventoId,
      });
      return false;
    }

    const appEvent: AppEvent = {
      id: evento.id,
      titolo: evento.titolo || "",
      data_inizio: evento.data_inizio || new Date().toISOString(),
      data_fine: evento.data_fine || new Date().toISOString(),
      descrizione: evento.descrizione || undefined,
      luogo: evento.luogo || undefined,
      cliente_id: evento.cliente_id || undefined,
      utente_id: evento.utente_id || userId,
      microsoft_event_id: evento.microsoft_event_id || undefined,
      tutto_giorno: evento.tutto_giorno || false,
    };

    console.log("📤 Payload appEvent", appEvent);

    if (evento.microsoft_event_id) {
      console.log("📝 Tentativo update Outlook", {
        userId,
        microsoftConnectionId,
        microsoftEventId: evento.microsoft_event_id,
      });

      await updateOutlookEvent(
        userId,
        microsoftConnectionId,
        evento.microsoft_event_id,
        appEvent
      );

      console.log("✅ Update Outlook completato");
      return true;
    }

    console.log("📅 Tentativo create Outlook", {
      userId,
      microsoftConnectionId,
    });

    const createdId = await createOutlookEvent(
      userId,
      microsoftConnectionId,
      appEvent
    );

    console.log("✅ Create Outlook completato", {
      createdId,
      eventoId,
    });

    return true;
  } catch (error: any) {
    console.error("❌ Errore sincronizzazione evento Outlook:", {
      message: error?.message || String(error),
      stack: error?.stack || null,
      raw: error,
    });

    return false;
  }
}
/**
 * Sincronizza tutti gli eventi (bidirezionale)
 */
async function fullCalendarSync(
  userId: string,
  microsoftConnectionId: string
): Promise<void> {
  console.log("🔄 Sincronizzazione completa calendario...");

  await syncFromOutlook(userId, microsoftConnectionId);

  const today = new Date().toISOString();

  const { data: unsyncedEvents } = await supabase
    .from("tbagenda")
    .select("*")
    .eq("utente_id", userId)
    .is("microsoft_event_id", null)
    .gte("data_inizio", today);

  if (unsyncedEvents && unsyncedEvents.length > 0) {
    console.log(`📤 ${unsyncedEvents.length} eventi da sincronizzare su Outlook`);

    for (const event of unsyncedEvents) {
      try {
        await createOutlookEvent(
          userId,
          microsoftConnectionId,
          event as AppEvent
        );
      } catch (error) {
        console.error(`❌ Errore sync evento ${(event as any).id}:`, error);
      }
    }
  }

  console.log("✅ Sincronizzazione completa terminata");
}

export const calendarSyncService = {
  syncFromOutlook,
  createOutlookEvent,
  updateOutlookEvent,
  deleteOutlookEvent,
  deleteEventFromOutlook: deleteOutlookEvent,
  syncEventToOutlook,
  fullCalendarSync,
};
