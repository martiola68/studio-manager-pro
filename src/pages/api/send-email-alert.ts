import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";

interface EmailAlertRequest {
  urgentClients: Array<{
    ragione_sociale: string;
    giorni_a?: number | null;
    giorni_b?: number | null;
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
    // Get user from authorization header
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    // Verify user session and get email directly from Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || !user.email) {
      return res.status(401).json({ error: "Non autenticato o email non disponibile" });
    }

    // Parse request body
    const { urgentClients } = req.body as EmailAlertRequest;

    if (!urgentClients || urgentClients.length === 0) {
      return res.status(400).json({ error: "Nessun cliente urgente specificato" });
    }

    // Build email content
    const rows = urgentClients
      .map((c) => {
        const parts = [`- ${c.ragione_sociale}:`];
        if (c.giorni_a !== null && c.giorni_a !== undefined) {
          parts.push(`Scad. A: ${c.giorni_a}gg`);
        }
        if (c.giorni_b !== null && c.giorni_b !== undefined) {
          parts.push(`Scad. B: ${c.giorni_b}gg`);
        }
        return parts.join(" ");
      })
      .join("\n");

    const emailSubject = `⚠️ REPORT URGENTE SCADENZE ANTIRICICLAGGIO (${urgentClients.length})`;
    const emailHtml = `
      <h2>Scadenze Antiriciclaggio Urgenti</h2>
      <p>Attenzione, rilevate scadenze urgenti (< 15 giorni):</p>
      <pre style="background: #f5f5f5; padding: 16px; border-radius: 8px; font-family: monospace;">
${rows}
      </pre>
      <p style="color: #666; font-size: 12px; margin-top: 24px;">
        Email generata automaticamente dal sistema Studio Manager Pro
      </p>
    `;

    const emailText = `Scadenze Antiriciclaggio Urgenti\n\nAttenzione, rilevate scadenze urgenti (< 15 giorni):\n\n${rows}\n\n---\nEmail generata automaticamente dal sistema Studio Manager Pro`;

    // Send email using Resend API (same as emailService)
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY non configurata");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: "Studio Manager Pro <noreply@studiomanagerpro.com>",
        to: [user.email],
        subject: emailSubject,
        html: emailHtml,
        text: emailText
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Errore Resend: ${JSON.stringify(errorData)}`);
    }

    return res.status(200).json({ 
      success: true, 
      message: "Email inviata con successo",
      recipients: [user.email]
    });
  } catch (error) {
    console.error("Error sending email alert:", error);
    return res.status(500).json({ 
      error: "Errore nell'invio dell'email",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}