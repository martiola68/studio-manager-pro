import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import {
  parseDatevKoinosCsv,
  RigaContabileDatev,
} from "../../../utils/contabilita/parsers/datevKoinosParser";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ImportRequestBody = {
  studio_id: string;
  cliente_id: string;

  controllo_id?: string | null;
  revisione_controllo_id?: string | null;
  origine_modulo?: "CONTROLLO_GESTIONE" | "REVISIONE";

  software_contabile?: string;

  nome_file?: string;

  /*
   * Per questa prima versione il frontend invierà il CSV
   * già convertito in stringa.
   */
  contenuto_csv: string;
};

type TemplateMappingRow = {
  id: string;
  template_id: string;
  codice_conto: string;
  voce_id: string | null;
  voce_id_negativo: string | null;
  moltiplicatore: number | null;
  escluso: boolean;
};

type ClienteMappingRow = {
  id: string;
  codice_conto: string;
  voce_id: string | null;
  moltiplicatore: number | null;
  escluso: boolean;
  confermato: boolean;
};

type EffectiveMapping = {
  codice_conto: string;
  voce_id: string | null;
  voce_id_negativo: string | null;
  moltiplicatore: number;
  escluso: boolean;
  origine: "template" | "cliente";
};

function normalizeCodice(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "");
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function estraiContiUtili(
  righe: RigaContabileDatev[]
): RigaContabileDatev[] {
  const perSezione = new Map<
    RigaContabileDatev["sezione"],
    RigaContabileDatev[]
  >();

  for (const riga of righe) {
    const elenco = perSezione.get(riga.sezione) || [];
    elenco.push(riga);
    perSezione.set(riga.sezione, elenco);
  }

  const risultato: RigaContabileDatev[] = [];

  for (const [, elenco] of perSezione) {
    const analitici = elenco.filter(
      (riga) => riga.livello === "analitico"
    );

    const padriConFigli = new Set(
      analitici
        .map((riga) => riga.codicePadre)
        .filter((value): value is string => Boolean(value))
    );

    for (const riga of elenco) {
      if (riga.livello === "analitico") {
        risultato.push(riga);
        continue;
      }

      if (padriConFigli.has(riga.codiceConto)) {
        continue;
      }

      risultato.push(riga);
    }
  }

  return risultato;
}

function getVoceEffettiva(
  mapping: EffectiveMapping | undefined,
  saldo: number,
  sezione: RigaContabileDatev["sezione"]
): string | null {
  if (!mapping || mapping.escluso) {
    return null;
  }

  const usaVoceNegativa =
    Boolean(mapping.voce_id_negativo) &&
    (
      saldo < 0 ||
      sezione === "SP_PASSIVO"
    );

  if (usaVoceNegativa) {
    return mapping.voce_id_negativo;
  }

  return mapping.voce_id;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  let importId: string | null = null;

  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Metodo non consentito",
      });
    }

   const {
  studio_id,
  cliente_id,
  controllo_id,
  revisione_controllo_id,
  origine_modulo = "CONTROLLO_GESTIONE",
  software_contabile = "datev_koinos",
  nome_file,
  contenuto_csv,
} = req.body as ImportRequestBody;

const origineModulo =
  origine_modulo === "REVISIONE"
    ? "REVISIONE"
    : "CONTROLLO_GESTIONE";

    if (!studio_id) {
      return res.status(400).json({
        success: false,
        error: "studio_id obbligatorio",
      });
    }

    if (!cliente_id) {
      return res.status(400).json({
        success: false,
        error: "cliente_id obbligatorio",
      });
    }

  if (
  origineModulo === "CONTROLLO_GESTIONE" &&
  !controllo_id
) {
  return res.status(400).json({
    success: false,
    error:
      "controllo_id obbligatorio per il Controllo di gestione",
  });
}

if (
  origineModulo === "REVISIONE" &&
  !revisione_controllo_id
) {
  return res.status(400).json({
    success: false,
    error:
      "revisione_controllo_id obbligatorio per la Revisione",
  });
}

if (!contenuto_csv) {
  return res.status(400).json({
    success: false,
    error: "contenuto_csv obbligatorio",
  });
}

  /*
 * 1. Verifica contesto operativo.
 */
