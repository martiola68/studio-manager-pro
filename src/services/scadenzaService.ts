import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

// Definiamo un tipo generico per le scadenze poiché ora sono in tabelle separate
// Questa è una semplificazione, idealmente dovremmo avere servizi separati o gestirli in modo più dinamico

export const scadenzaService = {
  // Esempio per TBScadIva
  async getScadenzeIva() {
    const { data, error } = await supabase
      .from("TBScadIva")
      .select(`
        *,
        cliente:TBClienti(ragione_sociale)
      `);
      
    if (error) {
      console.error("Error fetching scadenze IVA:", error);
      return [];
    }
    return data || [];
  },

  // Esempio per TBScadFiscali
  async getScadenzeFiscali() {
    const { data, error } = await supabase
      .from("TBScadFiscali")
      .select(`
        *,
        cliente:TBClienti(ragione_sociale)
      `);
      
    if (error) {
      console.error("Error fetching scadenze Fiscali:", error);
      return [];
    }
    return data || [];
  },

  // Metodi per recuperare tutte le scadenze per la dashboard
  // Questo richiederà chiamate multiple a tutte le tabelle scadenze
  async getAllScadenzeCounts() {
    const results = await Promise.all([
      supabase.from("TBScadIva").select("id", { count: "exact", head: true }),
      supabase.from("TBScadCCGG").select("id", { count: "exact", head: true }),
      supabase.from("TBScadCU").select("id", { count: "exact", head: true }),
      supabase.from("TBScadFiscali").select("id", { count: "exact", head: true }),
      supabase.from("TBScadBilanci").select("id", { count: "exact", head: true }),
      supabase.from("TBScad770").select("id", { count: "exact", head: true }),
      supabase.from("TBScadLipe").select("id", { count: "exact", head: true }),
      supabase.from("TBScadEstero").select("id", { count: "exact", head: true }),
      supabase.from("TBScadProforma").select("id", { count: "exact", head: true })
    ]);

    return {
      iva: results[0].count || 0,
      ccgg: results[1].count || 0,
      cu: results[2].count || 0,
      fiscali: results[3].count || 0,
      bilanci: results[4].count || 0,
      sette70: results[5].count || 0,
      lipe: results[6].count || 0,
      estero: results[7].count || 0,
      proforma: results[8].count || 0
    };
  }
};