import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Contatto = Database["public"]["Tables"]["TBContatti"]["Row"];
type ContattoInsert = Database["public"]["Tables"]["TBContatti"]["Insert"];
type ContattoUpdate = Database["public"]["Tables"]["TBContatti"]["Update"];

export const contattoService = {
  async getContatti(): Promise<Contatto[]> {
    const { data, error } = await supabase
      .from("TBContatti")
      .select("*")
      .order("cognome", { ascending: true });

    if (error) {
      console.error("Error fetching contatti:", error);
      return [];
    }
    return data || [];
  },

  async getContattoById(id: string): Promise<Contatto | null> {
    const { data, error } = await supabase
      .from("TBContatti")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching contatto:", error);
      return null;
    }
    return data;
  },

  async getContattiByCliente(clienteId: string): Promise<Contatto[]> {
    const { data, error } = await supabase
      .from("contatti")
      .select("*")
      .eq("id_cliente", clienteId)
      .order("cognome", { ascending: true });

    if (error) {
      console.error("Error fetching contatti by cliente:", error);
      return [];
    }
    return data || [];
  },

  async createContatto(contatto: ContattoInsert): Promise<Contatto | null> {
    const { data, error } = await supabase
      .from("TBContatti")
      .insert(contatto)
      .select()
      .single();

    if (error) {
      console.error("Error creating contatto:", error);
      throw error;
    }
    return data;
  },

  async updateContatto(id: string, updates: ContattoUpdate): Promise<Contatto | null> {
    const { data, error } = await supabase
      .from("TBContatti")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating contatto:", error);
      throw error;
    }
    return data;
  },

  async deleteContatto(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("TBContatti")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting contatto:", error);
      return false;
    }
    return true;
  }
};