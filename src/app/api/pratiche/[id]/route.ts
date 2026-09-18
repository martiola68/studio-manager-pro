import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { aggiornaStatiVariazione } from "@/lib/pratiche/aggiornaStatiVariazione";

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

let variazioneOrigine: any = null;

if (pratica.variazione_id) {
  const { data } = await supabaseAdmin
    .from("tbpratiche_variazioni")
    .select("id, data_atto")
    .eq("id", pratica.variazione_id)
    .maybeSingle();
  variazioneOrigine = data || null;
} else {
  const { data } = await supabaseAdmin
    .from("tbpratiche_variazioni")
    .select("id, data_atto")
    .eq("pratica_id", praticaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  variazioneOrigine = data || null;
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
    numero_rea
  `)
  .eq("id", pratica.cliente_id)
  .single();

let rappresentanteLegale: any = null;
let amministratorePrincipale: any = null;

if (cliente?.id) {
  const { data: organiPrincipali } = await supabaseAdmin
    .from("tbclienti_organi")
    .select("id, soggetto_cliente_id, ruolo, carica, principale, attivo")
    .eq("cliente_id", cliente.id)
    .eq("principale", true)
    .eq("attivo", true);

  const prioritaRuoliAmministrazione = [
    "presidente_cda",
    "amministratore_unico",
    "amministratore_delegato",
    "amministratore",
    "consigliere_delegato",
    "vice_presidente_cda",
    "consigliere",
    "rappresentante_legale",
    "liquidatore",
  ];

  const organoAmministratore = (organiPrincipali || [])
    .filter((organo: any) => {
      const ruolo = String(organo?.ruolo || "").trim().toLowerCase();
      if (prioritaRuoliAmministrazione.includes(ruolo)) return true;

      const testo = String(`${organo?.ruolo || ""} ${organo?.carica || ""}`).toLowerCase();
      return (
        testo.includes("amministr") ||
        testo.includes("presidente") ||
        testo.includes("consigliere") ||
        testo.includes("cda") ||
        testo.includes("consiglio di amministrazione")
      );
    })
    .sort((a: any, b: any) => {
      const ruoloA = String(a?.ruolo || "").trim().toLowerCase();
      const ruoloB = String(b?.ruolo || "").trim().toLowerCase();
      const posA = prioritaRuoliAmministrazione.indexOf(ruoloA);
      const posB = prioritaRuoliAmministrazione.indexOf(ruoloB);
      return (posA < 0 ? 999 : posA) - (posB < 0 ? 999 : posB);
    })[0];

  if (organoAmministratore?.soggetto_cliente_id) {
    const { data: soggettoAmministratore } = await supabaseAdmin
      .from("tbclienti")
      .select("id, ragione_sociale, codice_fiscale")
      .eq("id", organoAmministratore.soggetto_cliente_id)
      .maybeSingle();

    if (soggettoAmministratore) {
      amministratorePrincipale = {
        id: soggettoAmministratore.id,
        nome_cognome: soggettoAmministratore.ragione_sociale,
        codice_fiscale: soggettoAmministratore.codice_fiscale,
        ruolo: organoAmministratore.ruolo,
        carica: organoAmministratore.carica,
      };
    }
  }

  const { data: organoRapp } = await supabaseAdmin
    .from("tbclienti_organi")
    .select(`
      soggetto_cliente_id
    `)
    .eq("cliente_id", cliente.id)
    .eq("tipo_ruolo", "R")
    .eq("principale", true)
    .eq("attivo", true)
    .limit(1)
    .maybeSingle();

  if (organoRapp?.soggetto_cliente_id) {
    const { data: soggettoRapp } = await supabaseAdmin
      .from("tbclienti")
      .select(`
        id,
        ragione_sociale,
        codice_fiscale,
        indirizzo,
        citta,
        provincia,
        cap
      `)
      .eq("id", organoRapp.soggetto_cliente_id)
      .maybeSingle();

    if (soggettoRapp) {
      rappresentanteLegale = {
        id: soggettoRapp.id,
        nome_cognome: soggettoRapp.ragione_sociale,
        codice_fiscale: soggettoRapp.codice_fiscale,
        indirizzo: soggettoRapp.indirizzo,
        citta: soggettoRapp.citta,
        provincia: soggettoRapp.provincia,
        cap: soggettoRapp.cap,
      };
    }
  }
}

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

const { data: rappresentantiRows } = cliente?.id
  ? await supabaseAdmin
      .from("tbclienti")
      .select(`
        id,
        ragione_sociale,
        codice_fiscale,
        indirizzo,
        citta,
        provincia,
        cap
      `)
      .eq("studio_id", pratica.studio_id)
      .eq("cliente", false)
      .order("ragione_sociale")
  : { data: [] };

const rappresentantiLegali =
  (rappresentantiRows || []).map((r: any) => ({
    id: r.id,
    nome_cognome: r.ragione_sociale,
    codice_fiscale: r.codice_fiscale,
    indirizzo_residenza: r.indirizzo,
    citta_residenza: r.citta,
    indirizzo: r.indirizzo,
    citta: r.citta,
    provincia: r.provincia,
    cap: r.cap,
  }));
 return NextResponse.json({
pratica: {
  ...pratica,
  cliente,
  tipo,
  assegnatario,
  rappresentante_legale: rappresentanteLegale,
  amministratore_principale: amministratorePrincipale,
  data_atto_variazione: variazioneOrigine?.data_atto || null,
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

      verbale_definitivo:
  body.verbale_definitivo ?? false,

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

const { data: variazione } = await supabaseAdmin
  .from("tbpratiche_variazioni")
  .select("id")
  .eq("pratica_liquidazione_id", praticaId)
  .maybeSingle();

if (variazione?.id && body.verbale_definitivo === true) {
  await supabaseAdmin
    .from("tbpratiche_step")
    .update({
      stato: "completato",
      completato: true,
      data_completamento: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("variazione_id", variazione.id)
    .eq("codice_step", "LIQUIDAZIONE");

  await aggiornaStatiVariazione(supabaseAdmin, variazione.id);
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
