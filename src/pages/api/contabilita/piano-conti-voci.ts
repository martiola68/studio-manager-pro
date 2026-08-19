import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { supabaseAdmin } from "@/lib/supabase/admin";

type VocePayload = {
  id?: string;
  studio_id?: string;
  piano_conti_id?: string;

  codice_conto?: string;
  descrizione_conto?: string | null;
  codice_padre?: string | null;

  voce_smp_id?: string | null;
  voce_smp_id_negativo?: string | null;

  escluso?: boolean;
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
     * Elenco conti del Piano Master
     * =====================================================
     */
    if (req.method === "GET") {
      const studio_id =
        typeof req.query.studio_id === "string"
          ? req.query.studio_id
          : "";

      const piano_conti_id =
        typeof req.query.piano_conti_id === "string"
          ? req.query.piano_conti_id
          : "";

      if (
        !studio_id ||
        !piano_conti_id
      ) {
        return res.status(400).json({
          success: false,
          error:
            "studio_id e piano_conti_id obbligatori.",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "tbcontabilita_piano_conti_voci"
        )
        .select(`
          id,
          studio_id,
          piano_conti_id,
          codice_conto,
          descrizione_conto,
          codice_padre,
          voce_smp_id,
          voce_smp_id_negativo,
          escluso,
          attivo,
          created_at,
          updated_at
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
          "codice_conto",
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

    /*
     * =====================================================
     * POST
     * Inserimento / sincronizzazione singolo conto
     * =====================================================
     *
     * Questo endpoint è volutamente UPSERT:
     * se il conto esiste già nel Master
     * aggiorniamo descrizione/codice padre,
     * ma NON cancelliamo la classificazione già salvata.
     */
    if (req.method === "POST") {
      const body =
        req.body as VocePayload;

      const studio_id =
        String(
          body.studio_id || ""
        ).trim();

      const piano_conti_id =
        String(
          body.piano_conti_id || ""
        ).trim();

      const codice_conto =
        String(
          body.codice_conto || ""
        ).trim();

      if (
        !studio_id ||
        !piano_conti_id ||
        !codice_conto
      ) {
        return res.status(400).json({
          success: false,
          error:
            "studio_id, piano_conti_id e codice_conto sono obbligatori.",
        });
      }

      /*
       * Cerchiamo prima l'eventuale conto già presente.
       */
      const {
        data: esistente,
        error: esistenteError,
      } = await supabaseAdmin
        .from(
          "tbcontabilita_piano_conti_voci"
        )
        .select(`
          id,
          voce_smp_id,
          voce_smp_id_negativo,
          escluso,
          attivo
        `)
        .eq(
          "studio_id",
          studio_id
        )
        .eq(
          "piano_conti_id",
          piano_conti_id
        )
        .eq(
          "codice_conto",
          codice_conto
        )
        .maybeSingle();

      if (esistenteError) {
        throw esistenteError;
      }

      if (esistente) {
        /*
         * Conto già presente.
         *
         * Aggiorniamo i dati provenienti dal PC,
         * ma conserviamo la classificazione Master.
         */
        const {
          data,
          error,
        } = await supabaseAdmin
          .from(
            "tbcontabilita_piano_conti_voci"
          )
          .update({
            descrizione_conto:
              body.descrizione_conto ??
              null,

            codice_padre:
              body.codice_padre ??
              null,

            attivo: true,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            esistente.id
          )
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        return res.status(200).json({
          success: true,
          data,
          nuovo: false,
        });
      }

      /*
       * Nuovo conto.
       */
      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "tbcontabilita_piano_conti_voci"
        )
        .insert({
          studio_id,
          piano_conti_id,
          codice_conto,

          descrizione_conto:
            body.descrizione_conto ??
            null,

          codice_padre:
            body.codice_padre ??
            null,

          voce_smp_id: null,
          voce_smp_id_negativo: null,

          escluso: false,
          attivo: true,
        })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      return res.status(201).json({
        success: true,
        data,
        nuovo: true,
      });
    }

    /*
     * =====================================================
     * PUT
     * Classificazione / modifica del conto Master
     * =====================================================
     */
    if (req.method === "PUT") {
      const body =
        req.body as VocePayload;

      const id =
        String(
          body.id || ""
        ).trim();

      const studio_id =
        String(
          body.studio_id || ""
        ).trim();

      if (
        !id ||
        !studio_id
      ) {
        return res.status(400).json({
          success: false,
          error:
            "id e studio_id obbligatori.",
        });
      }

      const payload: Record<
        string,
        unknown
      > = {
        updated_at:
          new Date().toISOString(),
      };

      if (
        body.descrizione_conto !==
        undefined
      ) {
        payload.descrizione_conto =
          body.descrizione_conto;
      }

      if (
        body.codice_padre !==
        undefined
      ) {
        payload.codice_padre =
          body.codice_padre;
      }

      if (
        body.voce_smp_id !==
        undefined
      ) {
        payload.voce_smp_id =
          body.voce_smp_id ||
          null;
      }

      if (
        body.voce_smp_id_negativo !==
        undefined
      ) {
        payload.voce_smp_id_negativo =
          body.voce_smp_id_negativo ||
          null;
      }

      if (
        body.escluso !==
        undefined
      ) {
        payload.escluso =
          body.escluso;
      }

      if (
        body.attivo !==
        undefined
      ) {
        payload.attivo =
          body.attivo;
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "tbcontabilita_piano_conti_voci"
        )
        .update(payload)
        .eq(
          "id",
          id
        )
        .eq(
          "studio_id",
          studio_id
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
            "Conto del Piano Master non trovato.",
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
      error: "Metodo non consentito.",
    });
  } catch (err: any) {
    console.error(
      "Errore API voci piano conti:",
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
