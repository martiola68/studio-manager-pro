import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";

interface EmailAlert {
  operatorEmail: string;
  operatorName: string;
  clients: Array<{
    ragione_sociale: string;
    urgentDeadlines: Array<{
      tipo: string;
      giorni: number;
    }>;
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
    const { alerts } = req.body as { alerts: EmailAlert[] };

    if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
      return res.status(400).json({ error: "No alerts provided" });
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpFrom = process.env.SMTP_FROM;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !smtpFrom) {
      return res.status(500).json({
        error: "SMTP configuration missing",
        details: "Please configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM in .env.local"
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: false,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    const emailPromises = alerts.map(async (alert) => {
      const clientsList = alert.clients
        .map((client) => {
          const deadlines = client.urgentDeadlines
            .map((d) => `Scad. ${d.tipo}: ${d.giorni}gg`)
            .join(" • ");
          return `- ${client.ragione_sociale}: ${deadlines}`;
        })
        .join("\n");

      const subject = `⚠️ SCADENZE ANTIRICICLAGGIO URGENTI - ${alert.clients.length} Cliente/i`;

      const body = `Gentile ${alert.operatorName},

Sono state rilevate scadenze antiriciclaggio urgenti (< 15 giorni) per i seguenti tuoi clienti:

${clientsList}

Ti invitiamo a verificare e completare gli adempimenti entro le scadenze indicate.

---
Email generata automaticamente dal sistema Studio Manager Pro
Data: ${new Date().toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })} - ${new Date().toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;

      return transporter.sendMail({
        from: smtpFrom,
        to: alert.operatorEmail,
        subject,
        text: body,
      });
    });

    await Promise.all(emailPromises);

    return res.status(200).json({
      success: true,
      message: `Email inviate a ${alerts.length} operatore/i`,
      sentCount: alerts.length,
    });
  } catch (error) {
    console.error("Error sending email alerts:", error);
    return res.status(500).json({
      error: "Failed to send email alerts",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}