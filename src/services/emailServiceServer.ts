import { getPasswordResetEmailTemplate } from "@/lib/emailTemplates";

type SendResult =
  | { success: true; id: string }
  | { success: false; error: string };

const FROM = `"Studio Manager Pro" <alert@revisionicommerciali.it>`;

export async function sendPasswordResetEmailServer(
  nome: string,
  email: string,
  password: string
): Promise<SendResult> {
  try {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      return { success: false, error: "RESEND_API_KEY non configurata" };
    }

    const loginUrl = "https://studio-manager-pro.vercel.app/login";

    const html = getPasswordResetEmailTemplate(nome, email, password, loginUrl);

    const text = `
Password Reset - Studio Manager Pro

Ciao ${nome},

La tua password è stata resettata dall'amministratore.

Email: ${email}
Nuova Password: ${password}

Accedi qui:
${loginUrl}

---
Studio Manager Pro
Questa è una email automatica
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: "Password Reset - Studio Manager Pro",
        html,
        text
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data?.message || "Errore Resend" };
    }

    return { success: true, id: data.id };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Errore invio email"
    };
  }
}
