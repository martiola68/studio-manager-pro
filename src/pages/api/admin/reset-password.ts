import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// VERIFICA PRESENZA VARIABILI D'AMBIENTE
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Log per debug (rimuovere in produzione)
console.log("🔍 DEBUG API Reset Password:");
console.log("- Supabase URL presente:", !!supabaseUrl);
console.log("- Service Role Key presente:", !!serviceRoleKey);
console.log("- Service Role Key length:", serviceRoleKey?.length || 0);

// Verifica che le chiavi esistano
if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ ERRORE: Variabili d'ambiente mancanti!");
  console.error("- NEXT_PUBLIC_SUPABASE_URL:", !!supabaseUrl);
  console.error("- SUPABASE_SERVICE_ROLE_KEY:", !!serviceRoleKey);
}

// Admin client con Service Role Key (solo backend!)
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
  console.log("🔄 API Reset Password chiamata");
  console.log("- Method:", req.method);
  
  // Solo POST
  if (req.method !== "POST") {
    console.log("❌ Method non valido:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verifica che supabaseAdmin sia stato creato
  if (!supabaseAdmin) {
    console.error("❌ ERRORE CRITICO: supabaseAdmin non inizializzato!");
    console.error("Variabili d'ambiente:");
    console.error("- NEXT_PUBLIC_SUPABASE_URL:", !!supabaseUrl);
    console.error("- SUPABASE_SERVICE_ROLE_KEY:", !!serviceRoleKey);
    
    return res.status(500).json({ 
      error: "Configurazione server non valida",
      details: "Service Role Key mancante o non valida"
    });
  }

  try {
    const { userId, userEmail } = req.body;
    console.log("📝 Dati ricevuti:");
    console.log("- userId:", userId);
    console.log("- userEmail:", userEmail);

    if (!userId || !userEmail) {
      console.log("❌ Dati mancanti");
      return res.status(400).json({ error: "userId e userEmail richiesti" });
    }

    // Genera password temporanea
    const tempPassword = generateSecurePassword();
    console.log("🔑 Password generata, lunghezza:", tempPassword.length);

    // Aggiorna password usando Admin API
    console.log("🔄 Chiamata Supabase Admin API...");
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: tempPassword }
    );

    if (error) {
      console.error("❌ Errore Supabase Admin:", error);
      console.error("- Codice errore:", error.code);
      console.error("- Messaggio:", error.message);
      console.error("- Status:", error.status);
      
      return res.status(500).json({ 
        error: "Errore durante il reset della password",
        details: error.message,
        code: error.code
      });
    }

    console.log("✅ Password aggiornata con successo!");
    console.log("- User data:", data?.user?.email);

    // Successo!
    return res.status(200).json({
      success: true,
      tempPassword,
      message: "Password resettata con successo"
    });

  } catch (error: any) {
    console.error("❌ Errore API reset password:", error);
    console.error("- Nome:", error.name);
    console.error("- Messaggio:", error.message);
    console.error("- Stack:", error.stack);
    
    return res.status(500).json({ 
      error: "Errore interno del server",
      details: error.message,
      name: error.name
    });
  }
}