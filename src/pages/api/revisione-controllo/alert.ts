import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/services/emailService";

const SECRET = process.env.CRON_SECRET || "x9KfP2LmQ8zYtA71vBnR";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatDateIT(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("it-IT");
}

function diffDays(dateString: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(`${dateString}T00:00:00`);
  target.setHours(0, 0, 0, 0);

  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function tipoLabel(tipo: string) {
  const map: Record<string, string> = {
    REVISIONE_LEGALE: "Revisione legale",
    SOCIETA_REVISIONE: "Società di revisione",
    SINDACO_UNICO: "Sindaco unico",
    COLLEGIO_SINDACALE: "Collegio sindacale",
    ORGANO_UNICO_DOPPIA_FUNZIONE: "Organo unico doppia funzione",
    SINDACO_COLLEGIO_PIU_REVISORE: "Sindaco/Collegio + Revisore",
  };

  return map[tipo] || tipo;
}

function getAlertConfig(days: number, controllo: any) {
  if (days === 15 && !controllo.alert_15gg_inviato) {
    return {
      flag: "alert_15gg_inviato",
      livello: "15GG",
      subject: "Controllo trimestrale in scadenza tra 15 giorni",
    };
  }

  if (days === 7 && !controllo.alert_7gg_inviato) {
    return {
      flag: "alert_7gg_inviato",
      livello: "7GG",
      subject: "ATTENZIONE - Controllo trimestrale in scadenza tra 7 giorni",
    };
  }

  if (days === 0 && !controllo.alert_oggi_inviato) {
    return {
      flag: "alert_oggi_inviato",
      livello: "OGGI",
      subject: "SCADENZA ODIERNA controllo trimestrale",
    };
  }

  if (days < 0 && !controllo.alert_scaduto_inviato) {
    return {
      flag: "alert_scaduto_inviato",
      livello: "SCADUTO",
      subject: "CONTROLLO TRIMESTRALE SCADUTO",
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

  const querySecret = typeof req.query.secret === "string" ? req.query.secret : null;

  if (!SECRET || querySecret !== SECRET) {
    return res.status(401).json({
      success: false,
      error: "Non autorizzato",
    });
  }

  try {
    const { data: controlli, error } = await supabaseAdmin
      .from("vw_revisione_controlli")
      .select("*")
      .neq("stato", "COMPLETATO");

    if (error) throw error;

    const results: any[] = [];

    for (const controllo of controlli || []) {
      const days = diffDays(controllo.data_scadenza);
      const config = getAlertConfig(days, controllo);

      if (!config) {
        results.push({
          controllo_id: controllo.id,
          sent: false,
          reason: "nessun alert da inviare",
          days,
        });
        continue;
      }

      let destinatarioEmail: string | null = null;

      if (controllo.responsabile_id) {
        const { data: responsabile } = await supabaseAdmin
          .from("tbutenti")
          .select("email")
          .eq("id", controllo.responsabile_id)
          .single();

        destinatarioEmail = responsabile?.email || null;
      }

      if (!destinatarioEmail) {
        results.push({
          controllo_id: controllo.id,
          sent: false,
          reason: "nessun responsabile/email trovato",
          livello: config.livello,
        });
        continue;
      }

      const html = `
        <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
          <h2>${config.subject}</h2>

          <p><strong>Società:</strong> ${controllo.ragione_sociale}</p>
          <p><strong>Tipo incarico:</strong> ${tipoLabel(controllo.tipo_incarico)}</p>
          <p><strong>Trimestre:</strong> ${controllo.trimestre}/${controllo.anno}</p>
          <p><strong>Data scadenza:</strong> ${formatDateIT(controllo.data_scadenza)}</p>

          <p>
            Accedi a Studio Manager Pro per completare o aggiornare il controllo trimestrale.
          </p>
        </div>
      `;

      const text = `
${config.subject}

Società: ${controllo.ragione_sociale}
Tipo incarico: ${tipoLabel(controllo.tipo_incarico)}
Trimestre: ${controllo.trimestre}/${controllo.anno}
Data scadenza: ${formatDateIT(controllo.data_scadenza)}

Accedi a Studio Manager Pro per completare o aggiornare il controllo trimestrale.
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
          .from("tbrevisione_controlli")
          .update({
            [config.flag]: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", controllo.id);

        if (updateError) throw updateError;
      }

      await supabaseAdmin.from("tbalert_log").insert({
        tipo_alert: "REVISIONE_CONTROLLO",
        marker_univoco: `revisione_${controllo.id}_${config.livello}`,
        destinatario: destinatarioEmail,
        oggetto: config.subject,
        esito: emailResult.success ? "OK" : "ERRORE",
        errore: emailResult.success ? null : emailResult.error,
        created_at: new Date().toISOString(),
      });

      results.push({
        controllo_id: controllo.id,
        cliente: controllo.ragione_sociale,
        livello: config.livello,
        sent: emailResult.success,
        email: destinatarioEmail,
        error: emailResult.success ? null : emailResult.error,
      });
    }

    return res.status(200).json({
      success: true,
      checked: controlli?.length || 0,
      sent: results.filter((r) => r.sent).length,
      results,
    });
  } catch (error: any) {
    console.error("Errore alert revisione-controllo:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore alert revisione-controllo",
    });
  }
}
