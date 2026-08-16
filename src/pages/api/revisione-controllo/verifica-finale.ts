import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_CHECKLIST = [
  {
    codice: "VF_001",
    area: "Controlli periodici",
    domanda: "Tutti i controlli periodici previsti per l'esercizio sono stati completati?",
    ordine: 10,
  },
  {
    codice: "VF_002",
    area: "Rilievi",
    domanda: "Tutti i rilievi emersi nel corso dell'esercizio sono stati riesaminati?",
    ordine: 20,
  },
  {
    codice: "VF_003",
    area: "Rilievi",
    domanda: "Gli errori non corretti sono stati riepilogati e valutati rispetto alla materialità?",
    ordine: 30,
  },
  {
    codice: "VF_004",
    area: "Eventi successivi",
    domanda: "Sono stati verificati gli eventi successivi alla chiusura dell'esercizio?",
    ordine: 40,
  },
  {
    codice: "VF_005",
    area: "Continuità aziendale",
    domanda: "È stata effettuata e documentata la valutazione della continuità aziendale?",
    ordine: 50,
  },
  {
    codice: "VF_006",
    area: "Parti correlate",
    domanda: "Le operazioni con parti correlate sono state riesaminate?",
    ordine: 60,
  },
  {
    codice: "VF_007",
    area: "Contenzioso",
    domanda: "Contenziosi, accertamenti e passività potenziali sono stati riesaminati?",
    ordine: 70,
  },
  {
    codice: "VF_008",
    area: "Bilancio",
    domanda: "Il bilancio definitivo è stato acquisito?",
    ordine: 80,
  },
  {
    codice: "VF_009",
    area: "Bilancio",
    domanda: "La nota integrativa è stata verificata?",
    ordine: 90,
  },
  {
    codice: "VF_010",
    area: "Bilancio",
    domanda: "La relazione sulla gestione, ove prevista, è stata verificata?",
    ordine: 100,
  },
  {
    codice: "VF_011",
    area: "Attestazioni",
    domanda: "La lettera di attestazione della direzione è stata acquisita?",
    ordine: 110,
  },
  {
    codice: "VF_012",
    area: "Informativa",
    domanda: "L'informativa di bilancio risulta adeguata rispetto agli elementi emersi dalla revisione?",
    ordine: 120,
  },
];

