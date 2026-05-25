import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: Request, { params }: Params) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

   const { id: praticaId } = await params;

    const { data: pratica, error: praticaError } = await supabaseAdmin
      .from("tbpratiche")
      .select("*")
      .eq("id", praticaId)
      .single();

    if (praticaError || !pratica) {
      return NextResponse.json(
        { error: "Pratica non trovata" },
        { status: 404 }
      );
    }

    const { data: cliente } = await supabaseAdmin
      .from("tbclienti")
     .select(`
  id,
  ragione_sociale,
  codice_fiscale,
  partita_iva,
  indirizzo,
  cap,
  citta,
  provincia,
  numero_rea,
  rapp_legale_id
`)
      .eq("id", pratica.cliente_id)
      .single();

 const { data: rappresentanteLegale } = cliente?.rapp_legale_id
  ? await supabaseAdmin
      .from("rapp_legali" as any)
      .select("id, nome_cognome, codice_fiscale, indirizzo, citta, provincia, cap")
      .eq("id", cliente.rapp_legale_id)
      .single()
  : { data: null };

const { data: tipo } = await supabaseAdmin
  .from("tbpratiche_tipi")
  .select("id, nome, ente, classe_form")
  .eq("id", pratica.tipo_pratica_id)
  .single();

    const { data: assegnatario } = pratica.assegnato_a
      ? await supabaseAdmin
          .from("tbutenti")
          .select("id, nome, cognome")
          .eq("id", pratica.assegnato_a)
          .single()
      : { data: null };

    const { data: datiDocumento } = await supabaseAdmin
      .from("tbpratiche_dati_documenti")
      .select("*")
      .eq("pratica_id", praticaId)
      .maybeSingle();

  const { data: professionisti } = await supabaseAdmin
  .from("tbclienti")
  .select("id, ragione_sociale, codice_fiscale")
  .eq("professionista_incaricato", true)
  .order("ragione_sociale");

const { data: motiviLiquidazione } = await supabaseAdmin
  .from("tbpratiche_motivi_liquidazione")
  .select("*")
  .eq("attivo", true)
  .order("ordine");

const { data: diciture } = await supabaseAdmin
  .from("tbpratiche_dicitura_documenti")
  .select("*")
  .eq("attiva", true)
  .order("titolo");

