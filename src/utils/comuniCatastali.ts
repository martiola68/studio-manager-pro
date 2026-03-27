import { getSupabaseClient } from "@/lib/supabaseClient";
import { extractCodiceCatastaleFromCF, normalizeCF } from "@/utils/codiceFiscale";

type ComuneCatastaleRow = {
  id?: string;
  codice_catastale?: string | null;
  comune?: string | null;
  sigla_provincia?: string | null;
  data_inizio_validita?: string | null;
  data_fine_validita?: string | null;
};

export type ComuneFromCFResult = {
  codiceCatastale: string;
  comune: string;
  siglaProvincia: string;
  nazionalita: string;
};

export async function getComuneFromCF(
  codiceFiscale: string
): Promise<ComuneFromCFResult | null> {
  const cf = normalizeCF(codiceFiscale);
  if (cf.length !== 16) return null;

  const codiceCatastale = extractCodiceCatastaleFromCF(cf);
  if (!codiceCatastale) return null;

  const supabase = getSupabaseClient() as any;
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("tb_comuni_catastali")
    .select(
      "id, codice_catastale, comune, sigla_provincia, data_inizio_validita, data_fine_validita"
    )
    .eq("codice_catastale", codiceCatastale)
    .or(`data_fine_validita.is.null,data_fine_validita.gte.${today}`)
    .order("data_inizio_validita", { ascending: false });

  if (error) {
    console.error("Errore ricerca comune catastale:", error);
    return null;
  }

  const rows = (data || []) as ComuneCatastaleRow[];
  if (!rows.length) return null;

  const row = rows[0];
  const comune = row.comune?.trim() || "";

  if (!comune) return null;

  return {
    codiceCatastale,
    comune,
    siglaProvincia: row.sigla_provincia?.trim() || "",
    nazionalita: "Italiana",
  };
}
