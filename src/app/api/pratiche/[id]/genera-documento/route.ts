import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

function formatDataIt(dateValue?: string | null) {
  if (!dateValue) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(dateValue));
}

function formatDataBreveIt(dateValue?: string | null) {
  if (!dateValue) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateValue));
}

function anno(dateValue?: string | null) {
  if (!dateValue) return "";
  return String(new Date(dateValue).getFullYear());
}

function giorno(dateValue?: string | null) {
  if (!dateValue) return "";
  return String(new Date(dateValue).getDate());
}

function mese(dateValue?: string | null) {
  if (!dateValue) return "";
  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
  }).format(new Date(dateValue));
}

  const documento = new Document({
    sections: [
      {
        children: paragrafi,
      },
    ],
  });

  const buffer = await Packer.toBuffer(documento);
  return buffer;
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabaseAdmin = getSupabaseAdmin();

    const body = await req.json().catch(() => ({}));

    const codiceModello =
      body.codice_modello || "VERBALE_ASSEMBLEA_LIQUIDAZIONE";

    const { data: pratica, error: praticaError } = await supabaseAdmin
      .from("tbpratiche")
      .select("*")
      .eq("id", id)
      .single();

    if (praticaError || !pratica) {
      return NextResponse.json(
        { error: "Pratica non trovata" },
        { status: 404 }
      );
    }

    const { data: cliente } = await supabaseAdmin
      .from("tbclienti")
      .select(
        "id, ragione_sociale, codice_fiscale, partita_iva, indirizzo, cap, citta, provincia, numero_rea"
      )
      .eq("id", pratica.cliente_id)
      .single();

    const { data: datiDocumento } = await supabaseAdmin
      .from("tbpratiche_dati_documenti")
      .select("*")
      .eq("pratica_id", id)
      .maybeSingle();

    if (!datiDocumento) {
      return NextResponse.json(
        { error: "Compila e salva prima i dati documento della pratica." },
        { status: 400 }
      );
    }

const { data: soci } = await supabaseAdmin
  .from("tbpratiche_distribuzione_utili")
  .select("*")
  .eq("pratica_id", id)
  .order("created_at");

const { data: soggetti } = await supabaseAdmin
  .from("tbpratiche_soggetti")
  .select("*")
  .eq("pratica_id", id);

const liquidatore =
  soggetti?.find(
    (s: any) =>
      String(s.carica || "")
        .toLowerCase()
        .includes("liquidatore")
  ) || null;
    
    const { data: documentoEsistente } = await supabaseAdmin
  .from("tbpratiche_documenti")
  .select("id, nome_file")
  .eq("pratica_id", id)
  .eq("origine", "automatica")
  .eq("note", `Generato da modello ${codiceModello}`)
  .maybeSingle();

