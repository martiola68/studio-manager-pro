import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

export async function GET() {
const { data: prestazioni, error: prestazioneError } = await supabaseAdmin
  .from("tbprestazioni")
  .select("id, descrizione")
  .in("descrizione", [
    "Controllo di gestione",
    "Assistenza totale",
  ]);

if (prestazioneError) {
  return NextResponse.json(
    { error: prestazioneError.message },
    { status: 500 }
  );
}

const prestazioniIds = (prestazioni || []).map((p) => p.id);

if (prestazioniIds.length === 0) {
  return NextResponse.json([]);
}
  const { data: clienti, error } = await supabaseAdmin
    .from("tbclienti")
    .select("id, ragione_sociale, cod_cliente, tipo_prestazione_id, attivo")
    .eq("attivo", true)
    .in("tipo_prestazione_id", prestazioniIds)
    .order("ragione_sociale", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: controlliAttivi, error: controlliError } = await supabaseAdmin
    .from("tbcontrollo_gestione")
    .select("cliente_id")
    .eq("archiviato", false);

  if (controlliError) {
    return NextResponse.json(
      { error: controlliError.message },
      { status: 500 }
    );
  }

  const clientiGiaAttivi = new Set(
    (controlliAttivi || []).map((c) => c.cliente_id)
  );

  const disponibili = (clienti || []).filter(
    (cliente) => !clientiGiaAttivi.has(cliente.id)
  );

  return NextResponse.json(disponibili);
}
