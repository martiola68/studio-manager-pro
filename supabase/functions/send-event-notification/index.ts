import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// CORS Headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

// TEST MODE: Solo questo indirizzo riceverà le email
const TEST_MODE = true;
const TEST_EMAIL = "martiola68@tiscali.it";

interface EventNotificationRequest {
  eventoId: string;
  eventoTitolo: string;
  eventoData: string;
  eventoOraInizio: string;
  eventoOraFine: string;
  eventoLuogo?: string;
  eventoDescrizione?: string;
  responsabileEmail: string;
  responsabileNome: string;
  partecipantiEmails: string[];
  partecipantiNomi: string[];
  clienteEmail?: string;
  clienteNome?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("🚀 Starting email notification process...");
    console.log(`⚙️ TEST_MODE: ${TEST_MODE}`);
    if (TEST_MODE) {
      console.log(`📧 TEST MODE: All emails will be consolidated and sent to ${TEST_EMAIL}`);
    }
    
    // Check Resend API Key
    if (!RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY not configured");
      throw new Error("RESEND_API_KEY not configured - Please add it in Supabase Edge Functions Secrets");
    }

    console.log("✅ RESEND_API_KEY found");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const request: EventNotificationRequest = await req.json();

    console.log("📧 Request received:", {
      eventoId: request.eventoId,
      eventoTitolo: request.eventoTitolo,
      responsabileEmail: request.responsabileEmail,
      partecipantiCount: request.partecipantiEmails?.length || 0,
      hasCliente: !!request.clienteEmail
    });

    // Validate required fields
    if (!request.eventoId || !request.eventoTitolo || !request.responsabileEmail) {
      throw new Error("Missing required fields: eventoId, eventoTitolo, or responsabileEmail");
    }

    // Prepare recipients list (ORIGINAL - for display in email)
    const recipients: Array<{ email: string; name: string; role: string }> = [];
    
    // Add responsabile
    recipients.push({
      email: request.responsabileEmail,
      name: request.responsabileNome || request.responsabileEmail,
      role: "responsabile"
    });

    // Add partecipanti
    if (request.partecipantiEmails && request.partecipantiEmails.length > 0) {
      for (let i = 0; i < request.partecipantiEmails.length; i++) {
        const email = request.partecipantiEmails[i];
        const name = request.partecipantiNomi?.[i] || email;
        recipients.push({ email, name, role: "partecipante" });
      }
    }

    // Add cliente if present
    if (request.clienteEmail && request.clienteNome) {
      recipients.push({
        email: request.clienteEmail,
        name: request.clienteNome,
        role: "cliente"
      });
    }

    console.log(`📬 Total recipients: ${recipients.length}`);

    // Format date and time for display
    const eventDate = new Date(request.eventoData);
    const formattedDate = eventDate.toLocaleDateString("it-IT", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    // Generate email HTML
    const emailHtml = TEST_MODE 
      ? generateTestEmailTemplate({
          recipients: recipients,
          eventoTitolo: request.eventoTitolo,
          eventoData: formattedDate,
          eventoOraInizio: request.eventoOraInizio,
          eventoOraFine: request.eventoOraFine,
          eventoLuogo: request.eventoLuogo,
          eventoDescrizione: request.eventoDescrizione,
          responsabileNome: request.responsabileNome,
          partecipantiNomi: request.partecipantiNomi || [],
          clienteNome: request.clienteNome
        })
      : generateProductionEmailTemplate({
          eventoTitolo: request.eventoTitolo,
          eventoData: formattedDate,
          eventoOraInizio: request.eventoOraInizio,
          eventoOraFine: request.eventoOraFine,
          eventoLuogo: request.eventoLuogo,
          eventoDescrizione: request.eventoDescrizione,
          responsabileNome: request.responsabileNome,
          partecipantiNomi: request.partecipantiNomi || [],
          clienteNome: request.clienteNome
        });

    if (TEST_MODE) {
      // TEST MODE: Send ONE consolidated email to TEST_EMAIL
      console.log(`📤 Sending test email to ${TEST_EMAIL}...`);
      
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "Studio Manager Pro <onboarding@resend.dev>",
          to: [TEST_EMAIL],
          subject: `🧪 [TEST] Nuovo Evento: ${request.eventoTitolo}`,
          html: emailHtml
        })
      });

      const responseText = await response.text();
      console.log(`📬 Resend API Response:`, {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });

      if (!response.ok) {
        console.error(`❌ Failed to send test email:`, responseText);
        throw new Error(`Failed to send test email: ${response.status} ${responseText}`);
      }

      const result = JSON.parse(responseText);
      console.log(`✅ Test email sent successfully:`, result);

      return new Response(
        JSON.stringify({
          success: true,
          sent: 1,
          failed: 0,
          total: recipients.length,
          testMode: true,
          testEmail: TEST_EMAIL,
          message: `TEST MODE: Email inviata a ${TEST_EMAIL} con riepilogo di tutti i destinatari`,
          details: [{
            email: TEST_EMAIL,
            status: "fulfilled",
            originalRecipients: recipients.map(r => `${r.name} (${r.role})`)
          }]
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );

    } else {
      // PRODUCTION MODE: Send individual emails to all recipients
      console.log(`📤 Sending emails to ${recipients.length} recipients...`);
      
      const emailPromises = recipients.map(async (recipient) => {
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              from: "Studio Manager Pro <noreply@yourdomain.com>",
              to: [recipient.email],
              subject: `Nuovo Evento: ${request.eventoTitolo}`,
              html: emailHtml
            })
          });

          const responseText = await response.text();
          
          if (!response.ok) {
            console.error(`❌ Failed to send email to ${recipient.email}:`, responseText);
            return { email: recipient.email, status: "rejected", error: responseText };
          }

          const result = JSON.parse(responseText);
          console.log(`✅ Email sent to ${recipient.email}:`, result);
          return { email: recipient.email, status: "fulfilled", result };

        } catch (error) {
          console.error(`❌ Error sending email to ${recipient.email}:`, error);
          return { email: recipient.email, status: "rejected", error: error.message };
        }
      });

      const results = await Promise.all(emailPromises);
      const sent = results.filter(r => r.status === "fulfilled").length;
      const failed = results.filter(r => r.status === "rejected").length;

      console.log(`📊 Results: ${sent} sent, ${failed} failed`);

      return new Response(
        JSON.stringify({
          success: sent > 0,
          sent,
          failed,
          total: recipients.length,
          testMode: false,
          details: results
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: sent > 0 ? 200 : 500
        }
      );
    }

  } catch (error) {
    console.error("💥 Critical Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "Unknown error",
        sent: 0,
        failed: 0,
        total: 0,
        testMode: TEST_MODE,
        testEmail: TEST_MODE ? TEST_EMAIL : null
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});

