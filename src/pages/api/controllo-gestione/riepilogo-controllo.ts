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
    if (req.method !== "GET") {
      return res.status(405).json({
        success: false,
        error: "Metodo non consentito",
      });
    }

    const { controllo_id } = req.query;

    if (
      typeof controllo_id !== "string" ||
      !controllo_id
    ) {
      return res.status(400).json({
        success: false,
        error: "controllo_id obbligatorio",
      });
    }

    const {
      data: importRecord,
      error: importError,
    } = await supabaseAdmin
      .from("tbcontrollo_gestione_import")
      .select(`
        id,
        controllo_id,
        data_riferimento,
        numero_conti,
        conti_mappati,
        conti_da_mappare,
        stato,
        created_at
      `)
      .eq("controllo_id", controllo_id)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (importError) {
      throw importError;
    }

    const {
      data: indici,
      error: indiciError,
    } = await supabaseAdmin
      .from("tbcontrollo_gestione_indici")
      .select(`
        id,
        controllo_gestione_id,
        ricavi,
        costi_operativi,
        ammortamenti,
        accantonamenti,
        oneri_finanziari,
        imposte,
        utile_netto,
        totale_attivo,
        capitale_investito,
        patrimonio_netto,
        debiti_totali,
        attivo_corrente,
        passivo_corrente,
        cash_flow_operativo,
        rate_finanziarie_annue,
        ebitda,
        ebit,
        ebt,
        roi,
        roe,
        ros,
        roa,
        indebitamento,
        liquidita,
        dscr,
        origine,
        updated_at
      `)
      .eq(
        "controllo_gestione_id",
        controllo_id
      )
      .order("updated_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (indiciError) {
      throw indiciError;
    }

    const {
      data: integrazione,
      error: integrazioneError,
    } = await supabaseAdmin
      .from(
        "tbcontrollo_gestione_integrazioni"
      )
      .select(`
        debiti_finanziari_bt,
        debiti_finanziari_mlt,
        rate_finanziarie_12_mesi,
        cash_flow_operativo_previsionale
      `)
      .eq("controllo_id", controllo_id)
      .order("updated_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (integrazioneError) {
      throw integrazioneError;
    }

    return res.status(200).json({
      success: true,
      import: importRecord || null,
      indici: indici || null,
      integrazione: integrazione || null,
    });
  } catch (error: any) {
    console.error(
      "Errore API riepilogo controllo:",
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
