import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

const supabaseAdmin =
  getSupabaseAdmin();

type PianoPayload = {
  studio_id?: string;
  id?: string;

  nome?: string;
  software_contabile?: string;
  codice_piano?: string | null;
  descrizione?: string | null;
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
     * Elenco piani dello studio
     * =====================================================
     */
    if (req.method === "GET") {
      const studio_id =
        typeof req.query.studio_id === "string"
          ? req.query.studio_id
          : "";

      if (!studio_id) {
        return res.status(400).json({
          success: false,
          error: "studio_id obbligatorio.",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "tbcontabilita_piani_conti"
        )
        .select(`
          id,
          studio_id,
          nome,
          software_contabile,
          codice_piano,
          descrizione,
          attivo,
          created_at,
          updated_at
        `)
        .eq(
          "studio_id",
          studio_id
        )
        .order(
          "nome",
          {
            ascending: true,
          }
        );

      if (error) {
        throw error;
      }

      /*
       * Recuperiamo anche il numero
       * delle società e dei conti
       * collegati a ciascun piano.
       */
      const piani =
        data || [];

      const risultato =
        await Promise.all(
          piani.map(
            async (piano) => {
              const [
                societaResult,
                contiResult,
                classificatiResult,
              ] =
                await Promise.all([
                  supabaseAdmin
                    .from(
                      "tbcontabilita_societa_piano"
                    )
                    .select(
                      "id",
                      {
                        count: "exact",
                        head: true,
                      }
                    )
                    .eq(
                      "piano_conti_id",
                      piano.id
                    )
                    .eq(
                      "attivo",
                      true
                    ),

                  supabaseAdmin
                    .from(
                      "tbcontabilita_piano_conti_voci"
                    )
                    .select(
                      "id",
                      {
                        count: "exact",
                        head: true,
                      }
                    )
                    .eq(
                      "piano_conti_id",
                      piano.id
                    )
                    .eq(
                      "attivo",
                      true
                    ),

                  supabaseAdmin
                    .from(
                      "tbcontabilita_piano_conti_voci"
                    )
                    .select(
                      "id",
                      {
                        count: "exact",
                        head: true,
                      }
                    )
                    .eq(
                      "piano_conti_id",
                      piano.id
                    )
                    .eq(
                      "attivo",
                      true
                    )
                    .not(
                      "voce_smp_id",
                      "is",
                      null
                    ),
                ]);

              const numeroConti =
                contiResult.count || 0;

              const classificati =
                classificatiResult.count ||
                0;

              return {
                ...piano,

                numero_societa:
                  societaResult.count ||
                  0,

                numero_conti:
                  numeroConti,

                conti_classificati:
                  classificati,

                conti_da_classificare:
                  Math.max(
                    numeroConti -
                      classificati,
                    0
                  ),
              };
            }
          )
        );

      return res.status(200).json({
        success: true,
        data: risultato,
      });
    }

    /*
     * =====================================================
     * POST
     * Creazione nuovo Piano dei Conti Master
     * =====================================================
     */
    if (req.method === "POST") {
      const body =
        req.body as PianoPayload;

      const studio_id =
        String(
          body.studio_id || ""
        ).trim();

      const nome =
        String(
          body.nome || ""
        ).trim();

      const software_contabile =
        String(
          body.software_contabile ||
            ""
        ).trim();

      if (
        !studio_id ||
        !nome ||
        !software_contabile
      ) {
        return res.status(400).json({
          success: false,
          error:
            "studio_id, nome e software_contabile sono obbligatori.",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "tbcontabilita_piani_conti"
        )
        .insert({
          studio_id,
          nome,
          software_contabile,

          codice_piano:
            body.codice_piano ||
            null,

          descrizione:
            body.descrizione ||
            null,

          attivo:
            body.attivo ??
            true,
        })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      return res.status(201).json({
        success: true,
        data,
      });
    }

    /*
     * =====================================================
     * PUT
     * Modifica Piano dei Conti Master
     * =====================================================
     */
    if (req.method === "PUT") {
      const body =
        req.body as PianoPayload;

      const id =
        String(
          body.id || ""
        ).trim();

      const studio_id =
        String(
          body.studio_id || ""
        ).trim();

      if (!id || !studio_id) {
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
        body.nome !== undefined
      ) {
        payload.nome =
          String(
            body.nome
          ).trim();
      }

      if (
        body.software_contabile !==
        undefined
      ) {
        payload.software_contabile =
          String(
            body.software_contabile
          ).trim();
      }

      if (
        body.codice_piano !==
        undefined
      ) {
        payload.codice_piano =
          body.codice_piano ||
          null;
      }

      if (
        body.descrizione !==
        undefined
      ) {
        payload.descrizione =
          body.descrizione ||
          null;
      }

      if (
        body.attivo !== undefined
      ) {
        payload.attivo =
          body.attivo;
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "tbcontabilita_piani_conti"
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
            "Piano dei conti non trovato.",
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
      "Errore API piani conti:",
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
