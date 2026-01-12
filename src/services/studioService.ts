import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/types";

type Studio = Database["public"]["Tables"]["tbstudio"]["Row"];
type StudioInsert = Database["public"]["Tables"]["tbstudio"]["Insert"];
type StudioUpdate = Database["public"]["Tables"]["tbstudio"]["Update"];

export const studioService = {
  async getStudio(): Promise<Studio | null> {
    const { data, error } = await supabase
      .from("tbstudio")
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
      .from("tbstudio")
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
      .from("tbstudio")
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