if (origineModulo === "CONTROLLO_GESTIONE") {
  const {
    data: controllo,
    error: controlloError,
  } = await supabaseAdmin
    .from("tbcontrollo_gestione")
    .select(`
      id,
      studio_id,
      cliente_id,
      archiviato
    `)
    .eq("id", controllo_id)
    .eq("studio_id", studio_id)
    .eq("cliente_id", cliente_id)
    .maybeSingle();

  if (controlloError) {
    throw controlloError;
  }

  if (!controllo) {
    return res.status(404).json({
      success: false,
      error:
        "Controllo di gestione non trovato per lo studio/cliente indicato",
    });
  }

  if (controllo.archiviato) {
    return res.status(400).json({
      success: false,
      error:
        "Non è possibile importare dati in un controllo archiviato",
    });
  }
} else {
  const {
    data: controlloRevisione,
    error: controlloRevisioneError,
  } = await supabaseAdmin
    .from("tbrevisione_controlli")
    .select(`
      id,
      studio_id,
      incarico_id
    `)
    .eq("id", revisione_controllo_id)
    .eq("studio_id", studio_id)
    .maybeSingle();

  if (controlloRevisioneError) {
    throw controlloRevisioneError;
  }

  if (!controlloRevisione) {
    return res.status(404).json({
      success: false,
      error:
        "Controllo di revisione non trovato per lo studio indicato",
    });
  }
}
    /*
     * 2. Cliente + template associato.
     */
    const {
      data: cliente,
      error: clienteError,
    } = await supabaseAdmin
      .from("tbclienti")
      .select(`
        id,
        studio_id,
        controllo_gestione_template_id
      `)
      .eq("id", cliente_id)
      .eq("studio_id", studio_id)
      .maybeSingle();

    if (clienteError) {
      throw clienteError;
    }

    if (!cliente) {
      return res.status(404).json({
        success: false,
        error: "Cliente non trovato nello studio",
      });
    }

    let templateId =
      cliente.controllo_gestione_template_id || null;

    /*
     * Se non associato, usa il template predefinito.
     */
    if (!templateId) {
      const {
        data: templateDefault,
        error: templateError,
      } = await supabaseAdmin
        .from("tbcontrollo_gestione_template")
        .select("id")
        .eq("studio_id", studio_id)
        .eq(
          "software_contabile",
          software_contabile
        )
        .eq("predefinito", true)
        .eq("attivo", true)
        .maybeSingle();

      if (templateError) {
        throw templateError;
      }

      templateId =
        templateDefault?.id || null;

      /*
       * Se abbiamo trovato il template predefinito,
       * associamolo automaticamente al cliente.
       */
      if (templateId) {
        const {
          error: updateClienteError,
        } = await supabaseAdmin
          .from("tbclienti")
          .update({
            controllo_gestione_template_id:
              templateId,
          })
          .eq("id", cliente_id)
          .eq("studio_id", studio_id);

        if (updateClienteError) {
          throw updateClienteError;
        }
      }
    }

/*
 * Nessun Piano dei Conti Master disponibile.
 *
 * Il flusso corretto è:
 * Master PC → situazione contabile.
 *
 * Non creiamo automaticamente un master
 * partendo dalla situazione perché il master
 * deve essere preventivamente identificato
 * e può essere condiviso da più società.
 */
if (!templateId) {
  return res.status(400).json({
    success: false,

    code:
      "MASTER_PIANO_CONTI_NON_CONFIGURATO",

    error:
      "Per questa società non risulta configurato alcun Piano dei Conti Master. Configura o associa prima il piano dei conti e poi importa la situazione contabile.",
  });
}
    

    /*
     * 3. Parsing DATEV.
     */
    const parsed =
      parseDatevKoinosCsv(contenuto_csv);

    if (!parsed.righe.length) {
      return res.status(400).json({
        success: false,
        error:
          "Il file non contiene righe contabili DATEV riconoscibili",
      });
    }

    /*
     * 4. Quadrature.
     */
    const anomalie: string[] = [];

    if (
      !parsed.quadratura
        .statoPatrimoniale
    ) {
      anomalie.push(
        `Stato patrimoniale non quadrato. Differenza: ${parsed.quadratura.differenzaSP.toFixed(
          2
        )}`
      );
    }

    if (
      !parsed.quadratura
        .contoEconomico
    ) {
      anomalie.push(
        `Conto economico non quadrato. Differenza: ${parsed.quadratura.differenzaCE.toFixed(
          2
        )}`
      );
    }

    /*
     * 5. Conti utili.
     */
   const contiUtili =
  estraiContiUtili(parsed.righe);

