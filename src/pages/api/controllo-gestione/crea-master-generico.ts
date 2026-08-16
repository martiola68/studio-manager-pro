import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import {
  createClient,
} from "@supabase/supabase-js";

const supabaseAdmin =
  createClient(
    process.env
      .NEXT_PUBLIC_SUPABASE_URL!,
    process.env
      .SUPABASE_SERVICE_ROLE_KEY!
  );

type ContoInput = {
  codice_conto: string;
  descrizione_conto: string;
};

type Body = {
  studio_id: string;

  software_contabile:
    | "zucchetti"
    | "teamsystem"
    | "ipsoa";

  nome: string;

  conti: ContoInput[];
};

function normalizeCodice(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .replace(
      /\s+/g,
      ""
    );
}

function normalizeDescrizione(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .replace(
      /\s+/g,
      " "
    );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (
      req.method !==
      "POST"
    ) {
      return res
        .status(405)
        .json({
          success: false,
          error:
            "Metodo non consentito",
        });
    }

    const {
      studio_id,
      software_contabile,
      nome,
      conti,
    } =
      req.body as Body;

    if (!studio_id) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "studio_id obbligatorio",
        });
    }

    if (
      !software_contabile
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "software_contabile obbligatorio",
        });
    }

    if (
      ![
        "zucchetti",
        "teamsystem",
        "ipsoa",
      ].includes(
        software_contabile
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Software contabile non supportato",
        });
    }

    if (
      !nome ||
      !String(
        nome
      ).trim()
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Nome master obbligatorio",
        });
    }

    if (
      !Array.isArray(
        conti
      ) ||
      conti.length === 0
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Nessun conto da importare",
        });
    }

    /*
     * =====================================================
     * NORMALIZZAZIONE + DEDUPE
     * =====================================================
     */

    const map =
      new Map<
        string,
        ContoInput
      >();

    for (
      const conto
      of conti
    ) {
      const codice =
        normalizeCodice(
          conto.codice_conto
        );

      const descrizione =
        normalizeDescrizione(
          conto.descrizione_conto
        );

      if (
        !codice ||
        !descrizione
      ) {
        continue;
      }

      map.set(
        codice,
        {
          codice_conto:
            codice,

          descrizione_conto:
            descrizione,
        }
      );
    }

    const normalizzati =
      Array.from(
        map.values()
      );

    if (
      normalizzati.length ===
      0
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Il file non contiene conti validi",
        });
    }

    /*
     * =====================================================
     * VERIFICA NOME DUPLICATO
     * =====================================================
     */

    const {
      data: esistente,
      error:
        esistenteError,
    } = await supabaseAdmin
      .from(
        "tbcontrollo_gestione_template"
      )
      .select("id")
      .eq(
        "studio_id",
        studio_id
      )
      .eq(
        "software_contabile",
        software_contabile
      )
      .ilike(
        "nome",
        String(
          nome
        ).trim()
      )
      .maybeSingle();

    if (
      esistenteError
    ) {
      throw esistenteError;
    }

    if (esistente) {
      return res
        .status(409)
        .json({
          success: false,
          error:
            "Esiste già un master con questo nome per il software selezionato",
        });
    }

    /*
     * =====================================================
     * CREA MASTER
     * =====================================================
     */

    const {
      data: template,
      error:
        templateError,
    } = await supabaseAdmin
      .from(
        "tbcontrollo_gestione_template"
      )
      .insert({
        studio_id,

        software_contabile,

        nome:
          String(
            nome
          ).trim(),

        descrizione:
          `Master creato da file per ${software_contabile}`,

        predefinito:
          false,

        attivo:
          true,
      })
      .select(`
        id,
        studio_id,
        software_contabile,
        nome,
        attivo,
        predefinito
      `)
      .single();

    if (
      templateError
    ) {
      throw templateError;
    }

    /*
     * =====================================================
     * CREA CONTI MASTER
     * =====================================================
     */

    const rows =
      normalizzati.map(
        (conto) => ({
          template_id:
            template.id,

          codice_conto:
            conto.codice_conto,

          descrizione_conto:
            conto.descrizione_conto,

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
        })
      );

    const BATCH_SIZE =
      500;

    for (
      let i = 0;
      i < rows.length;
      i += BATCH_SIZE
    ) {
      const batch =
        rows.slice(
          i,
          i +
            BATCH_SIZE
        );

      const {
        error,
      } = await supabaseAdmin
        .from(
          "tbcontrollo_gestione_template_conti"
        )
        .insert(
          batch
        );

      if (error) {
        /*
         * Se qualcosa va storto,
         * eliminiamo anche il template
         * appena creato.
         */
        await supabaseAdmin
          .from(
            "tbcontrollo_gestione_template"
          )
          .delete()
          .eq(
            "id",
            template.id
          );

        throw error;
      }
    }

    return res
      .status(200)
      .json({
        success: true,

        template,

        riepilogo: {
          righe_ricevute:
            conti.length,

          conti_creati:
            normalizzati.length,
        },
      });
  } catch (
    error: any
  ) {
    console.error(
      "Errore crea-master-generico:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,

        error:
          error?.message ||
          "Errore interno durante la creazione del master",
      });
  }
}
