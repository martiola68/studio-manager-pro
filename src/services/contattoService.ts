import { supabase } from "@/lib/supabase/client";
import { Database } from "@/integrations/supabase/types";

export type Contatto = Database["public"]["Tables"]["tbcontatti"]["Row"];
export type ContattoInsert = Database["public"]["Tables"]["tbcontatti"]["Insert"];
export type ContattoUpdate = Database["public"]["Tables"]["tbcontatti"]["Update"];

export const contattoService = {
  async getContatti() {
    const { data, error } = await supabase
      .from("tbcontatti")
      .select("*")
      .order("cognome", { ascending: true });

    if (error) throw error;
    return data;
  },

  async getContattoById(id: string) {
    const { data, error } = await supabase
      .from("tbcontatti")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  async createContatto(contatto: ContattoInsert) {
    // Rimuovi campi non validi se presenti (pulizia difensiva)
    const { ...validContatto } = contatto;
    
    const { data, error } = await supabase
      .from("tbcontatti")
      .insert(validContatto)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateContatto(id: string, updates: ContattoUpdate) {
    // Rimuovi campi non validi se presenti (pulizia difensiva)
    const { ...validUpdates } = updates;

    const { data, error } = await supabase
      .from("tbcontatti")
      .update(validUpdates)
      .eq("id", id)
      .select("*") // Explicitly select all columns including updated_at
      .single();

    if (error) throw error;
    return data;
  },

  async deleteContatto(id: string) {
    const { error } = await supabase
      .from("tbcontatti")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }
};