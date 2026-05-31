import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseClient() as any;

    const { searchParams } = new URL(req.url);

    const cliente_id = searchParams.get("cliente_id");

    if (!cliente_id) {
      return NextResponse.json(
        { error: "cliente_id mancante" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("tbclienti_organi")
      .select(`
        *,
        rapp_legali (
          id,
          nome_cognome,
          codice_fiscale
        )
      `)
      .eq("cliente_id", cliente_id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      organi: data || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Errore server" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseClient() as any;

    const payload = await req.json();

    const { data, error } = await supabase
      .from("tbclienti_organi")
     .insert({
  cliente_id: payload.cliente_id,
  rapp_legale_id: payload.rapp_legale_id,
  ruolo: payload.ruolo,
  carica: payload.carica,
  percentuale_partecipazione: payload.percentuale_partecipazione,
  presenza: payload.presenza,
  principale: payload.principale,
  attivo: payload.attivo ?? true,
  data_nomina: payload.data_nomina || null,
  data_cessazione: payload.data_cessazione || null,
})
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      organo: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Errore server" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = getSupabaseClient() as any;

    const payload = await req.json();

    const { data, error } = await supabase
      .from("tbclienti_organi")
      .update({
        ruolo: payload.ruolo,
        carica: payload.carica,
        percentuale_partecipazione:
          payload.percentuale_partecipazione,
        principale: payload.principale,
        attivo: payload.attivo,
        data_attivazione:
          payload.data_attivazione || null,
        nominativo_cessato:
          payload.nominativo_cessato ?? false,
        data_cessato:
          payload.data_cessato || null,
      })
      .eq("id", payload.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      organo: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Errore server" },
      { status: 500 }
    );
  }
}
