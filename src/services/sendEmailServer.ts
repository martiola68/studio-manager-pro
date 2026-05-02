import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export async function sendEmailServer(params: {
  userId: string;
  microsoftConnectionId: string;
  to: string;
  subject: string;
  html: string;
}) {
  try {
    const { data: connection, error: connectionError } = await (
      supabaseAdmin as any
    )
      .from("microsoft_connections")
      .select("access_token")
      .eq("id", params.microsoftConnectionId)
      .maybeSingle();

    if (connectionError || !connection?.access_token) {
      return {
        success: false,
        error:
          connectionError?.message ||
          "Access token Microsoft mancante",
      };
    }

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${params.userId}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      return {
        success: false,
        error: `Errore Microsoft Graph ${response.status}: ${errorText}`,
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
