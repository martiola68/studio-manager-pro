import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const supabaseAdmin = getSupabaseAdmin();

  const { data: soggetti, error } = await supabaseAdmin
    .from("tbpratiche_soggetti")
  .select(`
  *,
  nominativo:tbpratiche_nominativi (
    id,
    nome_cognome,
    codice_fiscale,
    indirizzo,
    citta,
    provincia,
    cap
  )
`)
    .eq("pratica_id", id)
    .order("ordine");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ soggetti: soggetti || [] });
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("tbpratiche_soggetti")
   .insert({
  pratica_id: id,
  tipo_soggetto: body.tipo_soggetto,
  nominativo_id: body.nominativo_id || null,
  carica: body.carica || null,
  note: body.note || null,
  ordine: body.ordine || 0,
})
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, soggetto: data });
}
