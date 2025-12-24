import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get tomorrow's date range
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    // Fetch events for tomorrow from tbagenda
    const { data: events, error: eventsError } = await supabase
      .from("tbagenda")
      .select(`
        *,
        utente:tbutenti!tbagenda_utente_id_fkey(id, email, nome, cognome),
        cliente:tbclienti!tbagenda_cliente_id_fkey(id, email, ragione_sociale)
      `)
      .gte("data_inizio", tomorrow.toISOString())
      .lt("data_inizio", dayAfterTomorrow.toISOString());

    if (eventsError) throw eventsError;
    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ message: "No events for tomorrow", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;

    // Process each event
    for (const event of events) {
      const recipients: Array<{ email: string; name: string }> = [];

      // Check if reminder already sent to responsabile (utente)
      if (event.utente?.email) {
        const { data: existingReminder } = await supabase
          .from("event_reminders")
          .select("id")
          .eq("evento_id", event.id)
          .eq("sent_to", event.utente.email)
          .single();

        if (!existingReminder) {
          recipients.push({
            email: event.utente.email,
            name: `${event.utente.nome} ${event.utente.cognome}`
          });
        }
      }

      // Add partecipanti from JSONB column
      if (event.partecipanti && Array.isArray(event.partecipanti)) {
        // Parse partecipanti JSON
        // Structure expected: [{ value: "id", label: "Nome" }] or similar
        // Since we don't have direct email in JSON, we might need to fetch it
        // Or assume the JSON contains email
        
        // For now, let's skip JSON participants if email is not readily available
        // If partecipanti stores user IDs, we'd need to fetch them
      }

      // Add cliente
      if (event.cliente?.email) {
        const { data: existingClientReminder } = await supabase
          .from("event_reminders")
          .select("id")
          .eq("evento_id", event.id)
          .eq("sent_to", event.cliente.email)
          .single();

        if (!existingClientReminder) {
          recipients.push({
            email: event.cliente.email,
            name: event.cliente.ragione_sociale
          });
        }
      }

      // Send reminders
      for (const recipient of recipients) {
        const eventDate = new Date(event.data_inizio);
        const formattedDate = eventDate.toLocaleDateString("it-IT", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric"
        });

        const oraInizio = new Date(event.data_inizio).toLocaleTimeString("it-IT", { hour: '2-digit', minute: '2-digit' });
        const oraFine = new Date(event.data_fine).toLocaleTimeString("it-IT", { hour: '2-digit', minute: '2-digit' });

        const emailHtml = generateReminderTemplate({
          recipientName: recipient.name,
          eventoTitolo: event.titolo,
          eventoData: formattedDate,
          eventoOraInizio: oraInizio,
          eventoOraFine: oraFine,
          eventoLuogo: event.luogo || event.sala,
          eventoDescrizione: event.descrizione,
          responsabileNome: event.utente ? `${event.utente.nome} ${event.utente.cognome}` : "Studio"
        });

        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              from: "Revisioni Commerciali <info@revisionicommerciali.it>",
              to: [recipient.email],
              subject: `⏰ Promemoria: ${event.titolo} - Domani`,
              html: emailHtml
            })
          });

          if (response.ok) {
            // Record reminder as sent
            await supabase.from("event_reminders").insert({
              evento_id: event.id,
              sent_to: recipient.email
            });
            totalSent++;
          }
        } catch (emailError) {
          console.error(`Failed to send reminder to ${recipient.email}:`, emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        events_processed: events.length,
        reminders_sent: totalSent
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

function generateReminderTemplate(data: {
  recipientName: string;
  eventoTitolo: string;
  eventoData: string;
  eventoOraInizio: string;
  eventoOraFine: string;
  eventoLuogo?: string;
  eventoDescrizione?: string;
  responsabileNome: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Promemoria Evento</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">⏰ PROMEMORIA</h1>
              <p style="margin: 10px 0 0 0; color: #fef3c7; font-size: 16px;">Evento in programma domani</p>
            </td>
          </tr>

          <!-- Alert Badge -->
          <tr>
            <td style="padding: 30px; text-align: center;">
              <div style="background-color: #fef3c7; border-radius: 8px; padding: 15px 25px; display: inline-block; border: 2px solid #f59e0b;">
                <p style="margin: 0; color: #92400e; font-size: 18px; font-weight: 600;">📅 EVENTO DOMANI</p>
              </div>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Ciao <strong>${data.recipientName}</strong>,<br>
                Ti ricordiamo che domani hai in programma il seguente evento:
              </p>
            </td>
          </tr>

          <!-- Event Details -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 8px; border: 2px solid #f59e0b;">
                <tr>
                  <td style="padding: 25px;">
                    
                    <!-- Title -->
                    <div style="margin-bottom: 20px;">
                      <h2 style="margin: 0; color: #92400e; font-size: 22px; font-weight: 700;">${data.eventoTitolo}</h2>
                    </div>

                    <!-- Date & Time -->
                    <div style="margin-bottom: 15px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td width="50%" style="padding-right: 10px;">
                            <p style="margin: 0 0 5px 0; color: #92400e; font-size: 12px; font-weight: 600;">📅 Data</p>
                            <p style="margin: 0; color: #78350f; font-size: 16px; font-weight: 600;">${data.eventoData}</p>
                          </td>
                          <td width="50%" style="padding-left: 10px;">
                            <p style="margin: 0 0 5px 0; color: #92400e; font-size: 12px; font-weight: 600;">⏰ Orario</p>
                            <p style="margin: 0; color: #78350f; font-size: 16px; font-weight: 600;">${data.eventoOraInizio} - ${data.eventoOraFine}</p>
                          </td>
                        </tr>
                      </table>
                    </div>

                    ${data.eventoLuogo ? `
                    <!-- Location -->
                    <div style="margin-bottom: 15px;">
                      <p style="margin: 0 0 5px 0; color: #92400e; font-size: 12px; font-weight: 600;">📍 Luogo</p>
                      <p style="margin: 0; color: #78350f; font-size: 16px;">${data.eventoLuogo}</p>
                    </div>
                    ` : ''}

                    <!-- Responsabile -->
                    <div style="margin-bottom: 15px;">
                      <p style="margin: 0 0 5px 0; color: #92400e; font-size: 12px; font-weight: 600;">👤 Responsabile</p>
                      <p style="margin: 0; color: #78350f; font-size: 16px; font-weight: 600;">${data.responsabileNome}</p>
                    </div>

                    ${data.eventoDescrizione ? `
                    <!-- Description -->
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #fbbf24;">
                      <p style="margin: 0 0 5px 0; color: #92400e; font-size: 12px; font-weight: 600;">📝 Descrizione</p>
                      <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6;">${data.eventoDescrizione}</p>
                    </div>
                    ` : ''}

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 30px 40px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(data.eventoTitolo)}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(245, 158, 11, 0.3);">
                      📅 Visualizza in Calendar
                    </a>
                  </td>
                </tr>
              </table>
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