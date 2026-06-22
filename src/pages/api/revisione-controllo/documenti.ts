import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const { studio_id, controllo_id, relazione_id } = req.query;

      let query = supabaseAdmin
        .from("tbrevisione_documenti")
        .select("*")
        .order("generato_at", { ascending: false });

      if (typeof studio_id === "string" && studio_id) {
        query = query.eq("studio_id", studio_id);
      }

      if (typeof controllo_id === "string" && controllo_id) {
        query = query.eq("controllo_id", controllo_id);
      }

      if (typeof relazione_id === "string" && relazione_id) {
        query = query.eq("relazione_id", relazione_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: data || [],
      });
    }

    if (req.method === "POST") {
      const {
        studio_id,
        controllo_id,
        relazione_id,
        nome_file,
        tipo_file,
        testo_documento,
        generato_da,
      } = req.body;

      if (!studio_id) throw new Error("studio_id obbligatorio");
      if (!controllo_id) throw new Error("controllo_id obbligatorio");
      if (!nome_file) throw new Error("nome_file obbligatorio");
      if (!tipo_file) throw new Error("tipo_file obbligatorio");

      const { data, error } = await supabaseAdmin
        .from("tbrevisione_documenti")
        .insert({
          studio_id,
          controllo_id,
          relazione_id: relazione_id || null,
          nome_file,
          tipo_file,
          testo_documento: testo_documento || null,
          generato_da: generato_da || null,
          generato_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (error) throw error;

      return res.status(201).json({
        success: true,
        data,
      });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;

      if (typeof id !== "string" || !id) {
        return res.status(400).json({
          success: false,
          error: "ID documento obbligatorio",
        });
      }

      const { error } = await supabaseAdmin
        .from("tbrevisione_documenti")
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
    console.error("Errore API revisione-controllo/documenti:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno server",
    });
  }
}