if (documentoEsistente) {
  return NextResponse.json(
    {
      error:
        "Esiste già un documento generato con questo modello. Elimina prima quello presente e poi rigenera.",
    },
    { status: 409 }
  );
}

   const { data: modello, error: modelloError } = await supabaseAdmin
  .from("tbpratiche_modelli")
  .select("*")
  .eq("codice", codiceModello)
  .eq("attivo", true)
  .single();

    if (modelloError || !modello) {
      return NextResponse.json(
        { error: "Modello non trovato o non attivo." },
        { status: 404 }
      );
    }

      const sede =
      datiDocumento.societa_sede ||
      [
        cliente?.indirizzo,
        cliente?.cap,
        cliente?.citta,
        cliente?.provincia,
      ]
        .filter(Boolean)
        .join(" ");

    const dataAtto = datiDocumento.data_atto || pratica.data_apertura;

    function formatOra(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

const sociElenco = (soci || []).map((socio: any) => ({
  SOCIO_NOME_COGNOME:
    socio.nome_cognome || "",

  SOCIO_CODICE_FISCALE:
    socio.codice_fiscale || "",

  SOCIO_PERCENTUALE_PARTECIPAZIONE:
    socio.percentuale_partecipazione
      ? Number(
          socio.percentuale_partecipazione
        ).toFixed(2)
      : "0.00",

  SOCIO_IMPORTO_UTILE:
    socio.importo_utile
      ? Number(
          socio.importo_utile
        ).toFixed(2)
      : "0.00",

  SOCIO_PERCENTUALE_RITENUTA:
    socio.percentuale_ritenuta
      ? Number(
          socio.percentuale_ritenuta
        ).toFixed(2)
      : "0.00",

  SOCIO_IMPORTO_RITENUTA:
    socio.importo_ritenuta
      ? Number(
          socio.importo_ritenuta
        ).toFixed(2)
      : "0.00",

  SOCIO_IMPORTO_NETTO:
    socio.importo_netto
      ? Number(
          socio.importo_netto
        ).toFixed(2)
      : "0.00",

  SOCIO_TIPO_PAGAMENTO:
    socio.tipo_pagamento || "",

  SOCIO_PRESENZA:
    socio.presenza ||
    socio.tipo_pagamento ||
    "Presente",
}));

const percentualeCapitale = sociElenco.reduce(
  (totale: number, socio: any) =>
    totale + Number(socio.SOCIO_PERCENTUALE_PARTECIPAZIONE || 0),
  0
);
const caricaDocumento =
  datiDocumento.carica ||
  datiDocumento.tipo_carica ||
  datiDocumento.liquidatore_carica ||
  datiDocumento.amministratore_carica ||
  (codiceModello === "ACCETTAZIONE_CARICHE" && datiDocumento.liquidatore_nome
    ? "Liquidatore"
    : "");

const nominatoNome =
  datiDocumento.nominato_nome ||
  datiDocumento.amministratore_nome ||
  datiDocumento.liquidatore_nome ||
  "";

const nominatoCf =
  datiDocumento.nominato_codice_fiscale ||
  datiDocumento.amministratore_codice_fiscale ||
  datiDocumento.amministratore_cf ||
  datiDocumento.liquidatore_codice_fiscale ||
  datiDocumento.liquidatore_cf ||
  "";

const nominatoLuogoNascita =
  datiDocumento.nominato_citta_nascita ||
  datiDocumento.amministratore_citta_nascita ||
  datiDocumento.liquidatore_luogo_nascita ||
  datiDocumento.liquidatore_citta_nascita ||
  "";

const nominatoDataNascita =
  datiDocumento.nominato_data_nascita ||
  datiDocumento.amministratore_data_nascita ||
  datiDocumento.liquidatore_data_nascita ||
  "";

const nominatoIndirizzo =
  datiDocumento.nominato_indirizzo ||
  datiDocumento.amministratore_indirizzo ||
  datiDocumento.liquidatore_indirizzo ||
  "";

const nominatoCap =
  datiDocumento.nominato_cap ||
  datiDocumento.amministratore_cap ||
  datiDocumento.liquidatore_cap ||
  "";

const nominatoCitta =
  datiDocumento.nominato_citta ||
  datiDocumento.amministratore_citta ||
  datiDocumento.liquidatore_citta ||
  "";

const nominatoProvincia =
  datiDocumento.nominato_provincia ||
  datiDocumento.amministratore_provincia ||
  datiDocumento.liquidatore_provincia ||
  "";

const dataScadenzaCarica =
  datiDocumento.data_scadenza_carica ||
  datiDocumento.data_scadenza ||
  datiDocumento.durata_carica ||
  (caricaDocumento.toLowerCase().includes("liquidatore")
    ? "fino alla chiusura della liquidazione"
    : "");

const cariche = [];

if (codiceModello === "ACCETTAZIONE_CARICHE" && nominatoNome) {
  cariche.push({
    NOME_COGNOME: nominatoNome,
    CODICE_FISCALE: nominatoCf,
    LUOGO_NASCITA: nominatoLuogoNascita,
    DATA_NASCITA: formatDataIt(nominatoDataNascita),
    INDIRIZZO_RESIDENZA: nominatoIndirizzo,
    CAP_RESIDENZA: nominatoCap,
    CITTA_RESIDENZA: nominatoCitta,
    PROVINCIA_RESIDENZA: nominatoProvincia,
    CARICA: caricaDocumento,
    DATA_SCADENZA_CARICA: dataScadenzaCarica,
  });
}
    const { data: motivoLiquidazione } = datiDocumento.motivo_liquidazione
  ? await supabaseAdmin
      .from("tbpratiche_motivi_liquidazione")
      .select("numero_art_2484")
      .eq("codice", datiDocumento.motivo_liquidazione)
      .maybeSingle()
  : { data: null };
    
    const valori = {
      ANNO: anno(dataAtto),
      Anno: anno(dataAtto),

      GIORNO: giorno(dataAtto),
      Giorno: giorno(dataAtto),

      MESE: mese(dataAtto),
      Mese: mese(dataAtto),

      DATA_ATTO: formatDataIt(dataAtto),

      ORA: datiDocumento.ora_inizio || "",
      Ora: datiDocumento.ora_inizio || "",
      ORA_INIZIO: formatOra(datiDocumento.ora_inizio),
      ORA_CHIUSURA: formatOra(datiDocumento.ora_chiusura),

      DENOMINAZIONE:
        datiDocumento.societa_denominazione ||
        cliente?.ragione_sociale ||
        "",
      "Denominazione S.r.l.":
        datiDocumento.societa_denominazione ||
        cliente?.ragione_sociale ||
        "",

      CODICE_FISCALE:
        datiDocumento.societa_codice_fiscale ||
        cliente?.codice_fiscale ||
        "",

      PARTITA_IVA:
        datiDocumento.societa_partita_iva ||
        cliente?.partita_iva ||
        "",

      REA:
        datiDocumento.societa_rea ||
        cliente?.numero_rea ||
        "",

      SEDE: sede,
      "Indirizzo completo": sede,

      PRESIDENTE: datiDocumento.presidente || "",
      "Nome del Presidente": datiDocumento.presidente || "",

      SEGRETARIO: datiDocumento.segretario || "",
      "Nome del Segretario": datiDocumento.segretario || "",

      MOTIVO_LIQUIDAZIONE:
        datiDocumento.motivo_liquidazione ||
        datiDocumento.motivo_liquidazione_altro ||
        "",

      MOTIVO_LIQUIDAZIONE_TESTO:
      datiDocumento.motivo_liquidazione_testo || "",

      NUMERO_CAUSA_SCIOGLIMENTO:
      motivoLiquidazione?.numero_art_2484 || "",

      GIORNO_ORA_CONVOCAZIONE:
      datiDocumento.data_convocazione &&
      datiDocumento.ora_convocazione
        ? `${formatDataIt(
        datiDocumento.data_convocazione
      )} alle ore ${formatOra(
        datiDocumento.ora_convocazione
      )}`
    : "",

LUOGO_CONVOCAZIONE:
  datiDocumento.luogo_convocazione || "",

      PROFESSIONISTA_NOME:
        datiDocumento.professionista_nome || "",

      PROFESSIONISTA_CF:
        datiDocumento.professionista_codice_fiscale || "",

      QUALIFICA_PROFESSIONISTA:
        datiDocumento.professionista_qualifica || "",

      DICITURA_PRESENTAZIONE:
        datiDocumento.dicitura_presentazione || "",

      LUOGO_ASSEMBLEA:
        datiDocumento.luogo_assemblea || sede,

      TITOLO_PRATICA:
        pratica.titolo || "",

   NUMERO_PRATICA:
  pratica.numero_pratica || "",

PERCENTUALE_SOCI_PRESENTI:
  datiDocumento.percentuale_soci_presenti
    ? Number(datiDocumento.percentuale_soci_presenti).toFixed(2)
    : Number(percentualeCapitale).toFixed(2),

      SOCIETA_DENOMINAZIONE:
  datiDocumento.societa_denominazione ||
  cliente?.ragione_sociale ||
  "",

SOCIETA_SEDE:
  sede,

SOCIETA_CODICE_FISCALE:
  datiDocumento.societa_codice_fiscale ||
  cliente?.codice_fiscale ||
  "",

SOCIETA_PARTITA_IVA:
  datiDocumento.societa_partita_iva ||
  cliente?.partita_iva ||
  "",

SOCIETA_REA:
  datiDocumento.societa_rea ||
  cliente?.numero_rea ||
  "",

RAPPRESENTANTE_LEGALE_NOME:
  datiDocumento.rappresentante_legale_nome ||
  datiDocumento.presidente ||
  "",

RAPPRESENTANTE_LEGALE_CODICE_FISCALE:
  datiDocumento.rappresentante_legale_codice_fiscale ||
  "",

OGGETTO:
  codiceModello === "ACCETTAZIONE_CARICHE"
    ? `Accettazione carica ${caricaDocumento || ""}`.trim()
    : pratica.titolo || "",

TIPO_NOMINA:
  codiceModello === "ACCETTAZIONE_CARICHE"
    ? caricaDocumento
    : "",

DATA_ASSEMBLEA:
  formatDataIt(dataAtto),

      CARICA:
  caricaDocumento,

NOMINATO_NOME:
  nominatoNome,

NOMINATO_CF:
  nominatoCf,

NOMINATO_CITTA_NASCITA:
  nominatoLuogoNascita,

NOMINATO_DATA_NASCITA:
  formatDataBreveIt(nominatoDataNascita),

NOMINATO_INDIRIZZO:
  nominatoIndirizzo,

NOMINATO_CAP:
  nominatoCap,

NOMINATO_CITTA:
  nominatoCitta,

NOMINATO_PROVINCIA:
  nominatoProvincia,

DATA_SCADENZA_CARICA:
  dataScadenzaCarica,

SOCIETA_CF:
  datiDocumento.societa_codice_fiscale ||
  cliente?.codice_fiscale ||
  "",

CARICHE:
  cariche,

IMPORTO_DIVIDENDO_TOTALE:
  Number(
    datiDocumento.importo_dividendo_totale || 0
  ).toFixed(2),
      
SOCI:
  sociElenco,

LIQUIDATORE_NOME:
  datiDocumento.liquidatore_nome ||
  liquidatore?.nome_cognome ||
  "",

LIQUIDATORE_CF:
  datiDocumento.liquidatore_codice_fiscale ||
  liquidatore?.codice_fiscale ||
  "",

LIQUIDATORE_RESIDENZA: [
  
  datiDocumento?.liquidatore_indirizzo,
  datiDocumento?.liquidatore_cap,
  datiDocumento?.liquidatore_citta,
  datiDocumento?.liquidatore_provincia,
]
  .filter(Boolean)
  .join(" "),

SEDE_LIQUIDAZIONE:
  sede,
};

let outputBuffer: Buffer;

if (!modello.file_path) {
  return NextResponse.json(
    {
      error:
        "Per questo documento è obbligatorio allegare un modello DOCX.",
    },
    { status: 400 }
  );
}

const { data: modelloFile, error: downloadError } =
  await supabaseAdmin.storage
    .from("pratiche-modelli")
    .download(modello.file_path);

if (downloadError || !modelloFile) {
  return NextResponse.json(
    {
      error:
        downloadError?.message ||
        "Errore lettura modello DOCX.",
    },
    { status: 500 }
  );
}

const modelloBuffer = await modelloFile.arrayBuffer();

const zip = new PizZip(modelloBuffer);

const doc = new Docxtemplater(zip, {
  paragraphLoop: true,
  linebreaks: true,
  delimiters: {
    start: "[",
    end: "]",
  },
});

doc.render(valori);

outputBuffer = doc.getZip().generate({
  type: "nodebuffer",
  compression: "DEFLATE",
});
  const safeDenominazione = String(
  valori.DENOMINAZIONE || "societa"
)
  .replace(/[^a-zA-Z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

const safeTipoVerbale = String(
  modello?.titolo || modello?.codice || codiceModello || "documento"
)
  .replace(/[^a-zA-Z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

const nomeFile = `${safeTipoVerbale}_${safeDenominazione}.docx`;

    const filePath = `${id}/generati/${nomeFile}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("pratiche-documenti")
      .upload(filePath, outputBuffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      );
    }

    const { data: documento, error: documentoError } = await supabaseAdmin
      .from("tbpratiche_documenti")
      .insert({
        pratica_id: id,
        tipo_documento: modello?.codice || codiceModello,
        nome_file: nomeFile,
        file_path: filePath,
        stato: "generato",
        origine: "automatica",
        note: `Generato da modello ${modello.codice}`,
      })
      .select()
      .single();

    if (documentoError) {
      return NextResponse.json(
        { error: documentoError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      documento,
    });
} catch (error: any) {
  console.error("ERRORE GENERAZIONE DOCUMENTO:", JSON.stringify(error, null, 2));

  return NextResponse.json(
    {
      error: error.message || "Errore durante la generazione del documento",
      details: error.properties?.errors || error.properties || error,
    },
    { status: 500 }
  );
}
  
}
