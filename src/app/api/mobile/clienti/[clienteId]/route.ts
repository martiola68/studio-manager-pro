import { getMobileUser, mobileError, mobileSupabaseAdmin } from "@/lib/mobileApiAuth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clienteId: string }> }
) {
  try {
    const { utente } = await getMobileUser(request);
    const { clienteId } = await params;

    const { data: cliente, error } = await mobileSupabaseAdmin
      .from("tbclienti")
      .select("id,cod_cliente,ragione_sociale,cognome,nome,tipo_cliente,partita_iva,codice_fiscale,indirizzo,cap,citta,provincia,numero_rea,email,telefono,pec,cassetto_fiscale_id,utente_operatore_id,utente_payroll_id,utente_consulenza_id,attivo,cliente,settore_fiscale,settore_lavoro,settore_consulenza")
      .eq("id", clienteId)
      .eq("studio_id", utente.studio_id)
      .maybeSingle();

    if (error) throw error;
    if (!cliente) {
      return Response.json({ success: false, error: "Cliente non trovato." }, { status: 404 });
    }

    const userIds = [
      cliente.utente_operatore_id,
      cliente.utente_payroll_id,
      cliente.utente_consulenza_id,
    ].filter(Boolean) as string[];

    let utentiById = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: utenti, error: utentiError } = await mobileSupabaseAdmin
        .from("tbutenti")
        .select("id,nome,cognome,email")
        .in("id", userIds);

      if (utentiError) throw utentiError;

      utentiById = new Map(
        (utenti || []).map((u: any) => [
          String(u.id),
          (`${u.nome || ""} ${u.cognome || ""}`.trim() || u.email || ""),
        ])
      );
    }

    let cassettoNominativo = "";
    if (cliente.cassetto_fiscale_id) {
      const { data: cassetto, error: cassettoError } = await mobileSupabaseAdmin
        .from("tbcassetti_fiscali")
        .select("id,nominativo")
        .eq("id", cliente.cassetto_fiscale_id)
        .eq("studio_id", utente.studio_id)
        .maybeSingle();

      if (cassettoError) throw cassettoError;
      cassettoNominativo = cassetto?.nominativo || "";
    }

    return Response.json({
      success: true,
      data: {
        ...cliente,
        utente_fiscale_nome: cliente.utente_operatore_id
          ? utentiById.get(String(cliente.utente_operatore_id)) || ""
          : "",
        utente_payroll_nome: cliente.utente_payroll_id
          ? utentiById.get(String(cliente.utente_payroll_id)) || ""
          : "",
        utente_consulenza_nome: cliente.utente_consulenza_id
          ? utentiById.get(String(cliente.utente_consulenza_id)) || ""
          : "",
        cassetto_fiscale_nominativo: cassettoNominativo,
      },
    });
  } catch (error) {
    return mobileError(error);
  }
}
