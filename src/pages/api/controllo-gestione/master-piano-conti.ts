import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    /*
     * =========================================================
     * GET
     * Elenco master piano dei conti dello studio
     * =========================================================
     */
    if (req.method === "GET") {
      const { studio_id } = req.query;

      if (
        typeof studio_id !== "string" ||
        !studio_id
      ) {
        return res.status(400).json({
          success: false,
          error: "studio_id obbligatorio",
        });
      }

      const { data, error } = await supabaseAdmin
        .from("tbcontrollo_gestione_template")
        .select(`
          id,
          studio_id,
          software_contabile,
          nome,
          descrizione,
          predefinito,
          attivo,
          modello_import_id,
          created_at,
          updated_at
        `)
        .eq("studio_id", studio_id)
        .order("software_contabile", {
          ascending: true,
        })
        .order("nome", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      /*
       * Recuperiamo separatamente:
       *
       * - numero conti presenti nel master
       * - numero società che utilizzano il master
       *
       * Evitiamo embed complessi PostgREST.
       */
      const templateIds = (data || []).map(
        (row) => row.id
      );

      let conteggiConti: Record<string, number> = {};
      let conteggiClienti: Record<string, number> = {};

      if (templateIds.length > 0) {
        const [
          contiResponse,
          configurazioniResponse,
        ] = await Promise.all([
          supabaseAdmin
            .from(
              "tbcontrollo_gestione_template_conti"
            )
            .select("template_id")
            .in("template_id", templateIds),

          supabaseAdmin
            .from(
              "tbcontrollo_gestione_configurazioni"
            )
            .select("template_id")
            .eq("studio_id", studio_id)
            .eq("attiva", true)
            .in("template_id", templateIds),
        ]);

        if (contiResponse.error) {
          throw contiResponse.error;
        }

        if (configurazioniResponse.error) {
          throw configurazioniResponse.error;
        }

        for (const row of contiResponse.data || []) {
          conteggiConti[row.template_id] =
            (conteggiConti[row.template_id] || 0) + 1;
        }

        for (
          const row of
          configurazioniResponse.data || []
        ) {
          conteggiClienti[row.template_id] =
            (conteggiClienti[row.template_id] || 0) + 1;
        }
      }

      const risultato = (data || []).map(
        (template) => ({
          ...template,

          numero_conti:
            conteggiConti[template.id] || 0,

          numero_societa:
            conteggiClienti[template.id] || 0,
        })
      );

      return res.status(200).json({
        success: true,
        data: risultato,
      });
    }

    /*
     * =========================================================
     * POST
     * Creazione nuovo master
     * =========================================================
     */
    if (req.method === "POST") {
      const {
        studio_id,
        software_contabile,
        nome,
        descrizione = null,
        modello_import_id = null,
        predefinito = false,
      } = req.body;

      if (!studio_id) {
        return res.status(400).json({
          success: false,
          error: "studio_id obbligatorio",
        });
      }

      if (!software_contabile) {
        return res.status(400).json({
          success: false,
          error: "software_contabile obbligatorio",
        });
      }

      if (!nome || !String(nome).trim()) {
        return res.status(400).json({
          success: false,
          error: "nome obbligatorio",
        });
      }

      /*
       * Se viene impostato come predefinito,
       * togliamo il flag agli altri master
       * dello stesso software nello stesso studio.
       */
      if (predefinito) {
        const { error: resetError } =
          await supabaseAdmin
            .from("tbcontrollo_gestione_template")
            .update({
              predefinito: false,
              updated_at: new Date().toISOString(),
            })
            .eq("studio_id", studio_id)
            .eq(
              "software_contabile",
              software_contabile
            );

        if (resetError) {
          throw resetError;
        }
      }

      const { data, error } = await supabaseAdmin
        .from("tbcontrollo_gestione_template")
        .insert({
          studio_id,

          software_contabile:
            String(software_contabile).trim(),

          nome:
            String(nome).trim(),

          descrizione:
            descrizione != null &&
            String(descrizione).trim()
              ? String(descrizione).trim()
              : null,

          modello_import_id:
            modello_import_id || null,

          predefinito:
            Boolean(predefinito),

          attivo: true,

          updated_at:
            new Date().toISOString(),
        })
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
     * =========================================================
     * PUT
     * Modifica master
     * =========================================================
     */
    if (req.method === "PUT") {
      const {
        id,
        studio_id,
        nome,
        descrizione,
        software_contabile,
        modello_import_id,
        predefinito,
        attivo,
      } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: "id obbligatorio",
        });
      }

      if (!studio_id) {
        return res.status(400).json({
          success: false,
          error: "studio_id obbligatorio",
        });
      }

      /*
       * Verifica appartenenza allo studio.
       */
      const {
        data: esistente,
        error: esistenteError,
      } = await supabaseAdmin
        .from("tbcontrollo_gestione_template")
        .select(`
          id,
          studio_id,
          software_contabile
        `)
        .eq("id", id)
        .eq("studio_id", studio_id)
        .maybeSingle();

      if (esistenteError) {
        throw esistenteError;
      }

      if (!esistente) {
        return res.status(404).json({
          success: false,
          error: "Master non trovato nello studio",
        });
      }

      const softwareFinale =
        software_contabile != null
          ? String(software_contabile).trim()
          : esistente.software_contabile;

      /*
       * Se diventa predefinito, azzeriamo
       * gli altri master dello stesso software.
       */
      if (predefinito === true) {
        const { error: resetError } =
          await supabaseAdmin
            .from("tbcontrollo_gestione_template")
            .update({
              predefinito: false,
              updated_at: new Date().toISOString(),
            })
            .eq("studio_id", studio_id)
            .eq(
              "software_contabile",
              softwareFinale
            )
            .neq("id", id);

        if (resetError) {
          throw resetError;
        }
      }

      const payload: Record<string, unknown> = {
        updated_at:
          new Date().toISOString(),
      };

      if (nome !== undefined) {
        if (!String(nome).trim()) {
          return res.status(400).json({
            success: false,
            error: "nome non valido",
          });
        }

        payload.nome =
          String(nome).trim();
      }

      if (descrizione !== undefined) {
        payload.descrizione =
          descrizione != null &&
          String(descrizione).trim()
            ? String(descrizione).trim()
            : null;
      }

      if (software_contabile !== undefined) {
        payload.software_contabile =
          softwareFinale;
      }

      if (modello_import_id !== undefined) {
        payload.modello_import_id =
          modello_import_id || null;
      }

      if (predefinito !== undefined) {
        payload.predefinito =
          Boolean(predefinito);
      }

      if (attivo !== undefined) {
        payload.attivo =
          Boolean(attivo);
      }

      const { data, error } = await supabaseAdmin
        .from("tbcontrollo_gestione_template")
        .update(payload)
        .eq("id", id)
        .eq("studio_id", studio_id)
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
     * =========================================================
     * DELETE
     * Eliminazione master solo se non utilizzato
     * =========================================================
     */
    if (req.method === "DELETE") {
      const {
        id,
        studio_id,
      } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: "id obbligatorio",
        });
      }

      if (!studio_id) {
        return res.status(400).json({
          success: false,
          error: "studio_id obbligatorio",
        });
      }

      /*
       * Controlliamo che il master appartenga
       * allo studio.
       */
      const {
        data: template,
        error: templateError,
      } = await supabaseAdmin
        .from("tbcontrollo_gestione_template")
        .select("id")
        .eq("id", id)
        .eq("studio_id", studio_id)
        .maybeSingle();

      if (templateError) {
        throw templateError;
      }

      if (!template) {
        return res.status(404).json({
          success: false,
          error: "Master non trovato nello studio",
        });
      }

      /*
       * Non eliminiamo un master utilizzato
       * da una configurazione societaria.
       */
      const {
        count,
        error: configurazioniError,
      } = await supabaseAdmin
        .from(
          "tbcontrollo_gestione_configurazioni"
        )
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("studio_id", studio_id)
        .eq("template_id", id);

      if (configurazioniError) {
        throw configurazioniError;
      }

      if ((count || 0) > 0) {
        return res.status(409).json({
          success: false,
          error:
            "Il master è associato a una o più società e non può essere eliminato",
        });
      }

      /*
       * I conti del template vengono eliminati
       * automaticamente grazie a ON DELETE CASCADE.
       */
      const { error } = await supabaseAdmin
        .from("tbcontrollo_gestione_template")
        .delete()
        .eq("id", id)
        .eq("studio_id", studio_id);

      if (error) {
        throw error;
      }

      return res.status(200).json({
        success: true,
      });
    }

    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  } catch (error: any) {
    console.error(
      "Errore API master piano dei conti:",
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
