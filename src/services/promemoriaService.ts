import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { messaggioService } from "./messaggioService";

type Promemoria = Database["public"]["Tables"]["tbpromemoria"]["Row"];
type PromemoriaInsert = Database["public"]["Tables"]["tbpromemoria"]["Insert"];
type PromemoriaUpdate = Database["public"]["Tables"]["tbpromemoria"]["Update"];

export const promemoriaService = {
  /**
   * Ottiene tutti i promemoria visibili all'utente loggato
   * FILTRO AUTOMATICO tramite RLS:
   * - Responsabile: vede tutti i promemoria del suo settore
   * - Utente generico: vede solo i promemoria assegnati a lui o creati da lui
   */
  async getPromemoria() {
    const { data, error } = await supabase
      .from("tbpromemoria")
      .select(`
        *,
        operatore:tbutenti!operatore_id (
          id,
          nome,
          cognome,
          settore,
          responsabile
        ),
        destinatario:tbutenti!destinatario_id (
          id,
          nome,
          cognome,
          settore,
          responsabile
        )
      `)
      .order("data_scadenza", { ascending: true });

    if (error) throw error;
    return data;
  },

  /**
   * Ottiene promemoria in scadenza (prossimi 7 giorni)
   */
  async getPromemoriaInScadenza(utenteId: string): Promise<Promemoria[]> {
    const oggi = new Date().toISOString().split("T")[0];
    const traSetteGiorni = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { data, error } = await supabase
      .from("tbpromemoria")
      .select(`
        *,
        tbtipopromemoria (
          id,
          nome,
          descrizione,
          colore
        )
      `)
      .eq("operatore_id", utenteId)
      .eq("working_progress", "In lavorazione")
      .gte("data_scadenza", oggi)
      .lte("data_scadenza", traSetteGiorni)
      .order("data_scadenza", { ascending: true });

    if (error) {
      console.error("Errore caricamento promemoria in scadenza:", error);
      throw error;
    }

    return data || [];
  },

  /**
   * Controlla promemoria in scadenza e invia notifiche automatiche
   * ai destinatari tramite sistema messaggi interni
   */
  async controllaEInviaNotificheScadenza(currentUserId: string, studioId: string) {
    try {
      console.log("🔔 Controllo promemoria in scadenza...");

      const oggi = new Date();
      oggi.setHours(0, 0, 0, 0);
      const domani = new Date(oggi);
      domani.setDate(domani.getDate() + 1);
      const dopodomani = new Date(oggi);
      dopodomani.setDate(dopodomani.getDate() + 2);

      // Ottieni tutti i promemoria visibili (RLS fa il filtro)
      const { data: promemoria, error } = await supabase
        .from("tbpromemoria")
        .select(`
          *,
          destinatario:tbutenti!destinatario_id (
            id,
            nome,
            cognome,
            email
          )
        `)
        .in("working_progress", ["Aperto", "In lavorazione"])
        .gte("data_scadenza", oggi.toISOString().split("T")[0])
        .lte("data_scadenza", dopodomani.toISOString().split("T")[0]);

      if (error) {
        console.error("Errore recupero promemoria per notifiche:", error);
        return;
      }

      if (!promemoria || promemoria.length === 0) {
        console.log("✅ Nessun promemoria in scadenza");
        return;
      }

      console.log(`📋 Trovati ${promemoria.length} promemoria in scadenza`);

      // Per ogni promemoria in scadenza con destinatario
      for (const p of promemoria) {
        if (!p.destinatario_id || !p.destinatario) continue;

        const scadenza = new Date(p.data_scadenza);
        scadenza.setHours(0, 0, 0, 0);
        
        let urgenza = "";
        let giorniRimasti = 0;

        if (scadenza.getTime() === oggi.getTime()) {
          urgenza = "🔴 SCADE OGGI";
          giorniRimasti = 0;
        } else if (scadenza.getTime() === domani.getTime()) {
          urgenza = "🟡 SCADE DOMANI";
          giorniRimasti = 1;
        } else {
          urgenza = "🟢 SCADE TRA 2 GIORNI";
          giorniRimasti = 2;
        }

        // Controlla se abbiamo già inviato notifica oggi per questo promemoria
        const { data: notificheEsistenti } = await supabase
          .from("tbmessaggi")
          .select("id")
          .ilike("testo", `%Promemoria in scadenza: ${p.titolo}%`)
          .gte("created_at", oggi.toISOString());

        if (notificheEsistenti && notificheEsistenti.length > 0) {
          console.log(`⏭️  Notifica già inviata per promemoria: ${p.titolo}`);
          continue;
        }

        // Crea o ottieni conversazione diretta con destinatario
        try {
          const conversazione = await messaggioService.getOrCreateConversazioneDiretta(
            currentUserId,
            p.destinatario_id,
            studioId
          );

          if (!conversazione) {
            console.error(`❌ Impossibile creare conversazione per promemoria: ${p.titolo}`);
            continue;
          }

          // Formatta data scadenza
          const dataScadenzaFormattata = new Date(p.data_scadenza).toLocaleDateString("it-IT");

          // Invia messaggio di notifica
          const messaggioTesto = `${urgenza}\n\n📌 **Promemoria in scadenza: ${p.titolo}**\n\n` +
            `📅 Scadenza: ${dataScadenzaFormattata} (${giorniRimasti === 0 ? "oggi" : giorniRimasti === 1 ? "domani" : "tra 2 giorni"})\n` +
            `📝 Descrizione: ${p.descrizione || "Nessuna descrizione"}\n` +
            `⚡ Priorità: ${p.priorita}\n` +
            `📊 Stato: ${p.working_progress}\n\n` +
            `👉 Vai su /promemoria per gestire questo promemoria.`;

          await messaggioService.inviaMessaggio(
            conversazione.id,
            currentUserId,
            messaggioTesto
          );

          console.log(`✅ Notifica inviata per promemoria: ${p.titolo} a ${p.destinatario.nome} ${p.destinatario.cognome}`);

        } catch (msgError) {
          console.error(`❌ Errore invio notifica per promemoria ${p.titolo}:`, msgError);
        }
      }

      console.log("🎉 Controllo notifiche completato");
    } catch (error) {
      console.error("❌ Errore controllo notifiche scadenza:", error);
    }
  },

  /**
   * Crea un nuovo promemoria
   */
  async createPromemoria(promemoria: {
    titolo: string;
    descrizione?: string;
    data_scadenza: string;
    priorita: string;
    stato: string;
    operatore_id: string;
    destinatario_id?: string | null;
    settore?: string;
  }) {
    const { data, error } = await supabase
      .from("tbpromemoria")
      .insert({
        titolo: promemoria.titolo,
        descrizione: promemoria.descrizione,
        data_scadenza: promemoria.data_scadenza,
        priorita: promemoria.priorita,
        working_progress: promemoria.stato,
        operatore_id: promemoria.operatore_id,
        destinatario_id: promemoria.destinatario_id,
        settore: promemoria.settore
      } as any)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Aggiorna un promemoria esistente
   */
  async updatePromemoria(id: string, promemoria: {
    titolo?: string;
    descrizione?: string;
    data_scadenza?: string;
    priorita?: string;
    working_progress?: string;
    destinatario_id?: string | null;
    settore?: string;
  }) {
    const { data, error } = await supabase
      .from("tbpromemoria")
      .update(promemoria)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Errore aggiornamento promemoria:", error);
      throw error;
    }

    return data;
  },

  /**
   * Elimina un promemoria
   */
  async deletePromemoria(id: string): Promise<void> {
    const { error } = await supabase
      .from("tbpromemoria")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Errore eliminazione promemoria:", error);
      throw error;
    }
  },

  /**
   * Calcola la data di scadenza basata su data + giorni
   */
  calcolaDataScadenza(dataInizio: string, giorniScadenza: number): string {
    const data = new Date(dataInizio);
    data.setDate(data.getDate() + giorniScadenza);
    return data.toISOString().split("T")[0];
  },

  /**
   * Ottiene statistiche promemoria per dashboard
   */
  async getStatistiche(utenteId: string) {
    const { data, error } = await supabase
      .from("tbpromemoria")
      .select("working_progress, da_fatturare, fatturato")
      .eq("operatore_id", utenteId);

    if (error) {
      console.error("Errore caricamento statistiche:", error);
      return {
        totali: 0,
        inLavorazione: 0,
        conclusi: 0,
        daFatturare: 0,
        fatturati: 0,
      };
    }

    const promemoria = data || [];
    return {
      totali: promemoria.length,
      inLavorazione: promemoria.filter((p) => p.working_progress === "In lavorazione")
        .length,
      conclusi: promemoria.filter((p) => p.working_progress === "Concluso").length,
      daFatturare: promemoria.filter(
        (p) => p.da_fatturare && !p.fatturato
      ).length,
      fatturati: promemoria.filter((p) => p.fatturato).length,
    };
  },
};