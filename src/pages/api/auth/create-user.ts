import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// Admin client con Service Role Key (solo backend!)
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

// Genera password sicura
function generateSecurePassword(): string {
  const length = 16;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  
  password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
  password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
  password += "0123456789"[Math.floor(Math.random() * 10)];
  password += "!@#$%^&*"[Math.floor(Math.random() * 8)];
  
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  return password.split("").sort(() => Math.random() - 0.5).join("");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, password, nome, cognome, useAutoPassword } = req.body;

    if (!email || !nome || !cognome) {
      return res.status(400).json({ error: "Email, nome e cognome richiesti" });
    }

    // Determina password da usare
    const passwordToUse = useAutoPassword ? generateSecurePassword() : password;

    if (!passwordToUse || passwordToUse.length < 8) {
      return res.status(400).json({ error: "Password deve essere almeno 8 caratteri" });
    }

    // Crea utente in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: passwordToUse,
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

    // Restituisci i dati
    return res.status(200).json({
      success: true,
      userId: authData.user.id,
      password: passwordToUse,
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