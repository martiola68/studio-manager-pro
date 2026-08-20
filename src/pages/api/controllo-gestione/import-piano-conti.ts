import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ContoImportato = {
  codice_conto: string;
  descrizione_conto: string;
};

type ImportPianoContiBody = {
  studio_id: string;
  template_id: string;
  conti: ContoImportato[];
};

function normalizeCodice(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "");
}

function normalizeDescrizione(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Metodo non consentito",
      });
    }

    const {
      studio_id,
      template_id,
      conti,
    } = req.body as ImportPianoContiBody;

    if (!studio_id) {
      return res.status(400).json({
        success: false,
        error: "studio_id obbligatorio",
      });
    }

    if (!template_id) {
      return res.status(400).json({
        success: false,
        error: "template_id obbligatorio",
      });
    }

    if (!Array.isArray(conti) || conti.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Nessun conto da importare",
      });
    }

    /*
     * 1. Verifica che il master appartenga
     *    realmente allo studio.
     */
    const {
      data: template,
      error: templateError,
    } = await supabaseAdmin
      .from("tbcontrollo_gestione_template")
      .select(`
        id,
        studio_id,
        nome,
        software_contabile,
        attivo
      `)
      .eq("id", template_id)
      .eq("studio_id", studio_id)
      .maybeSingle();

    if (templateError) {
      throw templateError;
    }

   if (!template) {
  return res.status(404).json({
    success: false,
    error: "Piano dei conti non trovato nello studio",
  });
}

const softwareSupportati = [
  "datev_koinos",
  "zucchetti",
  "teamsystem",
  "ipsoa",
];

if (
  !softwareSupportati.includes(
    String(template.software_contabile)
  )
) {
  return res.status(400).json({
    success: false,
    error: "Software contabile non supportato",
  });
}

