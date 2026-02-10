import { supabase } from "@/lib/supabase/client";
import { microsoftGraphService } from "./microsoftGraphService";

/**
 * Calendar Sync Service
 * Sincronizza eventi tra Agenda Software e Outlook Calendar
 * Direzione: Agenda → Outlook (Unidirezionale)
 */

interface EventoAgenda {
  id: string;
  titolo: string;
  descrizione?: string | null;
  data_inizio: string;
  data_fine: string;
  cliente_id?: string | null;
  utente_id: string;
  luogo?: string | null;
  microsoft_event_id?: string | null;
  outlook_synced?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface OutlookEventData {
  subject: string;
  body?: {
    contentType: "HTML" | "Text";
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  attendees?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
    type: "required" | "optional";
  }>;
  isReminderOn?: boolean;
  reminderMinutesBeforeStart?: number;
}

/**
 * Verifica se Microsoft 365 è abilitato per lo studio corrente
 */
async function isMicrosoft365Enabled(): Promise<{
  enabled: boolean;
  userId: string | null;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { enabled: false, userId: null };

    // Verifica se esiste configurazione Microsoft 365
    const { data: profile } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id) return { enabled: false, userId: null };

    const { data: config } = await supabase
      .from("microsoft365_config")
      .select("enabled")
      .eq("studio_id", profile.studio_id)
      .single();

    if (!config?.enabled) return { enabled: false, userId: null };

    // Verifica se l'utente ha token Microsoft validi
    const { data: tokens } = await supabase
      .from("tbmicrosoft_tokens")
      .select("id")
      .eq("user_id", user.id)
      .single();

    return {
      enabled: !!tokens,
      userId: tokens ? user.id : null,
    };
  } catch (error) {
    console.error("Errore verifica Microsoft 365:", error);
    return { enabled: false, userId: null };
  }
}

/**
 * Converte un evento Agenda in formato Outlook
 */
function convertToOutlookEvent(evento: EventoAgenda): OutlookEventData {
  const timeZone = "Europe/Rome";

  return {
    subject: evento.titolo,
    body: evento.descrizione
      ? {
          contentType: "HTML",
          content: evento.descrizione,
        }
      : undefined,
    start: {
      dateTime: new Date(evento.data_inizio).toISOString(),
      timeZone,
    },
    end: {
      dateTime: new Date(evento.data_fine).toISOString(),
      timeZone,
    },
    location: evento.luogo
      ? {
          displayName: evento.luogo,
        }
      : undefined,
    isReminderOn: true,
    reminderMinutesBeforeStart: 15,
  };
}

/**
 * Sincronizza un evento dall'Agenda a Outlook (Creazione)
 */
export async function syncEventToOutlook(
  eventoId: string
): Promise<{ success: boolean; outlookEventId?: string; error?: string }> {
  try {
    // Verifica se Microsoft 365 è abilitato
    const { enabled, userId } = await isMicrosoft365Enabled();
    if (!enabled || !userId) {
      return {
        success: false,
        error: "Microsoft 365 non abilitato",
      };
    }

    // Carica l'evento dal database
    const { data: evento, error: fetchError } = await supabase
      .from("tbagenda")
      .select("*")
      .eq("id", eventoId)
      .single();

    if (fetchError || !evento) {
      return {
        success: false,
        error: "Evento non trovato",
      };
    }

    // Se già sincronizzato, non duplicare
    if (evento.microsoft_event_id && evento.outlook_synced) {
      return {
        success: true,
        outlookEventId: evento.microsoft_event_id,
      };
    }

    // Converte in formato Outlook
    const outlookEvent = convertToOutlookEvent(evento);

    // Crea evento in Outlook
    const result = await microsoftGraphService.createEvent(userId, outlookEvent);

    if (!result.success || !result.data?.id) {
      return {
        success: false,
        error: result.error || "Errore creazione evento Outlook",
      };
    }

    // Salva l'ID Outlook nel database
    const { error: updateError } = await supabase
      .from("tbagenda")
      .update({
        microsoft_event_id: result.data.id,
        outlook_synced: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventoId);

    if (updateError) {
      console.error("Errore aggiornamento evento con Outlook ID:", updateError);
    }

    return {
      success: true,
      outlookEventId: result.data.id,
    };
  } catch (error) {
    console.error("Errore sync evento a Outlook:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore sconosciuto",
    };
  }
}

/**
 * Aggiorna un evento in Outlook quando viene modificato nell'Agenda
 */
export async function updateEventInOutlook(
  eventoId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verifica se Microsoft 365 è abilitato
    const { enabled, userId } = await isMicrosoft365Enabled();
    if (!enabled || !userId) {
      return {
        success: false,
        error: "Microsoft 365 non abilitato",
      };
    }

    // Carica l'evento dal database
    const { data: evento, error: fetchError } = await supabase
      .from("tbagenda")
      .select("*")
      .eq("id", eventoId)
      .single();

    if (fetchError || !evento) {
      return {
        success: false,
        error: "Evento non trovato",
      };
    }

    // Se non ha Outlook ID, crea nuovo evento
    if (!evento.microsoft_event_id) {
      return await syncEventToOutlook(eventoId);
    }

    // Converte in formato Outlook
    const outlookEvent = convertToOutlookEvent(evento);

    // Aggiorna evento in Outlook
    const result = await microsoftGraphService.updateEvent(
      userId,
      evento.microsoft_event_id,
      outlookEvent
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Errore aggiornamento evento Outlook",
      };
    }

    // Aggiorna timestamp
    const { error: updateError } = await supabase
      .from("tbagenda")
      .update({
        outlook_synced: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventoId);

    if (updateError) {
      console.error("Errore aggiornamento timestamp:", updateError);
    }

    return { success: true };
  } catch (error) {
    console.error("Errore update evento in Outlook:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore sconosciuto",
    };
  }
}

