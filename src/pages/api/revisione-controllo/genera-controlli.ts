import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getScadenzaTrimestre(anno: number, trimestre: number) {
  if (trimestre === 1) return `${anno}-04-30`;
  if (trimestre === 2) return `${anno}-07-31`;
  if (trimestre === 3) return `${anno}-10-31`;
  return `${anno + 1}-01-31`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Metodo non consentito",
      });
    }

    const { incarico_id, anno } = req.body;

    if (!incarico_id) {
      return res.status(400).json({
        success: false,
        error: "incarico_id obbligatorio",
      });
    }

    const annoControllo = Number(anno || new Date().getFullYear());

    const { data: incarico, error: incaricoError } = await supabaseAdmin
      .from("tbrevisione_incarichi")
      .select("id, data_inizio, data_fine, attivo")
      .eq("id", incarico_id)
      .single();

    if (incaricoError) throw incaricoError;

    if (!incarico?.attivo) {
      return res.status(400).json({
        success: false,
        error: "Incarico non attivo",
      });
    }

    const rows = [1, 2, 3, 4].map((trimestre) => ({
      incarico_id,
      anno: annoControllo,
      trimestre,
      data_scadenza: getScadenzaTrimestre(annoControllo, trimestre),
      stato: "DA_FARE",
    }));

    const { data, error } = await supabaseAdmin
      .from("tbrevisione_controlli")
      .upsert(rows, {
        onConflict: "incarico_id,anno,trimestre",
        ignoreDuplicates: true,
      })
      .select("*");

    if (error) throw error;

    return res.status(200).json({
      success: true,
      inserted: data?.length || 0,
      data: data || [],
    });
  } catch (error: any) {
    console.error("Errore genera-controlli revisione:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore generazione controlli",
    });
  }
}