if (!template.attivo) {
      return res.status(400).json({
        success: false,
        error: "Il master selezionato non è attivo",
      });
    }

    /*
     * 2. Normalizzazione.
     *
     * Importante:
     * codice_conto resta SEMPRE text.
     * Non convertiamo mai in numero.
     */
    const normalizzati = conti
      .map((conto) => ({
        codice_conto: normalizeCodice(
          conto.codice_conto
        ),

        descrizione_conto:
          normalizeDescrizione(
            conto.descrizione_conto
          ),
      }))
      .filter(
        (conto) =>
          conto.codice_conto &&
          conto.descrizione_conto
      );

    /*
     * 3. Dedupe all'interno del file.
     *
     * Se lo stesso codice appare più volte,
     * utilizziamo l'ultima descrizione incontrata.
     */
    const fileMap = new Map<
      string,
      ContoImportato
    >();

    for (const conto of normalizzati) {
      fileMap.set(
        conto.codice_conto,
        conto
      );
    }

    const contiFile =
      Array.from(fileMap.values());

    if (contiFile.length === 0) {
      return res.status(400).json({
        success: false,
        error:
          "Il file non contiene conti validi con codice e descrizione",
      });
    }

    /*
     * 4. Conti già presenti nel master.
     */
    const {
      data: esistenti,
      error: esistentiError,
    } = await supabaseAdmin
      .from(
        "tbcontrollo_gestione_template_conti"
      )
      .select(`
        id,
        codice_conto,
        descrizione_conto,
        voce_id,
        voce_id_negativo,
        moltiplicatore,
        escluso
      `)
      .eq("template_id", template_id);

    if (esistentiError) {
      throw esistentiError;
    }

    const esistentiMap = new Map(
      (esistenti || []).map((conto) => [
        normalizeCodice(
          conto.codice_conto
        ),
        conto,
      ])
    );

    /*
     * 5. Classificazione delle differenze.
     */
    const nuovi: ContoImportato[] = [];

    const giaPresenti: Array<{
      codice_conto: string;
      descrizione_conto: string;
      classificato: boolean;
      escluso: boolean;
    }> = [];

    const descrizioniCambiate: Array<{
      codice_conto: string;
      descrizione_precedente: string | null;
      descrizione_nuova: string;
    }> = [];

    for (const conto of contiFile) {
      const esistente =
        esistentiMap.get(
          conto.codice_conto
        );

      if (!esistente) {
        nuovi.push(conto);
        continue;
      }

      const descrizionePrecedente =
        normalizeDescrizione(
          esistente.descrizione_conto
        );

      if (
        descrizionePrecedente !==
        conto.descrizione_conto
      ) {
        descrizioniCambiate.push({
          codice_conto:
            conto.codice_conto,

          descrizione_precedente:
            esistente.descrizione_conto,

          descrizione_nuova:
            conto.descrizione_conto,
        });
      }

      giaPresenti.push({
        codice_conto:
          conto.codice_conto,

        descrizione_conto:
          conto.descrizione_conto,

        classificato:
          Boolean(
            esistente.voce_id
          ),

        escluso:
          Boolean(
            esistente.escluso
          ),
      });
    }

    /*
     * 6. Inseriamo SOLO i nuovi conti.
     *
     * voce_id = null perché un conto nuovo
     * deve ancora essere classificato.
     */
    if (nuovi.length > 0) {
      const rows = nuovi.map(
        (conto) => ({
          template_id,

          codice_conto:
            conto.codice_conto,

          descrizione_conto:
            conto.descrizione_conto,

          voce_id: null,

          voce_id_negativo: null,

          moltiplicatore: 1,

          escluso: false,

          updated_at:
            new Date().toISOString(),
        })
      );

      const BATCH_SIZE = 500;

      for (
        let i = 0;
        i < rows.length;
        i += BATCH_SIZE
      ) {
        const batch = rows.slice(
          i,
          i + BATCH_SIZE
        );

        const { error } =
          await supabaseAdmin
            .from(
              "tbcontrollo_gestione_template_conti"
            )
            .upsert(batch, {
              onConflict:
                "template_id,codice_conto",

              ignoreDuplicates: true,
            });

        if (error) {
          throw error;
        }
      }
    }

    /*
     * 7. Se cambia soltanto la descrizione,
     *    aggiorniamo la descrizione ma NON
     *    tocchiamo mai la riclassificazione.
     */
    for (
      const cambio of
      descrizioniCambiate
    ) {
      const { error } =
        await supabaseAdmin
          .from(
            "tbcontrollo_gestione_template_conti"
          )
          .update({
            descrizione_conto:
              cambio.descrizione_nuova,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "template_id",
            template_id
          )
          .eq(
            "codice_conto",
            cambio.codice_conto
          );

      if (error) {
        throw error;
      }
    }

    /*
     * 8. Conti presenti nel master ma
     *    non presenti nel file appena importato.
     *
     * NON li cancelliamo.
     */
    const codiciFile = new Set(
      contiFile.map(
        (conto) =>
          conto.codice_conto
      )
    );

    const nonPresentiNelFile =
      (esistenti || [])
        .filter(
          (conto) =>
            !codiciFile.has(
              normalizeCodice(
                conto.codice_conto
              )
            )
        )
        .map((conto) => ({
          codice_conto:
            conto.codice_conto,

          descrizione_conto:
            conto.descrizione_conto,
        }));

    /*
     * 9. Risultato.
     */
    return res.status(200).json({
      success: true,

      template: {
        id: template.id,
        nome: template.nome,
        software_contabile:
          template.software_contabile,
      },

      riepilogo: {
        righe_file:
          conti.length,

        conti_validi:
          contiFile.length,

        gia_presenti:
          giaPresenti.length,

        nuovi:
          nuovi.length,

        descrizioni_aggiornate:
          descrizioniCambiate.length,

        non_presenti_nel_file:
          nonPresentiNelFile.length,
      },

      nuovi,

      gia_presenti:
        giaPresenti,

      descrizioni_cambiate:
        descrizioniCambiate,

      non_presenti_nel_file:
        nonPresentiNelFile,
    });
  } catch (error: any) {
    console.error(
      "Errore import piano dei conti:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Errore interno durante l'importazione del piano dei conti",
    });
  }
}
