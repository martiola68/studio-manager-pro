import { supabase } from "@/lib/supabase/client";
import {
  getWelcomeEmailTemplate,
  getPasswordResetEmailTemplate,
} from "@/lib/emailTemplates";
import { microsoftGraphService } from "./microsoftGraphService";

export interface EventEmailData {
  action?: "created" | "updated" | "cancelled";
  eventoId: string;
  eventoTitolo: string;
  eventoData: string;
  eventoOraInizio: string;
  eventoOraFine: string;
  eventoLuogo?: string;
  eventoDescrizione?: string;
  responsabileEmail: string;
  responsabileNome: string;
  partecipantiEmails: string[];
  partecipantiNomi: string[];
  clienteEmail?: string;
  clienteNome?: string;
  riunione_teams?: boolean;
  link_teams?: string;
}

export interface ComunicazioneEmailData {
  tipo: "newsletter" | "scadenze" | "singola" | "interna";
  destinatarioId?: string;
  destinatariIds?: string[];
  oggetto: string;
  messaggio: string;
  allegati?: any;
  microsoftConnectionId?: string;
}

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text: string;
  microsoftConnectionId?: string;
  attachments?: {
  nome: string;
  path: string;
  tipo?: string;
  bucket?: string;
}[];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isValidEmailFormat = (email: string): boolean => {
  if (!email || typeof email !== "string") return false;

  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(email)) return false;

  const [localPart, domain] = email.split("@");

  if (localPart.length > 64) return false;
  if (domain.length > 255) return false;

  const testDomains = ["prova", "test", "example", "xxx", "fake", "temp"];
  if (testDomains.some((test) => domain.toLowerCase().includes(test))) return false;

  return true;
};

async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.user?.id ?? null;
}

async function filePathToBase64(
  bucket: string,
  path: string
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).download(path);

  if (error || !data) {
    throw new Error(
      `Impossibile scaricare allegato da storage: ${error?.message || path}`
    );
  }

  const arrayBuffer = await data.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function buildMicrosoftAttachments(
  attachments?: { nome: string; path: string; tipo?: string; bucket?: string }[]
): Promise<
  {
    "@odata.type": "#microsoft.graph.fileAttachment";
    name: string;
    contentType: string;
    contentBytes: string;
  }[]
