import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";
import { emailService } from "@/services/emailService";

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

    // Verify user session
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    // Get user email
    const { data: profile, error: profileError } = await supabase
      .from("tbpersonale")
      .select("email")
      .eq("id_user", user.id)
      .single();

    if (profileError || !profile?.email) {
      return res.status(400).json({ error: "Email utente non trovata" });
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

    // Send email
    await emailService.sendEmail({
      to: profile.email,
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
    });

    return res.status(200).json({ 
      success: true, 
      message: "Email inviata con successo",
      recipients: [profile.email]
    });
  } catch (error) {
    console.error("Error sending email alert:", error);
    return res.status(500).json({ 
      error: "Errore nell'invio dell'email",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}