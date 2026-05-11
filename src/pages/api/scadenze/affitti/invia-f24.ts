import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendEmailServer } from "@/services/sendEmailServer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

function formatDateIT(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("it-IT");
}

function formatEuroIT(value?: string | number | null) {
  if (value == null || value === "") return "-";
  const n = Number(String(value).replace(",", "."));
  if (Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function buildF24Html(body: any) {
  
  return `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; background:#f3f4f6; font-family:Arial, Helvetica, sans-serif; color:#111827;">
  <div style="max-width:760px; margin:0 auto; padding:28px 16px;">
    <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:14px; overflow:hidden;">

      <div style="background:#1d4ed8; color:#ffffff; padding:24px 28px;">
        <div style="font-size:22px; font-weight:700; letter-spacing:0.2px;">
          Fac simile modello F24 Elide
        </div>
        <div style="font-size:13px; margin-top:6px; opacity:0.95;">
          Contratto di affitto — Imposta di registro
        </div>
      </div>

      <div style="padding:26px 28px;">
        <p style="margin:0 0 16px 0; font-size:15px; line-height:1.6;">
          In allegato si trasmette il fac simile del modello F24 Elide relativo al contratto di affitto indicato di seguito.
        </p>

        <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:16px; margin:18px 0;">
          <div style="font-size:13px; font-weight:700; color:#1d4ed8; text-transform:uppercase; margin-bottom:12px;">
            Dati contratto
          </div>

          <table style="width:100%; border-collapse:collapse; font-size:14px;">
            <tr>
              <td style="padding:7px 0; color:#6b7280;">Locatore</td>
              <td style="padding:7px 0; text-align:right; font-weight:700;">${body.locatore || "-"}</td>
            </tr>
            <tr>
              <td style="padding:7px 0; color:#6b7280;">Conduttore</td>
              <td style="padding:7px 0; text-align:right; font-weight:700;">${body.conduttore || "-"}</td>
            </tr>
            <tr>
              <td style="padding:7px 0; color:#6b7280;">Immobile</td>
              <td style="padding:7px 0; text-align:right; font-weight:700;">${body.immobile || "-"}</td>
            </tr>
            <tr>
              <td style="padding:7px 0; color:#6b7280;">Codice identificativo registrazione</td>
              <td style="padding:7px 0; text-align:right; font-weight:700;">${body.codice_identificativo_registrazione || "-"}</td>
            </tr>
          </table>
        </div>

        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:16px; margin:20px 0;">
          <div style="font-size:13px; font-weight:700; color:#1d4ed8; text-transform:uppercase; margin-bottom:12px;">
            Sezione Erario ed Altro
          </div>

          <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <tr>
              <td style="padding:0 6px 6px 0; color:#6b7280;">Tipo</td>
              <td style="padding:0 6px 6px 0; color:#6b7280;">Elementi identificativi</td>
              <td style="padding:0 6px 6px 0; color:#6b7280;">Codice</td>
              <td style="padding:0 6px 6px 0; color:#6b7280;">Anno riferimento</td>
              <td style="padding:0 0 6px 0; color:#6b7280;">Importo</td>
            </tr>
            <tr>
              <td style="padding:11px 10px; background:#ffffff; border:1px solid #dbeafe; font-weight:700; text-align:center;">
                ${body.tipo_tributo || "F"}
              </td>
              <td style="padding:11px 10px; background:#ffffff; border:1px solid #dbeafe; font-weight:700;">
                ${body.codice_identificativo_registrazione || "-"}
              </td>
              <td style="padding:11px 10px; background:#ffffff; border:1px solid #dbeafe; font-weight:700; text-align:center;">
                ${body.codice_tributo || "1501"}
              </td>
              <td style="padding:11px 10px; background:#ffffff; border:1px solid #dbeafe; font-weight:700; text-align:center;">
                ${body.anno_riferimento || "-"}
              </td>
              <td style="padding:11px 10px; background:#ffffff; border:1px solid #dbeafe; font-weight:700; text-align:right;">
                ${formatEuroIT(body.importo_registrazione)}
              </td>
            </tr>
          </table>
        </div>

        <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; padding:16px; margin:20px 0;">
          <div style="font-size:14px; line-height:1.6;">
            Il pagamento dovrà essere effettuato entro il giorno
            <strong>${formatDateIT(body.data_pagamento)}</strong>.
          </div>
          <div style="font-size:12px; color:#6b7280; margin-top:6px;">
            Scadenza originaria: ${formatDateIT(body.data_scadenza)}
          </div>
        </div>

        <p style="margin:24px 0 0 0; font-size:15px; line-height:1.6;">
          Cordiali saluti
        </p>
      </div>

      <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:14px 28px; text-align:center; font-size:12px; color:#6b7280;">
        Comunicazione generata automaticamente da Studio Manager Pro.
      </div>
    </div>
  </div>
</body>
</html>
`.trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  }

  try {
    const body = req.body || {};

    if (!body.studio_id) {
      return res.status(400).json({
        success: false,
        error: "Studio mancante.",
      });
    }

    if (!body.destinatario) {
      return res.status(400).json({
        success: false,
        error: "Destinatario mancante.",
      });
    }

  if (!body.mittente_user_id) {
  return res.status(400).json({
    success: false,
    error: "Utente mittente mancante.",
  });
}

const { data: sender, error: senderError } = await supabase
  .from("tbutenti")
  .select("id, studio_id")
  .eq("id", body.mittente_user_id)
  .eq("studio_id", body.studio_id)
  .maybeSingle();

if (senderError || !sender?.id) {
  return res.status(400).json({
    success: false,
    error: "Utente mittente non trovato.",
  });
}

    const { data: studio, error: studioError } = await (supabase as any)
      .from("tbstudio")
      .select("microsoft_connection_id")
      .eq("id", body.studio_id)
      .maybeSingle();

    if (studioError || !studio?.microsoft_connection_id) {
      return res.status(400).json({
        success: false,
        error: "Connessione Microsoft dello studio mancante.",
      });
    }

    const subject = `Fac simile F24 Elide - ${body.locatore || "Contratto affitto"}`;

    const html = buildF24Html(body);

    const emailResult = await sendEmailServer({
      senderUserId: sender.id,
      microsoftConnectionId: studio.microsoft_connection_id,
      to: body.destinatario,
      subject,
      html,
    });

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        error: emailResult.error || "Invio email non riuscito.",
      });
    }

    if (body.contratto_id) {
      await (supabase as any)
        .from("tbscadaffitti")
        .update({
          data_invio_f24: new Date().toISOString(),
        })
        .eq("id", body.contratto_id)
        .eq("studio_id", body.studio_id);
    }

    return res.status(200).json({
      success: true,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore invio F24.",
    });
  }
}
