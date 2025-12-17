import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Comunicazione = Database["public"]["Tables"]["TBComunicazioni"]["Row"];
type ComunicazioneInsert = Database["public"]["Tables"]["TBComunicazioni"]["Insert"];
type ComunicazioneUpdate = Database["public"]["Tables"]["TBComunicazioni"]["Update"];

export const comunicazioneService = {
  async getComunicazioni(): Promise<Comunicazione[]> {
    const { data, error } = await supabase
      .from("TBComunicazioni")
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
      .from("TBComunicazioni")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching comunicazione:", error);
      return null;
    }
    return data;
  },

  async createComunicazione(comunicazione: ComunicazioneInsert): Promise<Comunicazione | null> {
    const { data, error } = await supabase
      .from("TBComunicazioni")
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
      .from("TBComunicazioni")
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
      .from("TBComunicazioni")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting comunicazione:", error);
      return false;
    }
    return true;
  }
};