import { supabase } from "@/lib/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Contatto = Database["public"]["Tables"]["tbcontatti"]["Row"];
type ContattoInsert = Database["public"]["Tables"]["tbcontatti"]["Insert"];
type ContattoUpdate = Database["public"]["Tables"]["tbcontatti"]["Update"];

export const contattoService = {
  async getContatti(): Promise<Contatto[]> {
    const { data, error } = await supabase
      .from("tbcontatti")
      .select(`
        id,
        nome,
        cognome,
        email,
        cell,
        tel,
        cliente_id,
        note,
        cassetto_fiscale,
        utente,
        password,
        pin,
        password_iniziale,
        created_at
      `)
      .order("cognome", { ascending: true });

    if (error) {
      console.error("Error fetching contatti:", error);
      return [];
    }
    return data || [];
  },

  async getContattoById(id: string): Promise<Contatto | null> {
    const { data, error } = await supabase
      .from("tbcontatti")
      .select(`
        id,
        nome,
        cognome,
        email,
        cell,
        tel,
        cliente_id,
        note,
        cassetto_fiscale,
        utente,
        password,
        pin,
        password_iniziale,
        created_at
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching contatto:", error);
      return null;
    }
    return data;
  },

  async createContatto(contatto: ContattoInsert): Promise<Contatto | null> {
    const { data, error } = await supabase
      .from("tbcontatti")
      .insert(contatto)
      .select(`
        id,
        nome,
        cognome,
        email,
        cell,
        tel,
        cliente_id,
        note,
        cassetto_fiscale,
        utente,
        password,
        pin,
        password_iniziale,
        created_at
      `)
      .single();

    if (error) {
      console.error("Error creating contatto:", error);
      throw error;
    }
    return data;
  },

  async updateContatto(id: string, updates: Partial<ContattoUpdate>): Promise<Contatto | null> {
    const { data, error } = await supabase
      .from("tbcontatti")
      .update(updates)
      .eq("id", id)
      .select(`
        id,
        nome,
        cognome,
        email,
        cell,
        tel,
        cliente_id,
        note,
        cassetto_fiscale,
        utente,
        password,
        pin,
        password_iniziale,
        created_at
      `)
      .single();

    if (error) {
      console.error("Error updating contatto:", error);
      throw error;
    }
    return data;
  },

  async deleteContatto(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("tbcontatti")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting contatto:", error);
      return false;
    }
    return true;
  }
};