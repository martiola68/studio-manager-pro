import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type TipoScadenza = Database["public"]["Tables"]["tbtipi_scadenze"]["Row"];
type TipoScadenzaInsert = Database["public"]["Tables"]["tbtipi_scadenze"]["Insert"];
type TipoScadenzaUpdate = Database["public"]["Tables"]["tbtipi_scadenze"]["Update"];

export const tipoScadenzaService = {
  // Recupera tutti i tipi scadenze dello studio
  async getAll(studioId: string): Promise<TipoScadenza[]> {
    const { data, error } = await supabase
      .from("tbtipi_scadenze")
      .select("*")
      .eq("studio_id", studioId)
      .order("data_scadenza", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Recupera tipi scadenze attivi
  async getAttivi(studioId: string): Promise<TipoScadenza[]> {
    const { data, error } = await supabase
      .from("tbtipi_scadenze")
      .select("*")
      .eq("studio_id", studioId)
      .eq("attivo", true)
      .order("data_scadenza", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Recupera tipi scadenze per tipo specifico
  async getByTipo(studioId: string, tipo: string): Promise<TipoScadenza[]> {
    const { data, error } = await supabase
      .from("tbtipi_scadenze")
      .select("*")
      .eq("studio_id", studioId)
      .eq("tipo_scadenza", tipo)
      .eq("attivo", true)
      .order("data_scadenza", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Recupera scadenze imminenti (entro N giorni)
  async getImminenti(studioId: string, giorniAnticipo: number): Promise<TipoScadenza[]> {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() + giorniAnticipo);

    const { data, error } = await supabase
      .from("tbtipi_scadenze")
      .select("*")
      .eq("studio_id", studioId)
      .eq("attivo", true)
      .gte("data_scadenza", new Date().toISOString().split("T")[0])
      .lte("data_scadenza", dataLimite.toISOString().split("T")[0])
      .order("data_scadenza", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Recupera scadenze scadute
  async getScadute(studioId: string): Promise<TipoScadenza[]> {
    const { data, error } = await supabase
      .from("tbtipi_scadenze")
      .select("*")
      .eq("studio_id", studioId)
      .eq("attivo", true)
      .lt("data_scadenza", new Date().toISOString().split("T")[0])
      .order("data_scadenza", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Crea nuovo tipo scadenza
  async create(tipoScadenza: TipoScadenzaInsert): Promise<TipoScadenza> {
    const { data, error } = await supabase
      .from("tbtipi_scadenze")
      .insert(tipoScadenza)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Aggiorna tipo scadenza
  async update(id: string, updates: TipoScadenzaUpdate): Promise<TipoScadenza> {
    const { data, error } = await supabase
      .from("tbtipi_scadenze")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Elimina tipo scadenza
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("tbtipi_scadenze")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  // Attiva/disattiva tipo scadenza
  async toggleAttivo(id: string, attivo: boolean): Promise<TipoScadenza> {
    return this.update(id, { attivo });
  },
};