import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email obbligatoria" });
    }

    // Verifica che il richiedente sia autenticato e sia Admin
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Sessione non valida" });
    }

    // Verifica che l'utente sia Admin
    const { data: utente } = await supabaseAdmin
      .from("tbutenti")
      .select("tipo_utente")
      .eq("email", user.email)
      .single();

    if (!utente || utente.tipo_utente !== "Admin") {
      return res.status(403).json({ error: "Solo gli amministratori possono resettare le password" });
    }

    // Invia email di reset password
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/callback`
      }
    );

    if (resetError) {
      console.error("Errore reset password:", resetError);
      return res.status(400).json({ 
        error: "Errore durante l'invio dell'email di reset", 
        details: resetError.message 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: "Email di reset password inviata con successo" 
    });

  } catch (error) {
    console.error("Errore API reset-password:", error);
    return res.status(500).json({ 
      error: "Errore interno del server",
      details: error instanceof Error ? error.message : "Errore sconosciuto"
    });
  }
}