function toNumber(value: any) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function loadVerificaCompleta(verificaId: string) {
  const { data: verifica, error: verificaError } = await supabaseAdmin
    .from("tbrevisione_verifiche_finali")
    .select("*")
    .eq("id", verificaId)
    .single();

  if (verificaError) throw verificaError;

  const { data: checklist, error: checklistError } = await supabaseAdmin
    .from("tbrevisione_verifica_finale_checklist")
    .select("*")
    .eq("verifica_finale_id", verificaId)
    .order("ordine", { ascending: true });

  if (checklistError) throw checklistError;

  const { data: rilievi, error: rilieviError } = await supabaseAdmin
    .from("tbrevisione_verifica_finale_rilievi")
    .select("*")
    .eq("verifica_finale_id", verificaId)
    .order("trimestre", { ascending: true })
    .order("created_at", { ascending: true });

  if (rilieviError) throw rilieviError;

  return {
    verifica,
    checklist: checklist || [],
    rilievi: rilievi || [],
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    /*
     * =====================================================
     * GET
     * Legge la verifica finale dell'incarico/esercizio.
     * =====================================================
     */
    if (req.method === "GET") {
      const { incarico_id, anno } = req.query;

      if (typeof incarico_id !== "string" || !incarico_id) {
        return res.status(400).json({
          success: false,
          error: "incarico_id obbligatorio",
        });
      }

      if (typeof anno !== "string" || !anno) {
        return res.status(400).json({
          success: false,
          error: "anno obbligatorio",
        });
      }

      const { data: verifica, error } = await supabaseAdmin
        .from("tbrevisione_verifiche_finali")
        .select("*")
        .eq("incarico_id", incarico_id)
        .eq("anno", Number(anno))
        .maybeSingle();

      if (error) throw error;

      if (!verifica) {
        return res.status(200).json({
          success: true,
          exists: false,
          data: null,
          checklist: [],
          rilievi: [],
        });
      }

      const completa = await loadVerificaCompleta(verifica.id);

      return res.status(200).json({
        success: true,
        exists: true,
        data: completa.verifica,
        checklist: completa.checklist,
        rilievi: completa.rilievi,
      });
    }

    /*
     * =====================================================
     * POST
     * Avvia la verifica finale.
     *
     * 1. legge l'incarico;
     * 2. fotografa materialità/rischio;
     * 3. conta i controlli;
     * 4. legge i follow-up dell'esercizio;
     * 5. crea la verifica;
     * 6. crea la checklist;
     * 7. crea lo snapshot dei rilievi.
     * =====================================================
     */
    if (req.method === "POST") {
      const { incarico_id, anno } = req.body;

      if (!incarico_id) {
        return res.status(400).json({
          success: false,
          error: "incarico_id obbligatorio",
        });
      }

      const { data: incarico, error: incaricoError } = await supabaseAdmin
        .from("tbrevisione_incarichi")
        .select(`
          id,
          studio_id,
          cliente_id,
          esercizio,
          materialita,
          materialita_operativa,
          errore_chiaramente_trascurabile,
          rischio_complessivo
        `)
        .eq("id", incarico_id)
        .single();

      if (incaricoError) throw incaricoError;

      const annoVerifica = Number(anno || incarico.esercizio);

      if (!annoVerifica || !Number.isFinite(annoVerifica)) {
        return res.status(400).json({
          success: false,
          error: "Esercizio della verifica finale non valido",
        });
      }

      /*
       * Evitiamo duplicati.
       */
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("tbrevisione_verifiche_finali")
        .select("id")
        .eq("incarico_id", incarico_id)
        .eq("anno", annoVerifica)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.id) {
        const completa = await loadVerificaCompleta(existing.id);

        return res.status(200).json({
          success: true,
          already_exists: true,
          data: completa.verifica,
          checklist: completa.checklist,
          rilievi: completa.rilievi,
        });
      }

      /*
       * Controlli dell'esercizio.
       */
      const { data: controlli, error: controlliError } = await supabaseAdmin
        .from("tbrevisione_controlli")
        .select("id, anno, trimestre, stato")
        .eq("incarico_id", incarico_id)
        .eq("anno", annoVerifica);

      if (controlliError) throw controlliError;

      const controlliRows = controlli || [];

      const controlliPrevisti = controlliRows.length;

      const controlliCompletati = controlliRows.filter(
        (item: any) => item.stato === "COMPLETATO"
      ).length;

      const controlloIds = controlliRows.map((item: any) => item.id);

      /*
       * Follow-up relativi esclusivamente ai controlli
       * dell'esercizio.
       */
      let followups: any[] = [];

      if (controlloIds.length > 0) {
        const { data, error: followupError } = await supabaseAdmin
          .from("tbrevisione_followup")
          .select(`
            id,
            studio_id,
            controllo_id,
            checklist_id,
            descrizione,
            gravita,
            importo,
            significativo,
            corretto,
            effetto_relazione,
            stato,
            completato,
            note,
            controllo:tbrevisione_controlli(
              anno,
              trimestre
            ),
            checklist:tbrevisione_checklist(
              area
            )
          `)
          .in("controllo_id", controlloIds);

        if (followupError) throw followupError;

        followups = data || [];
      }

      const rilieviTotali = followups.length;

      const rilieviRisolti = followups.filter(
        (item: any) =>
          item.completato === true ||
          item.stato === "RISOLTO"
      ).length;

      const rilieviAperti = followups.filter(
        (item: any) =>
          item.completato !== true &&
          item.stato !== "RISOLTO"
      ).length;

      const rilieviSignificativiAperti = followups.filter(
        (item: any) =>
          item.significativo === true &&
          item.completato !== true &&
          item.stato !== "RISOLTO"
      ).length;

      const importoRilieviTotale = followups.reduce(
        (totale: number, item: any) =>
          totale + Number(item.importo || 0),
        0
      );

      const importoErroriCorretti = followups
        .filter(
          (item: any) =>
            item.corretto === true
        )
        .reduce(
          (totale: number, item: any) =>
            totale + Number(item.importo || 0),
          0
        );

      const importoErroriNonCorretti = followups
        .filter(
          (item: any) =>
            item.corretto !== true
        )
        .reduce(
          (totale: number, item: any) =>
            totale + Number(item.importo || 0),
          0
        );

      const materialita = toNumber(incarico.materialita);

      const materialitaOperativa = toNumber(
        incarico.materialita_operativa
      );

      const superaMaterialita =
        materialita !== null
          ? importoErroriNonCorretti > materialita
          : null;

      const superaMaterialitaOperativa =
        materialitaOperativa !== null
          ? importoErroriNonCorretti > materialitaOperativa
          : null;

      /*
       * Creazione verifica finale.
       */
      const { data: verifica, error: verificaError } = await supabaseAdmin
        .from("tbrevisione_verifiche_finali")
        .insert({
          studio_id: incarico.studio_id,
          incarico_id,
          anno: annoVerifica,

          stato: "IN_LAVORAZIONE",

          materialita: incarico.materialita,
          materialita_operativa: incarico.materialita_operativa,
          errore_chiaramente_trascurabile:
            incarico.errore_chiaramente_trascurabile,
          rischio_complessivo: incarico.rischio_complessivo,

          controlli_previsti: controlliPrevisti,
          controlli_completati: controlliCompletati,

          rilievi_totali: rilieviTotali,
          rilievi_risolti: rilieviRisolti,
          rilievi_aperti: rilieviAperti,
          rilievi_significativi_aperti:
            rilieviSignificativiAperti,

          importo_rilievi_totale: importoRilieviTotale,
          importo_errori_corretti: importoErroriCorretti,
          importo_errori_non_corretti: importoErroriNonCorretti,

          errori_non_corretti_superano_materialita:
            superaMaterialita,

          errori_non_corretti_superano_materialita_operativa:
            superaMaterialitaOperativa,
        })
        .select("*")
        .single();

      if (verificaError) throw verificaError;

      /*
       * Checklist finale.
       */
      const checklistRows = DEFAULT_CHECKLIST.map((item) => ({
        verifica_finale_id: verifica.id,
        studio_id: incarico.studio_id,
        codice: item.codice,
        area: item.area,
        domanda: item.domanda,
        risposta: null,
        esito: null,
        note: null,
        ordine: item.ordine,
      }));

      const { error: checklistError } = await supabaseAdmin
        .from("tbrevisione_verifica_finale_checklist")
        .insert(checklistRows);

      if (checklistError) throw checklistError;

      /*
       * Snapshot rilievi.
       */
      if (followups.length > 0) {
        const rilieviRows = followups.map((item: any) => ({
          verifica_finale_id: verifica.id,
          studio_id: incarico.studio_id,

          followup_id: item.id,
          controllo_id: item.controllo_id,
          checklist_id: item.checklist_id,

          anno: item.controllo?.anno || annoVerifica,
          trimestre: item.controllo?.trimestre || null,

          area: item.checklist?.area || null,

          descrizione: item.descrizione,

          gravita: item.gravita || null,

          importo:
            item.importo === null ||
            item.importo === undefined
              ? null
              : Number(item.importo),

          significativo: item.significativo === true,

          corretto: item.corretto === true,

          stato:
            item.stato ||
            (item.completato ? "RISOLTO" : "APERTO"),

          effetto_relazione:
            item.effetto_relazione || null,

          note: item.note || null,
        }));

        const { error: rilieviError } = await supabaseAdmin
          .from("tbrevisione_verifica_finale_rilievi")
          .insert(rilieviRows);

        if (rilieviError) throw rilieviError;
      }

      const completa = await loadVerificaCompleta(verifica.id);

      return res.status(201).json({
        success: true,
        already_exists: false,
        data: completa.verifica,
        checklist: completa.checklist,
        rilievi: completa.rilievi,
      });
    }

    /*
     * =====================================================
     * PUT
     * Salva la verifica finale e la checklist.
     * =====================================================
     */
    if (req.method === "PUT") {
      const {
        id,

        data_verifica,

        continuita_aziendale,
        eventi_successivi,
        parti_correlate,
        contenziosi,

        bilancio_definitivo_acquisito,
        nota_integrativa_verificata,
        relazione_gestione_verificata,
        lettera_attestazione_acquisita,

        richiami_informativa,
        testo_richiamo_informativa,

        incertezza_continuita,
        testo_incertezza_continuita,

        giudizio_proposto,
        motivazione_giudizio,

        conclusione_finale,

        stato,
        utente_id,

        checklist,
      } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: "ID verifica finale obbligatorio",
        });
      }

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (typeof data_verifica !== "undefined") {
        updateData.data_verifica = data_verifica || null;
      }

      if (typeof continuita_aziendale !== "undefined") {
        updateData.continuita_aziendale =
          continuita_aziendale || null;
      }

      if (typeof eventi_successivi !== "undefined") {
        updateData.eventi_successivi =
          eventi_successivi || null;
      }

      if (typeof parti_correlate !== "undefined") {
        updateData.parti_correlate =
          parti_correlate || null;
      }

      if (typeof contenziosi !== "undefined") {
        updateData.contenziosi = contenziosi || null;
      }

      if (typeof bilancio_definitivo_acquisito !== "undefined") {
        updateData.bilancio_definitivo_acquisito =
          bilancio_definitivo_acquisito === true;
      }

      if (typeof nota_integrativa_verificata !== "undefined") {
        updateData.nota_integrativa_verificata =
          nota_integrativa_verificata === true;
      }

      if (typeof relazione_gestione_verificata !== "undefined") {
        updateData.relazione_gestione_verificata =
          relazione_gestione_verificata === true;
      }

      if (typeof lettera_attestazione_acquisita !== "undefined") {
        updateData.lettera_attestazione_acquisita =
          lettera_attestazione_acquisita === true;
      }

      if (typeof richiami_informativa !== "undefined") {
        updateData.richiami_informativa =
          richiami_informativa === true;
      }

      if (typeof testo_richiamo_informativa !== "undefined") {
        updateData.testo_richiamo_informativa =
          testo_richiamo_informativa || null;
      }

      if (typeof incertezza_continuita !== "undefined") {
        updateData.incertezza_continuita =
          incertezza_continuita === true;
      }

      if (typeof testo_incertezza_continuita !== "undefined") {
        updateData.testo_incertezza_continuita =
          testo_incertezza_continuita || null;
      }

      if (typeof giudizio_proposto !== "undefined") {
        updateData.giudizio_proposto =
          giudizio_proposto || null;
      }

      if (typeof motivazione_giudizio !== "undefined") {
        updateData.motivazione_giudizio =
          motivazione_giudizio || null;
      }

      if (typeof conclusione_finale !== "undefined") {
        updateData.conclusione_finale =
          conclusione_finale || null;
      }

      if (typeof stato !== "undefined") {
        updateData.stato = stato;
      }

      /*
       * COMPLETATA:
       * registriamo chi/quando ha completato.
       */
      if (stato === "COMPLETATA") {
        updateData.compilata_da = utente_id || null;
        updateData.compilata_at = new Date().toISOString();
      }

      /*
       * CHIUSA:
       * il fascicolo viene formalmente chiuso.
       */
      if (stato === "CHIUSA") {
        updateData.chiusa_da = utente_id || null;
        updateData.chiusa_at = new Date().toISOString();
      }

      const { error: updateError } = await supabaseAdmin
        .from("tbrevisione_verifiche_finali")
        .update(updateData)
        .eq("id", id);

      if (updateError) throw updateError;

      /*
       * Aggiornamento checklist.
       */
      if (Array.isArray(checklist)) {
        for (const item of checklist) {
          if (!item.id) continue;

          const { error: itemError } = await supabaseAdmin
            .from("tbrevisione_verifica_finale_checklist")
            .update({
              risposta: item.risposta || null,
              esito: item.esito || null,
              note: item.note || null,

              compilata_da:
                item.risposta || item.esito || item.note
                  ? utente_id || null
                  : null,

              compilata_at:
                item.risposta || item.esito || item.note
                  ? new Date().toISOString()
                  : null,

              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id)
            .eq("verifica_finale_id", id);

          if (itemError) throw itemError;
        }
      }

      const completa = await loadVerificaCompleta(id);

      return res.status(200).json({
        success: true,
        data: completa.verifica,
        checklist: completa.checklist,
        rilievi: completa.rilievi,
      });
    }

    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  } catch (error: any) {
    console.error(
      "Errore API revisione-controllo/verifica-finale:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Errore interno server",
    });
  }
}
