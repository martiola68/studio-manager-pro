import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const { incarico_id } = req.query;

      if (typeof incarico_id !== "string" || !incarico_id) {
        return res.status(400).json({
          success: false,
          error: "incarico_id obbligatorio",
        });
      }

      const { data, error } = await supabaseAdmin
        .from("tbrevisione_soggetti")
        .select("*")
        .eq("incarico_id", incarico_id)
        .order("ruolo", { ascending: true })
        .order("nome", { ascending: true });

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: data || [],
      });
    }

    if (req.method === "POST") {
      const { incarico_id, soggetti } = req.body;

      if (!incarico_id) {
        return res.status(400).json({
          success: false,
          error: "incarico_id obbligatorio",
        });
      }

      if (!Array.isArray(soggetti)) {
        return res.status(400).json({
          success: false,
          error: "soggetti deve essere un array",
        });
      }

      const { error: deleteError } = await supabaseAdmin
        .from("tbrevisione_soggetti")
        .delete()
        .eq("incarico_id", incarico_id);

      if (deleteError) throw deleteError;

      const rows = soggetti
        .filter((s: any) => s.nome && s.ruolo)
        .map((s: any) => ({
          incarico_id,
          nominativo_id: s.nominativo_id || null,
          nome: s.nome,
          codice_fiscale: s.codice_fiscale || null,
          email: s.email || null,
          ruolo: s.ruolo,
          principale: Boolean(s.principale),
          attivo: s.attivo !== false,
        }));

      if (rows.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
        });
      }

      const { data, error } = await supabaseAdmin
        .from("tbrevisione_soggetti")
        .insert(rows)
        .select("*");

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: data || [],
      });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;

      if (typeof id !== "string" || !id) {
        return res.status(400).json({
          success: false,
          error: "ID soggetto obbligatorio",
        });
      }

      const { error } = await supabaseAdmin
        .from("tbrevisione_soggetti")
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
    console.error("Errore API revisione-controllo/soggetti:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno server",
    });
  }
}
