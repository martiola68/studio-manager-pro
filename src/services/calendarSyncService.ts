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
  body: {
    contentType: string;
    content: string;
  };
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
 * Sincronizza eventi da Outlook ad Agenda app
 */
async function syncFromOutlook(userId: string): Promise<number> {
  console.log("🔄 Sincronizzazione da Outlook ad Agenda...");

  try {
    // Ottieni eventi da Outlook (ultimi 30 giorni e prossimi 90 giorni)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 90);

    const filter = `start/dateTime ge '${startDate.toISOString()}' and end/dateTime le '${endDate.toISOString()}'`;
    
    const response = await graphApiCall<{ value: OutlookEvent[] }>(
      userId,
      `/me/calendar/events?$filter=${encodeURIComponent(filter)}&$top=100`
    );

    const outlookEvents = response.value;
    console.log(`📅 Trovati ${outlookEvents.length} eventi in Outlook`);

    let syncedCount = 0;

    for (const outlookEvent of outlookEvents) {
      // Verifica se evento già sincronizzato
      const { data: existing } = await supabase
        .from("tbagenda")
        .select("id")
        .eq("microsoft_event_id", outlookEvent.id)
        .eq("utente_id", userId)
        .single();

      const eventData = {
        titolo: outlookEvent.subject,
        data_inizio: convertOutlookToLocal(outlookEvent.start.dateTime),
        data_fine: convertOutlookToLocal(outlookEvent.end.dateTime),
        descrizione: outlookEvent.body?.content || null,
        luogo: outlookEvent.location?.displayName || null,
        updated_at: new Date().toISOString(),
        outlook_synced: true
      };

      if (existing) {
        // Aggiorna evento esistente
        await supabase
          .from("tbagenda")
          .update(eventData)
          .eq("id", existing.id);

        console.log(`✅ Aggiornato evento: ${outlookEvent.subject}`);
      } else {
        // Crea nuovo evento
        await supabase.from("tbagenda").insert({
          ...eventData,
          utente_id: userId,
          microsoft_event_id: outlookEvent.id,
          created_at: new Date().toISOString(),
          tutto_giorno: false, // Default per eventi Outlook
          in_sede: true
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
  appEvent: AppEvent
): Promise<string> {
  console.log("📅 Creazione evento in Outlook...");

  try {
    const outlookEvent = {
      subject: appEvent.titolo,
      start: {
        dateTime: appEvent.data_inizio,
        timeZone: "Europe/Rome",
      },
      end: {
        dateTime: appEvent.data_fine,
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
        body: JSON.stringify(outlookEvent),
      }
    );

    console.log("✅ Evento creato in Outlook:", response.id);

    // Salva ID Outlook nell'evento app
    await supabase
      .from("tbagenda")
      .update({
        microsoft_event_id: response.id,
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
  microsoftEventId: string,
  appEvent: AppEvent
): Promise<void> {
  console.log("📝 Aggiornamento evento in Outlook...");

  try {
    const outlookEvent = {
      subject: appEvent.titolo,
      start: {
        dateTime: appEvent.data_inizio,
        timeZone: "Europe/Rome",
      },
      end: {
        dateTime: appEvent.data_fine,
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
      body: JSON.stringify(outlookEvent),
    });

    console.log("✅ Evento aggiornato in Outlook");
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
  microsoftEventId: string
): Promise<void> {
  console.log("🗑️ Eliminazione evento da Outlook...");

  try {
    await graphApiCall(userId, `/me/calendar/events/${microsoftEventId}`, {
      method: "DELETE",
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
async function syncEventToOutlook(userId: string, eventoId: string): Promise<boolean> {
  try {
    // Verifica se l'utente ha Microsoft 365 configurato
    const hasMicrosoft = await hasMicrosoft365(userId);
    if (!hasMicrosoft) {
      console.log("ℹ️  Microsoft 365 non configurato, skip sincronizzazione Outlook");
      return false;
    }

    // Recupera l'evento dal database
    const { data: evento, error } = await supabase
      .from("tbagenda")
      .select("*")
      .eq("id", eventoId)
      .single();

    if (error || !evento) {
      console.error("Evento non trovato:", error);
      return false;
    }

    // Mappa l'evento del DB all'interfaccia AppEvent
    const appEvent: AppEvent = {
      id: evento.id,
      titolo: evento.titolo || "",
      data_inizio: evento.data_inizio || new Date().toISOString(),
      data_fine: evento.data_fine || new Date().toISOString(),
      descrizione: evento.descrizione || undefined,
      luogo: evento.luogo || undefined,
      cliente_id: evento.cliente_id || undefined,
      utente_id: evento.utente_id || userId, // Fallback a userId parametro se null
      microsoft_event_id: evento.microsoft_event_id || undefined,
      tutto_giorno: evento.tutto_giorno || false
    };

    // Se l'evento ha già un microsoft_event_id, aggiornalo
    if (evento.microsoft_event_id) {
      await updateOutlookEvent(userId, evento.microsoft_event_id, appEvent);
      return true;
    }

    // Altrimenti, crealo
    await createOutlookEvent(userId, appEvent);
    return true;

  } catch (error: any) {
    // ✅ Gestione errori migliorata
    if (error.message?.includes("Microsoft 365 non configurato")) {
      console.log("ℹ️  Sincronizzazione Outlook saltata: Microsoft 365 non configurato");
      return false;
    }
    console.error("Errore sincronizzazione evento:", error);
    return false;
  }
}

/**
 * Sincronizza tutti gli eventi (bidirezionale)
 */
async function fullCalendarSync(userId: string): Promise<void> {
  console.log("🔄 Sincronizzazione completa calendario...");

  // Sync da Outlook ad app
  await syncFromOutlook(userId);

  // Sync da app ad Outlook (eventi senza microsoft_event_id)
  const today = new Date().toISOString();
  
  const { data: unsyncedEvents } = await supabase
    .from("tbagenda")
    .select("*")
    .eq("utente_id", userId)
    .is("microsoft_event_id", null)
    .gte("data_inizio", today); // Solo eventi futuri

  if (unsyncedEvents && unsyncedEvents.length > 0) {
    console.log(`📤 ${unsyncedEvents.length} eventi da sincronizzare su Outlook`);

    for (const event of unsyncedEvents) {
      try {
        await createOutlookEvent(userId, event as AppEvent);
      } catch (error) {
        console.error(`❌ Errore sync evento ${event.id}:`, error);
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
  deleteEventFromOutlook: deleteOutlookEvent, // Alias per compatibilità
  syncEventToOutlook,
  fullCalendarSync
};