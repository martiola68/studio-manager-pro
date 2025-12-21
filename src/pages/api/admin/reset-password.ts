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

// Genera password sicura temporanea
function generateSecurePassword(): string {
  const length = 16;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  
  // Assicura almeno: 1 maiuscola, 1 minuscola, 1 numero, 1 speciale
  password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
  password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
  password += "0123456789"[Math.floor(Math.random() * 10)];
  password += "!@#$%^&*"[Math.floor(Math.random() * 8)];
  
  // Riempi il resto
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Mescola i caratteri
  return password.split("").sort(() => Math.random() - 0.5).join("");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Solo POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId, userEmail } = req.body;

    if (!userId || !userEmail) {
      return res.status(400).json({ error: "userId e userEmail richiesti" });
    }

    // Genera password temporanea
    const tempPassword = generateSecurePassword();

    // Aggiorna password usando Admin API
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: tempPassword }
    );

    if (error) {
      console.error("Errore reset password:", error);
      return res.status(500).json({ 
        error: "Errore durante il reset della password",
        details: error.message 
      });
    }

    // Successo!
    return res.status(200).json({
      success: true,
      tempPassword,
      message: "Password resettata con successo"
    });

  } catch (error: any) {
    console.error("Errore API reset password:", error);
    return res.status(500).json({ 
      error: "Errore interno del server",
      details: error.message 
    });
  }
}