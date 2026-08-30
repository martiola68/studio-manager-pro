import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type TipoScadenzaBase = Database["public"]["Tables"]["tbtipi_scadenze"]["Row"];
type TipoScadenzaInsert = Database["public"]["Tables"]["tbtipi_scadenze"]["Insert"];
type TipoScadenzaUpdate = Database["public"]["Tables"]["tbtipi_scadenze"]["Update"];

export type TipoScadenzaCatalogo = TipoScadenzaBase & {
  origine: "S" | "P";
  attivo_effettivo?: boolean;
  ha_scadenzario?: boolean | null;
};

const db = supabase as any;

export const tipoScadenzaService = {
  async getAll(studioId: string): Promise<TipoScadenzaCatalogo[]> {
    const { data, error } = await db
      .from("tbtipi_scadenze")
      .select("*")
      .or(`origine.eq.S,and(origine.eq.P,studio_id.eq.${studioId})`)
      .order("data_scadenza", { ascending: true });

    if (error) throw error;

    const rows = (data || []) as TipoScadenzaCatalogo[];
    const systemIds = rows.filter((row) => row.origine === "S").map((row) => row.id);
    let overrides: Record<string, boolean> = {};

    if (systemIds.length > 0) {
      const { data: stateRows, error: stateError } = await db
        .from("tbtipi_scadenze_studio")
        .select("tipo_scadenza_id, attivo")
        .eq("studio_id", studioId)
        .in("tipo_scadenza_id", systemIds);

      if (stateError) throw stateError;
      overrides = Object.fromEntries(
        (stateRows || []).map((row: any) => [row.tipo_scadenza_id, row.attivo]),
      );
    }

    return rows.map((row) => ({
      ...row,
      attivo_effettivo:
        row.origine === "S"
          ? Object.prototype.hasOwnProperty.call(overrides, row.id)
            ? overrides[row.id]
            : row.attivo !== false
          : row.attivo !== false,
    }));
  },

  async getAttivi(studioId: string): Promise<TipoScadenzaCatalogo[]> {
    const rows = await this.getAll(studioId);
    return rows.filter((row) => row.attivo_effettivo !== false);
  },

  async getByTipo(studioId: string, tipo: string): Promise<TipoScadenzaCatalogo[]> {
    const rows = await this.getAttivi(studioId);
    return rows.filter((row) => row.tipo_scadenza === tipo);
  },

  async getImminenti(studioId: string, giorniAnticipo: number): Promise<TipoScadenzaCatalogo[]> {
    const today = new Date().toISOString().split("T")[0];
    const limit = new Date();
    limit.setDate(limit.getDate() + giorniAnticipo);
    const limitKey = limit.toISOString().split("T")[0];
    const rows = await this.getAttivi(studioId);
    return rows.filter((row) => row.data_scadenza >= today && row.data_scadenza <= limitKey);
  },

  async getScadute(studioId: string): Promise<TipoScadenzaCatalogo[]> {
    const today = new Date().toISOString().split("T")[0];
    const rows = await this.getAttivi(studioId);
    return rows
      .filter((row) => row.data_scadenza < today)
      .sort((a, b) => b.data_scadenza.localeCompare(a.data_scadenza));
  },

  async create(tipoScadenza: TipoScadenzaInsert & { origine?: "S" | "P" }): Promise<TipoScadenzaCatalogo> {
    const { data, error } = await db
      .from("tbtipi_scadenze")
      .insert({ ...tipoScadenza, origine: tipoScadenza.origine || "P" })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: TipoScadenzaUpdate): Promise<TipoScadenzaCatalogo> {
    const { data, error } = await db
      .from("tbtipi_scadenze")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await db.from("tbtipi_scadenze").delete().eq("id", id);
    if (error) throw error;
  },

  async toggleAttivo(tipo: TipoScadenzaCatalogo, studioId: string, attivo: boolean): Promise<void> {
    if (tipo.origine === "S") {
      const { error } = await db
        .from("tbtipi_scadenze_studio")
        .upsert(
          {
            studio_id: studioId,
            tipo_scadenza_id: tipo.id,
            attivo,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "studio_id,tipo_scadenza_id" },
        );
      if (error) throw error;
      return;
    }

    await this.update(tipo.id, { attivo });
  },
};