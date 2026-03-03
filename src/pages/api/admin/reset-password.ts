import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { generateSecurePassword } from "@/lib/passwordGenerator";
import { sendPasswordResetEmail } from "@/services/emailService";

// ⚠️ USA SERVICE ROLE KEY (server-side only)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // NON ANON KEY
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({
        success: false,
        message: "userId ed email obbligatori",
      });
    }

    // 1️⃣ Genera nuova password temporanea
    const tempPassword = generateSecurePassword();

    // 2️⃣ Aggiorna password tramite admin API
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: tempPassword,
      });

    if (updateError) {
      console.error("Errore update password:", updateError);
      return res.status(500).json({
        success: false,
        message: "Errore aggiornamento password",
      });
    }

    // 3️⃣ Prova invio email
    let emailSent = false;
    let emailError: string | null = null;

    try {
      await sendPasswordResetEmail(email, tempPassword);
      emailSent = true;
    } catch (e: any) {
      console.error("Errore invio email:", e);
      emailError = e?.message || String(e);
    }

    return res.status(200).json({
      success: true,
      tempPassword,
      message: "Password resettata con successo",
      emailSent,
      emailError,
    });
  } catch (error: any) {
    console.error("RESET PASSWORD ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Errore interno server",
    });
  }
}
