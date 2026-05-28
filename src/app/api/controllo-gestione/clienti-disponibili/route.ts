import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

export async function GET() {
  const { data: clienti, error } = await supabaseAdmin
    .from("tbclienti")
    .select("*")
    .order("ragione_sociale", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: controlliAttivi, error: controlliError } = await supabaseAdmin
    .from("tbcontrollo_gestione")
    .select("cliente_id")
    .eq("archiviato", false);

  if (controlliError) {
    return NextResponse.json({ error: controlliError.message }, { status: 500 });
  }

  const clientiGiaAttivi = new Set(
    (controlliAttivi || []).map((c) => c.cliente_id)
  );

  const disponibili = (clienti || []).filter(
    (cliente) => !clientiGiaAttivi.has(cliente.id)
  );

  return NextResponse.json(disponibili);
}
