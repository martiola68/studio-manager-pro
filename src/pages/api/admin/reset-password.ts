import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { generateSecurePassword, validatePassword } from "@/lib/passwordGenerator";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = supabaseUrl && serviceRoleKey ? createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
) : null;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ 
      error: "Configurazione server non valida",
      details: "Service Role Key mancante o non valida"
    });
  }

  try {
    const { userId, userEmail } = req.body;

    if (!userId || !userEmail) {
      return res.status(400).json({ error: "userId e userEmail richiesti" });
    }

    const nuovaPassword = generateSecurePassword();

    if (!validatePassword(nuovaPassword)) {
      console.error("Password generata non valida:", nuovaPassword);
      return res.status(500).json({ error: "Errore generazione password sicura" });
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: nuovaPassword }
    );

    if (error) {
      console.error("Errore Supabase Admin:", error);
      return res.status(500).json({ 
        error: "Errore durante il reset della password",
        details: error.message,
        code: error.code
      });
    }

    return res.status(200).json({
      success: true,
      tempPassword: nuovaPassword,
      message: "Password resettata con successo"
    });

  } catch (error: any) {
    console.error("Errore API reset password:", error);
    return res.status(500).json({ 
      error: "Errore interno del server",
      details: error.message,
      name: error.name
    });
  }
}