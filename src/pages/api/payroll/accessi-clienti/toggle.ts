import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { accesso_id, attivo } = req.body;

    if (!accesso_id) {
      return res.status(400).json({ error: "Accesso mancante" });
    }

    if (typeof attivo !== "boolean") {
      return res.status(400).json({ error: "Stato accesso non valido" });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("tbclienti_accessi_pubblici")
      .update({
        attivo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accesso_id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ accesso: data });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Errore durante aggiornamento stato accesso",
    });
  }
}
