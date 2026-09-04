import { supabaseAdmin } from "@/lib/supabase/admin";

const REVISIONI_STUDIO_ID = "f9d3ca10-6134-4061-a2b4-0be74e8c7654";
const REVISIONI_AUTOMATIC_SENDER = "noreply@revisionicommerciali.it";

function isCentralAlertSubject(subject: string) {
  return /^Scadenza (superata|di oggi|tra )/i.test(subject.trim());
}

async function resolveAutomaticSenderMailbox(params: {
  microsoftConnectionId: string;
  subject: string;
}) {
  if (!isCentralAlertSubject(params.subject)) return null;

  const { data: connection, error } = await supabaseAdmin
    .from("microsoft365_connections")
    .select("studio_id")
    .eq("id", params.microsoftConnectionId)
    .maybeSingle();

  if (error || !connection?.studio_id) return null;

  if (connection.studio_id === REVISIONI_STUDIO_ID) {
    return REVISIONI_AUTOMATIC_SENDER;
  }

  return null;
}

export async function sendEmailServer(params: {
  senderUserId: string;
  microsoftConnectionId: string;
  to: string;
  subject: string;
  html: string;
  fromMailbox?: string | null;
  attachments?: {
    filename: string;
    contentType: string;
    contentBytes: string;
  }[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://app.studiomanagerpro.it";

    const message: any = {
      subject: params.subject,
      body: {
        contentType: "HTML",
        content: params.html,
      },
      toRecipients: [
        {
          emailAddress: {
            address: params.to,
          },
        },
      ],
    };

    if (params.attachments?.length) {
      message.attachments = params.attachments.map((a) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: a.filename,
        contentType: a.contentType,
        contentBytes: a.contentBytes,
      }));
    }

    const automaticSender = await resolveAutomaticSenderMailbox({
      microsoftConnectionId: params.microsoftConnectionId,
      subject: params.subject,
    });

    const fromMailbox =
      params.fromMailbox?.trim() || automaticSender || null;

    const endpoint = fromMailbox
      ? `/users/${encodeURIComponent(fromMailbox)}/sendMail`
      : "/me/sendMail";

    const response = await fetch(`${baseUrl}/api/microsoft365/graph-cron`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({
        userId: params.senderUserId,
        endpoint,
        method: "POST",
        microsoftConnectionId: params.microsoftConnectionId,
        body: {
          message,
          saveToSentItems: true,
        },
      }),
    });

    const text = await response.text();

    if (!response.ok) {
      return {
        success: false,
        error: text || `Errore graph-cron ${response.status}`,
      };
    }

    return {
      success: true,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Errore invio email",
    };
  }
}
