import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { generateSecurePassword, validatePassword } from "@/lib/passwordGenerator";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
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
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: adminUser },
      error: authUserError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authUserError || !adminUser?.email) {
      return res.status(401).json({
        error: "Sessione non valida",
        details: authUserError?.message || "Utente admin non disponibile",
      });
    }

    const { data: adminRow, error: adminRowError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, email, tipo_utente, studio_id")
      .eq("email", adminUser.email)
      .single();

    if (adminRowError || !adminRow) {
      return res.status(403).json({
        error: "Utente amministratore non trovato",
        details: adminRowError?.message || "Record admin assente in tbutenti",
      });
    }

    if (adminRow.tipo_utente !== "Admin") {
      return res.status(403).json({
        error: "Solo gli amministratori possono creare utenti",
      });
    }

    if (!adminRow.studio_id) {
      return res.status(400).json({
        error: "Studio non valorizzato per l'amministratore",
      });
    }

    const {
      email,
      nome,
      cognome,
      tipo_utente,
      ruolo_operatore_id,
      attivo,
      settore,
      responsabile,
      microsoft_connection_id,
    } = req.body;

    if (!email || !nome || !cognome) {
      return res.status(400).json({
        error: "Email, nome e cognome richiesti",
      });
    }

    const passwordGenerata = generateSecurePassword();

    if (!validatePassword(passwordGenerata)) {
      console.error("Password generata non valida:", passwordGenerata);
      return res.status(500).json({
        error: "Errore generazione password sicura",
      });
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: passwordGenerata,
        email_confirm: true,
        user_metadata: {
          nome,
          cognome,
        },
      });

    if (authError || !authData?.user?.id) {
      console.error("Errore creazione Auth:", authError);
      return res.status(400).json({
        error: "Errore creazione account",
        details: authError?.message || "Utente Auth non creato",
      });
    }

    const newUserId = authData.user.id;

    const payload = {
      id: newUserId,
      user_id: newUserId,
      studio_id: adminRow.studio_id,
      nome,
      cognome,
      email,
      tipo_utente: tipo_utente || "User",
      ruolo_operatore_id: ruolo_operatore_id || null,
      attivo: typeof attivo === "boolean" ? attivo : true,
      settore: settore || null,
      responsabile: typeof responsabile === "boolean" ? responsabile : false,
      microsoft_connection_id: microsoft_connection_id || null,
    };

  const { error: upsertError } = await supabaseAdmin
      .from("tbutenti")
      .upsert(payload, { onConflict: "id" });

    if (upsertError) {
      console.error("Errore aggiornamento/anagrafica tbutenti:", upsertError);
      return res.status(500).json({
        error: "Utente Auth creato ma anagrafica non aggiornata",
        details: upsertError.message,
      });
    }

    // Invio email di primo accesso / impostazione password
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/callback`
      }
    );

    if (resetError) {
      console.error("Errore invio email creazione utente:", resetError);
      return res.status(500).json({
        error: "Utente creato ma email non inviata",
        details: resetError.message,
      });
    }

    return res.status(200).json({
      success: true,
      userId: newUserId,
      email,
      message: "Utente creato ed email inviata con successo",
    });
  } catch (error: any) {
    console.error("Errore API create-user:", error);
    return res.status(500).json({
      error: "Errore interno del server",
      details: error.message,
    });
  }
}
