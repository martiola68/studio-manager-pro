// src/services/emailServiceServer.ts
import { Resend } from "resend";
import { getPasswordResetEmailTemplate } from "@/lib/emailTemplates";

type SendResult = { success: true; id: string } | { success: false; error: string };

const resend = new Resend(process.env.RESEND_API_KEY!);

const FROM = `"Studio Manager Pro" <noreply@revisionicommerciali.it>`; // oppure alert@...

export async function sendPasswordResetEmailServer(
  nome: string,
  email: string,
  password: string
): Promise<SendResult> {
  try {
    if (!process.env.RESEND_API_KEY) {
      return { success: false, error: "Missing RESEND_API_KEY env var" };
    }

    const loginUrl = "https://studio-manager-pro.vercel.app/login";
    const html = getPasswordResetEmailTemplate(nome, email, password, loginUrl);

    const text = `
Password Reset - Studio Manager Pro

Ciao ${nome},

La tua password è stata resettata dall'amministratore.

📧 Email: ${email}
🔐 Nuova Password: ${password}

Accedi al sistema: ${loginUrl}

---
Studio Manager Pro
Questa è una email automatica, non rispondere.
    `.trim();

    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [email],
      subject: "Password Reset - Studio Manager Pro",
      html,
      text,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id || "" };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
}
