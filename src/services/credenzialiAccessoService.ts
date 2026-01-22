import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type CredenzialeAccesso = Database["public"]["Tables"]["tbcredenziali_accesso"]["Row"];
type CredenzialeAccessoInsert = Database["public"]["Tables"]["tbcredenziali_accesso"]["Insert"];
type CredenzialeAccessoUpdate = Database["public"]["Tables"]["tbcredenziali_accesso"]["Update"];

export const credenzialiAccessoService = {
  async getAll(studioId: string): Promise<CredenzialeAccesso[]> {
    const { data, error } = await supabase
      .from("tbcredenziali_accesso")
      .select("*")
      .eq("studio_id", studioId)
      .order("portale", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<CredenzialeAccesso | null> {
    const { data, error } = await supabase
      .from("tbcredenziali_accesso")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  async create(credenziale: CredenzialeAccessoInsert): Promise<CredenzialeAccesso> {
    const { data, error } = await supabase
      .from("tbcredenziali_accesso")
      .insert(credenziale)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, credenziale: CredenzialeAccessoUpdate): Promise<CredenzialeAccesso> {
    const { data, error } = await supabase
      .from("tbcredenziali_accesso")
      .update({ ...credenziale, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("tbcredenziali_accesso")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async search(studioId: string, searchTerm: string): Promise<CredenzialeAccesso[]> {
    const { data, error } = await supabase
      .from("tbcredenziali_accesso")
      .select("*")
      .eq("studio_id", studioId)
      .ilike("portale", `%${searchTerm}%`)
      .order("portale", { ascending: true });

    if (error) throw error;
    return data || [];
  },
};