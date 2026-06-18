import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json();

    if (!body.studio_id) {
      return NextResponse.json(
        { error: "studio_id obbligatorio" },
        { status: 400 }
      );
    }

    if (!body.ragione_sociale || !String(body.ragione_sociale).trim()) {
      return NextResponse.json(
        { error: "Cognome e nome obbligatorio" },
        { status: 400 }
      );
    }

    if (!body.codice_fiscale || !String(body.codice_fiscale).trim()) {
      return NextResponse.json(
        { error: "Codice fiscale obbligatorio" },
        { status: 400 }
      );
    }

    const codiceFiscale = String(body.codice_fiscale).trim().toUpperCase();

    const { data: esistente, error: checkError } = await supabase
      .from("tbclienti")
      .select("id, ragione_sociale, codice_fiscale")
      .eq("codice_fiscale", codiceFiscale)
      .maybeSingle();

    if (checkError) throw checkError;

    if (esistente?.id) {
      return NextResponse.json({
        success: true,
        data: esistente,
        already_exists: true,
      });
    }

    const { data, error } = await supabase
      .from("tbclienti")
      .insert({
        studio_id: body.studio_id,
        ragione_sociale: String(body.ragione_sociale).trim(),
        codice_fiscale: codiceFiscale,
        email: body.email || null,
        luogo_nascita: body.luogo_nascita || null,
        data_nascita: body.data_nascita || null,
        indirizzo: body.indirizzo || null,
        citta: body.citta || null,
        provincia: body.provincia || null,
        cap: body.cap || null,
        tipo_cliente: body.tipo_cliente || "Persona fisica",
        cliente: false,
        attivo: true,
      })
      .select("id, ragione_sociale, codice_fiscale")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      already_exists: false,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Errore creazione soggetto" },
      { status: 500 }
    );
  }
}
