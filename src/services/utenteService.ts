import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Utente = Database["public"]["Tables"]["TBUtenti"]["Row"];
type UtenteInsert = Database["public"]["Tables"]["TBUtenti"]["Insert"];
type UtenteUpdate = Database["public"]["Tables"]["TBUtenti"]["Update"];

export const utenteService = {
  async getUtenti(): Promise<Utente[]> {
    const { data, error } = await supabase
      .from("TBUtenti")
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
      .from("TBUtenti")
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
      .from("TBUtenti")
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
      .from("TBUtenti")
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
      .from("TBUtenti")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting utente:", error);
      return false;
    }
    return true;
  },

  async getUtenteByUserId(userId: string): Promise<Utente | null> {
    // In questa versione semplificata, assumiamo che non ci sia un collegamento diretto auth.users -> TBUtenti
    // Se necessario, potremmo dover aggiungere un campo auth_user_id a TBUtenti o gestire la logica diversamente
    // Per ora cerco per email se possibile, o ritorno null
    console.warn("getUtenteByUserId non implementato completamente per il nuovo schema");
    return null; 
  }
};