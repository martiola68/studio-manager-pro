import { graphApiCall, hasMicrosoft365 } from "./microsoftGraphService";
import { supabase } from "@/lib/supabase/client";

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
  from?: {
    emailAddress: {
      address: string;
      name?: string;
    };
  };
  sender?: {
    emailAddress: {
      address: string;
      name?: string;
    };
  };
}

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  cc?: string | string[];
  bcc?: string | string[];
  from?: string;
}

function formatRecipients(emails: string | string[]): EmailRecipient[] {
  const emailArray = Array.isArray(emails) ? emails : [emails];
  return emailArray.map((email) => ({
    emailAddress: { address: email },
  }));
}

async function getUtenteMicrosoftContext(userId: string) {
  const { data: utente, error: utenteErr } = await supabase
    .from("tbutenti")
    .select("id, nome, cognome, email, studio_id, microsoft_connection_id")
    .eq("id", userId)
    .single();

  if (utenteErr || !utente?.studio_id) {
    throw new Error("Utente o studio non trovato per invio email Microsoft.");
  }

  let connection: any = null;

  if (utente.microsoft_connection_id) {
    const { data: connById, error: connByIdErr } = await (supabase as any)
      .from("microsoft365_connections")
      .select("*")
      .eq("id", utente.microsoft_connection_id)
      .eq("enabled", true)
      .single();

    if (!connByIdErr && connById) {
      connection = connById;
    }
  }

  if (!connection) {
    const { data: defaultConn, error: defaultConnErr } = await (supabase as any)
      .from("microsoft365_connections")
      .select("*")
      .eq("studio_id", utente.studio_id)
      .eq("enabled", true)
      .eq("is_default", true)
      .single();

    if (!defaultConnErr && defaultConn) {
      connection = defaultConn;
    }
  }

  if (!connection) {
    const { data: anyConn, error: anyConnErr } = await (supabase as any)
      .from("microsoft365_connections")
      .select("*")
      .eq("studio_id", utente.studio_id)
      .eq("enabled", true)
      .order("sort_order", { ascending: true })
      .limit(1)
      .single();

    if (!anyConnErr && anyConn) {
      connection = anyConn;
    }
  }

  if (!connection) {
    throw new Error("Connessione Microsoft 365 non trovata o non attiva.");
  }

  return { utente, connection };
}

export async function sendEmailViaMicrosoft(
  userId: string,
  params: SendEmailParams
): Promise<void> {
  const { utente, connection } = await getUtenteMicrosoftContext(userId);

  const studioId = utente.studio_id;
if (!studioId) {
  throw new Error("Studio non trovato per invio email Microsoft.");
}

const hasMicrosoft = await hasMicrosoft365(studioId, userId);
  if (!hasMicrosoft) {
    throw new Error("Microsoft 365 non configurato per questo utente");
  }

  const senderEmail =
    params.from ||
    connection.organizer_email ||
    connection.connected_email ||
    utente.email;

  const senderName =
    connection.nome_connessione ||
    `${utente.nome ?? ""} ${utente.cognome ?? ""}`.trim() ||
    "Studio Manager Pro";

  const message: EmailMessage = {
    subject: params.subject,
    body: {
      contentType: "HTML",
      content: params.html,
    },
    toRecipients: formatRecipients(params.to),
    from: {
      emailAddress: {
        address: senderEmail,
        name: senderName,
      },
    },
    sender: {
      emailAddress: {
        address: senderEmail,
        name: senderName,
      },
    },
  };

  if (params.cc) {
    message.ccRecipients = formatRecipients(params.cc);
  }

  if (params.bcc) {
    message.bccRecipients = formatRecipients(params.bcc);
  }

  console.log("📧 Invio email via Microsoft Graph...");
  console.log("📧 UserId:", userId);
  console.log("📧 Connessione:", connection.nome_connessione);
  console.log("📧 Destinatari:", params.to);
  console.log("📧 Oggetto:", params.subject);

  try {
    await graphApiCall(userId, "/me/sendMail", {
      method: "POST",
      body: JSON.stringify({
        message,
        saveToSentItems: true,
      }),
    });

    console.log("✅ Email inviata con successo via Microsoft 365");
  } catch (error: any) {
    console.error("❌ Errore invio email Microsoft:", error);
    throw new Error(`Errore invio email: ${error.message}`);
  }
}

export async function canUseMicrosoftEmail(userId: string): Promise<boolean> {
  const { data: utente, error } = await supabase
    .from("tbutenti")
    .select("studio_id")
    .eq("id", userId)
    .single();

  if (error || !utente?.studio_id) {
    return false;
  }

  return await hasMicrosoft365(utente.studio_id, userId);
}
