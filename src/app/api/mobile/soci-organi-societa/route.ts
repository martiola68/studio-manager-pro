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
      .eq("tipo_cliente", "Altro")
      .order("ragione_sociale", { ascending: true });

    if (error) throw error;

    const societa = (data || []).filter((cliente: any) => {
      const tipo = String(cliente?.tipo_cliente || "").trim().toLowerCase();
      const cognome = String(cliente?.cognome || "").trim();
      const nome = String(cliente?.nome || "").trim();
      const cf = String(cliente?.codice_fiscale || "").trim().toUpperCase();

      const cfPersonaFisica = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/.test(cf);

      return (
        tipo !== "persona fisica" &&
        !cognome &&
        !nome &&
        !cfPersonaFisica
      );
    });

    return Response.json({ success: true, data: societa });
  } catch (error) {
    return mobileError(error);
  }
}
