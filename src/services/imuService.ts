import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type ScadenzaIMU = Database["public"]["Tables"]["tbscadimu"]["Row"];
type ScadenzaIMUInsert = Database["public"]["Tables"]["tbscadimu"]["Insert"];
type ScadenzaIMUUpdate = Database["public"]["Tables"]["tbscadimu"]["Update"];

export const imuService = {
  // Fetch tutte le scadenze IMU
  async fetchAll(): Promise<ScadenzaIMU[]> {
    const { data, error } = await supabase
      .from("tbscadimu")
      .select(`
        *,
        professionista:tbutenti!tbscadimu_utente_professionista_id_fkey(id, nome, cognome),
        operatore:tbutenti!tbscadimu_utente_operatore_id_fkey(id, nome, cognome)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching IMU scadenze:", error);
      throw error;
    }

    return data || [];
  },

  // Fetch singola scadenza IMU
  async fetchById(id: string): Promise<ScadenzaIMU | null> {
    const { data, error } = await supabase
      .from("tbscadimu")
      .select(`
        *,
        professionista:tbutenti!tbscadimu_utente_professionista_id_fkey(id, nome, cognome),
        operatore:tbutenti!tbscadimu_utente_operatore_id_fkey(id, nome, cognome)
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching IMU scadenza:", error);
      throw error;
    }

    return data;
  },

  // Crea nuova scadenza IMU
  async create(scadenza: ScadenzaIMUInsert): Promise<ScadenzaIMU> {
    const { data, error } = await supabase
      .from("tbscadimu")
      .insert(scadenza)
      .select()
      .single();

    if (error) {
      console.error("Error creating IMU scadenza:", error);
      throw error;
    }

    return data;
  },

  // Aggiorna scadenza IMU
  async update(id: string, updates: ScadenzaIMUUpdate): Promise<ScadenzaIMU> {
    const { data, error } = await supabase
      .from("tbscadimu")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating IMU scadenza:", error);
      throw error;
    }

    return data;
  },

  // Elimina scadenza IMU
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("tbscadimu")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting IMU scadenza:", error);
      throw error;
    }
  },

  // Fetch scadenze IMU filtrate per operatore
  async fetchByOperatore(operatoreId: string): Promise<ScadenzaIMU[]> {
    const { data, error } = await supabase
      .from("tbscadimu")
      .select(`
        *,
        professionista:tbutenti!tbscadimu_utente_professionista_id_fkey(id, nome, cognome),
        operatore:tbutenti!tbscadimu_utente_operatore_id_fkey(id, nome, cognome)
      `)
      .eq("utente_operatore_id", operatoreId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching IMU scadenze by operatore:", error);
      throw error;
    }

    return data || [];
  },

  // Fetch scadenze IMU in scadenza (per alert)
  async fetchInScadenza(giorniProssimi: number = 30): Promise<ScadenzaIMU[]> {
    const oggi = new Date();
    const dataFine = new Date();
    dataFine.setDate(oggi.getDate() + giorniProssimi);

    const { data, error } = await supabase
      .from("tbscadimu")
      .select(`
        *,
        professionista:tbutenti!tbscadimu_utente_professionista_id_fkey(id, nome, cognome),
        operatore:tbutenti!tbscadimu_utente_operatore_id_fkey(id, nome, cognome)
      `)
      .or(`acconto_data.lte.${dataFine.toISOString()},saldo_data.lte.${dataFine.toISOString()},dichiarazione_scadenza.lte.${dataFine.toISOString()}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching IMU scadenze in scadenza:", error);
      throw error;
    }

    return data || [];
  }
};