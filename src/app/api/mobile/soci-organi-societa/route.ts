import { isCompanyClient } from "@/lib/isCompanyClient";
import { getMobileUser, mobileError, mobileSupabaseAdmin } from "@/lib/mobileApiAuth";

export async function GET(request: Request) {
  try {
    const { utente } = await getMobileUser(request);

    const { data, error } = await mobileSupabaseAdmin
      .from("tbclienti")
      .select("id, ragione_sociale, cod_cliente, codice_fiscale, partita_iva, cognome, nome, tipo_cliente, attivo, cliente")
      .eq("studio_id", utente.studio_id)
      .eq("cliente", true)
      .eq("attivo", true)
      .order("ragione_sociale", { ascending: true });

    if (error) throw error;

    const societa = (data || []).filter(isCompanyClient);

    return Response.json({ success: true, data: societa });
  } catch (error) {
    return mobileError(error);
  }
}
