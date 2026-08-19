import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ImportRow = {
  id: string;
  voce_id: string | null;
  saldo: number | string | null;
  mappata: boolean | null;
  esclusa: boolean | null;
};

type VoceRow = {
  id: string;
  codice: string;
  descrizione: string;
  sezione: string;
  macrovoce: string | null;
  natura: string;
  ordine: number;
};

type SaldoVoce = {
  voce_id: string;
  codice: string;
  descrizione: string;
  sezione: string;
  macrovoce: string | null;
  natura: string;
  ordine: number;
  importo: number;
  numero_conti: number;
};

function round2(value: number): number {
  return Math.round(
    (Number(value || 0) + Number.EPSILON) * 100
  ) / 100;
}

function safeDiv(
  numeratore: number,
  denominatore: number
): number {
  if (!denominatore) {
    return 0;
  }

  return numeratore / denominatore;
}

function sommaPerMacrovoce(
  saldi: SaldoVoce[],
  macrovoce: string
): number {
  return round2(
    saldi
      .filter(
        (row) =>
          row.macrovoce === macrovoce
      )
      .reduce(
        (totale, row) =>
          totale + row.importo,
        0
      )
  );
}

function sommaPerSezione(
  saldi: SaldoVoce[],
  sezione: string
): number {
  return round2(
    saldi
      .filter(
        (row) =>
          row.sezione === sezione
      )
      .reduce(
        (totale, row) =>
          totale + row.importo,
        0
      )
  );
}

function importoCodice(
  saldi: SaldoVoce[],
  codice: string
): number {
  return round2(
    saldi
      .filter(
        (row) =>
          row.codice === codice
      )
      .reduce(
        (totale, row) =>
          totale + row.importo,
        0
      )
  );
}

