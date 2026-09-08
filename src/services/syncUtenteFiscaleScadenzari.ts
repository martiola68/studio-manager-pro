import { getSupabaseClient } from "@/lib/supabase/client";

const SCADENZARI_FISCALI = [
  "tbscadiva",
  "tbscadccgg",
  "tbscadcu",
  "tbscadfiscali",
  "tbscadbilanci",
  "tbscad770",
  "tbscadlipe",
  "tbscadestero",
  "tbscadimu",
] as const;

export async function syncUtenteFiscaleScadenzari(
  clienteId: string,
  nuovoUtenteOperatoreId: string | null
) {
  const supabase = getSupabaseClient();

  for (const table of SCADENZARI_FISCALI) {
    const { error } = await (supabase as any)
      .from(table)
      .update({ utente_operatore_id: nuovoUtenteOperatoreId })
      .eq("cliente_id", clienteId);

    if (error) {
      throw new Error(
        `Errore aggiornamento Utente Fiscale nello scadenzario ${table}: ${error.message}`
      );
    }
  }
}
