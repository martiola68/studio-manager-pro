import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("tbpratiche_nominativi" as any)
    .select("id, nome_cognome, codice_fiscale")
    .order("nome_cognome");

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    nominativi: data || [],
  });
}

export async function POST(req: Request) {
  const body = await req.json();

  const nome_cognome = String(body.nome_cognome || "").trim();
  const codice_fiscale = String(body.codice_fiscale || "").trim();

  if (!nome_cognome) {
    return NextResponse.json(
      { error: "Nominativo obbligatorio" },
      { status: 400 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("tbpratiche_nominativi" as any)
    .upsert(
      {
        nome_cognome,
        codice_fiscale: codice_fiscale || null,
      },
      {
        onConflict: "codice_fiscale",
      }
    )
    .select("id, nome_cognome, codice_fiscale")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    nominativo: data,
  });
}
