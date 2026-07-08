import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { accesso_id, email_accesso } = req.body || {};

    if (!accesso_id) {
      return res.status(400).json({
        success: false,
        error: "ID accesso mancante",
      });
    }

    if (!email_accesso || !String(email_accesso).trim()) {
      return res.status(400).json({
        success: false,
        error: "Email accesso obbligatoria",
      });
    }

    const emailPulita = String(email_accesso).trim().toLowerCase();

    const { error } = await supabase
      .from("tbaccessi_clienti")
      .update({
        email_accesso: emailPulita,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accesso_id);

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      email_accesso: emailPulita,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore modifica email accesso",
    });
  }
}
