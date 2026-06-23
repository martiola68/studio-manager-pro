import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const { studio_id } = req.query;

      if (typeof studio_id !== "string" || !studio_id) {
        return res.status(400).json({
          success: false,
          error: "studio_id obbligatorio",
        });
      }

      const { data, error } = await supabaseAdmin
        .from("vw_controllo_gestione_corrente")
        .select("*")
        .eq("studio_id", studio_id)
        .order("ragione_sociale", { ascending: true });

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: data || [],
      });
    }

    if (req.method === "POST") {
      const {
        studio_id,
        cliente_id,
        controllo_gestione_id,
        form,
        risultati,
        origine = "xbrl",
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
          error: "cliente_id obbligatorio per salvare l'analisi",
        });
      }

      const { data: controllo, error: controlloError } = await supabaseAdmin
        .from("tbcontrollo_gestione")
        .select("id")
        .eq("studio_id", studio_id)
        .eq("cliente_id", cliente_id)
        .eq("archiviato", false)
        .maybeSingle();

      if (controlloError) throw controlloError;

      if (!controllo && !controllo_gestione_id) {
        return res.status(400).json({
          success: false,
          error:
            "Nessun controllo di gestione attivo trovato per questo cliente",
        });
      }

      const payload = {
        studio_id,
        cliente_id,
        controllo_gestione_id: controllo_gestione_id || controllo?.id || null,

        anno: form?.anno ? Number(form.anno) : null,
        societa: form?.societa || null,
        codice_fiscale: form?.codice_fiscale || null,

        ricavi: form?.ricavi || 0,
        costi_operativi: form?.costi_operativi || 0,
        ammortamenti: form?.ammortamenti || 0,
        accantonamenti: form?.accantonamenti || 0,
        oneri_finanziari: form?.oneri_finanziari || 0,
        imposte: form?.imposte || 0,
        utile_netto: form?.utile_netto || 0,

        totale_attivo: form?.totale_attivo || 0,
        capitale_investito: form?.capitale_investito || 0,
        patrimonio_netto: form?.patrimonio_netto || 0,
        debiti_totali: form?.debiti_totali || 0,
        attivo_corrente: form?.attivo_corrente || 0,
        passivo_corrente: form?.passivo_corrente || 0,

        cash_flow_operativo: form?.cash_flow_operativo || 0,
        rate_finanziarie_annue: form?.rate_finanziarie_annue || 0,

        ebitda: risultati?.ebitda || 0,
        ebit: risultati?.ebit || 0,
        ebt: risultati?.ebt || 0,

        roi: risultati?.roi || 0,
        roe: risultati?.roe || 0,
        ros: risultati?.ros || 0,
        roa: risultati?.roa || 0,

        indebitamento: risultati?.indebitamento || 0,
        liquidita: risultati?.liquidita || 0,
        dscr: risultati?.dscr || 0,

        origine,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabaseAdmin
        .from("tbcontrollo_gestione_indici")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;

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
    console.error("Errore API controllo-gestione/indici:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno server",
    });
  }
}
