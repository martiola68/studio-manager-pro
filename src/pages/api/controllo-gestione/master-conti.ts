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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    /*
     * =====================================================
     * GET
     * =====================================================
     *
     * Restituisce:
     * - master
     * - conti del master
     * - voci SMP disponibili
     */
    if (req.method === "GET") {
      const {
        studio_id,
        template_id,
      } = req.query;

      if (
        typeof studio_id !==
          "string" ||
        !studio_id
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "studio_id obbligatorio",
          });
      }

      if (
        typeof template_id !==
          "string" ||
        !template_id
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "template_id obbligatorio",
          });
      }

      /*
       * Verifica multi-studio.
       */
      const {
        data: template,
        error:
          templateError,
      } = await supabaseAdmin
        .from(
          "tbcontrollo_gestione_template"
        )
        .select(`
          id,
          studio_id,
          nome,
          software_contabile,
          predefinito,
          attivo
        `)
        .eq(
          "id",
          template_id
        )
        .eq(
          "studio_id",
          studio_id
        )
        .maybeSingle();

      if (templateError) {
        throw templateError;
      }

      if (!template) {
        return res
          .status(404)
          .json({
            success: false,
            error:
              "Master non trovato nello studio",
          });
      }

      const {
        data: conti,
        error: contiError,
      } = await supabaseAdmin
        .from(
          "tbcontrollo_gestione_template_conti"
        )
        .select(`
          id,
          template_id,
          codice_conto,
          descrizione_conto,
          voce_id,
          voce_id_negativo,
          moltiplicatore,
          escluso,
          updated_at
        `)
        .eq(
          "template_id",
          template_id
        )
        .order(
          "codice_conto",
          {
            ascending: true,
          }
        );

      if (contiError) {
        throw contiError;
      }

      const {
        data: voci,
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
          macrovoce
        `)
        .order(
          "sezione",
          {
            ascending: true,
          }
        )
        .order(
          "codice",
          {
            ascending: true,
          }
        );

      if (vociError) {
        throw vociError;
      }

      return res
        .status(200)
        .json({
          success: true,
          template,
          conti:
            conti || [],
          voci:
            voci || [],
        });
    }

    /*
     * =====================================================
     * POST
     * =====================================================
     *
     * Salva classificazione di UN conto del master.
     */
    if (req.method === "POST") {
      const {
        studio_id,
        template_id,
        conto_id,

        voce_id = null,
        voce_id_negativo = null,

        moltiplicatore = 1,

        escluso = false,
      } = req.body;

      if (!studio_id) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "studio_id obbligatorio",
          });
      }

      if (!template_id) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "template_id obbligatorio",
          });
      }

      if (!conto_id) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "conto_id obbligatorio",
          });
      }

      /*
       * Verifica che il master appartenga
       * davvero allo studio.
       */
      const {
        data: template,
        error:
          templateError,
      } = await supabaseAdmin
        .from(
          "tbcontrollo_gestione_template"
        )
        .select("id")
        .eq(
          "id",
          template_id
        )
        .eq(
          "studio_id",
          studio_id
        )
        .maybeSingle();

      if (templateError) {
        throw templateError;
      }

      if (!template) {
        return res
          .status(404)
          .json({
            success: false,
            error:
              "Master non appartenente allo studio",
          });
      }

      if (
        !escluso &&
        !voce_id
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "Seleziona una voce SMP oppure escludi il conto",
          });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "tbcontrollo_gestione_template_conti"
        )
        .update({
          voce_id:
            escluso
              ? null
              : voce_id,

          voce_id_negativo:
            escluso
              ? null
              : voce_id_negativo,

          moltiplicatore:
            Number(
              moltiplicatore ||
                1
            ),

          escluso:
            Boolean(
              escluso
            ),

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          conto_id
        )
        .eq(
          "template_id",
          template_id
        )
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      return res
        .status(200)
        .json({
          success: true,
          data,
        });
    }

    return res
      .status(405)
      .json({
        success: false,
        error:
          "Metodo non consentito",
      });
  } catch (error: any) {
    console.error(
      "Errore master-conti:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,
        error:
          error?.message ||
          "Errore interno server",
      });
  }
}
