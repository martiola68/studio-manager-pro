import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type TipoPromemoria = Database["public"]["Tables"]["tbtipopromemoria"]["Row"];
type TipoPromemoriaInsert = Database["public"]["Tables"]["tbtipopromemoria"]["Insert"];
type TipoPromemoriaUpdate = Database["public"]["Tables"]["tbtipopromemoria"]["Update"];

export const tipoPromemoriaService = {
  /**
   * Ottiene tutti i tipi di promemoria
   */
  async getTipiPromemoria(): Promise<TipoPromemoria[]> {
    const { data, error } = await supabase
      .from("tbtipopromemoria")
      .select("*")
      .order("nome", { ascending: true });

    if (error) {
      console.error("Errore caricamento tipi promemoria:", error);
      throw error;
    }

    return data || [];
  },

  /**
   * Ottiene un tipo promemoria per ID
   */
  async getTipoPromemoriaById(id: string): Promise<TipoPromemoria | null> {
    const { data, error } = await supabase
      .from("tbtipopromemoria")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Errore caricamento tipo promemoria:", error);
      throw error;
    }

    return data;
  },

  /**
   * Crea un nuovo tipo promemoria
   */
  async creaTipoPromemoria(
    tipo: TipoPromemoriaInsert
  ): Promise<TipoPromemoria | null> {
    const { data, error } = await supabase
      .from("tbtipopromemoria")
      .insert([tipo])
      .select()
      .single();

    if (error) {
      console.error("Errore creazione tipo promemoria:", error);
      throw error;
    }

    return data;
  },

  /**
   * Aggiorna un tipo promemoria
   */
  async aggiornaTipoPromemoria(
    id: string,
    updates: TipoPromemoriaUpdate
  ): Promise<TipoPromemoria | null> {
    const { data, error } = await supabase
      .from("tbtipopromemoria")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Errore aggiornamento tipo promemoria:", error);
      throw error;
    }

    return data;
  },

  /**
   * Elimina un tipo promemoria
   */
  async eliminaTipoPromemoria(id: string): Promise<void> {
    const { error } = await supabase
      .from("tbtipopromemoria")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Errore eliminazione tipo promemoria:", error);
      throw error;
    }
  },
};