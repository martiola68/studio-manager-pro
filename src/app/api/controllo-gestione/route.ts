import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const storico = searchParams.get("storico") === "true";
  const clienteId = searchParams.get("cliente_id");

  let query = storico
    ? supabaseAdmin.from("tbcontrollo_gestione").select(`
        *,
        cliente:tbclienti(*),
        utenti:tbcontrollo_gestione_utenti(*, utente:tbutenti(*)),
        allegati:tbcontrollo_gestione_allegati(*)
      `)
    : supabaseAdmin.from("vw_controllo_gestione_corrente").select(`
        *,
        cliente:tbclienti(*)
      `);

  if (clienteId) query = query.eq("cliente_id", clienteId);

  query = query.order("data_esecuzione", { ascending: false });

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();

  const {
    studio_id,
    cliente_id,
    cadenza_controllo,
    data_esecuzione,
    prossima_scadenza,
    note,
    link,
    utenti = [],
  } = body;

  const { data: controllo, error } = await supabaseAdmin
    .from("tbcontrollo_gestione")
    .insert({
      studio_id,
      cliente_id,
      cadenza_controllo,
      data_esecuzione,
      prossima_scadenza,
      note,
      link,
      archiviato: false,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (utenti.length > 0) {
    const rows = utenti.map((utente_id: string) => ({
      controllo_id: controllo.id,
      utente_id,
    }));

    const { error: utentiError } = await supabaseAdmin
      .from("tbcontrollo_gestione_utenti")
      .insert(rows);

    if (utentiError) {
      return NextResponse.json({ error: utentiError.message }, { status: 500 });
    }
  }

  return NextResponse.json(controllo);
}