async function leggiTutteLeRigheImport(
  importId: string
): Promise<ImportRow[]> {
  const PAGE_SIZE = 1000;

  const risultato: ImportRow[] = [];

  let from = 0;

  while (true) {
    const to =
      from + PAGE_SIZE - 1;

     const {
      data,
      error,
    } = await supabaseAdmin
      .from(
        "tbcontrollo_gestione_import_righe"
      )
      .select(`
        id,
        voce_id,
        saldo,
        mappata,
        esclusa
      `)
      .eq("import_id", importId)
      .range(from, to);

    if (error) {
      throw error;
    }

    const rows =
      (data || []) as ImportRow[];

    risultato.push(...rows);

    if (
      rows.length <
      PAGE_SIZE
    ) {
      break;
    }

    from += PAGE_SIZE;
  }

  return risultato;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (
      req.method !== "POST"
    ) {
      return res.status(405).json({
        success: false,
        error:
          "Metodo non consentito",
      });
    }

    const {
      import_id,
    } = req.body;

    if (!import_id) {
      return res.status(400).json({
        success: false,
        error:
          "import_id obbligatorio",
      });
    }

    /*
     * =====================================================
     * 1. IMPORT
     * =====================================================
     */
    const {
      data: importRecord,
      error: importError,
    } = await supabaseAdmin
      .from(
        "tbcontrollo_gestione_import"
      )
      .select(`
  id,
  studio_id,
  cliente_id,
  controllo_id,
  revisione_controllo_id,
  origine_modulo,
  software_contabile,
  data_riferimento,
  numero_conti,
  conti_mappati,
  conti_da_mappare,
  stato
`)
      .eq("id", import_id)
      .maybeSingle();

    if (importError) {
      throw importError;
    }

  const origineRevisione =
  importRecord.origine_modulo ===
  "REVISIONE";

const origineControlloGestione =
  !origineRevisione;

       /*
     * =====================================================
     * 2. CLIENTE
     * =====================================================
     */
    const {
      data: cliente,
      error: clienteError,
    } = await supabaseAdmin
      .from("tbclienti")
      .select(`
        id,
        ragione_sociale,
        codice_fiscale
      `)
      .eq(
        "id",
        importRecord.cliente_id
      )
      .maybeSingle();

    if (clienteError) {
      throw clienteError;
    }

    /*
     * =====================================================
     * 3. INTEGRAZIONI GESTIONALI
     * =====================================================
     */
    const {
      data: integrazione,
      error: integrazioneError,
    } = await supabaseAdmin
      .from(
        "tbcontrollo_gestione_integrazioni"
      )
      .select(`
        debiti_finanziari_bt,
        debiti_finanziari_mlt,
        rate_finanziarie_12_mesi,
        cash_flow_operativo_previsionale,
        note
      `)
      .eq(
        "import_id",
        import_id
      )
      .maybeSingle();

    if (integrazioneError) {
      throw integrazioneError;
    }

    /*
     * =====================================================
     * 4. RIGHE CONTABILI
     * =====================================================
     */
    const righe =
      await leggiTutteLeRigheImport(
        import_id
      );

  if (
  righe.length === 0
) {
  return res.status(400).json({
    success: false,
    error:
      "L'import non contiene righe contabili.",
  });
}

/*
 * La fonte autorevole per verificare la classificazione
 * è lo staging dell'import corrente.
 *
 * Non utilizziamo conti_da_mappare del registro import,
 * perché potrebbe essere un valore precedente/non più
 * coerente con le righe effettivamente riclassificate.
 */
const righeDaClassificare =
  righe.filter(
    (row) =>
      row.esclusa !== true &&
      (
        row.mappata !== true ||
        !row.voce_id
      )
  );

if (righeDaClassificare.length > 0) {
  return res.status(400).json({
    success: false,
    error:
      `Non è possibile elaborare il controllo: ${righeDaClassificare.length} conti risultano ancora da classificare.`,
  });
}

const righeUtili =
  righe.filter(
    (row) =>
      row.mappata === true &&
      row.esclusa !== true &&
      Boolean(row.voce_id)
  );

    if (
      righeUtili.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Nessuna riga riclassificata disponibile.",
      });
    }

    /*
     * =====================================================
     * 5. VOCI DI RICLASSIFICAZIONE
     * =====================================================
     */
    const voceIds =
      Array.from(
        new Set(
          righeUtili
            .map(
              (row) =>
                row.voce_id
            )
            .filter(
              (
                value
              ): value is string =>
                Boolean(value)
            )
        )
      );

    const {
      data: vociData,
      error: vociError,
    } = await supabaseAdmin
      .from(
        "tbcontrollo_gestione_voci"
      )
      .select(`
        id,
        codice,
        descrizione,
        sezione,
        macrovoce,
        natura,
        ordine
      `)
      .in("id", voceIds);

    if (vociError) {
      throw vociError;
    }

    const voci =
      (vociData ||
        []) as VoceRow[];

    const vociMap =
      new Map(
        voci.map(
          (voce) => [
            voce.id,
            voce,
          ]
        )
      );

    /*
     * =====================================================
     * 6. AGGREGAZIONE PER VOCE
     * =====================================================
     */
    const aggregati =
      new Map<
        string,
        {
          importo: number;
          numero_conti: number;
        }
      >();

    for (
      const row of
      righeUtili
    ) {
      if (!row.voce_id) {
        continue;
      }

      const voce =
        vociMap.get(
          row.voce_id
        );

      if (!voce) {
        continue;
      }

      let importo =
        Number(
          row.saldo || 0
        );

      /*
       * BANCHE
       *
       * Una banca passiva arriva dalla contabilità
       * con segno negativo/Avere.
       *
       * Una volta riclassificata tra i debiti bancari
       * deve essere esposta come valore positivo.
       */
      if (
        voce.codice ===
          "SP_DEBITI_BANCHE_BT" ||
        voce.codice ===
          "SP_DEBITI_BANCHE_MLT"
      ) {
        importo =
          Math.abs(importo);
      }

      const corrente =
        aggregati.get(
          row.voce_id
        ) || {
          importo: 0,
          numero_conti: 0,
        };

      corrente.importo +=
        importo;

      corrente.numero_conti +=
        1;

      aggregati.set(
        row.voce_id,
        corrente
      );
    }

    const saldi: SaldoVoce[] =
      Array.from(
        aggregati.entries()
      )
        .map(
          ([
            voceId,
            valore,
          ]) => {
            const voce =
              vociMap.get(
                voceId
              )!;

            return {
              voce_id:
                voceId,

              codice:
                voce.codice,

              descrizione:
                voce.descrizione,

              sezione:
                voce.sezione,

              macrovoce:
                voce.macrovoce,

              natura:
                voce.natura,

              ordine:
                voce.ordine,

              importo:
                round2(
                  valore.importo
                ),

              numero_conti:
                valore.numero_conti,
            };
          }
        )
        .sort(
          (a, b) =>
            a.ordine -
            b.ordine
        );

