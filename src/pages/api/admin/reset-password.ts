// src/pages/api/admin/reset-password.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { generateSecurePassword } from "@/lib/passwordGenerator";
import { getPasswordResetEmailTemplate } from "@/lib/emailTemplates";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
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

// Config mittente (deve essere dominio verificato su Resend)
const FROM = `"Studio Manager Pro" <alert@revisionicommerciali.it>`;
// se vuoi usare noreply, metti:
// const FROM = `"Studio Manager Pro" <noreply@revisionicommerciali.it>`;

async function sendViaResend(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY non configurata (env var mancante)" };

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  const json: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    return { ok: false, error: json?.message || `Resend error (${r.status})` };
  }

  return { ok: true, id: json?.id || "" };
}

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

    // 3) Prepara contenuti email
    const loginUrl = "https://studio-manager-pro.vercel.app/login";
    const displayName = (nome && String(nome).trim()) || "Utente";

    const html = getPasswordResetEmailTemplate(displayName, email, tempPassword, loginUrl);

    const text = `
Password Reset - Studio Manager Pro

Ciao ${displayName},

La tua password è stata resettata dall'amministratore.

📧 Email: ${email}
🔐 Nuova Password: ${tempPassword}

Accedi al sistema:
${loginUrl}

---
Studio Manager Pro
Questa è una email automatica, non rispondere.
    `.trim();

    // 4) Invia email (SE FALLISCE -> ERRORE)
    const sendRes = await sendViaResend({
      to: email,
      subject: "Password Reset - Studio Manager Pro",
      html,
      text,
    });

    if (!sendRes.ok) {
      console.error("[reset-password] resend error:", sendRes.error);
      return res.status(502).json({
        success: false,
        message: "Password aggiornata ma invio email fallito",
        details: sendRes.error,
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
    return res.status(500).json({
      success: false,
      message: error?.message || "Errore interno server",
    });
  }
}
