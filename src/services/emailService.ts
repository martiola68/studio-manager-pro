import { supabase } from "@/lib/supabase/client";
import { getWelcomeEmailTemplate, getPasswordResetEmailTemplate } from "@/lib/emailTemplates";
import { microsoftGraphService } from "./microsoftGraphService";

export interface EventEmailData {
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
}

export interface ComunicazioneEmailData {
  tipo: "newsletter" | "scadenze" | "singola" | "interna";
  destinatarioId?: string;
  destinatariIds?: string[];
  oggetto: string;
  messaggio: string;
  allegati?: any;
}

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Helper function to add delay between requests (rate limiting)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Strict email validation function
const isValidEmailFormat = (email: string): boolean => {
  if (!email || typeof email !== "string") return false;
  
  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(email)) return false;
  
  // Additional checks
  const [localPart, domain] = email.split("@");
  
  // Check local part length (max 64 chars)
  if (localPart.length > 64) return false;
  
  // Check domain length (max 255 chars)
  if (domain.length > 255) return false;
  
  // Blacklist test/fake domains
  const testDomains = ["prova", "test", "example", "xxx", "fake", "temp"];
  if (testDomains.some(test => domain.toLowerCase().includes(test))) return false;
  
  return true;
};

// Check if Microsoft 365 is configured for current studio
async function isMicrosoft365Enabled(): Promise<{ enabled: boolean; userId?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { enabled: false };

    const { data: userData } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", session.user.id)
      .single();

    if (!userData?.studio_id) return { enabled: false };

    const { data: config } = await supabase
      .from("microsoft365_config" as any)
      .select("enabled")
      .eq("studio_id", userData.studio_id)
      .single();

    return {
      enabled: config?.enabled === true,
      userId: session.user.id
    };
  } catch (error) {
    console.error("Error checking Microsoft 365 config:", error);
    return { enabled: false };
  }
}

