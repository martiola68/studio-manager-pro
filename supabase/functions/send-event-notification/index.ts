import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const request: EventNotificationRequest = await req.json();

    // Generate confirmation tokens
    const confirmationTokens = new Map<string, string>();
    
    // Prepare recipients list
    const recipients: Array<{ email: string; name: string; role: string }> = [];
    
    // Add responsabile
    const respToken = crypto.randomUUID();
    confirmationTokens.set(request.responsabileEmail, respToken);
    recipients.push({
      email: request.responsabileEmail,
      name: request.responsabileNome,
      role: "responsabile"
    });

    // Add partecipanti
    for (let i = 0; i < request.partecipantiEmails.length; i++) {
      const email = request.partecipantiEmails[i];
      const name = request.partecipantiNomi[i];
      const token = crypto.randomUUID();
      confirmationTokens.set(email, token);
      recipients.push({ email, name, role: "partecipante" });
    }

    // Add cliente if present
    if (request.clienteEmail && request.clienteNome) {
      const clientToken = crypto.randomUUID();
      confirmationTokens.set(request.clienteEmail, clientToken);
      recipients.push({
        email: request.clienteEmail,
        name: request.clienteNome,
        role: "cliente"
      });
    }

    // Store confirmation tokens in database
    const confirmations = Array.from(confirmationTokens.entries()).map(([email, token]) => {
      const recipient = recipients.find(r => r.email === email);
      return {
        evento_id: request.eventoId,
        user_email: email,
        user_name: recipient?.name || email,
        token: token,
        confirmed: false
      };
    });

    await supabase.from("event_confirmations").insert(confirmations);

    // Format date and time for display
    const eventDate = new Date(request.eventoData);
    const formattedDate = eventDate.toLocaleDateString("it-IT", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    // Send emails to all recipients
    const emailPromises = recipients.map(async (recipient) => {
      const token = confirmationTokens.get(recipient.email)!;
      const confirmUrl = `${SUPABASE_URL.replace('.supabase.co', '')}/functions/v1/confirm-event-participation?token=${token}`;
      
      const emailHtml = generateEmailTemplate({
        recipientName: recipient.name,
        recipientRole: recipient.role,
        eventoTitolo: request.eventoTitolo,
        eventoData: formattedDate,
        eventoOraInizio: request.eventoOraInizio,
        eventoOraFine: request.eventoOraFine,
        eventoLuogo: request.eventoLuogo,
        eventoDescrizione: request.eventoDescrizione,
        responsabileNome: request.responsabileNome,
        partecipantiNomi: request.partecipantiNomi,
        clienteNome: request.clienteNome,
        confirmUrl
      });

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "Revisioni Commerciali <info@revisionicommerciali.it>",
          to: [recipient.email],
          subject: `📅 Nuovo Evento: ${request.eventoTitolo}`,
          html: emailHtml
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`Failed to send email to ${recipient.email}:`, error);
        throw new Error(`Failed to send email to ${recipient.email}`);
      }

      return await response.json();
    });

    const results = await Promise.allSettled(emailPromises);
    const successful = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;

    return new Response(
      JSON.stringify({
        success: true,
        sent: successful,
        failed: failed,
        total: recipients.length
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function generateEmailTemplate(data: {
  recipientName: string;
  recipientRole: string;
  eventoTitolo: string;
  eventoData: string;
  eventoOraInizio: string;
  eventoOraFine: string;
  eventoLuogo?: string;
  eventoDescrizione?: string;
  responsabileNome: string;
  partecipantiNomi: string[];
  clienteNome?: string;
  confirmUrl: string;
}): string {
  const roleLabel = data.recipientRole === "responsabile" 
    ? "Responsabile" 
    : data.recipientRole === "cliente" 
    ? "Cliente" 
    : "Partecipante";

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

          <!-- Greeting -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Ciao <strong>${data.recipientName}</strong>,<br>
                Sei stato invitato come <strong>${roleLabel}</strong> al seguente evento:
              </p>
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

          ${data.partecipantiNomi.length > 0 ? `
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

          <!-- CTA Buttons -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 15px;">
                    <a href="${data.confirmUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                      ✅ Conferma Partecipazione
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(data.eventoTitolo)}&dates=${data.eventoData}/${data.eventoData}&details=${encodeURIComponent(data.eventoDescrizione || '')}" target="_blank" style="display: inline-block; background-color: #f3f4f6; color: #374151; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-size: 14px; font-weight: 500; border: 2px solid #e5e7eb;">
                      📅 Aggiungi a Google Calendar
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Reminder Notice -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 6px;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  💡 <strong>Promemoria:</strong> Riceverai un reminder 24 ore prima dell'evento.
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