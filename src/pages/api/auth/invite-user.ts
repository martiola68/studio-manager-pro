import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// Supabase Admin Client (usa Service Role Key per operazioni privilegiate)
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
    const { email, nome, cognome } = req.body;

    if (!email || !nome || !cognome) {
      return res.status(400).json({ error: "Email, nome e cognome sono obbligatori" });
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
      return res.status(403).json({ error: "Solo gli amministratori possono invitare utenti" });
    }

    // Crea l'utente su Supabase Auth con email di invito
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          nome,
          cognome,
          invited_by: user.email
        },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/callback`
      }
    );

    if (createError) {
      console.error("Errore creazione utente Supabase:", createError);
      return res.status(400).json({ 
        error: "Errore durante la creazione dell'account", 
        details: createError.message 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: "Invito inviato con successo",
      user: newUser 
    });

  } catch (error) {
    console.error("Errore API invite-user:", error);
    return res.status(500).json({ 
      error: "Errore interno del server",
      details: error instanceof Error ? error.message : "Errore sconosciuto"
    });
  }
}