// Send email via Microsoft Graph API
async function sendEmailViaMicrosoft(
  userId: string,
  data: EmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    const message = {
      subject: data.subject,
      body: {
        contentType: "HTML" as const,
        content: data.html
      },
      toRecipients: [
        {
          emailAddress: {
            address: data.to
          }
        }
      ]
    };

    await microsoftGraphService.sendEmail(userId, message);

    return { success: true };
  } catch (error) {
    console.error("Error sending email via Microsoft:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// Send email via Edge Function (Resend fallback)
async function sendEmailViaEdgeFunction(data: EmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: result, error } = await supabase.functions.invoke("send-email", {
      body: data
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
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// Main email sending function with dual mode support
export async function sendEmail(data: EmailData): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if Microsoft 365 is enabled
    const { enabled, userId } = await isMicrosoft365Enabled();

    if (enabled && userId) {
      console.log("📧 Sending email via Microsoft 365...");
      return await sendEmailViaMicrosoft(userId, data);
    } else {
      console.log("📧 Sending email via Edge Function (Resend)...");
      return await sendEmailViaEdgeFunction(data);
    }
  } catch (error) {
    console.error("Error in sendEmail:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export async function sendWelcomeEmail(
  nome: string,
  email: string,
  password: string
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
      text: textContent
    });
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export async function sendPasswordResetEmail(
  nome: string,
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const loginUrl = "https://studio-manager-pro.vercel.app/login";
    
    const htmlContent = getPasswordResetEmailTemplate(nome, email, password, loginUrl);
    
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
      text: textContent
    });
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export async function sendEventNotification(data: EventEmailData): Promise<{
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
      if (testDomains.some(test => domain?.includes(test))) return false;
      
      return true;
    };

    if (isValidEmail(data.responsabileEmail)) {
      recipients.push(data.responsabileEmail);
      console.log("✅ Responsabile:", data.responsabileEmail);
    } else {
      console.error("❌ Responsabile email invalid or missing:", data.responsabileEmail);
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        error: "Responsabile email is required and must be valid"
      };
    }

    if (data.partecipantiEmails && Array.isArray(data.partecipantiEmails)) {
      data.partecipantiEmails.forEach(email => {
        if (isValidEmail(email) && !recipients.includes(email)) {
          recipients.push(email);
          console.log("✅ Partecipante:", email);
        } else if (email) {
          console.warn("⚠️ Partecipante email non valida, esclusa:", email);
        }
      });
    }

    if (data.clienteEmail) {
      console.log("ℹ️ Cliente escluso dall'invio email:", data.clienteEmail);
    }

    if (recipients.length === 0) {
      console.error("❌ No valid recipients found!");
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        error: "No valid email recipients"
      };
    }

    console.log(`📧 Total valid recipients: ${recipients.length}`);
    console.log("📧 Recipients list:", recipients);

    const { data: result, error } = await supabase.functions.invoke(
      "send-event-notification",
      {
        body: {
          ...data,
          recipients
        }
      }
    );

    if (error) {
      console.error("❌ Error invoking email function:", error);
      return {
        success: false,
        sent: 0,
        failed: 0,
        total: recipients.length,
        error: error.message
      };
    }

    console.log("✅ Email function response:", result);

    return {
      success: true,
      sent: recipients.length,
      failed: 0,
      total: recipients.length,
      ...result
    };
  } catch (error) {
    console.error("💥 Error sending event notification:", error);
    return {
      success: false,
      sent: 0,
      failed: 0,
      total: 0,
      error: error instanceof Error ? error.message : "Unknown error"
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
      console.error("Error invoking reminder function:", error);
      return {
        success: false,
        events_processed: 0,
        reminders_sent: 0,
        error: error.message
      };
    }

    return result;
  } catch (error) {
    console.error("Error triggering reminders:", error);
    return {
      success: false,
      events_processed: 0,
      reminders_sent: 0,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export async function sendComunicazioneEmail(
  data: ComunicazioneEmailData
): Promise<{ success: boolean; sent: number; failed: number; skipped: number; error?: string }> {
  try {
    const { supabase } = await import("@/lib/supabase/client");
    
    let recipients: { email: string; nome: string }[] = [];

    // 1. Raccogli destinatari in base al tipo
    if (data.tipo === "singola" && data.destinatarioId) {
      const { data: cliente, error } = await supabase
        .from("tbclienti")
        .select("email, ragione_sociale")
        .eq("id", data.destinatarioId)
        .eq("attivo", true)
        .single();

      if (error || !cliente?.email) {
        return { success: false, sent: 0, failed: 0, skipped: 0, error: "Cliente non trovato o senza email" };
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
        return { success: false, sent: 0, failed: 0, skipped: 0, error: error.message };
      }

      recipients = (clienti || [])
        .filter(c => c.email)
        .map(c => ({ email: c.email as string, nome: c.ragione_sociale }));

    } else if (data.tipo === "scadenze") {
      const { data: clienti, error } = await supabase
        .from("tbclienti")
        .select("email, ragione_sociale")
        .eq("attivo", true)
        .eq("flag_mail_attivo", true)
        .eq("flag_mail_scadenze", true);

      if (error) {
        return { success: false, sent: 0, failed: 0, skipped: 0, error: error.message };
      }

      recipients = (clienti || [])
        .filter(c => c.email)
        .map(c => ({ email: c.email as string, nome: c.ragione_sociale }));

    } else if (data.tipo === "interna") {
      if (data.destinatariIds && data.destinatariIds.length > 0) {
        const { data: utenti, error } = await supabase
          .from("tbutenti")
          .select("email, nome, cognome")
          .in("id", data.destinatariIds)
          .eq("attivo", true);

        if (error) {
          return { success: false, sent: 0, failed: 0, skipped: 0, error: error.message };
        }

        recipients = (utenti || [])
          .filter(u => u.email)
          .map(u => ({ email: u.email as string, nome: `${u.nome} ${u.cognome}` }));

      } else {
        const { data: utenti, error } = await supabase
          .from("tbutenti")
          .select("email, nome, cognome")
          .eq("attivo", true);

        if (error) {
          return { success: false, sent: 0, failed: 0, skipped: 0, error: error.message };
        }

        recipients = (utenti || [])
          .filter(u => u.email)
          .map(u => ({ email: u.email as string, nome: `${u.nome} ${u.cognome}` }));
      }
    }

    if (recipients.length === 0) {
      return { success: false, sent: 0, failed: 0, skipped: 0, error: "Nessun destinatario valido trovato" };
    }

    console.log(`📧 Tentativo invio comunicazione a ${recipients.length} destinatari`);

    // 2. Valida email e separa valide/invalide
    const validRecipients = recipients.filter(r => isValidEmailFormat(r.email));
    const invalidRecipients = recipients.filter(r => !isValidEmailFormat(r.email));

    if (invalidRecipients.length > 0) {
      console.warn(`⚠️ ${invalidRecipients.length} email con formato invalido escluse:`, 
        invalidRecipients.map(r => `${r.nome} <${r.email}>`));
    }

    if (validRecipients.length === 0) {
      return { 
        success: false, 
        sent: 0, 
        failed: 0, 
        skipped: invalidRecipients.length,
        error: "Nessuna email valida trovata" 
      };
    }

    console.log(`✅ ${validRecipients.length} email valide, ${invalidRecipients.length} escluse`);

    // 3. Prepara il contenuto HTML
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px 20px; }
    .message { background: #f9f9f9; padding: 20px; border-left: 4px solid #667eea; border-radius: 4px; margin: 20px 0; white-space: pre-wrap; }
    .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; }
    .footer p { margin: 5px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📧 ${data.oggetto}</h1>
    </div>
    <div class="content">
      <div class="message">
        ${data.messaggio.replace(/\n/g, '<br>')}
      </div>
      ${data.allegati ? '<p><strong>📎 Questa comunicazione contiene allegati</strong></p>' : ''}
    </div>
    <div class="footer">
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

${data.allegati ? '📎 Questa comunicazione contiene allegati' : ''}

---
Studio Manager Pro - Sistema Gestionale Integrato
Powered by ProWork Studio M
Questa è una email automatica, non rispondere a questo messaggio
    `.trim();

    // 4. Invia email con rate limiting (2 req/sec = 500ms delay)
    let sent = 0;
    let failed = 0;

    console.log(`📤 Inizio invio con rate limiting (2 req/sec)...`);

    for (let i = 0; i < validRecipients.length; i++) {
      const recipient = validRecipients[i];
      
      try {
        const result = await sendEmail({
          to: recipient.email,
          subject: data.oggetto,
          html: htmlContent,
          text: textContent
        });

        if (result.success) {
          sent++;
          console.log(`✅ [${i + 1}/${validRecipients.length}] Email inviata a ${recipient.email}`);
        } else {
          failed++;
          console.error(`❌ [${i + 1}/${validRecipients.length}] Errore invio a ${recipient.email}:`, result.error);
        }
      } catch (error) {
        failed++;
        console.error(`❌ [${i + 1}/${validRecipients.length}] Errore invio a ${recipient.email}:`, error);
      }

      // Rate limiting: 500ms delay between requests (2 req/sec safe)
      if (i < validRecipients.length - 1) {
        await sleep(500);
      }
    }

    console.log(`📊 Risultato finale: ${sent} inviate, ${failed} fallite, ${invalidRecipients.length} escluse su ${recipients.length} totali`);

    return {
      success: sent > 0,
      sent,
      failed,
      skipped: invalidRecipients.length,
      error: failed > 0 ? `${failed} email non inviate` : undefined
    };

  } catch (error) {
    console.error("💥 Errore generale invio comunicazione:", error);
    return {
      success: false,
      sent: 0,
      failed: 0,
      skipped: 0,
      error: error instanceof Error ? error.message : "Errore sconosciuto"
    };
  }
}

export const emailService = {
  sendEventNotification,
  triggerEventReminders,
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendComunicazioneEmail
};