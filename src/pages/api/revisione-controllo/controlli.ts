import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const { studio_id, anno, trimestre, stato, cliente_id } = req.query;

      let query = supabaseAdmin
        .from("vw_revisione_controlli")
        .select("*")
        .order("data_scadenza", { ascending: true });

      if (typeof studio_id === "string" && studio_id) {
        query = query.eq("studio_id", studio_id);
      }

      if (typeof cliente_id === "string" && cliente_id) {
        query = query.eq("cliente_id", cliente_id);
      }

      if (typeof anno === "string" && anno) {
        query = query.eq("anno", Number(anno));
      }

      if (typeof trimestre === "string" && trimestre) {
        query = query.eq("trimestre", Number(trimestre));
      }

      if (typeof stato === "string" && stato) {
        query = query.eq("stato", stato);
      }

      const { data, error } = await query;

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: data || [],
      });
    }

    if (req.method === "PUT") {
      const {
        id,
        stato,
        data_controllo,
        esito,
        note,
        completato_da,
      } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: "ID controllo obbligatorio",
        });
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (stato) updateData.stato = stato;
      if (typeof esito !== "undefined") updateData.esito = esito || null;
      if (typeof note !== "undefined") updateData.note = note || null;
      if (typeof data_controllo !== "undefined") {
        updateData.data_controllo = data_controllo || null;
      }

      if (stato === "COMPLETATO") {
        updateData.completato_da = completato_da || null;
        updateData.completato_at = new Date().toISOString();

        if (!updateData.data_controllo) {
          updateData.data_controllo = new Date().toISOString().slice(0, 10);
        }
      }

      const { data, error } = await supabaseAdmin
        .from("tbrevisione_controlli")
        .update(updateData)
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
      const { id } = req.query;

      if (typeof id !== "string" || !id) {
        return res.status(400).json({
          success: false,
          error: "ID controllo obbligatorio",
        });
      }

      const { error } = await supabaseAdmin
        .from("tbrevisione_controlli")
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
    console.error("Errore API revisione-controllo/controlli:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno server",
    });
  }
}
