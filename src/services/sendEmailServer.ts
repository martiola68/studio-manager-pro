import { microsoftGraphService } from "@/services/microsoftGraphService";

export async function sendEmailServer(params: {
  senderUserId: string;
  microsoftConnectionId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromEmail?: string;
}) {
  try {
    if (!params.senderUserId) {
      return {
        success: false,
        error: "senderUserId mancante",
      };
    }

    if (!params.microsoftConnectionId) {
      return {
        success: false,
        error: "microsoftConnectionId mancante",
      };
    }

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

    if (params.fromEmail) {
      message.from = {
        emailAddress: {
          address: params.fromEmail,
        },
      };

      message.sender = {
        emailAddress: {
          address: params.fromEmail,
        },
      };
    }

    await microsoftGraphService.sendEmail(
      params.senderUserId,
      params.microsoftConnectionId,
      message
    );

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
