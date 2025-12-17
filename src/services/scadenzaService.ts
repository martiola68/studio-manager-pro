import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Scadenza = Database["public"]["Tables"]["scadenze"]["Row"];
type ScadenzaInsert = Database["public"]["Tables"]["scadenze"]["Insert"];
type ScadenzaUpdate = Database["public"]["Tables"]["scadenze"]["Update"];

export const scadenzaService = {
  async getScadenze(): Promise<Scadenza[]> {
    const { data, error } = await supabase
      .from("scadenze")
      .select("*")
      .order("data_scadenza", { ascending: true });

    if (error) {
      console.error("Error fetching scadenze:", error);
      return [];
    }
    return data || [];
  },

  async getScadenzaById(id: string): Promise<Scadenza | null> {
    const { data, error } = await supabase
      .from("scadenze")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching scadenza:", error);
      return null;
    }
    return data;
  },

  async getScadenzeByCliente(clienteId: string): Promise<Scadenza[]> {
    const query = supabase
      .from("scadenze")
      .select("*")
      .eq("cliente_id", clienteId);
      
    const { data, error } = await query.order("data_scadenza", { ascending: true });

    if (error) {
      console.error("Error fetching scadenze by cliente:", error);
      return [];
    }
    return data || [];
  },

  async getScadenzeByTipo(tipo: string): Promise<Scadenza[]> {
    const { data, error } = await supabase
      .from("scadenze")
      .select("*")
      .eq("tipo_scadenza", tipo)
      .order("data_scadenza", { ascending: true });

    if (error) {
      console.error("Error fetching scadenze by tipo:", error);
      return [];
    }
    return data || [];
  },

  async getScadenzeConfermate(): Promise<Scadenza[]> {
    const { data, error } = await supabase
      .from("scadenze")
      .select("*")
      .eq("conferma_riga", true)
      .order("data_scadenza", { ascending: true });

    if (error) {
      console.error("Error fetching scadenze confermate:", error);
      return [];
    }
    return data || [];
  },

  async createScadenza(scadenza: ScadenzaInsert): Promise<Scadenza | null> {
    const { data, error } = await supabase
      .from("scadenze")
      .insert(scadenza)
      .select()
      .single();

    if (error) {
      console.error("Error creating scadenza:", error);
      throw error;
    }
    return data;
  },

  async updateScadenza(id: string, updates: ScadenzaUpdate): Promise<Scadenza | null> {
    const { data, error } = await supabase
      .from("scadenze")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating scadenza:", error);
      throw error;
    }
    return data;
  },

  async deleteScadenza(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("scadenze")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting scadenza:", error);
      return false;
    }
    return true;
  }
};