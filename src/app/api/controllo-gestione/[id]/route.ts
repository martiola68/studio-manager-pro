import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { data, error } = await supabaseAdmin
    .from("tbcontrollo_gestione")
    .select(`
      *,
      cliente:tbclienti(*),
      utenti:tbcontrollo_gestione_utenti(*, utente:tbutenti(*)),
      allegati:tbcontrollo_gestione_allegati(*)
    `)
    .eq("id", params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { utenti, ...payload } = body;

  const { data, error } = await supabaseAdmin
    .from("tbcontrollo_gestione")
    .update(payload)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(utenti)) {
    await supabaseAdmin
      .from("tbcontrollo_gestione_utenti")
      .delete()
      .eq("controllo_id", params.id);

    if (utenti.length > 0) {
      const rows = utenti.map((utente_id: string) => ({
        controllo_id: params.id,
        utente_id,
      }));

      const { error: utentiError } = await supabaseAdmin
        .from("tbcontrollo_gestione_utenti")
        .insert(rows);

      if (utentiError) {
        return NextResponse.json({ error: utentiError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await supabaseAdmin
    .from("tbcontrollo_gestione")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
