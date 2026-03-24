import { graphApiCall, hasMicrosoft365 } from "./microsoftGraphService";
import { supabase } from "@/lib/supabase/client";

const ADMIN_LOGIN_EMAIL = "m.artiola@revisionicommerciali.it";
const SENDER_EMAIL = "noreply@revisionicommerciali.it";

async function getAdminUserId(): Promise<string> {
  const { data, error } = await supabase
    .from("tbutenti")
    .select("id,email")
    .eq("email", ADMIN_LOGIN_EMAIL)
    .single();

  if (error || !data) {
    throw new Error("Utente admin Microsoft non trovato");
  }

  return data.id;
}

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

export async function sendEmailViaMicrosoft(
  userId: string,
  params: SendEmailParams
): Promise<void> {
  const adminUserId = await getAdminUserId();

  const { data: u, error: uErr } = await supabase
    .from("tbutenti")
    .select("studio_id")
    .eq("id", adminUserId)
    .single();

  if (uErr || !u?.studio_id) {
    throw new Error("Studio non trovato per invio email Microsoft.");
  }

  const studioId = u.studio_id as string;

  const hasMicrosoft = await hasMicrosoft365(studioId, userId);
  if (!hasMicrosoft) {
    throw new Error("Microsoft 365 non configurato per questo utente");
  }

  const message: EmailMessage = {
    subject: params.subject,
    body: {
      contentType: "HTML",
      content: params.html,
    },
    toRecipients: formatRecipients(params.to),
    from: {
      emailAddress: {
        address: SENDER_EMAIL,
        name: "Nome Studio Test",
      },
    },
    sender: {
      emailAddress: {
        address: SENDER_EMAIL,
        name: "Nome Studio Test",
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
  console.log("📧 Destinatari:", params.to);
  console.log("📧 Oggetto:", params.subject);

  try {
    await graphApiCall(adminUserId, "/me/sendMail", {
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
  return await hasMicrosoft365(userId as any);
}
