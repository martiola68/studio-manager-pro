import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type Promemoria = Database["public"]["Tables"]["tbpromemoria"]["Row"];
type PromemoriaInsert = Database["public"]["Tables"]["tbpromemoria"]["Insert"];
type PromemoriaUpdate = Database["public"]["Tables"]["tbpromemoria"]["Update"];

export const promemoriaService = {
  /**
   * Ottiene tutti i promemoria dell'utente loggato
   */
  async getPromemoria() {
    const { data, error } = await supabase
      .from("tbpromemoria")
      .select(`
        *,
        cliente:cliente_id (
          id,
          ragione_sociale
        ),
        operatore:operatore_id (
          id,
          nome,
          cognome
        ),
        destinatario:destinatario_id (
          id,
          nome,
          cognome
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
    cliente_id?: string | null;
  }) {
    const { data, error } = await supabase
      .from("tbpromemoria")
      .insert({
        titolo: promemoria.titolo,
        descrizione: promemoria.descrizione,
        data_scadenza: promemoria.data_scadenza,
        priorita: promemoria.priorita,
        working_progress: promemoria.stato, // Mapping corretto
        operatore_id: promemoria.operatore_id,
        destinatario_id: promemoria.destinatario_id,
        settore: promemoria.settore,
        cliente_id: promemoria.cliente_id
      } as any) // Force cast per evitare ritardi tipi
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
  async aggiornaPromemoria(id: string, promemoria: Partial<Promemoria>) {
    const { error } = await supabase
      .from("tbpromemoria")
      .update({
        tipo_promemoria_id: promemoria.tipo_promemoria_id,
        data_inserimento: promemoria.data_inserimento,
        giorni_scadenza: promemoria.giorni_scadenza,
        data_scadenza: promemoria.data_scadenza,
        working_progress: promemoria.working_progress,
        da_fatturare: promemoria.da_fatturare,
        fatturato: promemoria.fatturato,
        note: promemoria.note
      })
      .eq("id", id);

    if (error) {
      console.error("Errore aggiornamento promemoria:", error);
      throw error;
    }
  },

  /**
   * Elimina un promemoria
   */
  async eliminaPromemoria(id: string): Promise<void> {
    const { error } = await supabase.from("tbpromemoria").delete().eq("id", id);

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