import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

export async function GET(req: NextRequest) {
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

  if (clienteId) {
    query = query.eq("cliente_id", clienteId);
  }

  query = storico
    ? query.order("data_storico", {
        ascending: false,
        nullsFirst: false,
      })
    : query.order("data_esecuzione", {
        ascending: false,
      });

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const {
    cliente_id,
    cadenza_controllo,
    note,
    link,
    utenti = [],
  } = body;

  if (!cliente_id) {
    return NextResponse.json(
      { error: "Cliente obbligatorio" },
      { status: 400 }
    );
  }

  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    return NextResponse.json(
      { error: "Token utente mancante" },
      { status: 401 }
    );
  }

  const token = authHeader.replace("Bearer ", "");

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user?.email) {
    return NextResponse.json(
      { error: "Utente non autenticato" },
      { status: 401 }
    );
  }

  const { data: utenteStudio, error: utenteError } = await supabaseAdmin
    .from("tbutenti")
    .select("studio_id")
    .eq("email", user.email)
    .single();

  if (utenteError || !utenteStudio?.studio_id) {
    return NextResponse.json(
      { error: "Studio utente non trovato" },
      { status: 500 }
    );
  }

  const { data: esistente, error: esistenteError } = await supabaseAdmin
    .from("tbcontrollo_gestione")
    .select("id")
    .eq("cliente_id", cliente_id)
    .eq("archiviato", false)
    .maybeSingle();

  if (esistenteError) {
    return NextResponse.json(
      { error: esistenteError.message },
      { status: 500 }
    );
  }

  if (esistente) {
    return NextResponse.json(
      {
        error:
          "Esiste già un controllo attivo per questo cliente. Usa la funzione Rinnova controllo.",
        controllo_id: esistente.id,
      },
      { status: 409 }
    );
  }

  const { data: controllo, error } = await supabaseAdmin
    .from("tbcontrollo_gestione")
    .insert({
      studio_id: utenteStudio.studio_id,
      cliente_id,
      cadenza_controllo,
      data_esecuzione: new Date().toISOString().slice(0, 10),
      data_storico: null,
      note,
      link,
      archiviato: false,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(utenti) && utenti.length > 0) {
    const rows = utenti.map((utente_id: string) => ({
      controllo_id: controllo.id,
      utente_id,
    }));

    const { error: utentiError } = await supabaseAdmin
      .from("tbcontrollo_gestione_utenti")
      .insert(rows);

    if (utentiError) {
      return NextResponse.json(
        { error: utentiError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(controllo);
}
