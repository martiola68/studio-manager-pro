import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const supabaseAdmin = getSupabaseAdmin();

  const { data: soci, error } = await supabaseAdmin
    .from("tbpratiche_distribuzione_utili")
    .select("*")
    .eq("pratica_id", id)
    .order("ordine");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ soci: soci || [] });
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const supabaseAdmin = getSupabaseAdmin();

  const dividendoLordo = Number(body.importo_utile || 0);
  const percentualeRitenuta = Number(body.percentuale_ritenuta || 26);
  const importoRitenuta =
    body.importo_ritenuta !== undefined && body.importo_ritenuta !== ""
      ? Number(body.importo_ritenuta)
      : dividendoLordo * (percentualeRitenuta / 100);

  const importoNetto =
    body.importo_netto !== undefined && body.importo_netto !== ""
      ? Number(body.importo_netto)
      : dividendoLordo - importoRitenuta;

  const { data, error } = await supabaseAdmin
    .from("tbpratiche_distribuzione_utili")
    .insert({
      pratica_id: id,
      nome_cognome: body.nome_cognome,
      codice_fiscale: body.codice_fiscale || null,
      percentuale_partecipazione: Number(body.percentuale_partecipazione || 0),
      importo_utile: dividendoLordo,
      percentuale_ritenuta: percentualeRitenuta,
      importo_ritenuta: importoRitenuta,
      importo_netto: importoNetto,
      tipo_pagamento: body.tipo_pagamento || null,
      note: body.note || null,
      ordine: body.ordine || 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, socio: data });
}
