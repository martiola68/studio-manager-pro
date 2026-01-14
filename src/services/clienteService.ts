import { supabase } from "@/lib/supabase/client";
import { Database } from "@/integrations/supabase/types";

export type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"] & {
  tbcassetti_fiscali?: Database["public"]["Tables"]["tbcassetti_fiscali"]["Row"] | null;
};
export type ClienteInsert = Database["public"]["Tables"]["tbclienti"]["Insert"];
export type ClienteUpdate = Database["public"]["Tables"]["tbclienti"]["Update"];

export const clienteService = {
  async getClienti() {
    const { data, error } = await supabase
      .from("tbclienti")
      .select(`
        *,
        tbcassetti_fiscali (*)
      `)
      .order("denominazione");
      
    if (error) throw error;
    return data;
  },

  async getClienteById(id: string) {
    const { data, error } = await supabase
      .from("tbclienti")
      .select(`
        *,
        tbcassetti_fiscali (*)
      `)
      .eq("id", id)
      .single();
      
    if (error) throw error;
    return data;
  },

  async getClientiAttivi(): Promise<Cliente[]> {
    const { data, error } = await supabase
      .from("tbclienti")
      .select("*")
      .eq("attivo", true)
      .order("ragione_sociale", { ascending: true });

    if (error) {
      console.error("Error fetching clienti attivi:", error);
      return [];
    }
    return data || [];
  },

  async createCliente(cliente: ClienteInsert): Promise<Cliente | null> {
    const { data, error } = await supabase
      .from("tbclienti")
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
      .from("tbclienti")
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
      .from("tbclienti")
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
      .from("tbclienti")
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