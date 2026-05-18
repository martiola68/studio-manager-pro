import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const nome_cognome = body.nome_cognome?.trim();
    const codice_fiscale = body.codice_fiscale?.trim();

    if (!nome_cognome) {
      return NextResponse.json(
        { error: "Nome e cognome obbligatori" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("rapp_legali" as any)
      .insert({
        nome_cognome,
        codice_fiscale: codice_fiscale || null,
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
      rappresentante: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Errore creazione rappresentante" },
      { status: 500 }
    );
  }
}
