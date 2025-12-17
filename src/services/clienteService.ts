import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Cliente = Database["public"]["Tables"]["TBClienti"]["Row"];
type ClienteInsert = Database["public"]["Tables"]["TBClienti"]["Insert"];
type ClienteUpdate = Database["public"]["Tables"]["TBClienti"]["Update"];

export const clienteService = {
  async getClienti(): Promise<Cliente[]> {
    const { data, error } = await supabase
      .from("TBClienti")
      .select("*")
      .order("ragione_sociale", { ascending: true });

    if (error) {
      console.error("Error fetching clienti:", error);
      return [];
    }
    return data || [];
  },

  async getClientiAttivi(): Promise<Cliente[]> {
    const { data, error } = await supabase
      .from("TBClienti")
      .select("*")
      .eq("attivo", true)
      .order("ragione_sociale", { ascending: true });

    if (error) {
      console.error("Error fetching clienti attivi:", error);
      return [];
    }
    return data || [];
  },

  async getClienteById(id: string): Promise<Cliente | null> {
    const { data, error } = await supabase
      .from("TBClienti")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching cliente:", error);
      return null;
    }
    return data;
  },

  async createCliente(cliente: ClienteInsert): Promise<Cliente | null> {
    const { data, error } = await supabase
      .from("TBClienti")
      .insert(cliente)
      .select()
      .single();

    if (error) {
      console.error("Error creating cliente:", error);
      throw error;
    }
    return data;
  },

  async updateCliente(id: string, updates: ClienteUpdate): Promise<Cliente | null> {
    const { data, error } = await supabase
      .from("TBClienti")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating cliente:", error);
      throw error;
    }
    return data;
  },

  async deleteCliente(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("TBClienti")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting cliente:", error);
      return false;
    }
    return true;
  },

  async searchClienti(query: string): Promise<Cliente[]> {
    const { data, error } = await supabase
      .from("TBClienti")
      .select("*")
      .or(`ragione_sociale.ilike.%${query}%,partita_iva.ilike.%${query}%,codice_fiscale.ilike.%${query}%`)
      .order("ragione_sociale", { ascending: true });

    if (error) {
      console.error("Error searching clienti:", error);
      return [];
    }
    return data || [];
  }
};