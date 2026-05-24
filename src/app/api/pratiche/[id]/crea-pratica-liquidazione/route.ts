import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  req: Request,
  { params }: Params
) {
  try {
    const { id } = await params;

    const supabaseAdmin = getSupabaseAdmin();

    const { data: pratica } = await supabaseAdmin
      .from("tbpratiche")
      .select("*")
      .eq("id", id)
      .single();

    if (!pratica) {
      return NextResponse.json(
        { error: "Pratica non trovata" },
        { status: 404 }
      );
    }

    const { data: datiDocumento } =
      await supabaseAdmin
        .from("tbpratiche_dati_documenti")
        .select("*")
        .eq("pratica_id", id)
        .maybeSingle();

  const { data: tipoLiquidazione } =
  await supabaseAdmin
    .from("tbpratiche_tipi")
    .select("id")
    .eq("nome", "Messa in liquidazione")
    .single();

    if (!tipoLiquidazione) {
      return NextResponse.json(
        {
          error:
            "Tipo pratica messa_liquidazione non trovato",
        },
        { status: 400 }
      );
    }

    const { data: nuovaPratica, error } =
      await supabaseAdmin
        .from("tbpratiche")
        .insert({
            studio_id: pratica.studio_id,
          titolo:
            "Verbale messa in liquidazione",

          cliente_id: pratica.cliente_id,

          tipo_pratica_id: tipoLiquidazione.id,

          pratica_collegata_id: pratica.id,

          data_apertura:
            datiDocumento?.data_convocazione ||
            new Date().toISOString(),

          stato: "aperta",

          priorita: pratica.priorita,

          assegnato_a: pratica.assegnato_a,
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
      success: true,
      pratica: nuovaPratica,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error.message ||
          "Errore creazione pratica",
      },
      { status: 500 }
    );
  }
}
