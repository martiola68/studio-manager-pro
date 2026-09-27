import { getMobileUser, mobileError, mobileSupabaseAdmin } from "@/lib/mobileApiAuth";

export async function GET(request: Request) {
  try {
    const { utente } = await getMobileUser(request);

    const { data, error } = await mobileSupabaseAdmin
      .from("tbclienti")
      .select("id, ragione_sociale, cod_cliente, codice_fiscale, partita_iva, tipo_cliente, attivo, cliente")
      .eq("studio_id", utente.studio_id)
      .eq("cliente", true)
      .eq("attivo", true)
      .eq("tipo_cliente", "Altro")
      .order("ragione_sociale", { ascending: true });

    if (error) throw error;

    return Response.json({ success: true, data: data || [] });
  } catch (error) {
    return mobileError(error);
  }
}
