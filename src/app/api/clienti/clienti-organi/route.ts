import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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
