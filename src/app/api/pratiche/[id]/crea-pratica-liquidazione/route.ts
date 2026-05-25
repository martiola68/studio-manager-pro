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

    const datiEreditati = {
  data_atto: datiDocumento?.data_convocazione || "",
  ora_inizio: datiDocumento?.ora_convocazione || "",
  luogo_assemblea: datiDocumento?.luogo_convocazione || "",

  presidente: datiDocumento?.rappresentante_legale_nome || "",
  segretario: datiDocumento?.segretario || "",

  liquidatore_nome: datiDocumento?.rappresentante_legale_nome || "",
  liquidatore_cf: datiDocumento?.rappresentante_legale_codice_fiscale || "",
  liquidatore_residenza: [
    datiDocumento?.rappresentante_legale_indirizzo,
    datiDocumento?.rappresentante_legale_cap,
    datiDocumento?.rappresentante_legale_citta,
    datiDocumento?.rappresentante_legale_provincia,
  ].filter(Boolean).join(" "),

  motivo_liquidazione: datiDocumento?.motivo_liquidazione || "",
  motivo_liquidazione_testo: datiDocumento?.motivo_liquidazione_testo || "",

  pratica_determina_id: id,
};

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

        const { data: praticaGiaCollegata } = await supabaseAdmin
  .from("tbpratiche")
  .select("id, numero_pratica")
  .eq("pratica_collegata_id", pratica.id)
  .eq("tipo_pratica_id", tipoLiquidazione.id)
  .maybeSingle();

if (praticaGiaCollegata) {
  return NextResponse.json({
    success: true,
    pratica: praticaGiaCollegata,
    alreadyExists: true,
  });
}

    const { data: nuovaPratica, error } =
      await supabaseAdmin
        .from("tbpratiche")
        .insert({
          numero_pratica: `LIQ-${new Date().getFullYear()}-${Date.now()}`,
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

    const { error: datiInsertError } = await supabaseAdmin
      .from("tbpratiche_dati_documenti")
      .insert({
        pratica_id: nuovaPratica.id,
        ...datiEreditati,
      });

    if (datiInsertError) {
      return NextResponse.json(
        { error: datiInsertError.message },
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
