import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type TipoPromemoriaBase = Database["public"]["Tables"]["tbtipopromemoria"]["Row"];

export type TipoPromemoriaCatalogo = TipoPromemoriaBase & {
  origine: "S" | "P";
  studio_id?: string | null;
};

const db = supabase as any;

export const tipoPromemoriaService = {
  async getTipiPromemoria(_studioId?: string): Promise<TipoPromemoriaCatalogo[]> {
    const { data, error } = await db.from("tbtipopromemoria").select("*").eq("origine", "S").order("nome", { ascending: true });
    if (error) { console.error("Errore caricamento tipi promemoria:", error); throw error; }
    return (data || []) as TipoPromemoriaCatalogo[];
  },

  async getTipoPromemoriaById(id: string): Promise<TipoPromemoriaCatalogo | null> {
    const { data, error } = await db.from("tbtipopromemoria").select("*").eq("id", id).eq("origine", "S").single();
    if (error) { console.error("Errore caricamento tipo promemoria:", error); throw error; }
    return data as TipoPromemoriaCatalogo;
  },

  async creaTipoPromemoria(tipo: { nome: string; descrizione?: string | null; colore?: string | null; studio_id?: string | null; origine?: "S" | "P"; }): Promise<TipoPromemoriaCatalogo | null> {
    const payload = { nome: tipo.nome, descrizione: null, colore: tipo.colore || "#3B82F6", origine: "S", studio_id: null };
    const { data, error } = await db.from("tbtipopromemoria").insert([payload]).select().single();
    if (error) { console.error("Errore creazione tipo promemoria:", error); throw error; }
    return data as TipoPromemoriaCatalogo;
  },

  async aggiornaTipoPromemoria(id: string, updates: { nome?: string; descrizione?: string | null; colore?: string | null }): Promise<TipoPromemoriaCatalogo | null> {
    const payload = { ...updates, descrizione: null, origine: "S", studio_id: null };
    const { data, error } = await db.from("tbtipopromemoria").update(payload).eq("id", id).eq("origine", "S").select().single();
    if (error) { console.error("Errore aggiornamento tipo promemoria:", error); throw error; }
    return data as TipoPromemoriaCatalogo;
  },

  async eliminaTipoPromemoria(id: string): Promise<void> {
    const { error } = await db.from("tbtipopromemoria").delete().eq("id", id).eq("origine", "S");
    if (error) { console.error("Errore eliminazione tipo promemoria:", error); throw error; }
  },
};
