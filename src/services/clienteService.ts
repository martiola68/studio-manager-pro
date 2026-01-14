import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];
type ClienteInsert = Database["public"]["Tables"]["tbclienti"]["Insert"];
type ClienteUpdate = Database["public"]["Tables"]["tbclienti"]["Update"];

export const clienteService = {
  async getClienti() {
    const { data, error } = await supabase
      .from("tbclienti")
      .select(`
        *,
        tbcassetti_fiscali (*)
      `)
      .order("ragione_sociale");

    if (error) throw error;
    return data || [];
  },

  async getClienteById(id: string) {
    const { data, error } = await supabase
      .from("tbclienti")
      .select(`
        *,
        tbcassetti_fiscali (*)
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  async createCliente(cliente: ClienteInsert) {
    const { data, error } = await supabase
      .from("tbclienti")
      .insert(cliente)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateCliente(id: string, updates: ClienteUpdate) {
    const { data, error } = await supabase
      .from("tbclienti")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteCliente(id: string) {
    // Prima elimina le scadenze associate
    const deletePromises = [
      supabase.from("tbscadiva").delete().eq("id", id),
      supabase.from("tbscad770").delete().eq("id", id),
      supabase.from("tbscadlipe").delete().eq("id", id),
      supabase.from("tbscadestero").delete().eq("id", id),
      supabase.from("tbscadproforma").delete().eq("id", id),
      supabase.from("tbscadimu").delete().eq("id", id),
      supabase.from("tbscadcu").delete().eq("id", id),
      supabase.from("tbscadbilanci").delete().eq("id", id),
      supabase.from("tbscadccgg").delete().eq("id", id),
      supabase.from("tbscadfiscali").delete().eq("id", id)
    ];

    await Promise.all(deletePromises);

    // Poi elimina il cliente
    const { error } = await supabase
      .from("tbclienti")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async searchClienti(query: string) {
    const { data, error } = await supabase
      .from("tbclienti")
      .select(`
        *,
        tbcassetti_fiscali (*)
      `)
      .or(`ragione_sociale.ilike.%${query}%,partita_iva.ilike.%${query}%,codice_fiscale.ilike.%${query}%`)
      .order("ragione_sociale");

    if (error) throw error;
    return data || [];
  },

  async getClientiByUtente(utenteId: string) {
    const { data, error } = await supabase
      .from("tbclienti")
      .select(`
        *,
        tbcassetti_fiscali (*)
      `)
      .or(`utente_operatore_id.eq.${utenteId},utente_professionista_id.eq.${utenteId}`)
      .order("ragione_sociale");

    if (error) throw error;
    return data || [];
  },

  async getClientiAttivi() {
    const { data, error } = await supabase
      .from("tbclienti")
      .select(`
        *,
        tbcassetti_fiscali (*)
      `)
      .eq("attivo", true)
      .order("ragione_sociale");

    if (error) throw error;
    return data || [];
  }
};