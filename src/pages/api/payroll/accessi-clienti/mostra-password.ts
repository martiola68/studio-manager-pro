import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { decriptaPassword } from "@/lib/accessiClientiCrypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { accesso_id } = req.body;

    if (!accesso_id) {
      return res.status(400).json({ error: "Accesso mancante" });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("tbclienti_accessi_pubblici")
      .select("id, password_criptata")
      .eq("id", accesso_id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Accesso non trovato" });
    }

    if (!data.password_criptata) {
      return res.status(400).json({
        error: "Password non recuperabile. Reimpostare la password.",
      });
    }

    const password = decriptaPassword(data.password_criptata);

    return res.status(200).json({ password });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Errore durante recupero password",
    });
  }
}