/*
 * =====================================================
 * 7. SALVATAGGIO SALDI RICLASSIFICATI
 * =====================================================
 *
 * L'elaborazione è ripetibile.
 *
 * Un controllo di gestione deve contenere una sola
 * elaborazione corrente dei saldi riclassificati.
 *
 * Quando viene effettuato un nuovo import dello stesso
 * controllo, il nuovo import_id è diverso dal precedente.
 *
 * Per questo motivo eliminiamo i saldi precedenti
 * dell'intero controllo e li rigeneriamo utilizzando
 * l'import corrente.
 */
const {
  error: deleteSaldiError,
} = await supabaseAdmin
  .from(
    "tbcontrollo_gestione_saldi"
  )
  .delete()
  .eq(
    "import_id",
    import_id
  );

if (deleteSaldiError) {
  throw deleteSaldiError;
}
    if (
      saldi.length > 0
    ) {
      const rowsSaldi =
        saldi.map(
          (saldo) => ({
            studio_id:
              importRecord.studio_id,

            cliente_id:
              importRecord.cliente_id,

            controllo_id:
              importRecord.controllo_id,

            import_id,

            voce_id:
              saldo.voce_id,

            importo:
              saldo.importo,

            numero_conti:
              saldo.numero_conti,

            updated_at:
              new Date()
                .toISOString(),
          })
        );

      const {
        error: insertSaldiError,
      } = await supabaseAdmin
        .from(
          "tbcontrollo_gestione_saldi"
        )
        .insert(
          rowsSaldi
        );

      if (insertSaldiError) {
        throw insertSaldiError;
      }
    }

    /*
     * =====================================================
     * 8. CONTO ECONOMICO
     * =====================================================
     */
    const ricavi =
      sommaPerMacrovoce(
        saldi,
        "ricavi"
      );

    const costiOperativi =
      sommaPerMacrovoce(
        saldi,
        "costi_operativi"
      );

    const ammortamenti =
      sommaPerMacrovoce(
        saldi,
        "ammortamenti"
      );

    const accantonamenti =
      sommaPerMacrovoce(
        saldi,
        "accantonamenti"
      );

    const proventiFinanziari =
      importoCodice(
        saldi,
        "CE_PROVENTI_FINANZIARI"
      );

    const oneriFinanziariLordi =
      importoCodice(
        saldi,
        "CE_ONERI_FINANZIARI"
      );

    /*
     * Manteniamo compatibilità con la vecchia
     * formula:
     *
     * EBT = EBIT - oneri_finanziari
     *
     * ma oneri_finanziari viene ora valorizzato
     * AL NETTO dei proventi.
     */
    const oneriFinanziari =
      round2(
        oneriFinanziariLordi -
          proventiFinanziari
      );

    const imposte =
      sommaPerMacrovoce(
        saldi,
        "imposte"
      );

    const ebitda =
      round2(
        ricavi -
          costiOperativi
      );

    const ebit =
      round2(
        ebitda -
          ammortamenti -
          accantonamenti
      );

    const ebt =
      round2(
        ebit -
          oneriFinanziari
      );

    const risultatoContoEconomico =
      round2(
        ebt -
          imposte
      );

    /*
     * =====================================================
     * 9. STATO PATRIMONIALE
     * =====================================================
     */
    const totaleAttivo =
      sommaPerSezione(
        saldi,
        "stato_patrimoniale_attivo"
      );

    const attivoCorrente =
      sommaPerMacrovoce(
        saldi,
        "attivo_corrente"
      );

    const disponibilitaLiquide =
      importoCodice(
        saldi,
        "SP_DISPONIBILITA_LIQUIDE"
      );

    const patrimonioNettoContabile =
      sommaPerMacrovoce(
        saldi,
        "patrimonio_netto"
      );

    const debitiBancheBtContabili =
      importoCodice(
        saldi,
        "SP_DEBITI_BANCHE_BT"
      );

    const debitiBancheMltContabili =
      importoCodice(
        saldi,
        "SP_DEBITI_BANCHE_MLT"
      );

    const debitiFinanziariContabili =
      round2(
        debitiBancheBtContabili +
          debitiBancheMltContabili
      );

    /*
     * =====================================================
     * 10. RIPARTIZIONE MANUALE DEBITI FINANZIARI
     * =====================================================
     *
     * Se esiste una integrazione salvata,
     * BT e MLT sono la ripartizione autorevole.
     *
     * Il totale deve però essere confrontato
     * con il debito rilevato dalla contabilità.
     */
    const integrazionePresente =
      Boolean(integrazione);

    const debitiFinanziariBt =
      integrazionePresente
        ? Number(
            integrazione
              ?.debiti_finanziari_bt ||
              0
          )
        : debitiBancheBtContabili;

    const debitiFinanziariMlt =
      integrazionePresente
        ? Number(
            integrazione
              ?.debiti_finanziari_mlt ||
              0
          )
        : debitiBancheMltContabili;

    const debitiFinanziariManuali =
      round2(
        debitiFinanziariBt +
          debitiFinanziariMlt
      );

    const differenzaDebitiFinanziari =
      round2(
        debitiFinanziariManuali -
          debitiFinanziariContabili
      );

    /*
     * Tolleranza di 1 euro.
     *
     * La ripartizione BT/MLT non deve modificare
     * il totale del debito finanziario risultante
     * dalla situazione contabile.
     */
    if (
      integrazionePresente &&
      Math.abs(
        differenzaDebitiFinanziari
      ) > 1
    ) {
      return res.status(400).json({
        success: false,

        error:
          "La ripartizione manuale dei debiti finanziari non coincide con il totale rilevato dalla contabilità.",

        dettaglio: {
          debiti_finanziari_contabili:
            debitiFinanziariContabili,

          debiti_finanziari_bt:
            round2(
              debitiFinanziariBt
            ),

          debiti_finanziari_mlt:
            round2(
              debitiFinanziariMlt
            ),

          totale_manuale:
            debitiFinanziariManuali,

          differenza:
            differenzaDebitiFinanziari,
        },
      });
    }

    /*
     * =====================================================
     * 11. PASSIVITÀ
     * =====================================================
     */

    /*
     * Tutte le passività escluse:
     * - patrimonio netto
     * - debiti bancari BT/MLT
     *
     * perché i debiti finanziari vengono reinseriti
     * con la ripartizione corretta.
     */
    const passivitaNonFinanziarie =
      round2(
        saldi
          .filter(
            (row) =>
              row.sezione ===
                "stato_patrimoniale_passivo" &&
              row.macrovoce !==
                "patrimonio_netto" &&
              row.codice !==
                "SP_DEBITI_BANCHE_BT" &&
              row.codice !==
                "SP_DEBITI_BANCHE_MLT"
          )
          .reduce(
            (totale, row) =>
              totale +
              row.importo,
            0
          )
      );

    const debitiTotali =
      round2(
        passivitaNonFinanziarie +
          debitiFinanziariManuali
      );

    /*
     * Passivo corrente:
     *
     * prendiamo le voci correnti operative
     * escluse le banche e reinseriamo
     * manualmente la quota finanziaria BT.
     */
    const passivoCorrenteOperativo =
      round2(
        saldi
          .filter(
            (row) =>
              row.macrovoce ===
                "passivo_corrente" &&
              row.codice !==
                "SP_DEBITI_BANCHE_BT" &&
              row.codice !==
                "SP_DEBITI_BANCHE_MLT"
          )
          .reduce(
            (totale, row) =>
              totale +
              row.importo,
            0
          )
      );

    const passivoCorrente =
      round2(
        passivoCorrenteOperativo +
          debitiFinanziariBt
      );

    /*
     * =====================================================
     * 12. RISULTATO PROVVISORIO DA QUADRATURA
     * =====================================================
     *
     * Come stabilito:
     *
     * nelle situazioni intermedie il risultato
     * non è necessariamente contabilizzato nel PN.
     *
     * Risultato =
     * Attivo -
     * Passività -
     * PN contabilizzato
     */
    const risultatoProvvisorio =
      round2(
        totaleAttivo -
          debitiTotali -
          patrimonioNettoContabile
      );

    const patrimonioNetto =
      round2(
        patrimonioNettoContabile +
          risultatoProvvisorio
      );

    /*
     * =====================================================
     * 13. CAPITALE INVESTITO
     * =====================================================
     *
     * Capitale investito finanziato =
     * PN + debiti finanziari.
     */
    const capitaleInvestito =
      round2(
        patrimonioNetto +
          debitiFinanziariManuali
      );

    /*
     * =====================================================
     * 14. DATI PREVISIONALI / DSCR
     * =====================================================
     */
    const rateFinanziarie =
      integrazione
        ? Number(
            integrazione
              .rate_finanziarie_12_mesi ||
              0
          )
        : 0;

    const cashFlowOperativo =
      integrazione
        ?.cash_flow_operativo_previsionale !=
      null
        ? Number(
            integrazione
              .cash_flow_operativo_previsionale
          )
        : null;

    /*
     * =====================================================
     * 15. INDICATORI
     * =====================================================
     */
    const roi =
      round2(
        safeDiv(
          ebit,
          capitaleInvestito
        ) * 100
      );

    const roe =
      round2(
        safeDiv(
          risultatoProvvisorio,
          patrimonioNetto
        ) * 100
      );

    const ros =
      round2(
        safeDiv(
          ebit,
          ricavi
        ) * 100
      );

    const roa =
      round2(
        safeDiv(
          risultatoProvvisorio,
          totaleAttivo
        ) * 100
      );

    const indebitamento =
      round2(
        safeDiv(
          debitiTotali,
          patrimonioNetto
        )
      );

    const liquidita =
      round2(
        safeDiv(
          attivoCorrente,
          passivoCorrente
        )
      );

    const dscr =
      cashFlowOperativo !== null &&
      rateFinanziarie > 0
        ? round2(
            safeDiv(
              cashFlowOperativo,
              rateFinanziarie
            )
          )
        : null;

    /*
     * =====================================================
     * 16. SALVATAGGIO INDICI
     * =====================================================
     */
    const dataRiferimento =
      String(
        importRecord.data_riferimento ||
          ""
      );

    const anno =
      dataRiferimento
        ? Number(
            dataRiferimento.slice(
              0,
              4
            )
          )
        : null;

    let analisi = null;

