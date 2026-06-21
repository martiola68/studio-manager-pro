import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const { studio_id, attivo } = req.query;

      let query = supabaseAdmin
        .from("tbrevisione_modelli")
        .select("*")
        .order("titolo", { ascending: true });

      if (typeof studio_id === "string" && studio_id) {
        query = query.eq("studio_id", studio_id);
      }

      if (typeof attivo === "string") {
        query = query.eq("attivo", attivo === "true");
      }

      const { data, error } = await query;
      if (error) throw error;

      return res.status(200).json({ success: true, data: data || [] });
    }

    if (req.method === "POST") {
      const {
        id,
        studio_id,
        codice,
        titolo,
        tipo_incarico,
        testo,
        attivo,
      } = req.body;

      if (!studio_id) throw new Error("studio_id obbligatorio");
      if (!codice) throw new Error("Codice modello obbligatorio");
      if (!titolo) throw new Error("Titolo modello obbligatorio");
      if (!testo) throw new Error("Testo modello obbligatorio");

      if (id) {
        const { data, error } = await supabaseAdmin
          .from("tbrevisione_modelli")
          .update({
            codice,
            titolo,
            tipo_incarico: tipo_incarico || null,
            testo,
            attivo: attivo !== false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("*")
          .single();

        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      const { data, error } = await supabaseAdmin
        .from("tbrevisione_modelli")
        .insert({
          studio_id,
          codice,
          titolo,
          tipo_incarico: tipo_incarico || null,
          categoria: "revisione_controllo",
          testo,
          attivo: attivo !== false,
        })
        .select("*")
        .single();

      if (error) throw error;

      return res.status(201).json({ success: true, data });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;

      if (typeof id !== "string" || !id) {
        return res.status(400).json({
          success: false,
          error: "ID modello obbligatorio",
        });
      }

      const { error } = await supabaseAdmin
        .from("tbrevisione_modelli")
        .delete()
        .eq("id", id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  } catch (error: any) {
    console.error("Errore API modelli revisione:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno server",
    });
  }
}
