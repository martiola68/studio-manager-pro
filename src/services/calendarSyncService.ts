import { supabase } from "@/lib/supabase/client";
import { microsoftGraphService } from "./microsoftGraphService";

/**
 * Mapping tra eventi locali e eventi Outlook
 */
interface EventMapping {
  evento_id: string;
  outlook_event_id: string;
  last_synced: string;
}

/**
 * Servizio per sincronizzazione calendario tra App e Microsoft Outlook
 */
export const calendarSyncService = {
  /**
   * Verifica se la sincronizzazione calendario è abilitata
   */
  async isSyncEnabled(userId: string): Promise<boolean> {
    try {
      const { data: utente } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", userId)
        .single();

      if (!utente?.studio_id) return false;

      const { data: config } = await supabase
        .from("microsoft365_config")
        .select("enabled, features")
        .eq("studio_id", utente.studio_id)
        .single();

      if (!config?.enabled) return false;
      
      const features = config.features as Record<string, boolean> | null;
      return features?.calendar === true;
    } catch {
      return false;
    }
  },

  /**
   * Converte evento locale in formato Microsoft Graph
   */
  convertToOutlookEvent(evento: any) {
    return {
      subject: evento.titolo || "Evento",
      body: {
        contentType: "HTML",
        content: evento.descrizione || "",
      },
      start: {
        dateTime: evento.data_inizio,
        timeZone: "Europe/Rome",
      },
      end: {
        dateTime: evento.data_fine,
        timeZone: "Europe/Rome",
      },
      location: evento.luogo
        ? {
            displayName: evento.luogo,
          }
        : undefined,
      isReminderOn: true,
      reminderMinutesBeforeStart: 15,
    };
  },

  /**
   * Converte evento Outlook in formato locale
   */
  convertFromOutlookEvent(outlookEvent: any) {
    return {
      titolo: outlookEvent.subject,
      descrizione: outlookEvent.body?.content || "",
      data_inizio: outlookEvent.start?.dateTime,
      data_fine: outlookEvent.end?.dateTime,
      luogo: outlookEvent.location?.displayName,
      tutto_il_giorno: outlookEvent.isAllDay || false,
    };
  },

  /**
   * Sincronizza un evento locale con Outlook (crea o aggiorna)
   */
  async syncEventToOutlook(
    userId: string,
    eventoId: string
  ): Promise<{ success: boolean; outlookEventId?: string; error?: string }> {
    try {
      console.log("🔄 [Sync] Sincronizzazione evento a Outlook:", eventoId);

      // 1. Verifica se sync abilitato
      const syncEnabled = await this.isSyncEnabled(userId);
      if (!syncEnabled) {
        console.log("⚠️ Sincronizzazione calendario non abilitata");
        return { success: false, error: "Sincronizzazione non abilitata" };
      }

      // 2. Ottieni evento locale
      const { data: evento, error: eventoError } = await supabase
        .from("tbagenda")
        .select("*")
        .eq("id", eventoId)
        .single();

      if (eventoError || !evento) {
        return { success: false, error: "Evento non trovato" };
      }

      // 3. Converti in formato Outlook
      const outlookEvent = this.convertToOutlookEvent(evento);

      // 4. Verifica se già sincronizzato
      const { data: mapping } = await supabase
        .from("tbmicrosoft_calendar_mappings")
        .select("outlook_event_id")
        .eq("evento_id", eventoId)
        .single();

      let result;
      if (mapping?.outlook_event_id) {
        // Aggiorna evento esistente
        console.log("📝 Aggiornamento evento esistente:", mapping.outlook_event_id);
        result = await microsoftGraphService.updateEvent(
          userId,
          mapping.outlook_event_id,
          outlookEvent
        );

        if (result.success) {
          // Aggiorna timestamp sincronizzazione
          await supabase
            .from("tbmicrosoft_calendar_mappings")
            .update({ last_synced: new Date().toISOString() })
            .eq("evento_id", eventoId);

          return { success: true, outlookEventId: mapping.outlook_event_id };
        }
      } else {
        // Crea nuovo evento
        console.log("➕ Creazione nuovo evento Outlook");
        result = await microsoftGraphService.createEvent(userId, outlookEvent);

        if (result.success && result.data?.id) {
          // Salva mapping
          await supabase.from("tbmicrosoft_calendar_mappings").insert({
            evento_id: eventoId,
            outlook_event_id: result.data.id,
            last_synced: new Date().toISOString(),
          });

          return { success: true, outlookEventId: result.data.id };
        }
      }

      return {
        success: false,
        error: result.error || "Errore sincronizzazione",
      };
    } catch (error: any) {
      console.error("❌ Errore sincronizzazione evento:", error);
      return {
        success: false,
        error: error.message || "Errore sincronizzazione",
      };
    }
  },

  /**
   * Elimina evento da Outlook
   */
  async deleteEventFromOutlook(
    userId: string,
    eventoId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("🗑️ [Sync] Eliminazione evento da Outlook:", eventoId);

      // 1. Ottieni mapping
      const { data: mapping } = await supabase
        .from("tbmicrosoft_calendar_mappings")
        .select("outlook_event_id")
        .eq("evento_id", eventoId)
        .single();

      if (!mapping?.outlook_event_id) {
        console.log("⚠️ Evento non sincronizzato, skip eliminazione");
        return { success: true }; // Non è un errore, semplicemente non era sincronizzato
      }

      // 2. Elimina da Outlook
      const result = await microsoftGraphService.deleteEvent(
        userId,
        mapping.outlook_event_id
      );

      if (result.success) {
        // 3. Rimuovi mapping
        await supabase
          .from("tbmicrosoft_calendar_mappings")
          .delete()
          .eq("evento_id", eventoId);
      }

      return result;
    } catch (error: any) {
      console.error("❌ Errore eliminazione evento:", error);
      return {
        success: false,
        error: error.message || "Errore eliminazione evento",
      };
    }
  },

  /**
   * Importa eventi da Outlook
   */
  async importEventsFromOutlook(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ success: boolean; imported: number; error?: string }> {
    try {
      console.log("📥 [Sync] Importazione eventi da Outlook");

      // 1. Verifica se sync abilitato
      const syncEnabled = await this.isSyncEnabled(userId);
      if (!syncEnabled) {
        return { success: false, imported: 0, error: "Sincronizzazione non abilitata" };
      }

      // 2. Ottieni eventi da Outlook
      const result = await microsoftGraphService.getEvents(userId, startDate, endDate);

      if (!result.success || !result.data) {
        return {
          success: false,
          imported: 0,
          error: result.error || "Errore recupero eventi",
        };
      }

      let imported = 0;

      // 3. Per ogni evento Outlook, verifica se già importato
      for (const outlookEvent of result.data) {
        const { data: existing } = await supabase
          .from("tbmicrosoft_calendar_mappings")
          .select("evento_id")
          .eq("outlook_event_id", outlookEvent.id)
          .single();

        if (existing) {
          console.log("⚠️ Evento già importato, skip:", outlookEvent.id);
          continue;
        }

        // 4. Converti e crea evento locale
        const localEvent = this.convertFromOutlookEvent(outlookEvent);

        const { data: nuovoEvento, error: insertError } = await supabase
          .from("tbagenda")
          .insert({
            ...localEvent,
            utente_id: userId,
            tipo: "appointment",
            stato: "scheduled",
          })
          .select()
          .single();

        if (insertError || !nuovoEvento) {
          console.error("❌ Errore creazione evento locale:", insertError);
          continue;
        }

        // 5. Crea mapping
        await supabase.from("tbmicrosoft_calendar_mappings").insert({
          evento_id: nuovoEvento.id,
          outlook_event_id: outlookEvent.id,
          last_synced: new Date().toISOString(),
        });

        imported++;
      }

      console.log(`✅ Importati ${imported} eventi da Outlook`);

      return { success: true, imported };
    } catch (error: any) {
      console.error("❌ Errore importazione eventi:", error);
      return {
        success: false,
        imported: 0,
        error: error.message || "Errore importazione eventi",
      };
    }
  },

  /**
   * Sincronizzazione bidirezionale completa
   */
  async fullSync(userId: string): Promise<{
    success: boolean;
    synced: number;
    imported: number;
    error?: string;
  }> {
    try {
      console.log("🔄 [Sync] Sincronizzazione completa calendario");

      let synced = 0;
      let imported = 0;

      // 1. Sincronizza eventi locali verso Outlook
      const { data: eventiLocali } = await supabase
        .from("tbagenda")
        .select("id")
        .eq("utente_id", userId)
        .gte("data_inizio", new Date().toISOString()); // Solo eventi futuri

      if (eventiLocali) {
        for (const evento of eventiLocali) {
          const result = await this.syncEventToOutlook(userId, evento.id);
          if (result.success) synced++;
        }
      }

      // 2. Importa eventi da Outlook
      const importResult = await this.importEventsFromOutlook(
        userId,
        new Date().toISOString() // Solo eventi futuri
      );

      if (importResult.success) {
        imported = importResult.imported;
      }

      console.log(`✅ Sincronizzazione completata: ${synced} sincronizzati, ${imported} importati`);

      return { success: true, synced, imported };
    } catch (error: any) {
      console.error("❌ Errore sincronizzazione completa:", error);
      return {
        success: false,
        synced: 0,
        imported: 0,
        error: error.message || "Errore sincronizzazione",
      };
    }
  },
};