if (origineControlloGestione) {

    /*
     * Rielaborazione ripetibile.
     *
     * Eliminiamo SOLO l'analisi automatica
     * dello stesso controllo.
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
        importRecord.controllo_id
      )
      .eq(
        "origine",
        "contabilita_datev"
      );

    if (deleteIndiciError) {
      throw deleteIndiciError;
    }

    const payloadIndici = {
      studio_id:
        importRecord.studio_id,

      cliente_id:
        importRecord.cliente_id,

      controllo_gestione_id:
        importRecord.controllo_id,

      anno,

      societa:
        cliente?.ragione_sociale ||
        null,

      codice_fiscale:
        cliente?.codice_fiscale ||
        null,

      ricavi,

      costi_operativi:
        costiOperativi,

      ammortamenti,

      accantonamenti,

      oneri_finanziari:
        oneriFinanziari,

      imposte,

      /*
       * Per le situazioni contabili intermedie
       * l'utile/perdita autorevole è quello
       * derivante dalla quadratura patrimoniale.
       */
      utile_netto:
        risultatoProvvisorio,

      totale_attivo:
        totaleAttivo,

      capitale_investito:
        capitaleInvestito,

      patrimonio_netto:
        patrimonioNetto,

      debiti_totali:
        debitiTotali,

      attivo_corrente:
        attivoCorrente,

      passivo_corrente:
        passivoCorrente,

      cash_flow_operativo:
        cashFlowOperativo,

      rate_finanziarie_annue:
        rateFinanziarie,

      ebitda,
      ebit,
      ebt,

      roi,
      roe,
      ros,
      roa,

      indebitamento,
      liquidita,
      dscr,

      origine:
        "contabilita_datev",

      updated_at:
        new Date().toISOString(),
    };

  const {
  data: analisiSalvata,
  error: indiciError,
} = await supabaseAdmin
      .from(
        "tbcontrollo_gestione_indici"
      )
      .insert(
        payloadIndici
      )
      .select("*")
      .single();

    if (indiciError) {
      throw indiciError;
    }
  analisi = analisiSalvata;

}

    /*
     * =====================================================
     * 17. STATO IMPORT
     * =====================================================
     */
    const {
      error: updateImportError,
    } = await supabaseAdmin
      .from(
        "tbcontrollo_gestione_import"
      )
      .update({
        stato:
          "elaborato",
      })
      .eq(
        "id",
        import_id
      );

