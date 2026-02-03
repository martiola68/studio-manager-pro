import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/types";

type Comunicazione = Database["public"]["Tables"]["tbcomunicazioni"]["Row"];
type ComunicazioneInsert = Database["public"]["Tables"]["tbcomunicazioni"]["Insert"];
type ComunicazioneUpdate = Database["public"]["Tables"]["tbcomunicazioni"]["Update"];

export const comunicazioneService = {
  async getComunicazioni(studioId?: string | null): Promise<Comunicazione[]> {
    let query = supabase
      .from("tbcomunicazioni")
      .select("*")
      .order("created_at", { ascending: false });

    if (studioId) {
      query = query.eq("studio_id", studioId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching comunicazioni:", error);
      return [];
    }
    return data || [];
  },

  async getComunicazioneById(id: string): Promise<Comunicazione | null> {
    const { data, error } = await supabase
      .from("tbcomunicazioni")
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
      .from("tbcomunicazioni")
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
      .from("tbcomunicazioni")
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
      .from("tbcomunicazioni")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting comunicazione:", error);
      return false;
    }
    return true;
  }
};