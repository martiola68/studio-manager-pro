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

    const fromMailbox = params.fromMailbox?.trim() || null;

    // Con token delegato, gli invii normali continuano a passare da /me/sendMail.
    // Solo quando viene richiesto esplicitamente un mittente alternativo aggiungiamo
    // message.from; Exchange applichera' i permessi Send As / Send on Behalf.
    if (fromMailbox) {
      message.from = {
        emailAddress: {
          address: fromMailbox,
        },
      };
    }

    const response = await fetch(`${baseUrl}/api/microsoft365/graph-cron`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({
        userId: params.senderUserId,
        endpoint: "/me/sendMail",
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

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Errore invio email",
    };
  }
}
