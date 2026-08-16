import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_CHECKLIST = [
  { area: "Area amministrativa", domanda: "Libri sociali aggiornati e regolarmente tenuti?", ordine: 10 },
  { area: "Area amministrativa", domanda: "Verbali precedenti e delibere risultano correttamente archiviati?", ordine: 20 },
  { area: "Area contabile", domanda: "La situazione contabile del trimestre risulta aggiornata?", ordine: 30 },
  { area: "Area contabile", domanda: "Sono state rilevate anomalie contabili significative?", ordine: 40 },
  { area: "Area fiscale", domanda: "Le principali scadenze fiscali risultano rispettate?", ordine: 50 },
  { area: "Area fiscale", domanda: "Sono presenti debiti tributari o previdenziali scaduti?", ordine: 60 },
  { area: "Area societaria", domanda: "Sono intervenute variazioni societarie rilevanti nel trimestre?", ordine: 70 },
  { area: "Area societaria", domanda: "Sono presenti situazioni di perdita o criticità patrimoniale rilevante?", ordine: 80 },
  { area: "Area tesoreria", domanda: "La situazione finanziaria e di tesoreria risulta coerente con l'andamento aziendale?", ordine: 90 },
  { area: "Area tesoreria", domanda: "Sono presenti tensioni finanziarie o ritardi rilevanti nei pagamenti?", ordine: 100 },
  { area: "Area personale", domanda: "Gli adempimenti relativi al personale risultano regolari?", ordine: 110 },
  { area: "Area personale", domanda: "Sono presenti criticità relative a dipendenti, paghe o contributi?", ordine: 120 },
  { area: "Continuità aziendale", domanda: "Sussistono elementi che possano incidere sulla continuità aziendale?", ordine: 130 },
  { area: "Contenzioso", domanda: "Sono presenti contenziosi, accertamenti o passività potenziali rilevanti?", ordine: 140 },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const { controllo_id, crea_default } = req.query;

      if (typeof controllo_id !== "string" || !controllo_id) {
        return res.status(400).json({
          success: false,
          error: "controllo_id obbligatorio",
        });
      }

      /*
 * =====================================================
 * DATI CONTABILI COLLEGATI AL CONTROLLO DI REVISIONE
 * =====================================================
 */

const {
  data: controlloRevisione,
  error: controlloRevisioneError,
} = await supabaseAdmin
  .from("tbrevisione_controlli")
  .select(`
    id,
    controllo_gestione_import_id
  `)
  .eq("id", controllo_id)
  .maybeSingle();

if (controlloRevisioneError) {
  throw controlloRevisioneError;
}

const importId =
  controlloRevisione
    ?.controllo_gestione_import_id ||
  null;

let datiContabili: any = null;

if (importId) {
  /*
   * Registro dell'import collegato.
   */
  const {
    data: importRecord,
    error: importError,
  } = await supabaseAdmin
    .from("tbcontrollo_gestione_import")
    .select(`
      id,
      software_contabile,
      data_riferimento,
      numero_conti,
      conti_mappati,
      conti_da_mappare,
      stato
    `)
    .eq("id", importId)
    .maybeSingle();

  if (importError) {
    throw importError;
  }

  /*
   * Saldi già elaborati dal Controllo di gestione.
   */
  const {
    data: saldiData,
    error: saldiError,
  } = await supabaseAdmin
    .from("tbcontrollo_gestione_saldi")
    .select(`
      voce_id,
      importo,
      numero_conti
    `)
    .eq("import_id", importId);

  if (saldiError) {
    throw saldiError;
  }

  const saldi = saldiData || [];

  /*
   * Recuperiamo le voci SMP associate ai saldi.
   */
  const voceIds = Array.from(
    new Set(
      saldi
        .map((row: any) => row.voce_id)
        .filter(Boolean)
    )
  );

  let vociMap =
    new Map<string, any>();

  if (voceIds.length > 0) {
    const {
      data: voci,
      error: vociError,
    } = await supabaseAdmin
      .from("tbcontrollo_gestione_voci")
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

    vociMap = new Map(
      (voci || []).map(
        (voce: any) => [
          voce.id,
          voce,
        ]
      )
    );
  }

  const saldiRiclassificati =
    saldi
      .map((saldo: any) => {
        const voce =
          vociMap.get(
            saldo.voce_id
          );

        if (!voce) {
          return null;
        }

        return {
          voce_id:
            saldo.voce_id,

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
            Number(
              saldo.importo || 0
            ),

          numero_conti:
            Number(
              saldo.numero_conti || 0
            ),
        };
      })
      .filter(Boolean)
      .sort(
        (a: any, b: any) =>
          Number(a.ordine || 0) -
          Number(b.ordine || 0)
      );

  datiContabili = {
    import:
      importRecord || null,

    saldi:
      saldiRiclassificati,
  };
}

      let { data, error } = await supabaseAdmin
        .from("tbrevisione_checklist")
        .select("*")
        .eq("controllo_id", controllo_id)
        .order("ordine", { ascending: true });

      if (error) throw error;

      if ((!data || data.length === 0) && crea_default === "true") {
        const { data: controllo, error: controlloError } = await supabaseAdmin
          .from("vw_revisione_controlli")
          .select("studio_id")
          .eq("id", controllo_id)
          .single();

        if (controlloError) throw controlloError;

        const rows = DEFAULT_CHECKLIST.map((item) => ({
          controllo_id,
          studio_id: controllo.studio_id,
          area: item.area,
          domanda: item.domanda,
          risposta: null,
          esito: null,
          gravita: null,
          follow_up: false,
          data_follow_up: null,
          raccomandazione: null,
          note: null,
          voce_smp_id: null,

asserzione: null,
rischio: null,
procedura: null,

significativita: null,

importo_rilievo: null,

effetto_relazione: null,

eseguito_da: null,
eseguito_at: null,
          ordine: item.ordine,
        }));

        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("tbrevisione_checklist")
          .insert(rows)
          .select("*");

        if (insertError) throw insertError;

        data = inserted || [];
      }

     return res.status(200).json({
  success: true,

  data:
    data || [],

  dati_contabili:
    datiContabili,
});
    }

    if (req.method === "POST") {
      const { controllo_id, checklist } = req.body;

      if (!controllo_id) {
        return res.status(400).json({
          success: false,
          error: "controllo_id obbligatorio",
        });
      }

      if (!Array.isArray(checklist)) {
        return res.status(400).json({
          success: false,
          error: "checklist deve essere un array",
        });
      }

      const { data: controllo, error: controlloError } = await supabaseAdmin
        .from("vw_revisione_controlli")
        .select("studio_id, cliente_id")
        .eq("id", controllo_id)
        .single();

      if (controlloError) throw controlloError;

      const rows = checklist
        .filter((item: any) => item.area && item.domanda)
        .map((item: any, index: number) => ({
          id: item.id || undefined,
          controllo_id,
          studio_id: controllo.studio_id,
          area: item.area,
          domanda: item.domanda,
          risposta: item.risposta || null,
          esito: item.esito || null,
          gravita: item.gravita || null,
          follow_up: item.follow_up === true,
          data_follow_up: item.data_follow_up || null,
          raccomandazione: item.raccomandazione || null,
          note: item.note || null,
          voce_smp_id:
  item.voce_smp_id || null,

asserzione:
  item.asserzione || null,

rischio:
  item.rischio || null,

procedura:
  item.procedura || null,

significativita:
  item.significativita || null,

importo_rilievo:
  item.importo_rilievo === null ||
  item.importo_rilievo === undefined ||
  item.importo_rilievo === ""
    ? null
    : Number(item.importo_rilievo),

effetto_relazione:
  item.effetto_relazione || null,

eseguito_da:
  item.eseguito_da || null,

eseguito_at:
  item.eseguito_at || null,
          ordine: Number(item.ordine ?? (index + 1) * 10),
          updated_at: new Date().toISOString(),
        }));

      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Nessuna voce checklist valida",
        });
      }

      const { data, error } = await supabaseAdmin
        .from("tbrevisione_checklist")
        .upsert(rows, {
          onConflict: "id",
        })
        .select("*");

      if (error) throw error;

      for (const item of data || []) {
        if (item.follow_up === true) {
          const descrizione =
            item.raccomandazione || item.domanda || "Follow-up revisione";

          const { data: existingFollowup, error: existingError } =
            await supabaseAdmin
              .from("tbrevisione_followup")
              .select("id")
              .eq("checklist_id", item.id)
              .maybeSingle();

          if (existingError) throw existingError;

          if (existingFollowup?.id) {
            const { error: updateFollowupError } = await supabaseAdmin
              .from("tbrevisione_followup")
              .update({
  studio_id: item.studio_id,
  controllo_id: item.controllo_id,
  checklist_id: item.id,
  cliente_id: controllo.cliente_id,

  descrizione,

  gravita:
    item.gravita || null,

  data_scadenza:
    item.data_follow_up || null,

  note:
    item.note || null,

  importo:
    item.importo_rilievo === null ||
    item.importo_rilievo === undefined
      ? null
      : Number(item.importo_rilievo),

  significativo:
    item.significativita ===
    "SIGNIFICATIVO",

  effetto_relazione:
    item.effetto_relazione || null,

  stato:
    "APERTO",
})
              .eq("id", existingFollowup.id);

            if (updateFollowupError) throw updateFollowupError;
          } else {
            const { error: insertFollowupError } = await supabaseAdmin
              .from("tbrevisione_followup")
             .insert({
  studio_id: item.studio_id,
  controllo_id: item.controllo_id,
  checklist_id: item.id,
  cliente_id: controllo.cliente_id,

  descrizione,

  gravita:
    item.gravita || null,

  data_scadenza:
    item.data_follow_up || null,

  completato:
    false,

  note:
    item.note || null,

  importo:
    item.importo_rilievo === null ||
    item.importo_rilievo === undefined
      ? null
      : Number(item.importo_rilievo),

  significativo:
    item.significativita ===
    "SIGNIFICATIVO",

  effetto_relazione:
    item.effetto_relazione || null,

  stato:
    "APERTO",
});

            if (insertFollowupError) throw insertFollowupError;
          }
        } else if (item.id) {
          const { error: deleteFollowupError } = await supabaseAdmin
            .from("tbrevisione_followup")
            .delete()
            .eq("checklist_id", item.id)
            .eq("completato", false);

          if (deleteFollowupError) throw deleteFollowupError;
        }
      }

      return res.status(200).json({
        success: true,
        data: data || [],
      });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;

      if (typeof id !== "string" || !id) {
        return res.status(400).json({
          success: false,
          error: "ID voce checklist obbligatorio",
        });
      }

      const { error } = await supabaseAdmin
        .from("tbrevisione_checklist")
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
    console.error("Errore API revisione-controllo/checklist:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno server",
    });
  }
}
