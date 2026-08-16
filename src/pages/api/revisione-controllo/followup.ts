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
     */
    if (req.method === "GET") {
      const {
        studio_id,
        completato,
        incarico_id,
        cliente_id,
      } = req.query;

      if (
        typeof studio_id !== "string" ||
        !studio_id
      ) {
        return res.status(400).json({
          success: false,
          error: "studio_id obbligatorio",
        });
      }

      /*
       * Leggiamo i follow-up.
       *
       * Recuperiamo anche:
       * - controllo;
       * - trimestre;
       * - anno;
       * - incarico;
       * - cliente;
       * - checklist;
       * - area;
       * - voce SMP.
       */
      let query =
        supabaseAdmin
          .from(
            "tbrevisione_followup"
          )
          .select(`
            id,
            studio_id,
            controllo_id,
            checklist_id,
            cliente_id,

            descrizione,
            gravita,

            importo,
            significativo,
            corretto,
            effetto_relazione,
            stato,

            data_scadenza,

            completato,
            completato_da,
            completato_at,

            note,
            created_at,

            controllo:tbrevisione_controlli(
              id,
              incarico_id,
              anno,
              trimestre,

              incarico:tbrevisione_incarichi(
                id,
                cliente_id,

                cliente:tbclienti(
                  id,
                  ragione_sociale
                )
              )
            ),

            checklist:tbrevisione_checklist(
              id,
              area,
              voce_smp_id,
              domanda,

              voce:tbcontrollo_gestione_voci(
                id,
                codice,
                descrizione
              )
            )
          `)
          .eq(
            "studio_id",
            studio_id
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          );

      if (
        typeof completato ===
          "string" &&
        (
          completato === "true" ||
          completato === "false"
        )
      ) {
        query =
          query.eq(
            "completato",
            completato === "true"
          );
      }

      if (
        typeof cliente_id ===
          "string" &&
        cliente_id
      ) {
        query =
          query.eq(
            "cliente_id",
            cliente_id
          );
      }

      const {
        data,
        error,
      } = await query;

      if (error) {
        throw error;
      }

      /*
       * Filtro incarico.
       *
       * incarico_id appartiene alla relazione
       * controllo -> incarico, quindi lo applichiamo
       * dopo la query.
       */
      let rows =
        data || [];

      if (
        typeof incarico_id ===
          "string" &&
        incarico_id
      ) {
        rows =
          rows.filter(
            (item: any) =>
              item.controllo
                ?.incarico_id ===
              incarico_id
          );
      }

      /*
       * Normalizziamo la risposta per semplificare
       * il frontend.
       */
      const risultato =
        rows.map(
          (item: any) => ({
            id:
              item.id,

            studio_id:
              item.studio_id,

            controllo_id:
              item.controllo_id,

            checklist_id:
              item.checklist_id,

            cliente_id:
              item.cliente_id,

            descrizione:
              item.descrizione,

            gravita:
              item.gravita,

            importo:
              item.importo != null
                ? Number(
                    item.importo
                  )
                : null,

            significativo:
              item.significativo ===
              true,

            corretto:
              item.corretto ===
              true,

            effetto_relazione:
              item.effetto_relazione ||
              null,

            stato:
              item.stato ||
              (
                item.completato
                  ? "RISOLTO"
                  : "APERTO"
              ),

            data_scadenza:
              item.data_scadenza,

            completato:
              item.completato ===
              true,

            completato_da:
              item.completato_da,

            completato_at:
              item.completato_at,

            note:
              item.note,

            created_at:
              item.created_at,

            incarico_id:
              item.controllo
                ?.incarico_id ||
              null,

            anno:
              item.controllo
                ?.anno ||
              null,

            trimestre:
              item.controllo
                ?.trimestre ||
              null,

            ragione_sociale:
              item.controllo
                ?.incarico
                ?.cliente
                ?.ragione_sociale ||
              null,

            area:
              item.checklist
                ?.area ||
              null,

            voce_smp_id:
              item.checklist
                ?.voce_smp_id ||
              null,

            voce_codice:
              item.checklist
                ?.voce
                ?.codice ||
              null,

            voce_descrizione:
              item.checklist
                ?.voce
                ?.descrizione ||
              null,
          })
        );

      return res.status(200).json({
        success: true,
        data: risultato,
      });
    }

    /*
     * =====================================================
     * PUT
     * =====================================================
     */
    if (req.method === "PUT") {
      const {
        id,

        descrizione,
        gravita,
        importo,
        significativo,
        corretto,
        effetto_relazione,
        stato,

        data_scadenza,

        completato,
        completato_da,

        note,
      } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error:
            "ID follow-up obbligatorio",
        });
      }

      const updateData:
        Record<string, any> = {};

      if (
        typeof descrizione !==
        "undefined"
      ) {
        updateData.descrizione =
          descrizione;
      }

      if (
        typeof gravita !==
        "undefined"
      ) {
        updateData.gravita =
          gravita || null;
      }

      if (
        typeof importo !==
        "undefined"
      ) {
        updateData.importo =
          importo === null ||
          importo === ""
            ? null
            : Number(importo);
      }

      if (
        typeof significativo !==
        "undefined"
      ) {
        updateData.significativo =
          significativo === true;
      }

      if (
        typeof corretto !==
        "undefined"
      ) {
        updateData.corretto =
          corretto === true;
      }

      if (
        typeof effetto_relazione !==
        "undefined"
      ) {
        updateData.effetto_relazione =
          effetto_relazione ||
          null;
      }

      if (
        typeof stato !==
        "undefined"
      ) {
        updateData.stato =
          stato || "APERTO";
      }

      if (
        typeof data_scadenza !==
        "undefined"
      ) {
        updateData.data_scadenza =
          data_scadenza ||
          null;
      }

      if (
        typeof note !==
        "undefined"
      ) {
        updateData.note =
          note || null;
      }

      /*
       * Chiusura / riapertura follow-up.
       */
      if (
        typeof completato !==
        "undefined"
      ) {
        updateData.completato =
          completato === true;

        if (
          completato === true
        ) {
          updateData.completato_da =
            completato_da ||
            null;

          updateData.completato_at =
            new Date()
              .toISOString();

          /*
           * Se non viene passato esplicitamente
           * uno stato diverso, la chiusura
           * corrisponde a RISOLTO.
           */
          if (
            typeof stato ===
            "undefined"
          ) {
            updateData.stato =
              "RISOLTO";
          }
        } else {
          updateData.completato_da =
            null;

          updateData.completato_at =
            null;

          if (
            typeof stato ===
            "undefined"
          ) {
            updateData.stato =
              "APERTO";
          }
        }
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "tbrevisione_followup"
        )
        .update(
          updateData
        )
        .eq(
          "id",
          id
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
     * DELETE
     * =====================================================
     */
    if (req.method === "DELETE") {
      const {
        id,
      } = req.query;

      if (
        typeof id !== "string" ||
        !id
      ) {
        return res.status(400).json({
          success: false,
          error:
            "ID follow-up obbligatorio",
        });
      }

      const {
        error,
      } = await supabaseAdmin
        .from(
          "tbrevisione_followup"
        )
        .delete()
        .eq(
          "id",
          id
        );

      if (error) {
        throw error;
      }

      return res.status(200).json({
        success: true,
      });
    }

    return res.status(405).json({
      success: false,
      error:
        "Metodo non consentito",
    });
  } catch (error: any) {
    console.error(
      "Errore API revisione-controllo/followup:",
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
