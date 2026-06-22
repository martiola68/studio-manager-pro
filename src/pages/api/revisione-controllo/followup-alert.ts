import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/services/emailService";

const SECRET = process.env.CRON_SECRET || "x9KfP2LmQ8zYtA71vBnR";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatDateIT(value?: string | null) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("it-IT");
}

function diffDays(dateString: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(`${dateString}T00:00:00`);
  target.setHours(0, 0, 0, 0);

  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function getAlertConfig(days: number, item: any) {
  if (days === 15 && !item.alert_15gg_inviato) {
    return {
      flag: "alert_15gg_inviato",
      livello: "15GG",
      subject: "Follow-up revisione in scadenza tra 15 giorni",
    };
  }

  if (days === 7 && !item.alert_7gg_inviato) {
    return {
      flag: "alert_7gg_inviato",
      livello: "7GG",
      subject: "ATTENZIONE - Follow-up revisione in scadenza tra 7 giorni",
    };
  }

  if (days === 0 && !item.alert_oggi_inviato) {
    return {
      flag: "alert_oggi_inviato",
      livello: "OGGI",
      subject: "SCADENZA ODIERNA follow-up revisione",
    };
  }

  if (days < 0 && !item.alert_scaduto_inviato) {
    return {
      flag: "alert_scaduto_inviato",
      livello: "SCADUTO",
      subject: "FOLLOW-UP REVISIONE SCADUTO",
    };
  }

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  }

  const querySecret =
    typeof req.query.secret === "string" ? req.query.secret : null;

  if (!SECRET || querySecret !== SECRET) {
    return res.status(401).json({
      success: false,
      error: "Non autorizzato",
    });
  }

  try {
    const { data: followups, error } = await supabaseAdmin
      .from("tbrevisione_followup")
      .select(`
        *,
        controllo:tbrevisione_controlli(
          id,
          incarico_id,
          incarico:tbrevisione_incarichi(
            id,
            cliente_id,
            responsabile_id,
            cliente:tbclienti(
              ragione_sociale
            ),
            responsabile:tbutenti(
              email,
              nome,
              cognome
            )
          )
        )
      `)
      .eq("completato", false)
      .not("data_scadenza", "is", null);

    if (error) throw error;

    const results: any[] = [];

    for (const item of followups || []) {
      const days = diffDays(item.data_scadenza);
      const config = getAlertConfig(days, item);

      if (!config) {
        results.push({
          followup_id: item.id,
          sent: false,
          reason: "nessun alert da inviare",
          days,
        });
        continue;
      }

      const incarico = item.controllo?.incarico;
      const cliente = incarico?.cliente?.ragione_sociale || "Cliente non indicato";
      const responsabile = incarico?.responsabile;
      const destinatarioEmail = responsabile?.email || null;

      if (!destinatarioEmail) {
        results.push({
          followup_id: item.id,
          sent: false,
          reason: "nessun responsabile/email trovato",
          livello: config.livello,
        });
        continue;
      }

      const html = `
        <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
          <h2>${config.subject}</h2>

          <p><strong>Cliente:</strong> ${cliente}</p>
          <p><strong>Descrizione:</strong> ${item.descrizione}</p>
          <p><strong>Gravità:</strong> ${item.gravita || "-"}</p>
          <p><strong>Scadenza:</strong> ${formatDateIT(item.data_scadenza)}</p>
          <p><strong>Note:</strong> ${item.note || "-"}</p>

          <p>
            Accedi a Studio Manager Pro → Revisione e controllo → Follow-up per gestire la voce.
          </p>
        </div>
      `;

      const text = `
${config.subject}

Cliente: ${cliente}
Descrizione: ${item.descrizione}
Gravità: ${item.gravita || "-"}
Scadenza: ${formatDateIT(item.data_scadenza)}
Note: ${item.note || "-"}

Accedi a Studio Manager Pro → Revisione e controllo → Follow-up per gestire la voce.
`.trim();

      const emailResult = await sendEmail({
        to: destinatarioEmail,
        subject: config.subject,
        html,
        text,
        sendMode: "studio",
      });

      if (emailResult.success) {
        const { error: updateError } = await supabaseAdmin
          .from("tbrevisione_followup")
          .update({
            [config.flag]: true,
          })
          .eq("id", item.id);

        if (updateError) throw updateError;
      }

      await supabaseAdmin.from("tbalert_log").insert({
        tipo_alert: "REVISIONE_FOLLOWUP",
        marker_univoco: `revisione_followup_${item.id}_${config.livello}`,
        destinatario: destinatarioEmail,
        oggetto: config.subject,
        esito: emailResult.success ? "OK" : "ERRORE",
        errore: emailResult.success ? null : emailResult.error,
        created_at: new Date().toISOString(),
      });

      results.push({
        followup_id: item.id,
        cliente,
        livello: config.livello,
        sent: emailResult.success,
        email: destinatarioEmail,
        error: emailResult.success ? null : emailResult.error,
      });
    }

    return res.status(200).json({
      success: true,
      checked: followups?.length || 0,
      sent: results.filter((r) => r.sent).length,
      results,
    });
  } catch (error: any) {
    console.error("Errore alert follow-up revisione:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore alert follow-up revisione",
    });
  }
}