if (!contiUtili.length) {
  return res.status(400).json({
    success: false,
    error:
      "Nessun conto utilizzabile individuato nel file DATEV",
  });
}

/*
 * =========================================================
 * 5A. SINCRONIZZAZIONE SITUAZIONE → MASTER PC
 * =========================================================
 *
 * Il Piano dei Conti Master è la fonte condivisa.
 *
 * Se nella situazione compare un conto che non esiste
 * ancora nel Master:
 *
 * - lo aggiungiamo automaticamente;
 * - NON lo classifichiamo;
 * - voce_id resta null;
 * - verrà quindi restituito come conto da classificare.
 *
 * Le classificazioni dei conti già presenti
 * NON vengono mai modificate.
 */

/*
 * Codici già presenti nel Master.
 */
const {
  data: contiMasterEsistenti,
  error: contiMasterError,
} = await supabaseAdmin
  .from(
    "tbcontrollo_gestione_template_conti"
  )
  .select(`
    codice_conto
  `)
  .eq(
    "template_id",
    templateId
  );

if (contiMasterError) {
  throw contiMasterError;
}

const codiciMaster =
  new Set(
    (contiMasterEsistenti || [])
      .map((conto) =>
        normalizeCodice(
          conto.codice_conto
        )
      )
      .filter(Boolean)
  );

/*
 * Evitiamo doppioni anche all'interno
 * della situazione stessa.
 */
const nuoviContiMap =
  new Map<
    string,
    {
      template_id: string;
      codice_conto: string;
      descrizione_conto: string;
      voce_id: null;
      voce_id_negativo: null;
      moltiplicatore: number;
      escluso: boolean;
      updated_at: string;
    }
  >();

for (const conto of contiUtili) {
  const codice =
    normalizeCodice(
      conto.codiceConto
    );

  if (
    !codice ||
    codiciMaster.has(codice)
  ) {
    continue;
  }

  nuoviContiMap.set(
    codice,
    {
      template_id:
        templateId,

      codice_conto:
        codice,

      descrizione_conto:
        String(
          conto.descrizione || ""
        )
          .trim()
          .replace(/\s+/g, " "),

      /*
       * Nuovo conto:
       * deve ancora essere classificato.
       */
      voce_id:
        null,

      voce_id_negativo:
        null,

      moltiplicatore:
        1,

      escluso:
        false,

      updated_at:
        new Date()
          .toISOString(),
    }
  );
}

const nuoviContiMaster =
  Array.from(
    nuoviContiMap.values()
  );

/*
 * Inserimento a blocchi.
 *
 * Usiamo upsert + ignoreDuplicates
 * anche come protezione da eventuali
 * import concorrenti.
 */
if (
  nuoviContiMaster.length > 0
) {
  const BATCH_SIZE_MASTER =
    500;

  for (
    let i = 0;
    i < nuoviContiMaster.length;
    i += BATCH_SIZE_MASTER
  ) {
    const batch =
      nuoviContiMaster.slice(
        i,
        i + BATCH_SIZE_MASTER
      );

    const {
      error: insertMasterError,
    } = await supabaseAdmin
      .from(
        "tbcontrollo_gestione_template_conti"
      )
      .upsert(
        batch,
        {
          onConflict:
            "template_id,codice_conto",

          ignoreDuplicates:
            true,
        }
      );

    if (insertMasterError) {
      throw insertMasterError;
    }
  }
}

/*
 * Verifichiamo se il controllo possiede già un import.
 *
 * Un controllo deve avere un solo import corrente.
 * Se esiste, lo sostituiremo mantenendo lo stesso import_id.
 */
let importEsistenteQuery = supabaseAdmin
  .from("tbcontrollo_gestione_import")
  .select("id")
  .eq("studio_id", studio_id)
  .eq("cliente_id", cliente_id)
  .eq("origine_modulo", origineModulo);

if (origineModulo === "REVISIONE") {
  importEsistenteQuery =
    importEsistenteQuery.eq(
      "revisione_controllo_id",
      revisione_controllo_id
    );
} else {
  importEsistenteQuery =
    importEsistenteQuery.eq(
      "controllo_id",
      controllo_id
    );
}

