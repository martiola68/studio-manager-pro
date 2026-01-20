import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/types";

// Fallback manuale se il tipo non è ancora stato rigenerato correttamente
type CredenzialeRow = {
  id: string;
  portale: string;
  indirizzo_url: string | null;
  login_utente: string;
  login_pw: string;
  login_pin: string | null;
  note: string | null;
  created_at: string | null;
  studio_id: string | null;
};

export type Credenziale = Database["public"]["Tables"] extends { credenziali_accesso: any } 
  ? Database["public"]["Tables"]["credenziali_accesso"]["Row"] 
  : CredenzialeRow;

export type CredenzialeInsert = Database["public"]["Tables"] extends { credenziali_accesso: any }
  ? Database["public"]["Tables"]["credenziali_accesso"]["Insert"]
  : Omit<CredenzialeRow, "id" | "created_at">;

export type CredenzialeUpdate = Database["public"]["Tables"] extends { credenziali_accesso: any }
  ? Database["public"]["Tables"]["credenziali_accesso"]["Update"]
  : Partial<CredenzialeInsert>;

export const passwordService = {
  async getCredenziali() {
    const { data, error } = await supabase
      .from("credenziali_accesso" as any)
      .select("*")
      .order("portale", { ascending: true });

    if (error) throw error;
    return data as unknown as Credenziale[];
  },

  async getCredenzialeById(id: string) {
    const { data, error } = await supabase
      .from("credenziali_accesso" as any)
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as unknown as Credenziale;
  },

  async createCredenziale(credenziale: CredenzialeInsert) {
    const { data, error } = await supabase
      .from("credenziali_accesso" as any)
      .insert(credenziale)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Credenziale;
  },

  async updateCredenziale(id: string, updates: CredenzialeUpdate) {
    const { data, error } = await supabase
      .from("credenziali_accesso" as any)
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Credenziale;
  },

  async deleteCredenziale(id: string) {
    const { error } = await supabase
      .from("credenziali_accesso" as any)
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  }
};