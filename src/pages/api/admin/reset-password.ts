// src/pages/api/admin/reset-password.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { generateSecurePassword } from "@/lib/passwordGenerator";
import { sendPasswordResetEmail } from "@/services/emailService";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Ok = {
  success: true;
  message: string;
  emailSent: true;
};

type Err = {
  success: false;
  message: string;
  details?: string;
  emailSent?: false;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { userId, email, nome } = req.body ?? {};

    if (!userId || !email) {
      return res.status(400).json({ success: false, message: "userId ed email obbligatori" });
    }

    // 1) Genera nuova password
    const tempPassword = generateSecurePassword();

    // 2) Aggiorna password via Admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });

    if (updateError) {
      console.error("[reset-password] updateUserById error:", updateError);
      return res.status(500).json({
        success: false,
        message: "Errore aggiornamento password",
        details: updateError.message,
      });
    }

    // 3) Invia email (SE FALLISCE -> ERRORE)
    try {
      await sendPasswordResetEmail(nome || "Utente", email, tempPassword);
    } catch (e: any) {
      console.error("[reset-password] sendPasswordResetEmail error:", e);
      // opzionale: qui potresti decidere di fare rollback della password, ma non è banale/utile.
      return res.status(502).json({
        success: false,
        message: "Password aggiornata ma invio email fallito",
        details: e?.message || String(e),
        emailSent: false,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password resettata e email inviata con successo",
      emailSent: true,
    });
  } catch (error: any) {
    console.error("[reset-password] fatal:", error);
    return res.status(500).json({ success: false, message: error?.message || "Errore interno server" });
  }
}
