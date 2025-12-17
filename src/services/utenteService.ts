import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Utente = Database["public"]["Tables"]["utenti"]["Row"];
type UtenteInsert = Database["public"]["Tables"]["utenti"]["Insert"];
type UtenteUpdate = Database["public"]["Tables"]["utenti"]["Update"];

export const utenteService = {
  async getUtenti(): Promise<Utente[]> {
    const { data, error } = await supabase
      .from("utenti")
      .select("*")
      .order("cognome", { ascending: true });

    if (error) {
      console.error("Error fetching utenti:", error);
      return [];
    }
    return data || [];
  },

  async getUtenteById(id: string): Promise<Utente | null> {
    const { data, error } = await supabase
      .from("utenti")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching utente:", error);
      return null;
    }
    return data;
  },

  async createUtente(utente: UtenteInsert): Promise<Utente | null> {
    const { data, error } = await supabase
      .from("utenti")
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
      .from("utenti")
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
      .from("utenti")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting utente:", error);
      return false;
    }
    return true;
  },

  async getUtenteByUserId(userId: string): Promise<Utente | null> {
    const { data, error } = await supabase
      .from("utenti")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching utente by user_id:", error);
      return null;
    }
    return data;
  }
};