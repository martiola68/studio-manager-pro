// src/pages/api/admin/reset-password.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { generateSecurePassword } from "@/lib/passwordGenerator";
import { getPasswordResetEmailTemplate } from "@/lib/emailTemplates";
import { sendEmailServer } from "@/services/sendEmailServer";
import {
  AUTOMATIC_ALERT_FROM_MAILBOX,
  AUTOMATIC_ALERT_OWNER_EMAIL,
  resolveAutomaticMicrosoftAlertSender,
} from "@/services/automaticMicrosoftAlertSender";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Ok = {
  success: true;
  message: string;
  emailSent: true;
  sender: string;
  microsoftOwner: string;
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

    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from("tbutenti")
      .select("studio_id")
      .eq("id", userId)
      .single();

    if (targetUserError || !targetUser?.studio_id) {
      return res.status(400).json({
        success: false,
        message: "Studio dell'utente non determinato",
        details: targetUserError?.message,
      });
    }

    const tempPassword = generateSecurePassword();

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });

    if (updateError) {
      return res.status(500).json({
        success: false,
        message: "Errore aggiornamento password",
        details: updateError.message,
      });
    }

    const loginUrl = "https://app.studiomanagerpro.it/login";
    const displayName = (nome && String(nome).trim()) || "Utente";
    const html = getPasswordResetEmailTemplate(displayName, email, tempPassword, loginUrl);

    // Tutte le email di sistema devono usare esclusivamente il mailbox Microsoft noreply
    // legato alla connessione/token di m.artiola. Nessuna scelta dell'ultimo token dello studio.
    const sender = await resolveAutomaticMicrosoftAlertSender(
      supabaseAdmin,
      targetUser.studio_id
    );

    const sendRes = await sendEmailServer({
      senderUserId: sender.senderUserId,
      microsoftConnectionId: sender.microsoftConnectionId,
      fromMailbox: sender.fromMailbox,
      to: String(email).trim(),
      subject: "Password Reset - Studio Manager Pro",
      html,
    });

    if (!sendRes.success) {
      return res.status(502).json({
        success: false,
        message: "Password aggiornata ma invio email Microsoft 365 fallito",
        details: sendRes.error,
        emailSent: false,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password resettata e email Microsoft 365 accettata per l'invio",
      emailSent: true,
      sender: AUTOMATIC_ALERT_FROM_MAILBOX,
      microsoftOwner: AUTOMATIC_ALERT_OWNER_EMAIL,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Errore interno server",
    });
  }
}
