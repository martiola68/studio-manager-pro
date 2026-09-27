import { getMobileUser, mobileError, mobileSupabaseAdmin } from "@/lib/mobileApiAuth";

export async function GET(request: Request) {
  try {
    const { utente } = await getMobileUser(request);

    const [{ data: utenti, error: utentiError }, { data: clienti, error: clientiError }, { data: eventi, error: eventiError }] =
      await Promise.all([
        mobileSupabaseAdmin
          .from("tbutenti")
          .select("id,nome,cognome,email,settore,attivo,studio_id")
          .eq("studio_id", utente.studio_id)
          .eq("attivo", true)
          .order("cognome", { ascending: true }),
        mobileSupabaseAdmin
          .from("tbclienti")
          .select("id,ragione_sociale,attivo")
          .eq("studio_id", utente.studio_id)
          .eq("attivo", true)
          .eq("cliente", true)
          .order("ragione_sociale", { ascending: true }),
        mobileSupabaseAdmin
          .from("tbagenda")
          .select("id,titolo,descrizione,data_inizio,data_fine,ora_inizio,ora_fine,luogo,sala,in_sede,utente_id,studio_id,riunione_teams,link_teams,evento_generico,ricorrente,partecipanti")
          .eq("studio_id", utente.studio_id)
          .order("data_inizio", { ascending: true })
          .limit(1000),
      ]);

    if (utentiError) throw utentiError;
    if (clientiError) throw clientiError;
    if (eventiError) throw eventiError;

    return Response.json({
      success: true,
      utenti: utenti || [],
      clienti: clienti || [],
      eventi: eventi || [],
      utente_corrente: utente,
    });
  } catch (error) {
    return mobileError(error);
  }
}
