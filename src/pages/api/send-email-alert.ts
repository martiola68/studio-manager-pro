import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";
import nodemailer from "nodemailer";

interface OperatorClients {
  operatorEmail: string;
  operatorName: string;
  clients: Array<{
    ragione_sociale: string;
    giorni_a: number | null;
    giorni_b: number | null;
  }>;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Verifica autenticazione
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    // Recupera dati dalla richiesta
    const { operators } = req.body as { operators: OperatorClients[] };

    if (!operators || operators.length === 0) {
      return res.status(400).json({ error: "Nessun operatore specificato" });
    }

    // Verifica configurazione SMTP
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpFrom = process.env.SMTP_FROM || "Studio Manager Pro <noreply@revisionicommerciali.it>";

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
      return res.status(500).json({ 
        error: "Configurazione SMTP non completa",
        details: "Verifica che SMTP_HOST, SMTP_PORT, SMTP_USER e SMTP_PASSWORD siano configurati in .env.local"
      });
    }

    // Configura trasportatore SMTP
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpPort === "465", // true per porta 465, false per altre
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    // Invia email per ogni operatore
    const sentEmails: string[] = [];
    const failedEmails: string[] = [];

    for (const operator of operators) {
      try {
        // Costruisci lista clienti
        const clientsList = operator.clients
          .map((c) => {
            const parts = [`• ${c.ragione_sociale}`];
            const scadenze: string[] = [];
            
            if (c.giorni_a !== null && c.giorni_a < 15) {
              scadenze.push(`Scadenza A: ${c.giorni_a} giorni`);
            }
            if (c.giorni_b !== null && c.giorni_b < 15) {
              scadenze.push(`Scadenza B: ${c.giorni_b} giorni`);
            }
            
            if (scadenze.length > 0) {
              parts.push(`\n  ${scadenze.join(" • ")}`);
            }
            
            return parts.join("");
          })
          .join("\n\n");

        // Corpo email HTML
        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .client-list { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626; }
    .client-item { margin-bottom: 15px; }
    .client-name { font-weight: bold; color: #111827; font-size: 16px; }
    .scadenza { color: #dc2626; font-weight: 600; margin-left: 20px; font-size: 14px; }
    .footer { background-color: #111827; color: #9ca3af; padding: 20px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px; }
    .urgent-badge { background-color: #dc2626; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ REPORT URGENTE SCADENZE ANTIRICICLAGGIO</h1>
    </div>
    <div class="content">
      <p>Gentile <strong>${operator.operatorName}</strong>,</p>
      
      <p>Ci sono <span class="urgent-badge">${operator.clients.length} CLIENTI</span> assegnati a te con scadenze antiriciclaggio urgenti (< 15 giorni):</p>
      
      <div class="client-list">
${operator.clients.map((c) => {
  const scadenze: string[] = [];
  if (c.giorni_a !== null && c.giorni_a < 15) {
    scadenze.push(`<div class="scadenza">→ Scadenza A: <strong>${c.giorni_a} giorni</strong></div>`);
  }
  if (c.giorni_b !== null && c.giorni_b < 15) {
    scadenze.push(`<div class="scadenza">→ Scadenza B: <strong>${c.giorni_b} giorni</strong></div>`);
  }
  return `        <div class="client-item">
          <div class="client-name">${c.ragione_sociale}</div>
${scadenze.join("\n")}
        </div>`;
}).join("\n")}
      </div>
      
      <p style="color: #dc2626; font-weight: bold;">⚠️ Si prega di procedere con le verifiche necessarie quanto prima.</p>
      
      <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
        Per visualizzare tutti i dettagli, accedi al <strong>Studio Manager Pro</strong> → Scadenze → Antiriciclaggio.
      </p>
    </div>
    <div class="footer">
      Email generata automaticamente da <strong>Studio Manager Pro</strong><br>
      Revisioni Commerciali • ${new Date().toLocaleDateString("it-IT")}
    </div>
  </div>
</body>
</html>
`;

        // Corpo email plain text
        const textBody = `
REPORT URGENTE SCADENZE ANTIRICICLAGGIO

Gentile ${operator.operatorName},

Ci sono ${operator.clients.length} clienti assegnati a te con scadenze antiriciclaggio urgenti (< 15 giorni):

${clientsList}

⚠️ Si prega di procedere con le verifiche necessarie quanto prima.

Per visualizzare tutti i dettagli, accedi al Studio Manager Pro → Scadenze → Antiriciclaggio.

---
Email generata automaticamente da Studio Manager Pro
Revisioni Commerciali • ${new Date().toLocaleDateString("it-IT")}
`;

        // Invia email
        await transporter.sendMail({
          from: smtpFrom,
          to: operator.operatorEmail,
          subject: `⚠️ REPORT URGENTE SCADENZE ANTIRICICLAGGIO (${operator.clients.length})`,
          text: textBody,
          html: htmlBody,
        });

        sentEmails.push(operator.operatorEmail);
      } catch (emailError) {
        console.error(`Error sending email to ${operator.operatorEmail}:`, emailError);
        failedEmails.push(operator.operatorEmail);
      }
    }

    // Risposta
    if (failedEmails.length === 0) {
      return res.status(200).json({
        success: true,
        message: `Email inviate con successo a ${sentEmails.length} operatore/i`,
        sent: sentEmails,
      });
    } else {
      return res.status(207).json({
        success: true,
        message: `Email inviate a ${sentEmails.length} operatore/i, ${failedEmails.length} fallite`,
        sent: sentEmails,
        failed: failedEmails,
      });
    }
  } catch (error) {
    console.error("Error sending email alert:", error);
    return res.status(500).json({
      error: "Errore nell'invio dell'email",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}