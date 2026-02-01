import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { generateSecurePassword, validatePassword } from "@/lib/passwordGenerator";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, nome, cognome } = req.body;

    if (!email || !nome || !cognome) {
      return res.status(400).json({ error: "Email, nome e cognome richiesti" });
    }

    const passwordGenerata = generateSecurePassword();

    if (!validatePassword(passwordGenerata)) {
      console.error("Password generata non valida:", passwordGenerata);
      return res.status(500).json({ error: "Errore generazione password sicura" });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: passwordGenerata,
      email_confirm: true,
      user_metadata: {
        nome,
        cognome
      }
    });

    if (authError) {
      console.error("Errore creazione Auth:", authError);
      return res.status(400).json({ 
        error: "Errore creazione account", 
        details: authError.message 
      });
    }

    return res.status(200).json({
      success: true,
      userId: authData.user.id,
      password: passwordGenerata,
      email: authData.user.email
    });

  } catch (error: any) {
    console.error("Errore API create-user:", error);
    return res.status(500).json({ 
      error: "Errore interno del server",
      details: error.message
    });
  }
}