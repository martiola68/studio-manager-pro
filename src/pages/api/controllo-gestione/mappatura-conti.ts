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
        software_contabile = "datev_koinos",
      } = req.query;

      if (typeof studio_id !== "string" || !studio_id) {
        return res.status(400).json({
          success: false,
          error: "studio_id obbligatorio",
        });
      }

      if (typeof cliente_id !== "string" || !cliente_id) {
        return res.status(400).json({
          success: false,
          error: "cliente_id obbligatorio",
        });
      }

      const { data, error } = await supabaseAdmin
        .from("tbcontrollo_gestione_mappatura_conti")
        .select(`
          id,
          studio_id,
          cliente_id,
          software_contabile,
          codice_conto,
          descrizione_conto,
          voce_id,
          moltiplicatore,
          escluso,
          origine,
          confermato,
          ultimo_utilizzo,
          created_at,
          updated_at,
          voce:tbcontrollo_gestione_voci (
            id,
            codice,
            descrizione,
            sezione,
            macrovoce,
            natura,
            ordine
          )
        `)
        .eq("studio_id", studio_id)
        .eq("cliente_id", cliente_id)
        .eq(
          "software_contabile",
          String(software_contabile || "datev_koinos")
        )
        .order("codice_conto", { ascending: true });

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
        software_contabile = "datev_koinos",
        codice_conto,
        descrizione_conto,
        voce_id,
        moltiplicatore = 1,
        escluso = false,
        confermato = true,
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

      if (!codice_conto) {
        return res.status(400).json({
          success: false,
          error: "codice_conto obbligatorio",
        });
      }

      if (!escluso && !voce_id) {
        return res.status(400).json({
          success: false,
          error:
            "Se il conto non è escluso devi indicare la voce di riclassificazione",
        });
      }

      const payload = {
        studio_id,
        cliente_id,
        software_contabile,
        codice_conto: String(codice_conto).trim(),
        descrizione_conto:
          descrizione_conto != null
            ? String(descrizione_conto).trim()
            : null,

        voce_id: escluso ? null : voce_id,

        moltiplicatore: Number(moltiplicatore || 1),

        escluso: Boolean(escluso),

        origine: "manuale",

        confermato: Boolean(confermato),

        ultimo_utilizzo: new Date().toISOString(),

        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabaseAdmin
        .from("tbcontrollo_gestione_mappatura_conti")
        .upsert(payload, {
          onConflict:
            "studio_id,cliente_id,software_contabile,codice_conto",
        })
        .select(`
          *,
          voce:tbcontrollo_gestione_voci (
            id,
            codice,
            descrizione,
            sezione,
            macrovoce,
            natura,
            ordine
          )
        `)
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
    console.error(
      "Errore API controllo-gestione/mappatura-conti:",
      error
    );

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno server",
    });
  }
}
