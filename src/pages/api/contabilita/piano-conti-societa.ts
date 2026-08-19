import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { supabaseAdmin } from "@/lib/supabase/admin";

type CollegamentoPayload = {
  studio_id?: string;
  cliente_id?: string;
  piano_conti_id?: string;
  attivo?: boolean;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    /*
     * =====================================================
     * GET
     * Legge il piano collegato alla società
     *
     * Oppure, passando piano_conti_id,
     * restituisce tutte le società collegate al Master.
     * =====================================================
     */
    if (req.method === "GET") {
      const studio_id =
        typeof req.query.studio_id === "string"
          ? req.query.studio_id
          : "";

      const cliente_id =
        typeof req.query.cliente_id === "string"
          ? req.query.cliente_id
          : "";

      const piano_conti_id =
        typeof req.query.piano_conti_id === "string"
          ? req.query.piano_conti_id
          : "";

      if (!studio_id) {
        return res.status(400).json({
          success: false,
          error: "studio_id obbligatorio.",
        });
      }

      /*
       * -----------------------------------------------
       * Caso A:
       * vogliamo sapere quale Piano Master usa
       * una determinata società.
       * -----------------------------------------------
       */
      if (cliente_id) {
        const {
          data,
          error,
        } = await supabaseAdmin
          .from(
            "tbcontabilita_societa_piano"
          )
          .select(`
            id,
            studio_id,
            cliente_id,
            piano_conti_id,
            attivo,
            created_at,
            updated_at,
            piano:tbcontabilita_piani_conti (
              id,
              nome,
              software_contabile,
              codice_piano,
              descrizione,
              attivo
            )
          `)
          .eq(
            "studio_id",
            studio_id
          )
          .eq(
            "cliente_id",
            cliente_id
          )
          .maybeSingle();

        if (error) {
          throw error;
        }

        return res.status(200).json({
          success: true,
          data: data || null,
        });
      }

      /*
       * -----------------------------------------------
       * Caso B:
       * vogliamo sapere quali società utilizzano
       * uno specifico Piano Master.
       * -----------------------------------------------
       */
      if (piano_conti_id) {
        const {
          data,
          error,
        } = await supabaseAdmin
          .from(
            "tbcontabilita_societa_piano"
          )
          .select(`
            id,
            studio_id,
            cliente_id,
            piano_conti_id,
            attivo,
            created_at,
            updated_at,
            cliente:tbclienti (
              id,
              ragione_sociale,
              codice_fiscale,
              partita_iva
            )
          `)
          .eq(
            "studio_id",
            studio_id
          )
          .eq(
            "piano_conti_id",
            piano_conti_id
          )
          .order(
            "created_at",
            {
              ascending: true,
            }
          );

        if (error) {
          throw error;
        }

        return res.status(200).json({
          success: true,
          data: data || [],
        });
      }

      return res.status(400).json({
        success: false,
        error:
          "Indicare cliente_id oppure piano_conti_id.",
      });
    }

    /*
     * =====================================================
     * POST
     * Collega una società a un Piano Master.
     *
     * La società può avere un solo Piano Master:
     * se esiste già un collegamento lo aggiorniamo.
     * =====================================================
     */
    if (req.method === "POST") {
      const body =
        req.body as CollegamentoPayload;

      const studio_id =
        String(
          body.studio_id || ""
        ).trim();

      const cliente_id =
        String(
          body.cliente_id || ""
        ).trim();

      const piano_conti_id =
        String(
          body.piano_conti_id || ""
        ).trim();

      if (
        !studio_id ||
        !cliente_id ||
        !piano_conti_id
      ) {
        return res.status(400).json({
          success: false,
          error:
            "studio_id, cliente_id e piano_conti_id sono obbligatori.",
        });
      }

      /*
       * Verifica che il Piano Master appartenga
       * allo stesso studio.
       */
      const {
        data: piano,
        error: pianoError,
      } = await supabaseAdmin
        .from(
          "tbcontabilita_piani_conti"
        )
        .select(`
          id,
          studio_id,
          attivo
        `)
        .eq(
          "id",
          piano_conti_id
        )
        .eq(
          "studio_id",
          studio_id
        )
        .maybeSingle();

      if (pianoError) {
        throw pianoError;
      }

      if (!piano) {
        return res.status(404).json({
          success: false,
          error:
            "Piano dei conti Master non trovato per questo studio.",
        });
      }

      if (!piano.attivo) {
        return res.status(400).json({
          success: false,
          error:
            "Il Piano dei conti Master selezionato non è attivo.",
        });
      }

      /*
       * Verifica anche che la società appartenga
       * allo stesso studio.
       */
      const {
        data: cliente,
        error: clienteError,
      } = await supabaseAdmin
        .from("tbclienti")
        .select(`
          id,
          studio_id
        `)
        .eq(
          "id",
          cliente_id
        )
        .eq(
          "studio_id",
          studio_id
        )
        .maybeSingle();

      if (clienteError) {
        throw clienteError;
      }

      if (!cliente) {
        return res.status(404).json({
          success: false,
          error:
            "Società non trovata per questo studio.",
        });
      }

      /*
       * La UNIQUE (studio_id, cliente_id)
       * garantisce un solo Piano Master
       * per società.
       *
       * Usiamo UPSERT:
       * se cambia piano, aggiorniamo
       * il collegamento esistente.
       */
      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "tbcontabilita_societa_piano"
        )
        .upsert(
          {
            studio_id,
            cliente_id,
            piano_conti_id,

            attivo:
              body.attivo ??
              true,

            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "studio_id,cliente_id",
          }
        )
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      return res.status(200).json({
        success: true,
        data,
      });
    }

    /*
     * =====================================================
     * PUT
     * Attiva/disattiva il collegamento
     * =====================================================
     */
    if (req.method === "PUT") {
      const body =
        req.body as CollegamentoPayload;

      const studio_id =
        String(
          body.studio_id || ""
        ).trim();

      const cliente_id =
        String(
          body.cliente_id || ""
        ).trim();

      if (
        !studio_id ||
        !cliente_id
      ) {
        return res.status(400).json({
          success: false,
          error:
            "studio_id e cliente_id obbligatori.",
        });
      }

      if (
        body.attivo === undefined
      ) {
        return res.status(400).json({
          success: false,
          error:
            "attivo obbligatorio.",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "tbcontabilita_societa_piano"
        )
        .update({
          attivo:
            body.attivo,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "studio_id",
          studio_id
        )
        .eq(
          "cliente_id",
          cliente_id
        )
        .select("*")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          error:
            "Collegamento società/Piano Master non trovato.",
        });
      }

      return res.status(200).json({
        success: true,
        data,
      });
    }

    res.setHeader(
      "Allow",
      "GET, POST, PUT"
    );

    return res.status(405).json({
      success: false,
      error:
        "Metodo non consentito.",
    });
  } catch (err: any) {
    console.error(
      "Errore API collegamento società/piano:",
      err
    );

    return res.status(500).json({
      success: false,
      error:
        err?.message ||
        "Errore interno.",
    });
  }
}
