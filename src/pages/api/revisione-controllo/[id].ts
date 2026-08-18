import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;

    if (typeof id !== "string" || !id) {
      return res.status(400).json({
        success: false,
        error: "ID incarico non valido",
      });
    }

   if (req.method === "GET") {
  /*
   * =====================================================
   * 1. INCARICO / FASCICOLO
   * =====================================================
   *
   * Leggiamo dalla tabella reale e non dalla vista,
   * così siamo sicuri di avere anche i nuovi campi:
   *
   * - esercizio
   * - materialita
   * - materialita_operativa
   * - errore_chiaramente_trascurabile
   * - rischio_complessivo
   * - stato_fascicolo
   * - conclusione_finale
   */
  const {
    data: incarico,
    error: incaricoError,
  } = await supabaseAdmin
    .from("tbrevisione_incarichi")
    .select("*")
    .eq("id", id)
    .single();

  if (incaricoError) {
    throw incaricoError;
  }

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
      ragione_sociale
    `)
    .eq("id", incarico.cliente_id)
    .maybeSingle();

  if (clienteError) {
    throw clienteError;
  }

  /*
   * =====================================================
   * 3. CONTROLLI PERIODICI
   * =====================================================
   */
  const {
    data: controlliData,
    error: controlliError,
  } = await supabaseAdmin
    .from("tbrevisione_controlli")
    .select(`
      id,
      incarico_id,
      anno,
      trimestre,
      data_scadenza,
      data_controllo,
      stato,
      esito,
      note,
      controllo_gestione_import_id,
      completato_at
    `)
    .eq("incarico_id", id)
    .order("anno", {
      ascending: true,
    })
    .order("trimestre", {
      ascending: true,
    });

  if (controlliError) {
    throw controlliError;
  }

  const controlli =
    controlliData || [];

  const controlloIds =
    controlli.map(
      (controllo: any) =>
        controllo.id
    );

  /*
   * =====================================================
   * 4. CHECKLIST
   * =====================================================
   */
  let checklist: any[] = [];

  if (controlloIds.length > 0) {
    const {
      data: checklistData,
      error: checklistError,
    } = await supabaseAdmin
      .from("tbrevisione_checklist")
      .select(`
        id,
        controllo_id,
        risposta,
        esito,
        gravita,
        significativita,
        follow_up
      `)
      .in(
        "controllo_id",
        controlloIds
      );

    if (checklistError) {
      throw checklistError;
    }

    checklist =
      checklistData || [];
  }

  /*
   * =====================================================
   * 5. FOLLOW-UP / RILIEVI
   * =====================================================
   */
  let followup: any[] = [];

  if (controlloIds.length > 0) {
    const {
      data: followupData,
      error: followupError,
    } = await supabaseAdmin
      .from("tbrevisione_followup")
      .select(`
        id,
        controllo_id,
        gravita,
        significativo,
        completato,
        stato,
        importo
      `)
      .in(
        "controllo_id",
        controlloIds
      );

    if (followupError) {
      throw followupError;
    }

    followup =
      followupData || [];
  }

  /*
   * =====================================================
   * 6. IMPORT CONTABILI COLLEGATI
   * =====================================================
   */
  const importIds =
    Array.from(
      new Set(
        controlli
          .map(
            (controllo: any) =>
              controllo
                .controllo_gestione_import_id
          )
          .filter(Boolean)
      )
    );

  let importMap =
    new Map<string, any>();

  if (importIds.length > 0) {
    const {
      data: imports,
      error: importsError,
    } = await supabaseAdmin
      .from(
        "tbcontrollo_gestione_import"
      )
      .select(`
        id,
        data_riferimento,
        software_contabile,
        stato,
        numero_conti,
        conti_mappati,
        conti_da_mappare
      `)
      .in("id", importIds);

    if (importsError) {
      throw importsError;
    }

       importMap = new Map(
      (imports || []).map(
        (item: any) => [
          item.id,
          item,
        ]
      )
    );
  }

  /*
   * =====================================================
   * 6B. BASI CONTABILI PER MATERIALITA
   * =====================================================
   */

  let basiMaterialita: any = null;

  if (importIds.length > 0) {
    /*
     * Per la pianificazione utilizziamo l'import contabile
     * più recente tra quelli collegati ai controlli
     * dell'incarico.
     */

    const importsOrdinati = Array.from(
      importMap.values()
    ).sort((a: any, b: any) => {
      const dataA = a?.data_riferimento
        ? new Date(a.data_riferimento).getTime()
        : 0;

      const dataB = b?.data_riferimento
        ? new Date(b.data_riferimento).getTime()
        : 0;

      return dataB - dataA;
    });

    const ultimoImport =
      importsOrdinati[0] || null;

    if (ultimoImport?.id) {
      const {
        data: saldiMaterialita,
        error: saldiMaterialitaError,
      } = await supabaseAdmin
        .from("tbcontrollo_gestione_saldi")
        .select(`
          voce_id,
          importo,
          numero_conti
        `)
        .eq(
          "import_id",
          ultimoImport.id
        );

      if (saldiMaterialitaError) {
        throw saldiMaterialitaError;
      }

      const voceIdsMaterialita = Array.from(
        new Set(
          (saldiMaterialita || [])
            .map(
              (saldo: any) =>
                saldo.voce_id
            )
            .filter(Boolean)
        )
      );

      let vociMaterialita: any[] = [];

      if (voceIdsMaterialita.length > 0) {
        const {
          data: vociData,
          error: vociError,
        } = await supabaseAdmin
          .from("tbcontrollo_gestione_voci")
          .select(`
            id,
            codice,
            descrizione,
            sezione
          `)
          .in(
            "id",
            voceIdsMaterialita
          );

        if (vociError) {
          throw vociError;
        }

        vociMaterialita =
          vociData || [];
      }

      const voceMapMaterialita =
        new Map(
          vociMaterialita.map(
            (voce: any) => [
              voce.id,
              voce,
            ]
          )
        );

      const saldiConVoce =
        (saldiMaterialita || []).map(
          (saldo: any) => ({
            ...saldo,
            voce:
              voceMapMaterialita.get(
                saldo.voce_id
              ) || null,
          })
        );

      /*
       * Helper temporaneo.
       *
       * Cerchiamo le voci sulla riclassificazione SMP.
       * Dopo il primo test verifichiamo i codici reali
       * presenti in tbcontrollo_gestione_voci e rendiamo
       * il mapping definitivo.
       */

      const sommaPerDescrizione = (
        termini: string[]
      ) => {
        return saldiConVoce.reduce(
          (
            totale: number,
            saldo: any
          ) => {
            const descrizione =
              String(
                saldo.voce?.descrizione ||
                  ""
              ).toLowerCase();

            const trovato =
              termini.some(
                (termine) =>
                  descrizione.includes(
                    termine.toLowerCase()
                  )
              );

            return trovato
              ? totale +
                  Math.abs(
                    Number(
                      saldo.importo || 0
                    )
                  )
              : totale;
          },
          0
        );
      };

      const ricavi =
        sommaPerDescrizione([
          "ricavi delle vendite",
          "ricavi vendite",
        ]);

      const patrimonioNetto =
        sommaPerDescrizione([
          "capitale sociale",
          "altre riserve",
          "utile / perdita",
          "utile/perdita",
        ]);

      const costi =
        sommaPerDescrizione([
          "acquisti materie",
          "costi per servizi",
          "godimento beni",
          "costo del personale",
          "oneri diversi",
        ]);

      basiMaterialita = {
        import_id:
          ultimoImport.id,

        data_riferimento:
          ultimoImport.data_riferimento ||
          null,

        software_contabile:
          ultimoImport.software_contabile ||
          null,

        ricavi,

        patrimonio_netto:
          patrimonioNetto,

        costi,

        /*
         * Questi due li lasciamo null finché non
         * identifichiamo in modo certo le relative
         * voci SMP.
         */
        totale_attivo: null,
        risultato_ante_imposte: null,
      };
    }
  }

  /*
   * =====================================================
   * 7. RIEPILOGO PER CONTROLLO
   * =====================================================
   */
  const controlliRiepilogo =
    controlli.map(
      (controllo: any) => {
        const checklistControllo =
          checklist.filter(
            (item: any) =>
              item.controllo_id ===
              controllo.id
          );

        const checklistCompilate =
          checklistControllo.filter(
            (item: any) =>
              Boolean(
                item.risposta
              )
          );

        const followupControllo =
          followup.filter(
            (item: any) =>
              item.controllo_id ===
              controllo.id
          );

        const followupAperti =
          followupControllo.filter(
            (item: any) =>
              item.completato !== true &&
              item.stato !== "RISOLTO"
          );

        const rilieviSignificativi =
          followupAperti.filter(
            (item: any) =>
              item.significativo ===
              true
          );

        const importId =
          controllo
            .controllo_gestione_import_id ||
          null;

        return {
          ...controllo,

          import_contabile:
            importId
              ? importMap.get(
                  importId
                ) || null
              : null,

          checklist_totale:
            checklistControllo.length,

          checklist_compilate:
            checklistCompilate.length,

          checklist_percentuale:
            checklistControllo.length >
            0
              ? Math.round(
                  (
                    checklistCompilate.length /
                    checklistControllo.length
                  ) *
                    100
                )
              : 0,

          followup_aperti:
            followupAperti.length,

          rilievi_significativi:
            rilieviSignificativi.length,
        };
      }
    );

  /*
   * =====================================================
   * 8. AVANZAMENTO ANNUALE
   * =====================================================
   */
  const controlliCompletati =
    controlliRiepilogo.filter(
      (item: any) =>
        item.stato ===
        "COMPLETATO"
    ).length;

  const totaleControlli =
    controlliRiepilogo.length;

  const percentualeControlli =
    totaleControlli > 0
      ? Math.round(
          (
            controlliCompletati /
            totaleControlli
          ) * 100
        )
      : 0;

  const rilieviApertiTotali =
    controlliRiepilogo.reduce(
      (
        totale: number,
        item: any
      ) =>
        totale +
        Number(
          item.followup_aperti || 0
        ),
      0
    );

  const rilieviSignificativiTotali =
    controlliRiepilogo.reduce(
      (
        totale: number,
        item: any
      ) =>
        totale +
        Number(
          item.rilievi_significativi ||
            0
        ),
      0
    );

  /*
   * =====================================================
   * 9. RISPOSTA
   * =====================================================
   */
  return res.status(200).json({
    success: true,

    data: {
      ...incarico,

      ragione_sociale:
        cliente?.ragione_sociale ||
        null,
    },

    controlli:
      controlliRiepilogo,

      riepilogo: {
      totale_controlli:
        totaleControlli,

      controlli_completati:
        controlliCompletati,

      percentuale_controlli:
        percentualeControlli,

      rilievi_aperti:
        rilieviApertiTotali,

      rilievi_significativi:
        rilieviSignificativiTotali,
    },

    basi_materialita:
      basiMaterialita,
  });
}

    if (req.method === "PUT") {
      const {
  tipo_incarico,
  data_nomina,
  data_inizio,
  data_fine,
  periodicita,
  responsabile_id,
  attivo,
  note,

  esercizio,
  materialita,
  materialita_operativa,
  errore_chiaramente_trascurabile,
  rischio_complessivo,
  stato_fascicolo,
  conclusione_finale,
} = req.body;

      const updateData: Record<string, any> = {
  updated_at: new Date().toISOString(),
};

/*
 * Campi incarico
 */
if (typeof tipo_incarico !== "undefined") {
  updateData.tipo_incarico = tipo_incarico;
}

if (typeof data_nomina !== "undefined") {
  updateData.data_nomina = data_nomina || null;
}

if (typeof data_inizio !== "undefined") {
  updateData.data_inizio = data_inizio;
}

if (typeof data_fine !== "undefined") {
  updateData.data_fine = data_fine || null;
}

if (typeof periodicita !== "undefined") {
  updateData.periodicita =
    periodicita || "TRIMESTRALE";
}

if (typeof responsabile_id !== "undefined") {
  updateData.responsabile_id =
    responsabile_id || null;
}

if (typeof attivo !== "undefined") {
  updateData.attivo =
    typeof attivo === "boolean"
      ? attivo
      : true;
}

if (typeof note !== "undefined") {
  updateData.note = note || null;
}

/*
 * Campi fascicolo / pianificazione
 */
if (typeof esercizio !== "undefined") {
  updateData.esercizio =
    esercizio === null ||
    esercizio === ""
      ? null
      : Number(esercizio);
}

if (typeof materialita !== "undefined") {
  updateData.materialita =
    materialita === null ||
    materialita === ""
      ? null
      : Number(materialita);
}

if (
  typeof materialita_operativa !==
  "undefined"
) {
  updateData.materialita_operativa =
    materialita_operativa === null ||
    materialita_operativa === ""
      ? null
      : Number(materialita_operativa);
}

if (
  typeof errore_chiaramente_trascurabile !==
  "undefined"
) {
  updateData.errore_chiaramente_trascurabile =
    errore_chiaramente_trascurabile === null ||
    errore_chiaramente_trascurabile === ""
      ? null
      : Number(
          errore_chiaramente_trascurabile
        );
}

if (
  typeof rischio_complessivo !==
  "undefined"
) {
  updateData.rischio_complessivo =
    rischio_complessivo || null;
}

if (
  typeof stato_fascicolo !==
  "undefined"
) {
  updateData.stato_fascicolo =
    stato_fascicolo || "PIANIFICAZIONE";
}

if (
  typeof conclusione_finale !==
  "undefined"
) {
  updateData.conclusione_finale =
    conclusione_finale || null;
}

      const { data, error } = await supabaseAdmin
  .from("tbrevisione_incarichi")
  .update(updateData)
  .eq("id", id)
  .select("*")
  .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data,
      });
    }

    if (req.method === "DELETE") {
      const { error } = await supabaseAdmin
        .from("tbrevisione_incarichi")
        .delete()
        .eq("id", id);

      if (error) throw error;

      return res.status(200).json({
        success: true,
      });
    }

    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  } catch (error: any) {
    console.error("Errore API revisione-controllo/[id]:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno server",
    });
  }
}
