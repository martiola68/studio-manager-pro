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
  controllo_id: string;

  software_contabile?: string;

  nome_file?: string;

  /*
   * Per questa prima versione il frontend invierà il CSV
   * già convertito in stringa.
   */
  contenuto_csv: string;
};

type MappingRow = {
  id: string;
  codice_conto: string;
  voce_id: string | null;
  moltiplicatore: number | null;
  escluso: boolean;
  confermato: boolean;
};

function normalizeCodice(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "");
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/*
 * Restituisce soltanto i conti da utilizzare per l'elaborazione.
 *
 * IMPORTANTE:
 * il CSV DATEV contiene sia conti sintetici sia analitici.
 * Non possiamo sommare entrambi.
 *
 * Per questa prima versione:
 * - se un conto è chiaramente analitico, viene preferito;
 * - i sintetici rimangono disponibili nel risultato del parser,
 *   ma non vengono automaticamente sommati nello staging.
 *
 * Successivamente, se il formato DATEV richiederà una gerarchia
 * più complessa, questa funzione sarà il solo punto da modificare.
 */
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
    /*
     * Nel parser abbiamo già una prima classificazione
     * conto / analitico.
     *
     * I conti analitici sono quelli da preferire.
     */
    const analitici = elenco.filter(
      (riga) => riga.livello === "analitico"
    );

    /*
     * Alcuni raggruppamenti DATEV potrebbero non avere
     * sottoconti analitici nel file.
     *
     * In quel caso dobbiamo mantenere il conto sintetico,
     * altrimenti perderemmo l'importo.
     */
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

      /*
       * Se il sintetico ha figli analitici, NON lo sommiamo.
       */
      if (padriConFigli.has(riga.codiceConto)) {
        continue;
      }

      /*
       * Se non ha figli, il suo importo deve essere mantenuto.
       */
      risultato.push(riga);
    }
  }

  return risultato;
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
      software_contabile = "datev_koinos",
      nome_file,
      contenuto_csv,
    } = req.body as ImportRequestBody;

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

    if (!controllo_id) {
      return res.status(400).json({
        success: false,
        error: "controllo_id obbligatorio",
      });
    }

    if (!contenuto_csv) {
      return res.status(400).json({
        success: false,
        error: "contenuto_csv obbligatorio",
      });
    }

    /*
     * 1. Verifica che il controllo appartenga davvero
     *    allo studio e al cliente indicati.
     */
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

    /*
     * 2. Parsing DATEV.
     */
    const parsed = parseDatevKoinosCsv(contenuto_csv);

    if (!parsed.righe.length) {
      return res.status(400).json({
        success: false,
        error:
          "Il file non contiene righe contabili DATEV riconoscibili",
      });
    }

    /*
     * 3. Controllo quadrature.
     *
     * Per ora NON blocchiamo l'import in presenza di differenze:
     * restituiamo l'anomalia e consentiamo di capire se il parser
     * deve essere adattato a qualche ulteriore caso DATEV.
     */
    const anomalie: string[] = [];

    if (!parsed.quadratura.statoPatrimoniale) {
      anomalie.push(
        `Stato patrimoniale non quadrato. Differenza: ${parsed.quadratura.differenzaSP.toFixed(
          2
        )}`
      );
    }

    if (!parsed.quadratura.contoEconomico) {
      anomalie.push(
        `Conto economico non quadrato. Differenza: ${parsed.quadratura.differenzaCE.toFixed(
          2
        )}`
      );
    }

    /*
     * 4. Selezioniamo i conti da elaborare evitando
     *    la doppia contabilizzazione sintetico + analitico.
     */
    const contiUtili = estraiContiUtili(parsed.righe);

    if (!contiUtili.length) {
      return res.status(400).json({
        success: false,
        error:
          "Nessun conto utilizzabile individuato nel file DATEV",
      });
    }

    /*
     * 5. Recuperiamo tutte le mappature già conosciute
     *    per questa SPECIFICA società.
     */
    const {
      data: mappings,
      error: mappingsError,
    } = await supabaseAdmin
      .from("tbcontrollo_gestione_mappatura_conti")
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
      .eq("software_contabile", software_contabile);

    if (mappingsError) {
      throw mappingsError;
    }

    const mappingMap = new Map<string, MappingRow>();

    for (const mapping of (mappings || []) as MappingRow[]) {
      mappingMap.set(
        normalizeCodice(mapping.codice_conto),
        mapping
      );
    }

    /*
     * 6. Conteggi preliminari.
     */
    let contiMappati = 0;
    let contiDaMappare = 0;
    let contiEsclusi = 0;

    for (const conto of contiUtili) {
      const mapping = mappingMap.get(
        normalizeCodice(conto.codiceConto)
      );

      if (!mapping) {
        contiDaMappare++;
        continue;
      }

      if (mapping.escluso) {
        contiEsclusi++;
        continue;
      }

      if (
        mapping.voce_id &&
        mapping.confermato
      ) {
        contiMappati++;
      } else {
        contiDaMappare++;
      }
    }

    /*
     * 7. Creazione registro import.
     */
    const statoImport =
      contiDaMappare > 0
        ? "da_mappare"
        : "validazione";

    const {
      data: importRecord,
      error: importError,
    } = await supabaseAdmin
      .from("tbcontrollo_gestione_import")
      .insert({
        studio_id,
        cliente_id,
        controllo_id,

        software_contabile,
        tipo_import: "situazione_contabile",

        data_riferimento:
          parsed.periodoAl ||
          new Date().toISOString().slice(0, 10),

        nome_file: nome_file || null,

        numero_righe: parsed.righe.length,
        numero_conti: contiUtili.length,

        conti_mappati: contiMappati,
        conti_da_mappare: contiDaMappare,

        numero_errori: anomalie.length,

        stato: statoImport,

        messaggio_errore:
          anomalie.length > 0
            ? anomalie.join(" | ")
            : null,
      })
      .select("id")
      .single();

    if (importError) {
      throw importError;
    }

    importId = importRecord.id;

    /*
     * 8. Preparazione staging.
     */
    const stagingRows = contiUtili.map((conto) => {
      const mapping = mappingMap.get(
        normalizeCodice(conto.codiceConto)
      );

      const esclusa = Boolean(mapping?.escluso);

      const mappata =
        Boolean(mapping) &&
        !esclusa &&
        Boolean(mapping?.voce_id) &&
        Boolean(mapping?.confermato);

      return {
        studio_id,
        cliente_id,
        import_id: importId,

        numero_riga: conto.numeroRiga,

        codice_conto: conto.codiceConto,
        descrizione_conto: conto.descrizione,

        /*
         * DATEV ci fornisce già un importo per lato.
         *
         * Manteniamo per ora saldo = importo.
         * Dare/Avere saranno valorizzati in base alla sezione.
         */
        saldo_dare:
          conto.sezione === "SP_ATTIVO" ||
          conto.sezione === "CE_COSTI"
            ? round2(conto.importo)
            : 0,

        saldo_avere:
          conto.sezione === "SP_PASSIVO" ||
          conto.sezione === "CE_RICAVI"
            ? round2(conto.importo)
            : 0,

        saldo: round2(conto.importo),

        voce_id:
          esclusa
            ? null
            : mapping?.voce_id || null,

        mappata,
        esclusa,

        dati_originali: {
          sezione: conto.sezione,
          livello: conto.livello,
          codice_padre:
            conto.codicePadre || null,
        },
      };
    });

    /*
     * Supabase/PostgREST può gestire inserimenti multipli,
     * ma evitiamo payload giganteschi usando batch.
     */
    const BATCH_SIZE = 500;

    for (
      let i = 0;
      i < stagingRows.length;
      i += BATCH_SIZE
    ) {
      const batch = stagingRows.slice(
        i,
        i + BATCH_SIZE
      );

      const { error: stagingError } =
        await supabaseAdmin
          .from(
            "tbcontrollo_gestione_import_righe"
          )
          .insert(batch);

      if (stagingError) {
        throw stagingError;
      }
    }

    /*
     * 9. Aggiorniamo ultimo_utilizzo delle mappature
     *    effettivamente incontrate.
     */
    const codiciUtilizzati = Array.from(
      new Set(
        contiUtili
          .map((conto) =>
            normalizeCodice(conto.codiceConto)
          )
          .filter((codice) =>
            mappingMap.has(codice)
          )
      )
    );

    if (codiciUtilizzati.length > 0) {
      const now = new Date().toISOString();

      const { error: utilizzoError } =
        await supabaseAdmin
          .from(
            "tbcontrollo_gestione_mappatura_conti"
          )
          .update({
            ultimo_utilizzo: now,
            updated_at: now,
          })
          .eq("studio_id", studio_id)
          .eq("cliente_id", cliente_id)
          .eq(
            "software_contabile",
            software_contabile
          )
          .in(
            "codice_conto",
            codiciUtilizzati
          );

      if (utilizzoError) {
        console.error(
          "Errore aggiornamento ultimo_utilizzo:",
          utilizzoError
        );
      }
    }

    /*
     * 10. Prepariamo i conti mancanti da mostrare
     *     immediatamente nella futura UI.
     */
    const daMappare = stagingRows
      .filter(
        (riga) =>
          !riga.mappata &&
          !riga.esclusa
      )
      .map((riga) => ({
        codice_conto: riga.codice_conto,
        descrizione_conto:
          riga.descrizione_conto,

        importo: riga.saldo,

        sezione:
          riga.dati_originali.sezione,

        codice_padre:
          riga.dati_originali.codice_padre,
      }));

    /*
     * 11. Risposta.
     */
    return res.status(200).json({
      success: true,

      import_id: importId,

      file: {
        nome: nome_file || null,

        societa: parsed.societa,
        codice_azienda: parsed.codiceAzienda,

        periodo_dal: parsed.periodoDal,
        periodo_al: parsed.periodoAl,
      },

      quadratura: parsed.quadratura,

      totali: parsed.totali,

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

      stato: statoImport,

      anomalie,

      da_mappare: daMappare,
    });
  } catch (error: any) {
    console.error(
      "Errore API import contabilità:",
      error
    );

    /*
     * Se abbiamo già creato l'import ma qualcosa è fallito
     * successivamente, lo marchiamo come errore.
     */
    if (importId) {
      try {
        await supabaseAdmin
          .from("tbcontrollo_gestione_import")
          .update({
            stato: "errore",
            numero_errori: 1,
            messaggio_errore:
              error?.message ||
              "Errore elaborazione import",
          })
          .eq("id", importId);
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
