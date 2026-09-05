import { supabase } from "@/lib/supabase/client";
import {
  promemoriaService as legacyPromemoriaService,
  type Promemoria,
  type Allegato,
} from "./promemoriaServiceLegacy";

export type { Promemoria, Allegato } from "./promemoriaServiceLegacy";

async function getPromemoria(
  studioId?: string | null,
  userId?: string,
  isResponsabile?: boolean,
  userSettore?: string | null
) {
  let query = supabase
    .from("tbpromemoria")
    .select(`
      *,
      operatore:tbutenti!tbpromemoria_operatore_id_fkey(id, nome, cognome, settore, responsabile),
      destinatario:tbutenti!tbpromemoria_destinatario_id_fkey(id, nome, cognome, settore, responsabile)
    `);

  if (studioId) {
    query = query.eq("studio_id", studioId);
  }

  query = query.order("data_scadenza", {
    ascending: true,
    nullsFirst: false,
  });

  const { data, error } = await query;
  if (error) throw error;

  let filteredData = data || [];

  if (isResponsabile && userSettore) {
    filteredData = filteredData.filter((p) => {
      const op = p.operatore;

      if (p.operatore_id === userId || p.destinatario_id === userId) {
        return true;
      }

      if (op?.settore === userSettore && op?.responsabile === false) {
        return true;
      }

      return false;
    });
  } else {
    filteredData = filteredData.filter(
      (p) => p.destinatario_id === userId || p.operatore_id === userId
    );
  }

  return filteredData as Promemoria[];
}

async function getStatistiche(utenteId: string) {
  const { data, error } = await supabase
    .from("tbpromemoria")
    .select("working_progress, da_fatturare, fatturato")
    .eq("operatore_id", utenteId);

  if (error) {
    console.error("Errore caricamento statistiche:", error);
    return {
      totali: 0,
      inLavorazione: 0,
      conclusi: 0,
      daFatturare: 0,
      fatturati: 0,
    };
  }

  const promemoria = data || [];

  return {
    totali: promemoria.length,
    inLavorazione: promemoria.filter(
      (p) => p.working_progress === "In lavorazione"
    ).length,
    conclusi: promemoria.filter(
      (p) => p.working_progress === "Concluso"
    ).length,
    daFatturare: promemoria.filter(
      (p) => p.da_fatturare && !p.fatturato
    ).length,
    fatturati: promemoria.filter((p) => p.fatturato).length,
  };
}

export const promemoriaService = {
  ...legacyPromemoriaService,
  getPromemoria,
  getStatistiche,
};
