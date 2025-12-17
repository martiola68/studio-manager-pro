import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Studio = Database["public"]["Tables"]["TBStudio"]["Row"];
type StudioInsert = Database["public"]["Tables"]["TBStudio"]["Insert"];
type StudioUpdate = Database["public"]["Tables"]["TBStudio"]["Update"];

export const studioService = {
  async getStudio(): Promise<Studio | null> {
    const { data, error } = await supabase
      .from("TBStudio")
      .select("*")
      .single();

    if (error) {
      console.error("Error fetching studio:", error);
      return null;
    }
    return data;
  },

  async createStudio(studio: StudioInsert): Promise<Studio | null> {
    const { data, error } = await supabase
      .from("TBStudio")
      .insert(studio)
      .select()
      .single();

    if (error) {
      console.error("Error creating studio:", error);
      throw error;
    }
    return data;
  },

  async updateStudio(id: string, updates: StudioUpdate): Promise<Studio | null> {
    const { data, error } = await supabase
      .from("TBStudio")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating studio:", error);
      throw error;
    }
    return data;
  }
};