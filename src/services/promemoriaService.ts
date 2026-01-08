import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Promemoria = Database["public"]["Tables"]["tbpromemoria"]["Row"];
type PromemoriaInsert = Database["public"]["Tables"]["tbpromemoria"]["Insert"];
type PromemoriaUpdate = Database["public"]["Tables"]["tbpromemoria"]["Update"];

export const promemoriaService = {
  /**
   * Ottiene tutti i promemoria dell'utente loggato
   */
  async getPromemoria(utenteId: string): Promise<Promemoria[]> {
    const { data, error } = await supabase
      .from("tbpromemoria")
      .select(`
        *,
        tbtipopromemoria!tbpromemoria_tipologia_id_fkey (
          id,
          nome,
          descrizione,
          colore
        ),
        tbutenti!tbpromemoria_operatore_id_fkey (
          id,
          nome,
          cognome,
          email
        )
      `)
      .eq("operatore_id", utenteId)
      .order("data_scadenza", { ascending: true });

    if (error) {
      console.error("Errore caricamento promemoria:", error);
      throw error;
    }

    return data || [];
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
        tbtipopromemoria!tbpromemoria_tipologia_id_fkey (
          id,
          nome,
          descrizione,
          colore
        )
      `)
      .eq("operatore_id", utenteId)
      .eq("working_progress", "in_lavorazione")
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
  async creaPromemoria(promemoria: Omit<Promemoria, "id" | "created_at" | "updated_at">) {
    const { error } = await supabase.from("tbpromemoria").insert({
      operatore_id: promemoria.operatore_id,
      tipo_promemoria_id: promemoria.tipo_promemoria_id,
      data_inserimento: promemoria.data_inserimento,
      giorni_scadenza: promemoria.giorni_scadenza,
      data_scadenza: promemoria.data_scadenza,
      working_progress: promemoria.working_progress,
      da_fatturare: promemoria.da_fatturare,
      fatturato: promemoria.fatturato,
      note: promemoria.note
    });

    if (error) {
      console.error("Errore creazione promemoria:", error);
      throw error;
    }
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
      inLavorazione: promemoria.filter((p) => p.working_progress === "in_lavorazione")
        .length,
      conclusi: promemoria.filter((p) => p.working_progress === "Concluso").length,
      daFatturare: promemoria.filter(
        (p) => p.da_fatturare && !p.fatturato
      ).length,
      fatturati: promemoria.filter((p) => p.fatturato).length,
    };
  },
};