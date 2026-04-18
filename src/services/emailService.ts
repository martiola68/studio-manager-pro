import { supabase } from "@/lib/supabase/client";
import {
  getWelcomeEmailTemplate,
  getPasswordResetEmailTemplate,
} from "@/lib/emailTemplates";
import { microsoftGraphService } from "./microsoftGraphService";

export interface EventEmailData {
  action?: "created" | "updated" | "cancelled" | "reminder";
  eventoId: string;
  eventoTitolo: string;
  eventoData: string;
  eventoOraInizio: string;
  eventoOraFine: string;
  eventoLuogo?: string;
  eventoDescrizione?: string;
  eventoInSede?: boolean;
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
  allegati?: {
    nome: string;
    tipo: string;
    dimensione?: number;
    bucket: string;
    path: string;
  }[] | null;
  microsoftConnectionId?: string;
}

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text: string;
  microsoftConnectionId?: string;
  senderUserId?: string;
  sendMode?: "studio" | "user";
  fromEmail?: string;
  attachments?: {
    nome: string;
    path: string;
    tipo?: string;
    bucket?: string;
  }[];
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

async function getCurrentUserContext(): Promise<{
  id: string;
  email: string;
  studio_id: string;
  microsoft_connection_id: string | null;
} | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const authEmail = session?.user?.email;
  const authUserId = session?.user?.id;

  if (!authEmail || !authUserId) return null;

  const { data, error } = await (supabase as any)
    .from("tbutenti")
    .select("id, email, studio_id, microsoft_connection_id")
    .eq("id", authUserId)
    .single();

  if (error || !data?.id || !data?.studio_id || !data?.email) {
    return null;
  }

  return {
    id: String(data.id),
    email: String(data.email),
    studio_id: String(data.studio_id),
    microsoft_connection_id: data.microsoft_connection_id
      ? String(data.microsoft_connection_id)
      : null,
  };
}

