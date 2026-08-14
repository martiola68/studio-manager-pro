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
    if (req.method === "GET") {
      const {
        studio_id,
        cliente_id,
        controllo_id,
        import_id,
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

      if (
        typeof cliente_id !== "string" ||
        !cliente_id
      ) {
        return res.status(400).json({
          success: false,
          error: "cliente_id obbligatorio",
        });
      }

      if (
        typeof controllo_id !== "string" ||
        !controllo_id
      ) {
        return res.status(400).json({
          success: false,
          error: "controllo_id obbligatorio",
        });
      }

      if (
        typeof import_id !== "string" ||
        !import_id
      ) {
        return res.status(400).json({
          success: false,
          error: "import_id obbligatorio",
        });
      }

      const { data, error } = await supabaseAdmin
        .from("tbcontrollo_gestione_integrazioni")
        .select("*")
        .eq("studio_id", studio_id)
        .eq("cliente_id", cliente_id)
        .eq("controllo_id", controllo_id)
        .eq("import_id", import_id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return res.status(200).json({
        success: true,
        data: data || null,
      });
    }

    if (req.method === "POST") {
      const {
        studio_id,
        cliente_id,
        controllo_id,
        import_id,

        debiti_finanziari_bt = 0,
        debiti_finanziari_mlt = 0,
        rate_finanziarie_12_mesi = 0,
        cash_flow_operativo_previsionale = null,

        note = null,
      } = req.body;

      if (!studio_id) {
        return res.status(400).json({
          success: false,
          error: "studio_id obbligatorio",
        });
      }

      if (!cliente_id) {
        return res.status(400).json({
          success: false,
          error: "cliente_id obbligatorio",
        });
      }

      if (!controllo_id) {
        return res.status(400).json({
          success: false,
          error: "controllo_id obbligatorio",
        });
      }

      if (!import_id) {
        return res.status(400).json({
          success: false,
          error: "import_id obbligatorio",
        });
      }

      /*
       * Verifica che import e controllo appartengano
       * davvero allo stesso studio/cliente.
       */
      const {
        data: importRecord,
        error: importError,
      } = await supabaseAdmin
        .from("tbcontrollo_gestione_import")
        .select(`
          id,
          studio_id,
          cliente_id,
          controllo_id
        `)
        .eq("id", import_id)
        .eq("studio_id", studio_id)
        .eq("cliente_id", cliente_id)
        .eq("controllo_id", controllo_id)
        .maybeSingle();

      if (importError) {
        throw importError;
      }

      if (!importRecord) {
        return res.status(404).json({
          success: false,
          error:
            "Import non trovato oppure non appartenente al controllo indicato",
        });
      }

      const bt = Number(debiti_finanziari_bt || 0);
      const mlt = Number(debiti_finanziari_mlt || 0);
      const rate = Number(rate_finanziarie_12_mesi || 0);

      if (bt < 0 || mlt < 0 || rate < 0) {
        return res.status(400).json({
          success: false,
          error:
            "Debiti finanziari e rate non possono essere negativi",
        });
      }

      const cashFlow =
        cash_flow_operativo_previsionale === null ||
        cash_flow_operativo_previsionale === "" ||
        cash_flow_operativo_previsionale === undefined
          ? null
          : Number(cash_flow_operativo_previsionale);

      const payload = {
        studio_id,
        cliente_id,
        controllo_id,
        import_id,

        debiti_finanziari_bt: bt,
        debiti_finanziari_mlt: mlt,

        rate_finanziarie_12_mesi: rate,

        cash_flow_operativo_previsionale:
          cashFlow,

        note:
          note != null && String(note).trim()
            ? String(note).trim()
            : null,

        updated_at:
          new Date().toISOString(),
      };

      const { data, error } = await supabaseAdmin
        .from("tbcontrollo_gestione_integrazioni")
        .upsert(payload, {
          onConflict: "import_id",
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

    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  } catch (error: any) {
    console.error(
      "Errore API controllo-gestione/integrazioni:",
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
