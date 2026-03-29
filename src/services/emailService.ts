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
}

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
      success:
