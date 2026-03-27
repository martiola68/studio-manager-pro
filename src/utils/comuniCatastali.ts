import { getSupabaseClient } from "@/lib/supabaseClient";
import { extractCodiceCatastaleFromCF, normalizeCF } from "@/utils/codiceFiscale";

type ComuneCatastaleRow = {
  codice_catastale?: string | null;
  comune?: string | null;
  nome?: string | null;
  denominazione?: string | null;
};

export async function getComuneFromCF(codiceFiscale: string): Promise<string | null> {
  const cf = normalizeCF(codiceFiscale);

  if (cf.length !== 16) return null;

  const codiceCatastale = extractCodiceCatastaleFromCF(cf);
  if (!codiceCatastale) return null;

  const supabase = getSupabaseClient() as any;

  const { data, error } = await supabase
    .from("tb_comuni_catastali")
    .select("codice_catastale, comune, nome, denominazione")
    .eq("codice_catastale", codiceCatastale)
    .maybeSingle();

  if (error) {
    console.error("Errore ricerca comune catastale:", error);
    return null;
  }

  const row = data as ComuneCatastaleRow | null;
  if (!row) return null;

  return row.comune || row.nome || row.denominazione || null;
}
