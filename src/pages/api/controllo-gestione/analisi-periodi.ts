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

    const {
      cliente_id,
      anno,
    } = req.query;

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
      typeof anno !== "string" ||
      !anno
    ) {
      return res.status(400).json({
        success: false,
        error: "anno obbligatorio",
      });
    }

    /*
     * 1. SOCIETÀ
     */
    const {
      data: cliente,
      error: clienteError,
    } = await supabaseAdmin
      .from("tbclienti")
      .select(`
        id,
        ragione_sociale,
        codice_fiscale
      `)
      .eq("id", cliente_id)
      .maybeSingle();

    if (clienteError) {
      throw clienteError;
    }

    if (!cliente) {
      return res.status(404).json({
        success: false,
        error: "Società non trovata",
      });
    }

    /*
     * 2. CONTROLLI DELLA SOCIETÀ
     */
    const {
      data: controlli,
      error: controlliError,
    } = await supabaseAdmin
      .from("tbcontrollo_gestione")
      .select(`
        id,
        studio_id,
        cliente_id,
        cadenza_controllo,
        data_esecuzione,
        data_storico,
        archiviato,
        controllo_precedente_id,
        step_1_completato,
        step_1_note,
        step_2_completato,
        step_2_note,
        step_3_completato,
        step_3_note,
        step_4_completato,
        step_4_note,
        created_at
      `)
      .eq("cliente_id", cliente_id);

    if (controlliError) {
      throw controlliError;
    }

    const controlloIds =
      (controlli || []).map(
        (controllo: any) =>
          controllo.id
      );

    if (controlloIds.length === 0) {
      return res.status(200).json({
        success: true,
        cliente,
        anno,
        periodi: [],
      });
    }

    /*
     * 3. IMPORT DELL'ANNO
     */
    const {
      data: imports,
      error: importsError,
    } = await supabaseAdmin
      .from(
        "tbcontrollo_gestione_import"
      )
      .select(`
        id,
        controllo_id,
        software_contabile,
        data_riferimento,
        numero_conti,
        conti_mappati,
        conti_da_mappare,
        stato,
        created_at
      `)
      .in(
        "controllo_id",
        controlloIds
      )
      .gte(
        "data_riferimento",
        `${anno}-01-01`
      )
      .lte(
        "data_riferimento",
        `${anno}-12-31`
      )
      .order(
        "data_riferimento",
        {
          ascending: true,
        }
      );

    if (importsError) {
      throw importsError;
    }

    const importIds =
      (imports || []).map(
        (item: any) => item.id
      );

    /*
     * 4. INDICI
     */
    const {
      data: indici,
      error: indiciError,
    } = await supabaseAdmin
      .from(
        "tbcontrollo_gestione_indici"
      )
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
      .in(
        "controllo_gestione_id",
        controlloIds
      );

    if (indiciError) {
      throw indiciError;
    }

    /*
     * 5. INTEGRAZIONI
     */
    let integrazioni: any[] = [];

    if (importIds.length > 0) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "tbcontrollo_gestione_integrazioni"
        )
        .select(`
          id,
          controllo_id,
          import_id,
          debiti_finanziari_bt,
          debiti_finanziari_mlt,
          rate_finanziarie_12_mesi,
          cash_flow_operativo_previsionale,
          note
        `)
        .in(
          "import_id",
          importIds
        );

      if (error) {
        throw error;
      }

      integrazioni =
        data || [];
    }

    /*
     * 6. MAPPE
     */
    const controlliMap =
      new Map(
        (controlli || []).map(
          (item: any) => [
            item.id,
            item,
          ]
        )
      );

    const indiciMap =
      new Map(
        (indici || []).map(
          (item: any) => [
            item.controllo_gestione_id,
            item,
          ]
        )
      );

    const integrazioniMap =
      new Map(
        integrazioni.map(
          (item: any) => [
            item.import_id,
            item,
          ]
        )
      );

    /*
     * 7. PERIODI
     */
    const periodi =
      (imports || []).map(
        (importRecord: any) => {
          const controllo =
            controlliMap.get(
              importRecord.controllo_id
            ) || null;

          const indice =
            indiciMap.get(
              importRecord.controllo_id
            ) || null;

          const integrazione =
            integrazioniMap.get(
              importRecord.id
            ) || null;

          return {
            controllo,
            import:
              importRecord,
            indici:
              indice,
            integrazione,
          };
        }
      );

    return res.status(200).json({
      success: true,
      cliente,
      anno,
      periodi,
    });
  } catch (error: any) {
    console.error(
      "Errore API analisi periodi:",
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
