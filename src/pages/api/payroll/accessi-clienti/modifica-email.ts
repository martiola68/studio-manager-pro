import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { criptaPassword } from "@/lib/accessiClientiCrypto";

function generaPassword() {
  return crypto
    .randomBytes(6)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10);
}

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

    const password = generaPassword();
    const password_hash = await bcrypt.hash(password, 10);
    const password_criptata = criptaPassword(password);

  const { data, error } = await supabase
  .from("tbclienti_accessi_pubblici")
  .update({
    email_accesso: emailPulita,
    password_hash,
    password_criptata,
    attivo: true,
    updated_at: new Date().toISOString(),
  })
  .eq("id", accesso_id)
  .select()
  .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

   return res.status(200).json({
  success: true,
  accesso: data,
  email_accesso: emailPulita,
  password_generata: password,
});
    
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore modifica email accesso",
    });
  }
}
