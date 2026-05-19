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

  const isDistribuzioneUtili = String(
  modelloCorrente?.nome || modelloCorrente?.codice || ""
)
  .toLowerCase()
  .includes("distribuzione utili");

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

  if (!codice_fiscale) {
    return NextResponse.json(
      { error: "Codice fiscale obbligatorio" },
      { status: 400 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: esistente, error: searchError } = await supabaseAdmin
    .from("tbpratiche_nominativi" as any)
    .select("id, nome_cognome, codice_fiscale")
    .eq("codice_fiscale", codice_fiscale)
    .maybeSingle();

  if (searchError) {
    return NextResponse.json(
      { error: searchError.message },
      { status: 500 }
    );
  }

  if (esistente) {
    return NextResponse.json({
      success: true,
      nominativo: esistente,
    });
  }

 const { data: esistente, error: searchError } =
  await supabaseAdmin
    .from("tbpratiche_nominativi" as any)
    .select("id, nome_cognome, codice_fiscale")
    .eq("codice_fiscale", codice_fiscale)
    .maybeSingle();

if (searchError) {
  return NextResponse.json(
    { error: searchError.message },
    { status: 500 }
  );
}

if (esistente) {
  return NextResponse.json({
    success: true,
    nominativo: esistente,
  });
}

const { data, error } = await supabaseAdmin
  .from("tbpratiche_nominativi" as any)
  .insert({
    nome_cognome,
    codice_fiscale,
  })
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
