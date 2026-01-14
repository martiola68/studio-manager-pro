import { supabase } from "@/lib/supabase/client";
import { Database } from "@/integrations/supabase/types";

export type CassettoFiscale = Database["public"]["Tables"]["tbcassetti_fiscali"]["Row"];
export type CassettoFiscaleInsert = Database["public"]["Tables"]["tbcassetti_fiscali"]["Insert"];
export type CassettoFiscaleUpdate = Database["public"]["Tables"]["tbcassetti_fiscali"]["Update"];

export const cassettiFiscaliService = {
  async getCassettiFiscali() {
    const { data, error } = await supabase
      .from("tbcassetti_fiscali")
      .select("*")
      .order("nominativo");

    if (error) throw error;
    return data || [];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from("tbcassetti_fiscali")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  async create(cassetto: CassettoFiscaleInsert) {
    const { data, error } = await supabase
      .from("tbcassetti_fiscali")
      .insert(cassetto)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, cassetto: CassettoFiscaleUpdate) {
    const { data, error } = await supabase
      .from("tbcassetti_fiscali")
      .update(cassetto)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("tbcassetti_fiscali")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }
};