/**
 * Cancella un evento da Outlook quando viene cancellato dall'Agenda
 */
export async function deleteEventFromOutlook(
  eventoId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verifica se Microsoft 365 è abilitato
    const { enabled, userId } = await isMicrosoft365Enabled();
    if (!enabled || !userId) {
      return {
        success: false,
        error: "Microsoft 365 non abilitato",
      };
    }

    // Carica l'evento dal database per ottenere l'Outlook ID
    const { data: evento, error: fetchError } = await supabase
      .from("tbagenda")
      .select("microsoft_event_id")
      .eq("id", eventoId)
      .single();

    if (fetchError || !evento || !evento.microsoft_event_id) {
      // Se non ha Outlook ID, non c'è nulla da cancellare
      return { success: true };
    }

    // Cancella evento da Outlook
    const result = await microsoftGraphService.deleteEvent(
      userId,
      evento.microsoft_event_id
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Errore cancellazione evento Outlook",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Errore delete evento da Outlook:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore sconosciuto",
    };
  }
}

/**
 * Sincronizza in batch tutti gli eventi non sincronizzati
 */
export async function syncAllPendingEvents(): Promise<{
  success: boolean;
  synced: number;
  errors: number;
}> {
  try {
    // Verifica se Microsoft 365 è abilitato
    const { enabled, userId } = await isMicrosoft365Enabled();
    if (!enabled || !userId) {
      return {
        success: false,
        synced: 0,
        errors: 0,
      };
    }

    // Ottieni utente corrente
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, synced: 0, errors: 0 };
    }

    // Carica eventi non sincronizzati (ultimi 30 giorni)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: eventi, error: fetchError } = await supabase
      .from("tbagenda")
      .select("id")
      .eq("utente_id", user.id)
      .or("outlook_synced.is.null,outlook_synced.eq.false")
      .gte("data_inizio", thirtyDaysAgo.toISOString())
      .order("data_inizio", { ascending: true })
      .limit(50); // Limite per evitare timeout

    if (fetchError || !eventi || eventi.length === 0) {
      return { success: true, synced: 0, errors: 0 };
    }

    // Sincronizza ogni evento
    let synced = 0;
    let errors = 0;

    for (const evento of eventi) {
      const result = await syncEventToOutlook(evento.id);
      if (result.success) {
        synced++;
      } else {
        errors++;
      }
    }

    return {
      success: true,
      synced,
      errors,
    };
  } catch (error) {
    console.error("Errore sync batch eventi:", error);
    return {
      success: false,
      synced: 0,
      errors: 0,
    };
  }
}

/**
 * Esporta tutte le funzioni
 */
export const calendarSyncService = {
  syncEventToOutlook,
  updateEventInOutlook,
  deleteEventFromOutlook,
  syncAllPendingEvents,
  isMicrosoft365Enabled,
};