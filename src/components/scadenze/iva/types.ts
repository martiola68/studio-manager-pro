import type { Database } from "@/integrations/supabase/types";

export type ScadenzaIvaRow = Database["public"]["Tables"]["tbscadiva"]["Row"];
export type UtenteIva = Database["public"]["Tables"]["tbutenti"]["Row"];

export type ScadenzaIva = ScadenzaIvaRow & {
  anno_riferimento?: number | null;
  archiviato?: boolean | null;
};

export type IvaStats = {
  totale: number;
  confermate: number;
  nonConfermate: number;
};