async function getStudioMailContext(): Promise<{
  senderUserId: string;
  studioEmail: string;
  microsoftConnectionId: string | null;
} | null> {
  const currentUser = await getCurrentUserContext();
  if (!currentUser?.studio_id) return null;

  const { data: studio, error: studioError } = await (supabase as any)
    .from("tbstudio")
    .select("email, microsoft_connection_id")
    .eq("id", currentUser.studio_id)
    .single();

  if (studioError || !studio?.email) {
    return null;
  }

  return {
    senderUserId: currentUser.id,
    studioEmail: String(studio.email),
    microsoftConnectionId: studio.microsoft_connection_id
      ? String(studio.microsoft_connection_id)
      : null,
  };
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
  attachments?: {
    nome: string;
    path: string;
    tipo?: string;
    bucket?: string;
  }[]
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
    if (!attachment?.path) continue;

    const contentBytes = await filePathToBase64(
      attachment.bucket || "messaggi-allegati",
      attachment.path
    );

    results.push({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: attachment.nome || "allegato",
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

    const message: any = {
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

    if (data.fromEmail) {
      message.from = {
        emailAddress: {
          address: data.fromEmail,
        },
      };
      message.sender = {
        emailAddress: {
          address: data.fromEmail,
        },
      };
    }

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

export async function sendEmail(
  data: EmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    const sendMode = data.sendMode || "user";

    if (sendMode === "studio") {
      const studioCtx = await getStudioMailContext();

      if (!studioCtx?.senderUserId) {
        return {
          success: false,
          error: "Impossibile determinare il contesto studio per l'invio email",
        };
      }

      if (!studioCtx.microsoftConnectionId) {
        return {
          success: false,
          error: "Connessione Microsoft dello studio non trovata su tbstudio",
        };
      }

      return await sendEmailViaMicrosoft(studioCtx.senderUserId, {
        ...data,
        microsoftConnectionId:
          data.microsoftConnectionId || studioCtx.microsoftConnectionId,
        fromEmail: data.fromEmail || studioCtx.studioEmail,
      });
    }

    const currentUser = await getCurrentUserContext();

    const senderUserId = data.senderUserId || currentUser?.id || null;
    const microsoftConnectionId =
      data.microsoftConnectionId || currentUser?.microsoft_connection_id || null;

    if (!senderUserId) {
      return {
        success: false,
        error: "Utente mittente non determinato",
      };
    }

    if (!microsoftConnectionId) {
      return {
        success: false,
        error: "Connessione Microsoft utente non trovata",
      };
    }

    return await sendEmailViaMicrosoft(senderUserId, {
      ...data,
      microsoftConnectionId,
    });
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
      sendMode: "studio",
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
      sendMode: "studio",
    });
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function buildEventNotificationHtml(data: EventEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const action = data.action || "created";

  let headerTitle = "Nuovo Evento";
  let introText = "Hai un nuovo evento in agenda!";
  let emailSubject = `📅 Nuovo Evento: ${data.eventoTitolo}`;

  if (action === "updated") {
    headerTitle = "Evento Modificato";
    introText = "È stato modificato un evento in agenda.";
    emailSubject = `✏️ Evento modificato: ${data.eventoTitolo}`;
  }

  if (action === "cancelled") {
    headerTitle = "Evento Annullato";
    introText = "È stato annullato un evento in agenda.";
    emailSubject = `❌ Evento annullato: ${data.eventoTitolo}`;
  }

  if (action === "reminder") {
    headerTitle = "Promemoria Evento";
    introText = "Ti ricordiamo che oggi è previsto questo evento in agenda.";
    emailSubject = `🔔 Promemoria evento di oggi: ${data.eventoTitolo}`;
  }

  const luogoLabel = data.eventoInSede
    ? `In Sede${data.eventoLuogo ? ` – ${data.eventoLuogo}` : ""}`
    : data.eventoLuogo || "";

  const luogoSection = luogoLabel
    ? `<p style="margin: 10px 0; font-size: 14px; color: #555;">
         <strong>📍 Luogo:</strong> ${luogoLabel}
       </p>`
    : "";

  const clienteSection = data.clienteNome
    ? `<p style="margin: 10px 0; font-size: 14px; color: #555;">
         <strong>🏢 Cliente:</strong> ${data.clienteNome}
       </p>`
    : "";

  const teamsSection =
    data.link_teams && action !== "cancelled"
      ? `<p style="margin: 10px 0; font-size: 14px; color: #555;">
           <strong>💻 Riunione Teams:</strong><br/>
           <a href="${data.link_teams}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: none;">
             Partecipa alla riunione Teams
           </a>
         </p>`
      : "";

  const partecipantiSection =
    data.partecipantiNomi && data.partecipantiNomi.length > 0
      ? `
        <div style="margin: 15px 0;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #333;">
            <strong>👥 Partecipanti:</strong>
          </p>
          <div style="font-size: 14px; color: #555; line-height: 1.6;">
            ${data.partecipantiNomi.map((nome) => `<div>• ${nome}</div>`).join("")}
          </div>
        </div>
      `
      : "";

  const descrizioneSection = data.eventoDescrizione
    ? `<div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #3b82f6; border-radius: 4px;">
         <p style="margin: 0; font-size: 14px; color: #333;">
           <strong>📝 Note:</strong><br/>
           ${data.eventoDescrizione}
         </p>
       </div>`
    : "";

  const headerColor =
    action === "updated"
      ? "#f59e0b"
      : action === "cancelled"
      ? "#ef4444"
      : action === "reminder"
      ? "#0f766e"
      : "#2563eb";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 0; }
        .header { color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #ffffff; padding: 20px; border: none; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header" style="background: ${headerColor};">
          <h1 style="margin: 0; font-size: 28px;">${headerTitle}</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${data.eventoTitolo}</p>
        </div>
        <div class="content">
          <p style="margin: 0 0 20px 0; font-size: 16px; color: #111;">
            ${introText}
          </p>

          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 10px 0; font-size: 14px; color: #555;">
              <strong>📅 Data:</strong> ${data.eventoData}
            </p>
            <p style="margin: 10px 0; font-size: 14px; color: #555;">
              <strong>⏰ Orario:</strong> ${data.eventoOraInizio} - ${data.eventoOraFine}
            </p>
            ${luogoSection}
            <p style="margin: 10px 0; font-size: 14px; color: #555;">
              <strong>👤 Responsabile:</strong> ${data.responsabileNome}
            </p>
            ${clienteSection}
            ${teamsSection}
          </div>

          ${partecipantiSection}
          ${descrizioneSection}

          <div style="margin-top: 30px; text-align: center;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">
              Accedi a Studio Manager Pro per visualizzare tutti i dettagli
            </p>
          </div>
        </div>
        <div class="footer">
          <p style="margin: 5px 0;">Studio Manager Pro - Sistema di Gestione Studio</p>
          <p style="margin: 5px 0;">Questa è una email automatica, non rispondere a questo messaggio.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
${headerTitle}

${data.eventoTitolo}

${introText}

Data: ${data.eventoData}
Orario: ${data.eventoOraInizio} - ${data.eventoOraFine}
${luogoLabel ? `Luogo: ${luogoLabel}` : ""}
Responsabile: ${data.responsabileNome}
${data.clienteNome ? `Cliente: ${data.clienteNome}` : ""}
${data.link_teams && action !== "cancelled" ? `Link Teams: ${data.link_teams}` : ""}
${data.partecipantiNomi?.length ? `Partecipanti: ${data.partecipantiNomi.join(", ")}` : ""}
${data.eventoDescrizione ? `Note: ${data.eventoDescrizione}` : ""}
  `.trim();

  return {
    subject: emailSubject,
    html,
    text,
  };
}

export async function sendEventNotification(
  data: EventEmailData & { microsoftConnectionId?: string; senderUserId?: string }
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

    const built = buildEventNotificationHtml(data);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

     const result = await sendEmail({
  to: recipient,
  subject: built.subject,
  html: built.html,
  text: built.text,
  sendMode: "studio",
});

      if (result.success) {
        sent++;
      } else {
        failed++;
      }

      if (i < recipients.length - 1) {
        await sleep(300);
      }
    }

    return {
      success: sent > 0,
      sent,
      failed,
      total: recipients.length,
      error: failed > 0 ? `${failed} email non inviate` : undefined,
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
    const response = await fetch("/api/agenda/send-reminders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        events_processed: 0,
        reminders_sent: 0,
        error: result?.error || "Errore invocazione route promemoria",
      };
    }

    return {
      success: true,
      events_processed: Number(result?.processedGroups || 0),
      reminders_sent: Number(result?.updatedRows || 0),
    };
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
          .map((u) => ({
            email: u.email as string,
            nome: `${u.nome} ${u.cognome}`,
          }));
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
          .map((u) => ({
            email: u.email as string,
            nome: `${u.nome} ${u.cognome}`,
          }));
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
      margin-bottom: 25px;
    }

    .subject {
      font-size: 15px;
      color: #111827;
      margin-bottom: 25px;
    }

    .message-row {
      font-size: 15px;
      color: #1f2937;
      margin-bottom: 20px;
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

      <p class="subject">
        <strong>Oggetto:</strong> ${data.oggetto}
      </p>

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
          sendMode: "studio",
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
