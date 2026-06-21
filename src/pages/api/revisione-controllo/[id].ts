import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;

    if (typeof id !== "string" || !id) {
      return res.status(400).json({
        success: false,
        error: "ID incarico non valido",
      });
    }

    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("vw_revisione_incarichi")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data,
      });
    }

    if (req.method === "PUT") {
      const {
        tipo_incarico,
        data_nomina,
        data_inizio,
        data_fine,
        responsabile_id,
        attivo,
        note,
      } = req.body;

      const { data, error } = await supabaseAdmin
        .from("tbrevisione_incarichi")
        .update({
          tipo_incarico,
          data_nomina: data_nomina || null,
          data_inizio,
          data_fine: data_fine || null,
          responsabile_id: responsabile_id || null,
          attivo: typeof attivo === "boolean" ? attivo : true,
          note: note || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data,
      });
    }

    if (req.method === "DELETE") {
      const { error } = await supabaseAdmin
        .from("tbrevisione_incarichi")
        .delete()
        .eq("id", id);

      if (error) throw error;

      return res.status(200).json({
        success: true,
      });
    }

    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  } catch (error: any) {
    console.error("Errore API revisione-controllo/[id]:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno server",
    });
  }
}