if (updateImportError) {
  throw updateImportError;
}

/*
 * =====================================================
 * 18. COMPLETAMENTO AUTOMATICO STEP 1
 * =====================================================
 *
 * Lo Step 1 appartiene esclusivamente
 * al modulo Controllo di gestione.
 *
 * Gli import provenienti dalla Revisione
 * non devono creare né aggiornare
 * tbcontrollo_gestione.
 */
if (
  origineControlloGestione &&
  importRecord.controllo_id
) {
  console.log(
    "DEBUG STEP1 BEFORE UPDATE",
    {
      import_id,
      controllo_id_import:
        importRecord.controllo_id,
      cliente_id:
        importRecord.cliente_id,
    }
  );

  const {
    data: step1Updated,
    error: step1Error,
  } = await supabaseAdmin
    .from("tbcontrollo_gestione")
    .update({
      step_1_completato: true,
    })
    .eq(
      "id",
      importRecord.controllo_id
    )
    .select(`
      id,
      cliente_id,
      step_1_completato
    `);

  if (step1Error) {
    throw step1Error;
  }

  console.log(
    "DEBUG STEP1 UPDATED",
    step1Updated
  );
}

/*
 * =====================================================
 * 19. RISPOSTA
 * =====================================================
 */
return res.status(200).json({
      success: true,

      import_id,

      controllo_id:
        importRecord.controllo_id,

      data_riferimento:
        importRecord.data_riferimento,

      saldi,

      conto_economico: {
        ricavi,

        costi_operativi:
          costiOperativi,

        ebitda,

        ammortamenti,

        accantonamenti,

        ebit,

        proventi_finanziari:
          proventiFinanziari,

        oneri_finanziari_lordi:
          oneriFinanziariLordi,

        oneri_finanziari_netti:
          oneriFinanziari,

        ebt,

        imposte,

        risultato_conto_economico:
          risultatoContoEconomico,

        risultato_provvisorio:
          risultatoProvvisorio,

        differenza_risultato:
          round2(
            risultatoProvvisorio -
              risultatoContoEconomico
          ),
      },

      stato_patrimoniale: {
        totale_attivo:
          totaleAttivo,

        attivo_corrente:
          attivoCorrente,

        disponibilita_liquide:
          disponibilitaLiquide,

        patrimonio_netto_contabile:
          patrimonioNettoContabile,

        risultato_provvisorio:
          risultatoProvvisorio,

        patrimonio_netto:
          patrimonioNetto,

        debiti_finanziari_contabili:
          debitiFinanziariContabili,

        debiti_finanziari_bt:
          round2(
            debitiFinanziariBt
          ),

        debiti_finanziari_mlt:
          round2(
            debitiFinanziariMlt
          ),

        debiti_totali:
          debitiTotali,

        passivo_corrente:
          passivoCorrente,

        capitale_investito:
          capitaleInvestito,
      },

      indicatori: {
        roi,
        roe,
        ros,
        roa,
        indebitamento,
        liquidita,
        dscr,
      },

      analisi,
    });
  } catch (error: any) {
    console.error(
      "Errore elaborazione controllo di gestione:",
      error
    );

    return res.status(500).json({
      success: false,

      error:
        error?.message ||
        "Errore interno durante l'elaborazione del controllo di gestione",
    });
  }
}