const {
  data: importEsistente,
  error: importEsistenteError,
} = await importEsistenteQuery
  .order("created_at", {
    ascending: false,
  })
  .limit(1)
  .maybeSingle();

if (importEsistenteError) {
  throw importEsistenteError;
}

if (importEsistenteError) {
  throw importEsistenteError;
}

/*
 * 6. MAPPATURE TEMPLATE.
 */
    let templateMappings:
      TemplateMappingRow[] = [];

    if (templateId) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "tbcontrollo_gestione_template_conti"
        )
        .select(`
          id,
          template_id,
          codice_conto,
          voce_id,
          voce_id_negativo,
          moltiplicatore,
          escluso
        `)
        .eq(
          "template_id",
          templateId
        );

      if (error) {
        throw error;
      }

      templateMappings =
        (data || []) as TemplateMappingRow[];
    }

    /*
     * 7. ECCEZIONI CLIENTE.
     */
    const {
      data: clienteMappings,
      error: clienteMappingsError,
    } = await supabaseAdmin
      .from(
        "tbcontrollo_gestione_mappatura_conti"
      )
      .select(`
        id,
        codice_conto,
        voce_id,
        moltiplicatore,
        escluso,
        confermato
      `)
      .eq("studio_id", studio_id)
      .eq("cliente_id", cliente_id)
      .eq(
        "software_contabile",
        software_contabile
      );

    if (clienteMappingsError) {
      throw clienteMappingsError;
    }

    /*
     * 8. MERGE MAPPATURE.
     *
     * Prima template.
     * Poi cliente, che prevale.
     */
    const mappingMap =
      new Map<string, EffectiveMapping>();

    for (const mapping of templateMappings) {
      mappingMap.set(
        normalizeCodice(
          mapping.codice_conto
        ),
        {
          codice_conto:
            mapping.codice_conto,

          voce_id:
            mapping.voce_id,

          voce_id_negativo:
            mapping.voce_id_negativo,

          moltiplicatore:
            Number(
              mapping.moltiplicatore || 1
            ),

          escluso:
            Boolean(mapping.escluso),

          origine: "template",
        }
      );
    }

    for (const mapping of
      (clienteMappings ||
        []) as ClienteMappingRow[]) {
      /*
       * Le vecchie righe cliente vengono
       * considerate solo se confermate.
       */
      if (!mapping.confermato) {
        continue;
      }

      mappingMap.set(
        normalizeCodice(
          mapping.codice_conto
        ),
        {
          codice_conto:
            mapping.codice_conto,

          voce_id:
            mapping.voce_id,

          /*
           * Le eccezioni cliente attuali non hanno
           * ancora voce_id_negativo.
           */
          voce_id_negativo: null,

          moltiplicatore:
            Number(
              mapping.moltiplicatore || 1
            ),

          escluso:
            Boolean(mapping.escluso),

          origine: "cliente",
        }
      );
    }

    /*
     * 9. Conteggi.
     */
    let contiMappati = 0;
    let contiDaMappare = 0;
    let contiEsclusi = 0;

    for (const conto of contiUtili) {
      const mapping =
        mappingMap.get(
          normalizeCodice(
            conto.codiceConto
          )
        );

      if (!mapping) {
        contiDaMappare++;
        continue;
      }

      if (mapping.escluso) {
        contiEsclusi++;
        continue;
      }

const voceEffettiva =
  getVoceEffettiva(
    mapping,
    conto.importo,
    conto.sezione
  );

      if (voceEffettiva) {
        contiMappati++;
      } else {
        contiDaMappare++;
      }
    }

   /*
 * 10. Registro import.
 *
 * Analizza e importa = SALVATAGGIO AUTOMATICO.
 *
 * Se il controllo possiede già un import:
 * - manteniamo lo stesso import_id;
 * - sostituiamo i dati;
 * - eliminiamo le vecchie righe contabili;
 * - invalidiamo saldi e indici già elaborati.
 *
 * Se non esiste, creiamo il primo import.
 */
const statoImport =
  contiDaMappare > 0
    ? "da_mappare"
    : "validazione";

