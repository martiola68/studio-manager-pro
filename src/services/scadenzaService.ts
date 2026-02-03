import { supabase } from "@/lib/supabase/client";

export const scadenzaService = {
  async getScadenzeIva(studioId?: string | null) {
    let query = supabase
      .from("tbscadiva")
      .select(`
        *,
        cliente:tbclienti(ragione_sociale)
      `);

    if (studioId) {
      query = query.eq("studio_id", studioId);
    }
      
    const { data, error } = await query;
      
    if (error) {
      console.error("Error fetching scadenze IVA:", error);
      return [];
    }
    return data || [];
  },

  async getScadenzeFiscali(studioId?: string | null) {
    let query = supabase
      .from("tbscadfiscali")
      .select(`
        *,
        cliente:tbclienti(ragione_sociale)
      `);

    if (studioId) {
      query = query.eq("studio_id", studioId);
    }
      
    const { data, error } = await query;
      
    if (error) {
      console.error("Error fetching scadenze Fiscali:", error);
      return [];
    }
    return data || [];
  },

  async getAllScadenzeCounts(studioId?: string | null) {
    const tables = [
      "tbscadiva", "tbscadccgg", "tbscadcu", "tbscadfiscali", 
      "tbscadbilanci", "tbscad770", "tbscadlipe", "tbscadestero", "tbscadproforma"
    ] as const;

    const promises = tables.map(table => {
      let query = supabase.from(table).select("id", { count: "exact", head: true });
      if (studioId) {
        query = query.eq("studio_id", studioId);
      }
      return query;
    });

    const results = await Promise.all(promises);

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