> {
  if (!attachments || attachments.length === 0) return [];

  const results: {
    "@odata.type": "#microsoft.graph.fileAttachment";
    name: string;
    contentType: string;
    contentBytes: string;
  }[] = [];

  for (const attachment of attachments) {
    const bucket = attachment.bucket || "documenti";
    const contentBytes = await filePathToBase64(bucket, attachment.path);

    results.push({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: attachment.nome,
      contentType: attachment.tipo || "application/octet-stream",
      contentBytes,
    });
  }

  return results;
}
async function sendEmailViaMicrosoft(
  userId: string,
  data: EmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!data.microsoftConnectionId) {
      return {
        success: false,
        error: "microsoftConnectionId mancante per invio Microsoft",
      };
    }

    const attachments = await buildMicrosoftAttachments(data.attachments);

  const message = {
  subject: data.subject,
  body: {
    contentType: "HTML" as const,
    content: data.html,
  },
  toRecipients: [
    {
      emailAddress: {
        address: data.to,
      },
    },
  ],
  ...(attachments.length > 0 ? { attachments } : {}),
};

    await microsoftGraphService.sendEmail(
      userId,
      data.microsoftConnectionId,
      message
    );

    return { success: true };
  } catch (error) {
    console.error("Error sending email via Microsoft:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function sendEmailViaEdgeFunction(
  data: EmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: result, error } = await supabase.functions.invoke("send-email", {
      body: data,
    });

    if (error) {
      console.warn("Edge function 'send-email' not found or error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, ...result };
  } catch (error) {
    console.error("Error sending email via edge function:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sendEmail(
  data: EmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getCurrentUserId();

    if (data.microsoftConnectionId && userId) {
      console.log("📧 Sending email via Microsoft 365...");
      return await sendEmailViaMicrosoft(userId, data);
    }

    console.log("📧 Sending email via Edge Function (Resend)...");
    return await sendEmailViaEdgeFunction(data);
  } catch (error) {
    console.error("Error in sendEmail:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sendWelcomeEmail(
  nome: string,
  email: string,
  password: string,
  microsoftConnectionId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const loginUrl = "https://studio-manager-pro.vercel.app/login";

    const htmlContent = getWelcomeEmailTemplate(nome, email, password, loginUrl);

    const textContent = `
Benvenuto in Studio Manager Pro

Ciao ${nome}!

Il tuo account è stato creato con successo.

Le tue credenziali di accesso:
📧 Email: ${email}
🔐 Password: ${password}

Accedi al sistema: ${loginUrl}

Conserva questa email in un luogo sicuro.
Non condividere mai le tue credenziali.

Buon lavoro!

---
Studio Manager Pro - Sistema Gestionale Integrato
Powered by ProWork Studio M
Questa è una email automatica, non rispondere a questo messaggio
    `.trim();

    return await sendEmail({
      to: email,
      subject: "Benvenuto in Studio Manager Pro - Credenziali di accesso",
      html: htmlContent,
      text: textContent,
      microsoftConnectionId,
    });
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sendPasswordResetEmail(
  nome: string,
  email: string,
  password: string,
  microsoftConnectionId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const loginUrl = "https://studio-manager-pro.vercel.app/login";

    const htmlContent = getPasswordResetEmailTemplate(
      nome,
      email,
      password,
      loginUrl
    );

    const textContent = `
Password Reset - Studio Manager Pro

Ciao ${nome},

La tua password è stata resettata dall'amministratore.

Le tue nuove credenziali:
📧 Email: ${email}
🔐 Nuova Password: ${password}

Accedi al sistema: ${loginUrl}

La tua password precedente non è più valida.
Conserva questa email in un luogo sicuro.

Buon lavoro!

---
Studio Manager Pro - Sistema Gestionale Integrato
Powered by ProWork Studio M
Questa è una email automatica, non rispondere a questo messaggio
    `.trim();

    return await sendEmail({
      to: email,
      subject: "Password Reset - Studio Manager Pro",
      html: htmlContent,
      text: textContent,
      microsoftConnectionId,
    });
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sendEventNotification(
  data: EventEmailData & { microsoftConnectionId?: string }
): Promise<{
  success: boolean;
  sent: number;
  failed: number;
  total: number;
  error?: string;
}> {
  try {
    console.log("📧 emailService.sendEventNotification - Building recipients list");

    const recipients: string[] = [];

    const isValidEmail = (email: string): boolean => {
      if (!email || typeof email !== "string") return false;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return false;

      const testDomains = ["prova", "test", "example", "xxx", "fake"];
      const domain = email.split("@")[1]?.toLowerCase();
      if (testDomains.some((test) => domain?.includes(test))) return false;

      return true;
    };

    if (isValidEmail(data.responsabileEmail)) {
      recipients.push(data.responsabileEmail);
    } else {
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        error: "Responsabile email is required and must be valid",
      };
    }

    if (data.partecipantiEmails && Array.isArray(data.partecipantiEmails)) {
      data.partecipantiEmails.forEach((email) => {
        if (isValidEmail(email) && !recipients.includes(email)) {
          recipients.push(email);
        }
      });
    }

    if (
      data.clienteEmail &&
      isValidEmail(data.clienteEmail) &&
      !recipients.includes(data.clienteEmail)
    ) {
      recipients.push(data.clienteEmail);
    }

    if (recipients.length === 0) {
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        error: "No valid email recipients",
      };
    }

    const action = data.action || "created";

    const { data: result, error } = await supabase.functions.invoke(
      "send-event-notification",
      {
        body: {
          ...data,
          action,
          recipients,
        },
      }
    );

    if (error) {
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: recipients.length,
        error: error.message,
      };
    }

    return {
      success: true,
      sent: recipients.length,
      failed: 0,
      total: recipients.length,
      ...result,
    };
  } catch (error) {
    console.error("💥 Error sending event notification:", error);
    return {
      success: false,
      sent: 0,
      failed: 0,
      total: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function triggerEventReminders(): Promise<{
  success: boolean;
  events_processed: number;
  reminders_sent: number;
  error?: string;
}> {
  try {
    const { data: result, error } = await supabase.functions.invoke(
      "send-event-reminder"
    );

    if (error) {
      return {
        success: false,
        events_processed: 0,
        reminders_sent: 0,
        error: error.message,
      };
    }

    return result;
  } catch (error) {
    console.error("Error triggering reminders:", error);
    return {
      success: false,
      events_processed: 0,
      reminders_sent: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sendComunicazioneEmail(
  data: ComunicazioneEmailData
): Promise<{
  success: boolean;
  sent: number;
  failed: number;
  skipped: number;
  error?: string;
}> {
  try {
    const { supabase } = await import("@/lib/supabase/client");

    let recipients: { email: string; nome: string }[] = [];

    if (data.tipo === "singola" && data.destinatarioId) {
      const { data: cliente, error } = await supabase
        .from("tbclienti")
        .select("email, ragione_sociale")
        .eq("id", data.destinatarioId)
        .eq("attivo", true)
        .single();

      if (error || !cliente?.email) {
        return {
          success: false,
          sent: 0,
          failed: 0,
          skipped: 0,
          error: "Cliente non trovato o senza email",
        };
      }

      recipients.push({ email: cliente.email, nome: cliente.ragione_sociale });
    } else if (data.tipo === "newsletter") {
      const { data: clienti, error } = await supabase
        .from("tbclienti")
        .select("email, ragione_sociale")
        .eq("attivo", true)
        .eq("flag_mail_attivo", true)
        .eq("flag_mail_newsletter", true);

      if (error) {
        return {
          success: false,
          sent: 0,
          failed: 0,
          skipped: 0,
          error: error.message,
        };
      }

      recipients = (clienti || [])
        .filter((c) => c.email)
        .map((c) => ({ email: c.email as string, nome: c.ragione_sociale }));
    } else if (data.tipo === "scadenze") {
      const { data: clienti, error } = await supabase
        .from("tbclienti")
        .select("email, ragione_sociale")
        .eq("attivo", true)
        .eq("flag_mail_attivo", true)
        .eq("flag_mail_scadenze", true);

      if (error) {
        return {
          success: false,
          sent: 0,
          failed: 0,
          skipped: 0,
          error: error.message,
        };
      }

      recipients = (clienti || [])
        .filter((c) => c.email)
        .map((c) => ({ email: c.email as string, nome: c.ragione_sociale }));
    } else if (data.tipo === "interna") {
      if (data.destinatariIds && data.destinatariIds.length > 0) {
        const { data: utenti, error } = await supabase
          .from("tbutenti")
          .select("email, nome, cognome")
          .in("id", data.destinatariIds)
          .eq("attivo", true);

        if (error) {
          return {
            success: false,
            sent: 0,
            failed: 0,
            skipped: 0,
            error: error.message,
          };
        }

        recipients = (utenti || [])
          .filter((u) => u.email)
          .map((u) => ({ email: u.email as string, nome: `${u.nome} ${u.cognome}` }));
      } else {
        const { data: utenti, error } = await supabase
          .from("tbutenti")
          .select("email, nome, cognome")
          .eq("attivo", true);

        if (error) {
          return {
            success: false,
            sent: 0,
            failed: 0,
            skipped: 0,
            error: error.message,
          };
        }

        recipients = (utenti || [])
          .filter((u) => u.email)
          .map((u) => ({ email: u.email as string, nome: `${u.nome} ${u.cognome}` }));
      }
    }

    if (recipients.length === 0) {
      return {
        success: false,
        sent: 0,
        failed: 0,
        skipped: 0,
        error: "Nessun destinatario valido trovato",
      };
    }

    const validRecipients = recipients.filter((r) => isValidEmailFormat(r.email));
    const invalidRecipients = recipients.filter((r) => !isValidEmailFormat(r.email));

    if (validRecipients.length === 0) {
      return {
        success: false,
        sent: 0,
        failed: 0,
        skipped: invalidRecipients.length,
        error: "Nessuna email valida trovata",
      };
    }

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      margin: 0;
      padding: 24px 0;
      background-color: #f3f4f6;
    }

    .container {
      max-width: 700px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #dbe3ef;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
    }

    .content {
      padding: 30px 24px 20px 24px;
    }

    .badge {
      background: #1d4ed8;
      color: #ffffff;
      padding: 16px 20px;
      text-align: center;
      font-size: 28px;
      font-weight: 700;
      line-height: 1.2;
    }

    .spacer-1 {
      height: 26px;
    }

    .spacer-2 {
      height: 34px;
    }

    .subject {
      font-size: 15px;
      color: #111827;
      margin: 0;
    }

    .message-row {
      font-size: 15px;
      color: #1f2937;
      margin: 0;
      white-space: normal;
    }

    .attachment-box {
      margin-top: 22px;
      padding: 14px 16px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      color: #1d4ed8;
      font-size: 14px;
      font-weight: 600;
      text-align: center;
    }

    .footer {
      background: #f9fafb;
      padding: 18px 24px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }

    .footer p {
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">

      <div class="badge">
        COMUNICAZIONE INTERNA
      </div>

      <div class="spacer-1"></div>

      <p class="subject">
        <strong>Oggetto:</strong> ${data.oggetto}
      </p>

      <div class="spacer-2"></div>

      <p class="message-row">
        <strong>Messaggio:</strong> ${data.messaggio.replace(/\n/g, "<br>")}
      </p>

      ${
        data.allegati && Array.isArray(data.allegati) && data.allegati.length > 0
          ? `<div class="attachment-box">Questa comunicazione contiene ${data.allegati.length} allegato/i</div>`
          : ""
      }

      <div style="height: 70px;"></div>
    </div>

    <div class="footer">
      ${
        data.allegati && Array.isArray(data.allegati) && data.allegati.length > 0
          ? `<p>Questa comunicazione contiene ${data.allegati.length} allegato/i</p>`
          : ""
      }
      <p><strong>Studio Manager Pro</strong> - Sistema Gestionale Integrato</p>
      <p>Powered by ProWork Studio M</p>
      <p>Questa è una email automatica, non rispondere a questo messaggio</p>
    </div>
  </div>
</body>
</html>
`.trim();
    
    const textContent = `
${data.oggetto}

${data.messaggio}

${data.allegati ? "📎 Questa comunicazione contiene allegati" : ""}

---
Studio Manager Pro - Sistema Gestionale Integrato
Powered by ProWork Studio M
Questa è una email automatica, non rispondere a questo messaggio
    `.trim();

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < validRecipients.length; i++) {
      const recipient = validRecipients[i];

      try {
     const result = await sendEmail({
          to: recipient.email,
          subject: data.oggetto,
          html: htmlContent,
          text: textContent,
          microsoftConnectionId: data.microsoftConnectionId,
          attachments: Array.isArray(data.allegati) ? data.allegati : [],
        });

        if (result.success) {
          sent++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }

      if (i < validRecipients.length - 1) {
        await sleep(500);
      }
    }

    return {
      success: sent > 0,
      sent,
      failed,
      skipped: invalidRecipients.length,
      error: failed > 0 ? `${failed} email non inviate` : undefined,
    };
  } catch (error) {
    console.error("💥 Errore generale invio comunicazione:", error);
    return {
      success: false,
      sent: 0,
      failed: 0,
      skipped: 0,
      error: error instanceof Error ? error.message : "Errore sconosciuto",
    };
  }
}

export const emailService = {
  sendEventNotification,
  triggerEventReminders,
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendComunicazioneEmail,
};
