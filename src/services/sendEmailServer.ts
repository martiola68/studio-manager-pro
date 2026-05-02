import { microsoftGraphService } from "@/services/microsoftGraphService";

export async function sendEmailServer(params: {
  senderUserId: string;
  microsoftConnectionId: string;
  to: string;
  subject: string;
  html: string;
}) {
  try {
    await microsoftGraphService.sendEmail(
      params.senderUserId,
      params.microsoftConnectionId,
      {
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
      }
    );

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Errore invio email",
    };
  }
}
