import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user?.email) {
      return res.status(401).json({
        error: "Sessione non valida",
        details: authError?.message || "Utente non disponibile",
      });
    }

    const { promemoriaId, motivazione } = req.body;

    if (!promemoriaId || !motivazione) {
      return res.status(400).json({
        error: "promemoriaId e motivazione sono obbligatori",
      });
    }

    // utente loggato
    const { data: currentUser, error: currentUserError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, nome, cognome, email")
      .eq("email", user.email)
      .single();

    if (currentUserError || !currentUser) {
      return res.status(404).json({
        error: "Utente mittente non trovato",
        details: currentUserError?.message,
      });
    }

    // promemoria
    const { data: promemoria, error: promemoriaError } = await supabaseAdmin
      .from("tbpromemoria")
      .select("id, titolo, descrizione, data_scadenza, operatore_id, destinatario_id")
      .eq("id", promemoriaId)
      .single();

    if (promemoriaError || !promemoria) {
      return res.status(404).json({
        error: "Promemoria non trovato",
        details: promemoriaError?.message,
      });
    }

    // creatore promemoria = destinatario email
    const { data: creatore, error: creatoreError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, nome, cognome, email")
      .eq("id", promemoria.operatore_id)
      .single();

    if (creatoreError || !creatore?.email) {
      return res.status(404).json({
        error: "Creatore promemoria non trovato",
        details: creatoreError?.message,
      });
    }

    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const loginUrl = `${appBaseUrl.replace(/\/$/, "")}/login`;

    const html = `
      <div style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:700px;margin:0 auto;background:#ffffff;">
          <div style="background:#7c3aed;padding:28px 24px;text-align:center;color:#ffffff;">
            <div style="font-size:38px;font-weight:700;line-height:1.2;">📩 Richiesta confronto</div>
            <div style="font-size:22px;margin-top:10px;">Studio Manager Pro</div>
          </div>

          <div style="padding:36px 32px;color:#111827;">
            <h1 style="margin:0 0 24px 0;font-size:42px;line-height:1.15;font-weight:700;">
              Ciao ${escapeHtml(creatore.nome || "")},
            </h1>

            <p style="font-size:20px;line-height:1.7;margin:0 0 22px 0;">
              L'utente <strong>${escapeHtml(
                `${currentUser.nome || ""} ${currentUser.cognome || ""}`.trim()
              )}</strong>
              ha richiesto un confronto sul seguente promemoria.
            </p>

            <div style="border-left:6px solid #7c3aed;background:#f9fafb;padding:22px;margin:24px 0 28px 0;border-radius:8px;">
              <div style="font-size:18px;margin-bottom:12px;"><strong>Titolo:</strong> ${escapeHtml(promemoria.titolo || "-")}</div>
              <div style="font-size:18px;margin-bottom:12px;"><strong>Descrizione:</strong> ${escapeHtml(promemoria.descrizione || "-")}</div>
              <div style="font-size:18px;"><strong>Scadenza:</strong> ${escapeHtml(promemoria.data_scadenza || "-")}</div>
            </div>

            <div style="font-size:22px;font-weight:700;color:#7c3aed;margin-bottom:12px;">
              Motivazione
            </div>

            <div style="background:#eef2f7;padding:18px;border-radius:8px;font-size:20px;line-height:1.7;white-space:pre-wrap;">
              ${escapeHtml(motivazione)}
            </div>

            <div style="text-align:center;margin:36px 0;">
              <a
                href="${loginUrl}"
                style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:18px 34px;border-radius:10px;font-size:28px;font-weight:700;"
                target="_blank"
                rel="noopener noreferrer"
              >
                Accedi Ora
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    const edgeBaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(
      ".supabase.co",
      ".supabase.co/functions/v1"
    );

    if (!edgeBaseUrl) {
      return res.status(500).json({
        error: "URL Supabase non configurato",
      });
    }

    const sendEmailResponse = await fetch(`${edgeBaseUrl}/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      },
      body: JSON.stringify({
        to: creatore.email,
        subject: `Richiesta confronto - ${promemoria.titolo || "Promemoria"}`,
        html,
        text: `Richiesta confronto

Mittente: ${currentUser.nome || ""} ${currentUser.cognome || ""}
Titolo: ${promemoria.titolo || "-"}
Descrizione: ${promemoria.descrizione || "-"}
Scadenza: ${promemoria.data_scadenza || "-"}
Motivazione: ${motivazione}

Accedi: ${loginUrl}`,
      }),
    });

    const sendEmailResult = await sendEmailResponse.json().catch(() => null);

    if (!sendEmailResponse.ok || !sendEmailResult?.success) {
      return res.status(500).json({
        error: "Errore invio email",
        details: sendEmailResult?.error || sendEmailResult?.message || "Invio fallito",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Richiesta confronto inviata con successo",
    });
  } catch (error: any) {
    console.error("Errore API richiesta-confronto-email:", error);
    return res.status(500).json({
      error: "Errore interno del server",
      details: error.message,
    });
  }
}
