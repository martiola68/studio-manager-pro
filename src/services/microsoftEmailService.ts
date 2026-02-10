import { graphApiCall, hasMicrosoft365 } from "./microsoftGraphService";

/**
 * Microsoft Email Service
 * Invia email tramite Microsoft Graph API usando Outlook
 */

interface EmailRecipient {
  emailAddress: {
    address: string;
    name?: string;
  };
}

interface EmailMessage {
  subject: string;
  body: {
    contentType: "HTML" | "Text";
    content: string;
  };
  toRecipients: EmailRecipient[];
  ccRecipients?: EmailRecipient[];
  bccRecipients?: EmailRecipient[];
}

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  cc?: string | string[];
  bcc?: string | string[];
  from?: string; // Ignorato, usa sempre l'account Microsoft dell'utente
}

/**
 * Converte email string/array in formato Microsoft Graph
 */
function formatRecipients(emails: string | string[]): EmailRecipient[] {
  const emailArray = Array.isArray(emails) ? emails : [emails];
  return emailArray.map((email) => ({
    emailAddress: { address: email },
  }));
}

/**
 * Invia email tramite Microsoft Graph API
 */
export async function sendEmailViaMicrosoft(
  userId: string,
  params: SendEmailParams
): Promise<void> {
  // Verifica che l'utente abbia Microsoft 365 configurato
  const hasMicrosoft = await hasMicrosoft365(userId);
  if (!hasMicrosoft) {
    throw new Error("Microsoft 365 non configurato per questo utente");
  }

  // Costruisci messaggio in formato Graph API
  const message: EmailMessage = {
    subject: params.subject,
    body: {
      contentType: "HTML",
      content: params.html,
    },
    toRecipients: formatRecipients(params.to),
  };

  // Aggiungi CC se presente
  if (params.cc) {
    message.ccRecipients = formatRecipients(params.cc);
  }

  // Aggiungi BCC se presente
  if (params.bcc) {
    message.bccRecipients = formatRecipients(params.bcc);
  }

  console.log("📧 Invio email via Microsoft Graph...");
  console.log("📧 Destinatari:", params.to);
  console.log("📧 Oggetto:", params.subject);

  try {
    // Invia email tramite Graph API
    await graphApiCall(userId, "/me/sendMail", {
      method: "POST",
      body: JSON.stringify({
        message,
        saveToSentItems: true, // Salva in "Posta inviata"
      }),
    });

    console.log("✅ Email inviata con successo via Microsoft 365");
  } catch (error: any) {
    console.error("❌ Errore invio email Microsoft:", error);
    throw new Error(`Errore invio email: ${error.message}`);
  }
}

/**
 * Verifica se un utente può usare Microsoft per le email
 */
export async function canUseMicrosoftEmail(userId: string): Promise<boolean> {
  return await hasMicrosoft365(userId);
}