import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

export async function GET() {
  const { data: prestazione, error: prestazioneError } = await supabaseAdmin
    .from("tbprestazioni")
    .select("id")
    .ilike("nome", "Controllo di gestione")
    .maybeSingle();

  if (prestazioneError) {
    return NextResponse.json(
      { error: prestazioneError.message },
      { status: 500 }
    );
  }

  if (!prestazione) {
    return NextResponse.json([]);
  }

  const { data: clienti, error } = await supabaseAdmin
    .from("tbclienti")
    .select("id, ragione_sociale, cod_cliente, tipo_prestazione_id, attivo")
    .eq("attivo", true)
    .eq("tipo_prestazione_id", prestazione.id)
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
