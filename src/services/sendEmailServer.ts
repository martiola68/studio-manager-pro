export async function sendEmailServer(params: {
  senderUserId: string;
  microsoftConnectionId: string;
  to: string;
  subject: string;
  html: string;
}) {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://studio-manager-pro.vercel.app";

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
    message: {
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
    },
    saveToSentItems: true,
  },
}),

    const text = await response.text();

    if (!response.ok) {
      return {
        success: false,
        error: text || `Errore Graph proxy ${response.status}`,
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
