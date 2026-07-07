import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const supabase = getSupabaseAdmin();

   const { data: clienti, error: clientiError } = await supabase
  .from("tbclienti")
  .select(`
    id,
    studio_id,
    ragione_sociale,
    email,
    pec,
    utente_payroll_id,
    attivo,
    settore_lavoro
  `)
  .eq("attivo", true)
  .eq("settore_lavoro", true)
  .order("ragione_sociale", { ascending: true });

    if (clientiError) {
      return res.status(500).json({ error: clientiError.message });
    }

    const { data: accessi, error: accessiError } = await supabase
      .from("tbclienti_accessi_pubblici")
      .select("*");

    if (accessiError) {
      return res.status(500).json({ error: accessiError.message });
    }

    return res.status(200).json({
      clienti: clienti || [],
      accessi: accessi || [],
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Errore durante il caricamento accessi clienti",
    });
  }
}
