import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationData {
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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: NotificationData = await req.json();
    console.log("🔍 DEBUG - Inizio invio notifiche email per evento:", data.eventoId);

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY non configurata");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Recupera informazioni studio per footer email
    const { data: studioData } = await supabase
      .from("tbstudio")
      .select("ragione_sociale, indirizzo, telefono, email, sito_web")
      .single();

    const studioInfo = studioData || {};

    // Lista di tutti i destinatari (escluso il responsabile che è il mittente)
    const allRecipients: string[] = [];

    // Aggiungi partecipanti
    if (data.partecipantiEmails && data.partecipantiEmails.length > 0) {
      allRecipients.push(...data.partecipantiEmails);
    }

    // Aggiungi cliente
    if (data.clienteEmail) {
      allRecipients.push(data.clienteEmail);
    }

    console.log("📧 Dati email preparati:", {
      mittente: data.responsabileEmail,
      destinatari: allRecipients,
      eventoTitolo: data.eventoTitolo,
      eventoData: data.eventoData,
    });

    const results = [];

    // Invia email a tutti i destinatari
    for (let i = 0; i < allRecipients.length; i++) {
      const recipient = allRecipients[i];
      const isPartecipante = data.partecipantiEmails.includes(recipient);
      const isCliente = recipient === data.clienteEmail;

      const recipientName = isPartecipante
        ? data.partecipantiNomi[data.partecipantiEmails.indexOf(recipient)]
        : isCliente
        ? data.clienteNome
        : "Destinatario";

      try {
        const emailHtml = generateEmailTemplate({
          ...data,
          recipientName,
          recipientEmail: recipient,
          isPartecipante,
          isCliente,
          studioInfo,
        });

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `${data.responsabileNome} <${data.responsabileEmail}>`,
            to: [recipient],
            subject: `Nuovo evento: ${data.eventoTitolo} - ${data.eventoData}`,
            html: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error(`❌ Failed to send email to ${recipient}:`, errorText);
          results.push({
            recipient,
            success: false,
            error: errorText,
          });
        } else {
          const responseData = await emailResponse.json();
          console.log(`✅ Email sent successfully to ${recipient}:`, responseData);
          results.push({
            recipient,
            success: true,
            messageId: responseData.id,
          });
        }
      } catch (error) {
        console.error(`💥 Exception sending email to ${recipient}:`, error);
        results.push({
          recipient,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notifiche inviate: ${successCount} riuscite, ${failureCount} fallite`,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("💥 Errore critico:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

function generateEmailTemplate(data: any): string {
  const {
    eventoTitolo,
    eventoData,
    eventoOraInizio,
    eventoOraFine,
    eventoLuogo,
    eventoDescrizione,
    responsabileNome,
    recipientName,
    isPartecipante,
    isCliente,
    eventoId,
    studioInfo,
  } = data;

  const confirmUrl = `${SUPABASE_URL}/functions/v1/confirm-event-participation?eventoId=${eventoId}&userId=${recipientName}`;

  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nuovo Evento in Agenda</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">
                📅 Nuovo Evento in Agenda
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px;">
                Ciao <strong>${recipientName}</strong>,
              </p>
              
              <p style="margin: 0 0 30px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                ${isPartecipante 
                  ? `Sei stato invitato a partecipare al seguente evento da <strong>${responsabileNome}</strong>:` 
                  : isCliente 
                  ? `È stato programmato un evento per te da <strong>${responsabileNome}</strong>:` 
                  : `Ti informiamo del seguente evento organizzato da <strong>${responsabileNome}</strong>:`}
              </p>

              <!-- Evento Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8f9fa; border-left: 4px solid #667eea; border-radius: 4px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <h2 style="margin: 0 0 15px 0; color: #667eea; font-size: 20px;">
                      ${eventoTitolo}
                    </h2>
                    
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #666666; font-size: 14px;">📅 <strong>Data:</strong></span>
                          <span style="color: #333333; font-size: 14px;">${eventoData}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #666666; font-size: 14px;">🕐 <strong>Orario:</strong></span>
                          <span style="color: #333333; font-size: 14px;">${eventoOraInizio} - ${eventoOraFine}</span>
                        </td>
                      </tr>
                      ${eventoLuogo ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #666666; font-size: 14px;">📍 <strong>Luogo:</strong></span>
                          <span style="color: #333333; font-size: 14px;">${eventoLuogo}</span>
                        </td>
                      </tr>
                      ` : ''}
                      ${eventoDescrizione ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #666666; font-size: 14px;">📝 <strong>Descrizione:</strong></span>
                          <p style="margin: 5px 0 0 0; color: #333333; font-size: 14px; line-height: 1.5;">${eventoDescrizione}</p>
                        </td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #666666; font-size: 14px;">👤 <strong>Organizzatore:</strong></span>
                          <span style="color: #333333; font-size: 14px;">${responsabileNome}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${isPartecipante ? `
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${confirmUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                      ✅ Conferma Partecipazione
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}

              <p style="margin: 20px 0 0 0; color: #999999; font-size: 13px; line-height: 1.6;">
                ${isPartecipante 
                  ? 'Ti preghiamo di confermare la tua partecipazione cliccando sul pulsante sopra.' 
                  : 'Riceverai ulteriori comunicazioni se necessario.'}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0;">
              ${studioInfo.ragione_sociale ? `<p style="margin: 0 0 10px 0; color: #333333; font-size: 14px; font-weight: bold;">${studioInfo.ragione_sociale}</p>` : ''}
              ${studioInfo.indirizzo ? `<p style="margin: 5px 0; color: #666666; font-size: 12px;">${studioInfo.indirizzo}</p>` : ''}
              ${studioInfo.telefono ? `<p style="margin: 5px 0; color: #666666; font-size: 12px;">Tel: ${studioInfo.telefono}</p>` : ''}
              ${studioInfo.email ? `<p style="margin: 5px 0; color: #666666; font-size: 12px;">Email: ${studioInfo.email}</p>` : ''}
              ${studioInfo.sito_web ? `<p style="margin: 5px 0; color: #666666; font-size: 12px;">Web: ${studioInfo.sito_web}</p>` : ''}
              
              <p style="margin: 15px 0 0 0; color: #999999; font-size: 11px;">
                Questa è una notifica automatica. Si prega di non rispondere a questa email.
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