import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type TipoPromemoriaBase = Database["public"]["Tables"]["tbtipopromemoria"]["Row"];

export type TipoPromemoriaCatalogo = TipoPromemoriaBase & {
  origine: "S" | "P";
  studio_id?: string | null;
};

const db = supabase as any;

export const tipoPromemoriaService = {
  async getTipiPromemoria(studioId: string): Promise<TipoPromemoriaCatalogo[]> {
    const { data, error } = await db
      .from("tbtipopromemoria")
      .select("*")
      .or(`origine.eq.S,and(origine.eq.P,studio_id.eq.${studioId})`)
      .order("nome", { ascending: true });

    if (error) {
      console.error("Errore caricamento tipi promemoria:", error);
      throw error;
    }

    return (data || []) as TipoPromemoriaCatalogo[];
  },

  async getTipoPromemoriaById(id: string): Promise<TipoPromemoriaCatalogo | null> {
    const { data, error } = await db
      .from("tbtipopromemoria")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Errore caricamento tipo promemoria:", error);
      throw error;
    }

    return data as TipoPromemoriaCatalogo;
  },

  async creaTipoPromemoria(tipo: {
    nome: string;
    descrizione?: string | null;
    colore?: string | null;
    studio_id: string;
    origine?: "S" | "P";
  }): Promise<TipoPromemoriaCatalogo | null> {
    const { data, error } = await db
      .from("tbtipopromemoria")
      .insert([{ ...tipo, origine: tipo.origine || "P" }])
      .select()
      .single();

    if (error) {
      console.error("Errore creazione tipo promemoria:", error);
      throw error;
    }

    return data as TipoPromemoriaCatalogo;
  },

  async aggiornaTipoPromemoria(
    id: string,
    updates: { nome?: string; descrizione?: string | null; colore?: string | null },
  ): Promise<TipoPromemoriaCatalogo | null> {
    const { data, error } = await db
      .from("tbtipopromemoria")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Errore aggiornamento tipo promemoria:", error);
      throw error;
    }

    return data as TipoPromemoriaCatalogo;
  },

  async eliminaTipoPromemoria(id: string): Promise<void> {
    const { error } = await db
      .from("tbtipopromemoria")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Errore eliminazione tipo promemoria:", error);
      throw error;
    }
  },
};