const { data: rappresentantiLegali } = cliente?.id
  ? await supabaseAdmin
      .from("rapp_legali" as any)
      .select(`
       id,
  nome_cognome,
  codice_fiscale,
  indirizzo_residenza,
  citta_residenza,
  indirizzo,
  citta,
  provincia,
  cap
      `)
     .eq("studio_id", pratica.studio_id)
      .order("nome_cognome")
  : { data: [] };

 return NextResponse.json({
pratica: {
  ...pratica,
  cliente,
  tipo,
  assegnatario,
  rappresentante_legale: rappresentanteLegale,
  rappresentanti_legali: rappresentantiLegali || [],
  dati_documento: datiDocumento,
},

  professionisti,
  motivi_liquidazione: motiviLiquidazione,
 diciture,
rappresentanti_legali: rappresentantiLegali || [],
});
   } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error.message || "Errore caricamento dettaglio pratica",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const body = await req.json();

    const supabaseAdmin = getSupabaseAdmin();

    const { id: praticaId } = await params;

    const payload = {
      pratica_id: praticaId,
      societa_denominazione: body.societa_denominazione || null,
      societa_sede: body.societa_sede || null,
      societa_codice_fiscale: body.societa_codice_fiscale || null,
      societa_partita_iva: body.societa_partita_iva || null,
      societa_rea: body.societa_rea || null,
      data_atto: body.data_atto || null,
      ora_inizio: body.ora_inizio || null,
      luogo_assemblea: body.luogo_assemblea || null,
      presidente: body.presidente || null,
      segretario: body.segretario || null,
      motivo_liquidazione: body.motivo_liquidazione || null,
      motivo_liquidazione_altro:
        body.motivo_liquidazione_altro || null,

      motivo_liquidazione_testo:
  body.motivo_liquidazione_testo || null,

data_convocazione:
  body.data_convocazione || null,

ora_convocazione:
  body.ora_convocazione || null,

luogo_convocazione:
  body.luogo_convocazione || null,
      
      ora_chiusura: body.ora_chiusura || null,
      professionista_nome: body.professionista_nome || null,
      professionista_codice_fiscale:
        body.professionista_codice_fiscale || null,
      professionista_qualifica:
        body.professionista_qualifica || null,
dicitura_presentazione:
  body.dicitura_presentazione || null,

rappresentante_legale_nome:
  body.rappresentante_legale_nome || null,

rappresentante_legale_codice_fiscale:
  body.rappresentante_legale_codice_fiscale || null,

      rappresentante_legale_indirizzo:
  body.rappresentante_legale_indirizzo || null,

rappresentante_legale_citta:
  body.rappresentante_legale_citta || null,

rappresentante_legale_provincia:
  body.rappresentante_legale_provincia || null,

rappresentante_legale_cap:
  body.rappresentante_legale_cap || null,

liquidatore_nome:
  body.liquidatore_nome || null,

liquidatore_codice_fiscale:
  body.liquidatore_codice_fiscale || null,

liquidatore_indirizzo:
  body.liquidatore_indirizzo || null,

liquidatore_citta:
  body.liquidatore_citta || null,

liquidatore_provincia:
  body.liquidatore_provincia || null,

liquidatore_cap:
  body.liquidatore_cap || null,

liquidatore_residenza: [
  body.liquidatore_indirizzo,
  body.liquidatore_cap,
  body.liquidatore_citta,
  body.liquidatore_provincia,
]
  .filter(Boolean)
  .join(" "),
      
percentuale_soci_presenti:
  body.percentuale_soci_presenti
    ? Number(body.percentuale_soci_presenti)
    : 100,

importo_dividendo_totale:
  body.importo_dividendo_totale
    ? Number(body.importo_dividendo_totale)
    : null,

updated_at: new Date().toISOString(),

      };

    const { data: existing } = await supabaseAdmin
      .from("tbpratiche_dati_documenti")
      .select("id")
      .eq("pratica_id", praticaId)
      .maybeSingle();

    let result;

    if (existing) {
      result = await supabaseAdmin
        .from("tbpratiche_dati_documenti")
        .update(payload)
        .eq("pratica_id", praticaId)
        .select()
        .single();
    } else {
      result = await supabaseAdmin
        .from("tbpratiche_dati_documenti")
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      dati_documento: result.data,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error.message || "Errore salvataggio dati documento",
      },
      { status: 500 }
    );
  }
}
export async function DELETE(
  req: Request,
  { params }: Params
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { id: praticaId } = await params;

    // documenti pratica
    const { data: documenti } = await supabaseAdmin
      .from("tbpratiche_documenti")
      .select("id, file_path")
      .eq("pratica_id", praticaId);

    // elimina file storage
    for (const doc of documenti || []) {
      if (doc.file_path) {
        await supabaseAdmin.storage
          .from("pratiche-documenti")
          .remove([doc.file_path]);
      }
    }

    // elimina record collegati
    await supabaseAdmin
      .from("tbpratiche_documenti")
      .delete()
      .eq("pratica_id", praticaId);

    await supabaseAdmin
      .from("tbpratiche_soci")
      .delete()
      .eq("pratica_id", praticaId);

    await supabaseAdmin
      .from("tbpratiche_dati_documenti")
      .delete()
      .eq("pratica_id", praticaId);

    // elimina pratica
    const { error } = await supabaseAdmin
      .from("tbpratiche")
      .delete()
      .eq("id", praticaId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error.message || "Errore eliminazione pratica",
      },
      { status: 500 }
    );
  }
}
