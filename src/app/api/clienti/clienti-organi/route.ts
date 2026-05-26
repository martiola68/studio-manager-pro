import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);

    const clienteId = searchParams.get("cliente_id");

    if (!clienteId) {
      return NextResponse.json(
        { error: "cliente_id mancante" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("tbclienti_organi")
      .select(`
        *,
        rapp_legali (
          id,
          nome_cognome,
          codice_fiscale
        )
      `)
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      organi: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Errore caricamento organi" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabaseAdmin = getSupabaseAdmin();

    if (!body.cliente_id || !body.rapp_legale_id || !body.ruolo) {
      return NextResponse.json(
        { error: "cliente_id, rapp_legale_id e ruolo sono obbligatori" },
        { status: 400 }
      );
    }

    if (body.principale && body.cliente_id && body.ruolo) {
      await supabaseAdmin
        .from("tbclienti_organi")
        .update({
          principale: false,
          attivo: false,
          data_cessazione: new Date().toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        })
        .eq("cliente_id", body.cliente_id)
        .eq("ruolo", body.ruolo)
        .eq("principale", true);
    }

    const { data, error } = await supabaseAdmin
      .from("tbclienti_organi")
      .upsert(
        {
          cliente_id: body.cliente_id,
          rapp_legale_id: body.rapp_legale_id,
          ruolo: body.ruolo,
          percentuale_partecipazione:
            body.percentuale_partecipazione || null,
          presenza: body.presenza || null,
          carica: body.carica || null,
          principale: body.principale || false,
          attivo: body.attivo ?? true,
          data_nomina: body.data_nomina || null,
          data_cessazione: body.data_cessazione || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "cliente_id,rapp_legale_id,ruolo",
        }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      organo: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Errore salvataggio organo cliente" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "ID mancante" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("tbclienti_organi")
      .update({
        ruolo: body.ruolo,
        percentuale_partecipazione:
          body.percentuale_partecipazione || null,
        presenza: body.presenza || null,
        carica: body.carica || null,
        principale: body.principale ?? false,
        attivo: body.attivo ?? true,
        data_nomina: body.data_nomina || null,
        data_cessazione: body.data_cessazione || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      organo: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Errore aggiornamento organo" },
      { status: 500 }
    );
  }
}
