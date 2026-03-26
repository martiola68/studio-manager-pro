import { graphApiCall } from "./microsoftGraphService";
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
  microsoftConnectionId: string;
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

async function getUtenteMicrosoftContext(
  userId: string,
  microsoftConnectionId: string
) {
  const { data: utente, error: utenteErr } = await supabase
    .from("tbutenti")
    .select("id, nome, cognome, email, studio_id")
    .eq("id", userId)
    .single();

  if (utenteErr || !utente?.studio_id) {
    throw new Error("Utente o studio non trovato per invio email Microsoft.");
  }

  const { data: connection, error: connErr } = await (supabase as any)
    .from("microsoft365_connections")
    .select("*")
    .eq("id", microsoftConnectionId)
    .eq("studio_id", utente.studio_id)
    .eq("enabled", true)
    .single();

  if (connErr || !connection) {
    throw new Error("Connessione Microsoft 365 non trovata o non attiva.");
  }

console.log("CHECK TOKEN MICROSOFT", {
  studio_id: utente.studio_id,
  user_id: userId,
  microsoft_connection_id: microsoftConnectionId,
});

const { data: tokenRow, error: tokenErr } = await (supabase as any)
  .from("tbmicrosoft365_user_tokens")
  .select("id, connected_at, revoked_at, microsoft_connection_id, user_id")
  .eq("studio_id", utente.studio_id)
  .eq("microsoft_connection_id", microsoftConnectionId)
  .is("revoked_at", null)
  .order("connected_at", { ascending: false })
  .limit(1)
  .maybeSingle();

console.log("TOKEN ROW TROVATA", tokenRow, tokenErr);
  if (tokenErr || !tokenRow?.id) {
    throw new Error("Microsoft 365 non configurato per questo utente");
  }

  return { utente, connection };
}

export async function sendEmailViaMicrosoft(
  userId: string,
  params: SendEmailParams
): Promise<void> {
  if (!params.microsoftConnectionId) {
    throw new Error("microsoftConnectionId mancante per invio email Microsoft.");
  }

  const { utente, connection } = await getUtenteMicrosoftContext(
    userId,
    params.microsoftConnectionId
  );

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

  try {
    await graphApiCall(userId, "/me/sendMail", {
      method: "POST",
      microsoftConnectionId: params.microsoftConnectionId,
      body: {
        message,
        saveToSentItems: true,
      } as any,
    });

    console.log("✅ Email inviata con successo via Microsoft 365");
  } catch (error: any) {
    console.error("❌ Errore invio email Microsoft:", error);
    throw new Error(`Errore invio email: ${error.message}`);
  }
}

export async function canUseMicrosoftEmail(
  userId: string,
  microsoftConnectionId: string
): Promise<boolean> {
  try {
    if (!microsoftConnectionId) return false;

    const { data: utente, error } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", userId)
      .single();

    if (error || !utente?.studio_id) {
      return false;
    }

   const { data: tokenRow, error: tokenErr } = await (supabase as any)
  .from("tbmicrosoft365_user_tokens")
  .select("id")
  .eq("studio_id", utente.studio_id)
  .eq("microsoft_connection_id", microsoftConnectionId)
  .is("revoked_at", null)
  .order("connected_at", { ascending: false })
  .limit(1)
  .maybeSingle();

    return !tokenErr && !!tokenRow?.id;
  } catch {
    return false;
  }
}
