import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Comunicazione = Database["public"]["Tables"]["comunicazioni"]["Row"];
type ComunicazioneInsert = Database["public"]["Tables"]["comunicazioni"]["Insert"];
type ComunicazioneUpdate = Database["public"]["Tables"]["comunicazioni"]["Update"];

export const comunicazioneService = {
  async getComunicazioni(): Promise<Comunicazione[]> {
    const { data, error } = await supabase
      .from("comunicazioni")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching comunicazioni:", error);
      return [];
    }
    return data || [];
  },

  async getComunicazioneById(id: string): Promise<Comunicazione | null> {
    const { data, error } = await supabase
      .from("comunicazioni")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching comunicazione:", error);
      return null;
    }
    return data;
  },

  async getComunicazioniByCliente(clienteId: string): Promise<Comunicazione[]> {
    const { data, error } = await supabase
      .from("comunicazioni")
      .select("*")
      .eq("id_cliente", clienteId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching comunicazioni by cliente:", error);
      return [];
    }
    return data || [];
  },

  async getComunicazioniNonLette(): Promise<Comunicazione[]> {
    const { data, error } = await supabase
      .from("comunicazioni")
      .select("*")
      .eq("letto", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching comunicazioni non lette:", error);
      return [];
    }
    return data || [];
  },

  async createComunicazione(comunicazione: ComunicazioneInsert): Promise<Comunicazione | null> {
    const { data, error } = await supabase
      .from("comunicazioni")
      .insert(comunicazione)
      .select()
      .single();

    if (error) {
      console.error("Error creating comunicazione:", error);
      throw error;
    }
    return data;
  },

  async updateComunicazione(id: string, updates: ComunicazioneUpdate): Promise<Comunicazione | null> {
    const { data, error } = await supabase
      .from("comunicazioni")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating comunicazione:", error);
      throw error;
    }
    return data;
  },

  async deleteComunicazione(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("comunicazioni")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting comunicazione:", error);
      return false;
    }
    return true;
  },

  async markAsRead(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("comunicazioni")
      .update({ letto: true })
      .eq("id", id);

    if (error) {
      console.error("Error marking comunicazione as read:", error);
      return false;
    }
    return true;
  }
};