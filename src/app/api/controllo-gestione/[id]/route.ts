import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

type Params = Promise<{
  id: string;
}>;

export async function GET(
  req: NextRequest,
  context: { params: Params }
) {
  const { id } = await context.params;

  const { data, error } = await supabaseAdmin
    .from("tbcontrollo_gestione")
    .select(`
      *,
      cliente:tbclienti(*),
      utenti:tbcontrollo_gestione_utenti(*, utente:tbutenti(*)),
      allegati:tbcontrollo_gestione_allegati(*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  req: NextRequest,
  context: { params: Params }
) {
  const { id } = await context.params;
  const body = await req.json();

  const { utenti, ...payload } = body;

  const { data, error } = await supabaseAdmin
    .from("tbcontrollo_gestione")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(utenti)) {
    const { error: deleteUtentiError } = await supabaseAdmin
      .from("tbcontrollo_gestione_utenti")
      .delete()
      .eq("controllo_id", id);

    if (deleteUtentiError) {
      return NextResponse.json(
        { error: deleteUtentiError.message },
        { status: 500 }
      );
    }

    if (utenti.length > 0) {
      const rows = utenti.map((utente_id: string) => ({
        controllo_id: id,
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
  }

  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Params }
) {
  const { id } = await context.params;
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");

  if (scope === "cliente") {
    const { data: controllo, error: getError } = await supabaseAdmin
      .from("tbcontrollo_gestione")
      .select("cliente_id")
      .eq("id", id)
      .single();

    if (getError) {
      return NextResponse.json({ error: getError.message }, { status: 500 });
    }

    const { error } = await supabaseAdmin
      .from("tbcontrollo_gestione")
      .delete()
      .eq("cliente_id", controllo.cliente_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  const { error } = await supabaseAdmin
    .from("tbcontrollo_gestione")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
