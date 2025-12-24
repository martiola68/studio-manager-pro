import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(
      getErrorPage("Token mancante"),
      {
        headers: { "Content-Type": "text/html" },
        status: 400
      }
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find confirmation by token
    const { data: confirmation, error } = await supabase
      .from("event_confirmations")
      .select("*, evento:tbagenda(*)")
      .eq("token", token)
      .single();

    if (error || !confirmation) {
      return new Response(
        getErrorPage("Token non valido o scaduto"),
        {
          headers: { "Content-Type": "text/html" },
          status: 404
        }
      );
    }

    // Check if already confirmed
    if (confirmation.confirmed) {
      return new Response(
        getSuccessPage(confirmation, true),
        {
          headers: { "Content-Type": "text/html" },
          status: 200
        }
      );
    }

    // Update confirmation
    await supabase
      .from("event_confirmations")
      .update({
        confirmed: true,
        confirmed_at: new Date().toISOString()
      })
      .eq("token", token);

    return new Response(
      getSuccessPage(confirmation, false),
      {
        headers: { "Content-Type": "text/html" },
        status: 200
      }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      getErrorPage("Errore durante la conferma"),
      {
        headers: { "Content-Type": "text/html" },
        status: 500
      }
    );
  }
});

function getSuccessPage(confirmation: any, alreadyConfirmed: boolean): string {
  const eventDate = new Date(confirmation.evento.data_inizio);
  const formattedDate = eventDate.toLocaleDateString("it-IT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  
  const oraInizio = new Date(confirmation.evento.data_inizio).toLocaleTimeString("it-IT", { hour: '2-digit', minute: '2-digit' });
  const oraFine = new Date(confirmation.evento.data_fine).toLocaleTimeString("it-IT", { hour: '2-digit', minute: '2-digit' });

  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conferma Partecipazione</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
      animation: bounce 1s ease;
    }
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-20px); }
    }
    h1 {
      color: #111827;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .subtitle {
      color: ${alreadyConfirmed ? '#f59e0b' : '#10b981'};
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 30px;
    }
    .event-details {
      background: #f9fafb;
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 30px;
      text-align: left;
    }
    .detail-row {
      margin-bottom: 15px;
      display: flex;
      align-items: flex-start;
    }
    .detail-row:last-child { margin-bottom: 0; }
    .detail-icon {
      font-size: 20px;
      margin-right: 12px;
      min-width: 24px;
    }
    .detail-content {
      flex: 1;
    }
    .detail-label {
      color: #6b7280;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .detail-value {
      color: #111827;
      font-size: 16px;
      font-weight: 600;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      transition: transform 0.2s;
    }
    .button:hover {
      transform: translateY(-2px);
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${alreadyConfirmed ? '⚠️' : '✅'}</div>
    <h1>${alreadyConfirmed ? 'Già Confermato' : 'Partecipazione Confermata!'}</h1>
    <p class="subtitle">
      ${alreadyConfirmed 
        ? 'Hai già confermato la tua partecipazione a questo evento' 
        : 'La tua presenza è stata registrata con successo'}
    </p>

    <div class="event-details">
      <div class="detail-row">
        <div class="detail-icon">📅</div>
        <div class="detail-content">
          <div class="detail-label">Evento</div>
          <div class="detail-value">${confirmation.evento.titolo}</div>
        </div>
      </div>
      
      <div class="detail-row">
        <div class="detail-icon">🗓️</div>
        <div class="detail-content">
          <div class="detail-label">Data</div>
          <div class="detail-value">${formattedDate}</div>
        </div>
      </div>
      
      <div class="detail-row">
        <div class="detail-icon">⏰</div>
        <div class="detail-content">
          <div class="detail-label">Orario</div>
          <div class="detail-value">${oraInizio} - ${oraFine}</div>
        </div>
      </div>

      ${confirmation.evento.luogo ? `
      <div class="detail-row">
        <div class="detail-icon">📍</div>
        <div class="detail-content">
          <div class="detail-label">Luogo</div>
          <div class="detail-value">${confirmation.evento.luogo}</div>
        </div>
      </div>
      ` : ''}
    </div>

    <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(confirmation.evento.titolo)}" target="_blank" class="button">
      📅 Aggiungi a Google Calendar
    </a>

    <div class="footer">
      <strong>Revisioni Commerciali</strong><br>
      info@revisionicommerciali.it
    </div>
  </div>
</body>
</html>
  `;
}

function getErrorPage(message: string): string {
  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Errore</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #111827;
      font-size: 28px;
      margin-bottom: 10px;
    }
    p {
      color: #6b7280;
      font-size: 16px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">❌</div>
    <h1>Errore</h1>
    <p>${message}</p>
  </div>
</body>
</html>
  `;
}