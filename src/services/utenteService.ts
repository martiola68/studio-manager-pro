import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/types";

type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];
type UtenteInsert = Database["public"]["Tables"]["tbutenti"]["Insert"];
type UtenteUpdate = Database["public"]["Tables"]["tbutenti"]["Update"];

export const utenteService = {
  async getUtenti() {
    const { data, error } = await supabase
      .from("tbutenti")
      .select("id, nome, cognome, email, tipo_utente, ruolo_operatore_id, attivo, created_at, updated_at, settore, responsabile")
      .order("cognome", { ascending: true });

    if (error) {
      throw error;
    }

    return data;
  },

  async getUtenteById(id: string) {
    const { data, error } = await supabase
      .from("tbutenti")
      .select("id, nome, cognome, email, tipo_utente, ruolo_operatore_id, attivo, created_at, updated_at, settore, responsabile")
      .eq("id", id)
      .single();

    if (error) {
      throw error;
    }

    return data;
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
    // In un sistema multi-studio, qui filtreremmo per studio_id
    // Dato che lo schema attuale non ha studio_id su tbutenti, restituiamo tutti (single tenant logic)
    return this.getUtenti();
  },

  async getUtenteByUserId(userId: string): Promise<Utente | null> {
    console.warn("getUtenteByUserId non implementato completamente per il nuovo schema");
    return null; 
  }
};