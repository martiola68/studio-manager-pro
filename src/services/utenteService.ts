import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/types";

type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];
type UtenteInsert = Database["public"]["Tables"]["tbutenti"]["Insert"];
type UtenteUpdate = Database["public"]["Tables"]["tbutenti"]["Update"];

const utentiSelect = `
  id,
  nome,
  cognome,
  email,
  tipo_utente,
  ruolo_operatore_id,
  attivo,
  created_at,
  updated_at,
  responsabile,
  studio_id,
  settore,
  microsoft_connection_id
`;

export const utenteService = {
  async getUtenti(studioId?: string | null): Promise<Utente[]> {
    let query = supabase
      .from("tbutenti")
      .select(utentiSelect)
      .order("cognome", { ascending: true });

    if (studioId) {
      query = query.eq("studio_id", studioId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data ?? []) as Utente[];
  },

  async getUtenteById(id: string): Promise<Utente | null> {
    const { data, error } = await supabase
      .from("tbutenti")
      .select(utentiSelect)
      .eq("id", id)
      .single();

    if (error) {
      throw error;
    }

    return data as Utente | null;
  },

  async createUtente(utente: UtenteInsert): Promise<Utente | null> {
    const { data, error } = await supabase
      .from("tbutenti")
      .insert(utente)
      .select()
      .single();

    if (error) {
      console.error("Error creating utente:", error);
      throw error;
    }

    return data;
  },

  async updateUtente(id: string, updates: UtenteUpdate): Promise<Utente | null> {
    const { data, error } = await supabase
      .from("tbutenti")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating utente:", error);
      throw error;
    }

    return data;
  },

  async deleteUtente(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("tbutenti")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting utente:", error);
      return false;
    }

    return true;
  },

  async getUtentiStudio(studioId: string): Promise<Utente[]> {
    return await this.getUtenti(studioId);
  },

  async getUtenteByUserId(userId: string): Promise<Utente | null> {
    const { data, error } = await supabase
      .from("tbutenti")
      .select(utentiSelect)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error getting utente by user_id:", error);
      throw error;
    }

    return (data as Utente | null) ?? null;
  },
};