function generateTestEmailTemplate(data: {
  recipients: Array<{ email: string; name: string; role: string }>;
  eventoTitolo: string;
  eventoData: string;
  eventoOraInizio: string;
  eventoOraFine: string;
  eventoLuogo?: string;
  eventoDescrizione?: string;
  responsabileNome: string;
  partecipantiNomi: string[];
  clienteNome?: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nuovo Evento in Agenda (TEST)</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- TEST MODE Banner -->
          <tr>
            <td style="background-color: #fef3c7; border-bottom: 3px solid #f59e0b; padding: 15px 30px; text-align: center;">
              <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 700;">
                🧪 MODALITÀ TEST - Questa è l'anteprima dell'email che verrà inviata ai destinatari
              </p>
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">🏢 REVISIONI COMMERCIALI</h1>
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 16px;">Studio Commercialista</p>
            </td>
          </tr>

          <!-- Event Badge -->
          <tr>
            <td style="padding: 30px; text-align: center;">
              <div style="background-color: #eff6ff; border-radius: 8px; padding: 15px 25px; display: inline-block;">
                <p style="margin: 0; color: #3b82f6; font-size: 18px; font-weight: 600;">📅 NUOVO EVENTO IN AGENDA</p>
              </div>
            </td>
          </tr>

          <!-- Recipients Info (TEST MODE) -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <div style="background-color: #f0fdf4; border: 2px solid #86efac; border-radius: 8px; padding: 20px;">
                <p style="margin: 0 0 10px 0; color: #15803d; font-size: 14px; font-weight: 700;">
                  📬 Destinatari che riceveranno questa email in produzione:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #166534;">
                  ${data.recipients.map(r => `
                    <li style="margin: 5px 0;">
                      <strong>${r.name}</strong> (${r.role}) - ${r.email}
                    </li>
                  `).join('')}
                </ul>
              </div>
            </td>
          </tr>

          <!-- Event Details -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; border: 2px solid #e5e7eb;">
                <tr>
                  <td style="padding: 25px;">
                    
                    <!-- Title -->
                    <div style="margin-bottom: 20px;">
                      <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Titolo</p>
                      <h2 style="margin: 0; color: #111827; font-size: 22px; font-weight: 700;">${data.eventoTitolo}</h2>
                    </div>

                    <!-- Date & Time -->
                    <div style="margin-bottom: 15px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td width="50%" style="padding-right: 10px;">
                            <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px;">📅 Data</p>
                            <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 600;">${data.eventoData}</p>
                          </td>
                          <td width="50%" style="padding-left: 10px;">
                            <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px;">⏰ Orario</p>
                            <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 600;">${data.eventoOraInizio} - ${data.eventoOraFine}</p>
                          </td>
                        </tr>
                      </table>
                    </div>

                    ${data.eventoLuogo ? `
                    <!-- Location -->
                    <div style="margin-bottom: 15px;">
                      <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px;">📍 Luogo</p>
                      <p style="margin: 0; color: #111827; font-size: 16px;">${data.eventoLuogo}</p>
                    </div>
                    ` : ''}

                    <!-- Responsabile -->
                    <div style="margin-bottom: 15px;">
                      <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px;">👤 Responsabile</p>
                      <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 600;">${data.responsabileNome}</p>
                    </div>

                    ${data.eventoDescrizione ? `
                    <!-- Description -->
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px;">📝 Descrizione</p>
                      <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">${data.eventoDescrizione}</p>
                    </div>
                    ` : ''}

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${data.partecipantiNomi && data.partecipantiNomi.length > 0 ? `
          <!-- Partecipanti -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Partecipanti:</p>
              <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 14px;">
                ${data.partecipantiNomi.map(nome => `<li style="margin: 5px 0;">${nome}</li>`).join('')}
              </ul>
            </td>
          </tr>
          ` : ''}

          ${data.clienteNome ? `
          <!-- Cliente -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Cliente:</p>
              <p style="margin: 0; color: #374151; font-size: 14px;">${data.clienteNome}</p>
            </td>
          </tr>
          ` : ''}

          <!-- Test Mode Notice -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 6px;">
                <p style="margin: 0 0 10px 0; color: #92400e; font-size: 14px; font-weight: 700;">
                  🧪 Modalità Test Attiva
                </p>
                <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.6;">
                  Questa email è stata inviata solo a <strong>martiola68@tiscali.it</strong> per test.<br>
                  Per abilitare l'invio a tutti i destinatari, cambia TEST_MODE = false nella Edge Function.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
                <strong>Revisioni Commerciali</strong>
              </p>
              <p style="margin: 0 0 5px 0; color: #9ca3af; font-size: 13px;">
                📧 info@revisionicommerciali.it
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 13px;">
                🌐 www.revisionicommerciali.it
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function generateProductionEmailTemplate(data: {
  eventoTitolo: string;
  eventoData: string;
  eventoOraInizio: string;
  eventoOraFine: string;
  eventoLuogo?: string;
  eventoDescrizione?: string;
  responsabileNome: string;
  partecipantiNomi: string[];
  clienteNome?: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nuovo Evento in Agenda</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">🏢 REVISIONI COMMERCIALI</h1>
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 16px;">Studio Commercialista</p>
            </td>
          </tr>

          <!-- Event Badge -->
          <tr>
            <td style="padding: 30px; text-align: center;">
              <div style="background-color: #eff6ff; border-radius: 8px; padding: 15px 25px; display: inline-block;">
                <p style="margin: 0; color: #3b82f6; font-size: 18px; font-weight: 600;">📅 NUOVO EVENTO IN AGENDA</p>
              </div>
            </td>
          </tr>

          <!-- Event Details -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; border: 2px solid #e5e7eb;">
                <tr>
                  <td style="padding: 25px;">
                    
                    <!-- Title -->
                    <div style="margin-bottom: 20px;">
                      <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Titolo</p>
                      <h2 style="margin: 0; color: #111827; font-size: 22px; font-weight: 700;">${data.eventoTitolo}</h2>
                    </div>

                    <!-- Date & Time -->
                    <div style="margin-bottom: 15px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td width="50%" style="padding-right: 10px;">
                            <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px;">📅 Data</p>
                            <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 600;">${data.eventoData}</p>
                          </td>
                          <td width="50%" style="padding-left: 10px;">
                            <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px;">⏰ Orario</p>
                            <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 600;">${data.eventoOraInizio} - ${data.eventoOraFine}</p>
                          </td>
                        </tr>
                      </table>
                    </div>

                    ${data.eventoLuogo ? `
                    <!-- Location -->
                    <div style="margin-bottom: 15px;">
                      <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px;">📍 Luogo</p>
                      <p style="margin: 0; color: #111827; font-size: 16px;">${data.eventoLuogo}</p>
                    </div>
                    ` : ''}

                    <!-- Responsabile -->
                    <div style="margin-bottom: 15px;">
                      <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px;">👤 Responsabile</p>
                      <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 600;">${data.responsabileNome}</p>
                    </div>

                    ${data.eventoDescrizione ? `
                    <!-- Description -->
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 12px;">📝 Descrizione</p>
                      <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">${data.eventoDescrizione}</p>
                    </div>
                    ` : ''}

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${data.partecipantiNomi && data.partecipantiNomi.length > 0 ? `
          <!-- Partecipanti -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Partecipanti:</p>
              <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 14px;">
                ${data.partecipantiNomi.map(nome => `<li style="margin: 5px 0;">${nome}</li>`).join('')}
              </ul>
            </td>
          </tr>
          ` : ''}

          ${data.clienteNome ? `
          <!-- Cliente -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Cliente:</p>
              <p style="margin: 0; color: #374151; font-size: 14px;">${data.clienteNome}</p>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
                <strong>Revisioni Commerciali</strong>
              </p>
              <p style="margin: 0 0 5px 0; color: #9ca3af; font-size: 13px;">
                📧 info@revisionicommerciali.it
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 13px;">
                🌐 www.revisionicommerciali.it
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}