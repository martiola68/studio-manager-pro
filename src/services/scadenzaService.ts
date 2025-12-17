import { supabase } from "@/integrations/supabase/client";

export const scadenzaService = {
  async getScadenzeIva() {
    const { data, error } = await supabase
      .from("tbscadiva")
      .select(`
        *,
        cliente:tbclienti(ragione_sociale)
      `);
      
    if (error) {
      console.error("Error fetching scadenze IVA:", error);
      return [];
    }
    return data || [];
  },

  async getScadenzeFiscali() {
    const { data, error } = await supabase
      .from("tbscadfiscali")
      .select(`
        *,
        cliente:tbclienti(ragione_sociale)
      `);
      
    if (error) {
      console.error("Error fetching scadenze Fiscali:", error);
      return [];
    }
    return data || [];
  },

  async getAllScadenzeCounts() {
    const results = await Promise.all([
      supabase.from("tbscadiva").select("id", { count: "exact", head: true }),
      supabase.from("tbscadccgg").select("id", { count: "exact", head: true }),
      supabase.from("tbscadcu").select("id", { count: "exact", head: true }),
      supabase.from("tbscadfiscali").select("id", { count: "exact", head: true }),
      supabase.from("tbscadbilanci").select("id", { count: "exact", head: true }),
      supabase.from("tbscad770").select("id", { count: "exact", head: true }),
      supabase.from("tbscadlipe").select("id", { count: "exact", head: true }),
      supabase.from("tbscadestero").select("id", { count: "exact", head: true }),
      supabase.from("tbscadproforma").select("id", { count: "exact", head: true })
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