const payloadImport = {
  studio_id,
  cliente_id,

  origine_modulo: origineModulo,

  controllo_id:
    origineModulo === "CONTROLLO_GESTIONE"
      ? controllo_id || null
      : null,

  revisione_controllo_id:
    origineModulo === "REVISIONE"
      ? revisione_controllo_id || null
      : null,

  software_contabile,

  tipo_import:
    "situazione_contabile",

  data_riferimento:
    parsed.periodoAl ||
    new Date()
      .toISOString()
      .slice(0, 10),

  nome_file:
    nome_file || null,

  numero_righe:
    parsed.righe.length,

  numero_conti:
    contiUtili.length,

  conti_mappati:
    contiMappati,

  conti_da_mappare:
    contiDaMappare,

  numero_errori:
    anomalie.length,

  stato:
    statoImport,

  messaggio_errore:
    anomalie.length > 0
      ? anomalie.join(" | ")
      : null,
};
if (importEsistente?.id) {
  importId = importEsistente.id;

  /*
   * Eliminiamo prima le righe appartenenti
   * al precedente file importato.
   */
  const {
    error: deleteRigheError,
  } = await supabaseAdmin
    .from(
      "tbcontrollo_gestione_import_righe"
    )
    .delete()
    .eq(
      "import_id",
      importId
    );

  if (deleteRigheError) {
    throw deleteRigheError;
  }

 /*
 * Saldi e indici del Controllo di gestione
 * esistono soltanto quando l'import proviene
 * dal modulo CONTROLLO_GESTIONE.
 *
 * Un import proveniente dalla Revisione non deve
 * dipendere da tbcontrollo_gestione.
 */
if (
  origineModulo === "CONTROLLO_GESTIONE" &&
  controllo_id
) {
  /*
   * I saldi derivati non sono più validi.
   * Verranno rigenerati con "Elabora controllo".
   */
  const {
    error: deleteSaldiError,
  } = await supabaseAdmin
    .from(
      "tbcontrollo_gestione_saldi"
    )
    .delete()
    .eq(
      "controllo_id",
      controllo_id
    );

  if (deleteSaldiError) {
    throw deleteSaldiError;
  }

  /*
   * Anche gli indici automatici
   * non sono più validi.
   */
  const {
    error: deleteIndiciError,
  } = await supabaseAdmin
    .from(
      "tbcontrollo_gestione_indici"
    )
    .delete()
    .eq(
      "controllo_gestione_id",
      controllo_id
    )
    .eq(
      "origine",
      "contabilita_datev"
    );

  if (deleteIndiciError) {
    throw deleteIndiciError;
  }
}
  const {
    error: updateImportError,
  } = await supabaseAdmin
    .from(
      "tbcontrollo_gestione_import"
    )
    .update(
      payloadImport
    )
    .eq(
      "id",
      importId
    );

  if (updateImportError) {
    throw updateImportError;
  }
} else {
  const {
    data: importRecord,
    error: importError,
  } = await supabaseAdmin
    .from(
      "tbcontrollo_gestione_import"
    )
    .insert(
      payloadImport
    )
    .select("id")
    .single();

  if (importError) {
    throw importError;
  }

  importId =
    importRecord.id;
}

    /*
     * 11. STAGING.
     */
    const stagingRows =
      contiUtili.map((conto) => {
        const mapping =
          mappingMap.get(
            normalizeCodice(
              conto.codiceConto
            )
          );

        const esclusa =
          Boolean(
            mapping?.escluso
          );

      const voceEffettiva =
  getVoceEffettiva(
    mapping,
    conto.importo,
    conto.sezione
  );

        const mappata =
          Boolean(mapping) &&
          !esclusa &&
          Boolean(
            voceEffettiva
          );

        const moltiplicatore =
          mapping?.moltiplicatore || 1;

        const importoEffettivo =
          round2(
            conto.importo *
              moltiplicatore
          );

        return {
          studio_id,
          cliente_id,
          import_id: importId,

          numero_riga:
            conto.numeroRiga,

          codice_conto:
            conto.codiceConto,

          descrizione_conto:
            conto.descrizione,

          saldo_dare:
            conto.sezione ===
              "SP_ATTIVO" ||
            conto.sezione ===
              "CE_COSTI"
              ? importoEffettivo
              : 0,

          saldo_avere:
            conto.sezione ===
              "SP_PASSIVO" ||
            conto.sezione ===
              "CE_RICAVI"
              ? importoEffettivo
              : 0,

          saldo:
            importoEffettivo,

          voce_id:
            esclusa
              ? null
              : voceEffettiva,

          mappata,
          esclusa,

          dati_originali: {
            sezione:
              conto.sezione,

            livello:
              conto.livello,

            codice_padre:
              conto.codicePadre ||
              null,

            origine_mappatura:
              mapping?.origine ||
              null,

            voce_id_standard:
              mapping?.voce_id ||
              null,

            voce_id_negativo:
              mapping
                ?.voce_id_negativo ||
              null,

            applicata_voce_negativa:
              Boolean(
                conto.importo < 0 &&
                mapping
                  ?.voce_id_negativo
              ),
          },
        };
      });

    /*
     * 12. Inserimento staging.
     */
    const BATCH_SIZE = 500;

    for (
      let i = 0;
      i < stagingRows.length;
      i += BATCH_SIZE
    ) {
      const batch =
        stagingRows.slice(
          i,
          i + BATCH_SIZE
        );

      const {
        error: stagingError,
      } = await supabaseAdmin
        .from(
          "tbcontrollo_gestione_import_righe"
        )
        .insert(batch);

      if (stagingError) {
        throw stagingError;
      }
    }

    /*
     * 13. Ultimo utilizzo:
     *
     * aggiorniamo soltanto le eventuali
     * eccezioni cliente.
     *
     * Il template non possiede ultimo_utilizzo.
     */
    const codiciClienteUtilizzati =
      Array.from(
        new Set(
          contiUtili
            .map((conto) =>
              normalizeCodice(
                conto.codiceConto
              )
            )
            .filter((codice) => {
              const mapping =
                mappingMap.get(
                  codice
                );

              return (
                mapping?.origine ===
                "cliente"
              );
            })
        )
      );

    if (
      codiciClienteUtilizzati.length >
      0
    ) {
      const now =
        new Date().toISOString();

      const {
        error: utilizzoError,
      } = await supabaseAdmin
        .from(
          "tbcontrollo_gestione_mappatura_conti"
        )
        .update({
          ultimo_utilizzo:
            now,
          updated_at:
            now,
        })
        .eq(
          "studio_id",
          studio_id
        )
        .eq(
          "cliente_id",
          cliente_id
        )
        .eq(
          "software_contabile",
          software_contabile
        )
        .in(
          "codice_conto",
          codiciClienteUtilizzati
        );

      if (utilizzoError) {
        console.error(
          "Errore aggiornamento ultimo_utilizzo:",
          utilizzoError
        );
      }
    }

    /*
     * 14. Conti ancora da mappare.
     */
    const daMappare =
      stagingRows
        .filter(
          (riga) =>
            !riga.mappata &&
            !riga.esclusa
        )
        .map((riga) => ({
          codice_conto:
            riga.codice_conto,

          descrizione_conto:
            riga.descrizione_conto,

          importo:
            riga.saldo,

          sezione:
            riga.dati_originali
              .sezione,

          codice_padre:
            riga.dati_originali
              .codice_padre,
        }));

    /*
     * 15. Risposta.
     */
    return res.status(200).json({
      success: true,

      import_id:
        importId,

      template_id:
        templateId,

      file: {
        nome:
          nome_file || null,

        societa:
          parsed.societa,

        codice_azienda:
          parsed.codiceAzienda,

        periodo_dal:
          parsed.periodoDal,

        periodo_al:
          parsed.periodoAl,
      },

      quadratura:
        parsed.quadratura,

      totali:
        parsed.totali,

      riepilogo: {
        righe_lette:
          parsed.righe.length,

        conti_importati:
          contiUtili.length,

        conti_mappati:
          contiMappati,

        conti_da_mappare:
          contiDaMappare,

        conti_esclusi:
          contiEsclusi,

        anomalie:
          anomalie.length,
      },

      stato:
        statoImport,

      anomalie,

      da_mappare:
        daMappare,
    });
  } catch (error: any) {
    console.error(
      "Errore API import contabilità:",
      error
    );

    if (importId) {
      try {
        await supabaseAdmin
          .from(
            "tbcontrollo_gestione_import"
          )
          .update({
            stato: "errore",

            numero_errori: 1,

            messaggio_errore:
              error?.message ||
              "Errore elaborazione import",
          })
          .eq(
            "id",
            importId
          );
      } catch (updateError) {
        console.error(
          "Impossibile aggiornare stato import:",
          updateError
        );
      }
    }

    return res.status(500).json({
      success: false,

      error:
        error?.message ||
        "Errore interno durante l'importazione",
    });
  }
}
