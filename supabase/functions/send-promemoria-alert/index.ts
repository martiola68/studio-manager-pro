import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      destinatarioEmail,
      destinatarioNome,
      promemoriaTitolo,
      promemoriaDescrizione,
      dataScadenza,
      priorita,
      giorniRimanenti,
      tipoAlert,
    } = await req.json();

    if (!destinatarioEmail || !promemoriaTitolo || !dataScadenza) {
      throw new Error("Dati mancanti per invio email promemoria");
    }

    const subject =
      tipoAlert === "7_giorni"
        ? `Promemoria in scadenza tra 7 giorni: ${promemoriaTitolo}`
        : `Promemoria in scadenza tra 2 giorni: ${promemoriaTitolo}`;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #222;">
        <h2>Promemoria in scadenza</h2>
        <p>Ciao ${destinatarioNome || ""},</p>
        <p>
          Ti ricordiamo che il promemoria <strong>${promemoriaTitolo}</strong>
          scadrà il <strong>${dataScadenza}</strong>.
        </p>
        <p><strong>Giorni rimanenti:</strong> ${giorniRimanenti}</p>
        <p><strong>Priorità:</strong> ${priorita || "-"}</p>
        ${
          promemoriaDescrizione
            ? `<p><strong>Descrizione:</strong><br>${promemoriaDescrizione}</p>`
            : ""
        }
        <p>Questo è un messaggio automatico di Studio Manager Pro.</p>
      </div>
    `;

    // QUI sostituisci con il provider che usate già adesso
    // Esempio generico via webhook/provider esterno
    const emailApiUrl = Deno.env.get("EMAIL_API_URL");
    const emailApiKey = Deno.env.get("EMAIL_API_KEY");

    if (!emailApiUrl || !emailApiKey) {
      throw new Error("Configurazione email mancante");
    }

    const emailResponse = await fetch(emailApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${emailApiKey}`,
      },
      body: JSON.stringify({
        to: destinatarioEmail,
        subject,
        html,
      }),
    });

    const emailResult = await emailResponse.text();

    if (!emailResponse.ok) {
      throw new Error(`Errore provider email: ${emailResult}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email promemoria inviata",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
