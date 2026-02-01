import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { generateSecurePassword, validatePassword } from "@/lib/passwordGenerator";
import { sendPasswordResetEmail } from "@/services/emailService";

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

    console.log("🔄 Reset password richiesto per:", { userId, userEmail });

    if (!userId || !userEmail) {
      return res.status(400).json({ error: "userId e userEmail richiesti" });
    }

    const { data: utente, error: selectError } = await supabaseAdmin
      .from("tbutenti")
      .select("nome, cognome, email")
      .eq("id", userId)
      .single();

    if (selectError || !utente) {
      console.error("❌ Errore recupero utente:", selectError);
      return res.status(404).json({ 
        error: "Utente non trovato",
        details: selectError?.message
      });
    }

    console.log("✅ Utente trovato:", { nome: utente.nome, email: utente.email });

    const nuovaPassword = generateSecurePassword();
    console.log("✅ Password generata");

    if (!validatePassword(nuovaPassword)) {
      console.error("❌ Password generata non valida:", nuovaPassword);
      return res.status(500).json({ error: "Errore generazione password sicura" });
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: nuovaPassword }
    );

    if (error) {
      console.error("❌ Errore Supabase Admin updateUserById:", error);
      return res.status(500).json({ 
        error: "Errore durante il reset della password",
        details: error.message,
        code: error.code
      });
    }

    console.log("✅ Password aggiornata in Supabase Auth");

    try {
      const nomeCompleto = `${utente.nome} ${utente.cognome || ""}`.trim();
      console.log("📧 Invio email a:", utente.email, "Nome:", nomeCompleto);
      
      const emailResult = await sendPasswordResetEmail(
        nomeCompleto,
        utente.email,
        nuovaPassword
      );

      if (emailResult.success) {
        console.log("✅ Email inviata con successo");
      } else {
        console.error("⚠️ Email non inviata:", emailResult.error);
      }

      return res.status(200).json({
        success: true,
        tempPassword: nuovaPassword,
        message: "Password resettata con successo",
        emailSent: emailResult.success,
        emailError: emailResult.error
      });

    } catch (emailError: any) {
      console.error("💥 Errore invio email:", emailError);
      
      return res.status(200).json({
        success: true,
        tempPassword: nuovaPassword,
        message: "Password resettata, ma email non inviata",
        emailSent: false,
        emailError: emailError.message
      });
    }

  } catch (error: any) {
    console.error("💥 Errore API reset password:", error);
    return res.status(500).json({ 
      error: "Errore interno del server",
      details: error.message,
      name: error.name
    });
  }
}