import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type EventoAgenda = Database["public"]["Tables"]["TBAgenda"]["Row"];
type EventoAgendaInsert = Database["public"]["Tables"]["TBAgenda"]["Insert"];
type EventoAgendaUpdate = Database["public"]["Tables"]["TBAgenda"]["Update"];

export const eventoService = {
  async getEventi(): Promise<EventoAgenda[]> {
    const { data, error } = await supabase
      .from("TBAgenda")
      .select("*")
      .order("data_inizio", { ascending: true });

    if (error) {
      console.error("Error fetching eventi:", error);
      return [];
    }
    return data || [];
  },

  async getEventoById(id: string): Promise<EventoAgenda | null> {
    const { data, error } = await supabase
      .from("TBAgenda")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching evento:", error);
      return null;
    }
    return data;
  },

  async getEventiByUtente(utenteId: string): Promise<EventoAgenda[]> {
    const { data, error } = await supabase
      .from("TBAgenda")
      .select("*")
      .eq("utente_id", utenteId)
      .order("data_inizio", { ascending: true });

    if (error) {
      console.error("Error fetching eventi by utente:", error);
      return [];
    }
    return data || [];
  },

  async getEventiByCliente(clienteId: string): Promise<EventoAgenda[]> {
    const { data, error } = await supabase
      .from("TBAgenda")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("data_inizio", { ascending: true });

    if (error) {
      console.error("Error fetching eventi by cliente:", error);
      return [];
    }
    return data || [];
  },

  async getEventiByDateRange(startDate: string, endDate: string): Promise<EventoAgenda[]> {
    const { data, error } = await supabase
      .from("TBAgenda")
      .select("*")
      .gte("data_inizio", startDate)
      .lte("data_inizio", endDate)
      .order("data_inizio", { ascending: true });

    if (error) {
      console.error("Error fetching eventi by date range:", error);
      return [];
    }
    return data || [];
  },

  async createEvento(evento: EventoAgendaInsert): Promise<EventoAgenda | null> {
    const { data, error } = await supabase
      .from("TBAgenda")
      .insert(evento)
      .select()
      .single();

    if (error) {
      console.error("Error creating evento:", error);
      throw error;
    }
    return data;
  },

  async updateEvento(id: string, updates: EventoAgendaUpdate): Promise<EventoAgenda | null> {
    const { data, error } = await supabase
      .from("TBAgenda")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating evento:", error);
      throw error;
    }
    return data;
  },

  async deleteEvento(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("TBAgenda")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting evento:", error);
      return false;
    }
    return true;
  }
};