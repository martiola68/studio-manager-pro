import { getMobileUser, mobileError, mobileSupabaseAdmin } from "@/lib/mobileApiAuth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const { utente } = await getMobileUser(request);

    let presenzeQuery = mobileSupabaseAdmin
      .from("tbpresenze_dipendenti")
      .select("id,data_presenza,codice_presenza,note")
      .eq("utente_id", utente.id)
      .order("data_presenza", { ascending: true });

    if (from) presenzeQuery = presenzeQuery.gte("data_presenza", from);
    if (to) presenzeQuery = presenzeQuery.lte("data_presenza", to);

    const [{ data: presenze, error: pError }, { data: codici, error: cError }] =
      await Promise.all([
        presenzeQuery,
        mobileSupabaseAdmin
          .from("tbpresenze_codici")
          .select("codice,descrizione,tipo,ordine,attivo")
          .eq("attivo", true)
          .order("ordine", { ascending: true }),
      ]);

    if (pError) throw pError;
    if (cError) throw cError;

    return Response.json({
      success: true,
      utente,
      presenze: presenze || [],
      codici: codici || [],
    });
  } catch (error) {
    return mobileError(error);
  }
}
