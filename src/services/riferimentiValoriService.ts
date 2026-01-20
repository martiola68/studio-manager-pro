import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type RiferimentoValore = Database["public"]["Tables"]["tbreferimenti_valori"]["Row"];
type RiferimentoValoreInsert = Database["public"]["Tables"]["tbreferimenti_valori"]["Insert"];

export const riferimentiValoriService = {
  async getValoriByTipo(tipo: "matricola_inps" | "pat_inail" | "codice_ditta_ce") {
    const { data, error } = await supabase
      .from("tbreferimenti_valori")
      .select("*")
      .eq("tipo", tipo)
      .order("valore");

    if (error) throw error;
    return data || [];
  },

  async checkExists(tipo: "matricola_inps" | "pat_inail" | "codice_ditta_ce", valore: string) {
    const { data, error } = await supabase
      .from("tbreferimenti_valori")
      .select("*")
      .eq("tipo", tipo)
      .ilike("valore", valore)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createValore(tipo: "matricola_inps" | "pat_inail" | "codice_ditta_ce", valore: string) {
    if (!valore.trim()) return null;

    const { data, error } = await supabase
      .from("tbreferimenti_valori")
      .insert({ tipo, valore: valore.trim() })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return null;
      }
      throw error;
    }
    return data;
  },

  async deleteValore(id: string) {
    const { error } = await supabase
      .from("tbreferimenti_valori")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async searchValori(tipo: "matricola_inps" | "pat_inail" | "codice_ditta_ce", query: string) {
    const { data, error } = await supabase
      .from("tbreferimenti_valori")
      .select("*")
      .eq("tipo", tipo)
      .ilike("valore", `%${query}%`)
      .order("valore")
      .limit(10);

    if (error) throw error;
    return data || [];
  }
};