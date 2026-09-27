import { getMobileUser, mobileError, mobileSupabaseAdmin } from "@/lib/mobileApiAuth";

export async function GET(request: Request) {
  try {
    const { utente } = await getMobileUser(request);

    const { data, error } = await mobileSupabaseAdmin
      .from("tbclienti")
      .select("id,cod_cliente,ragione_sociale,cognome,nome,tipo_cliente,partita_iva,codice_fiscale,email,telefono,pec,citta,provincia,attivo,cliente,settore_fiscale,settore_lavoro,settore_consulenza")
      .eq("studio_id", utente.studio_id)
      .eq("cliente", true)
      .order("ragione_sociale", { ascending: true });

    if (error) throw error;

    return Response.json({ success: true, data: data || [] });
  } catch (error) {
    return mobileError(error);
  }
}
