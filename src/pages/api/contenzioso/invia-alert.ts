import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/services/emailService";

const SECRET = process.env.CRON_SECRET || "x9KfP2LmQ8zYtA71vBnR";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Metodo non consentito" });
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
    await (supabase as any).rpc("genera_alert_contenzioso_base");

    const { data: alert, error: alertError } = await (supabase as any)
      .from("tbcontenzioso_alert_email")
      .select("*")
      .eq("inviato", false)
      .is("errore", null)
      .order("created_at", { ascending: true })
      .limit(20);

    if (alertError) {
      return res.status(500).json({
        success: false,
        error: alertError.message,
      });
    }

    let processati = 0;
    let inviati = 0;
    let falliti = 0;
    let giaInviati = 0;
    let logCreati = 0;

    for (const item of alert || []) {
      processati++;

      const tipoAlert = `${item.giorni_preavviso || 0}gg`;
      const markerUnivoco = `contenzioso:${item.pratica_id}:${tipoAlert}:${item.data_scadenza}:${item.email_destinatario}`;

      const { data: logEsistente } = await (supabase as any)
        .from("tbalert_log")
        .select("id")
        .eq("marker_univoco", markerUnivoco)
        .maybeSingle();

      if (logEsistente) {
        giaInviati++;

        await (supabase as any)
          .from("tbcontenzioso_alert_email")
          .update({
            inviato: true,
            inviato_at: new Date().toISOString(),
            errore: null,
          })
          .eq("id", item.id);

        continue;
      }

      try {
        const { data: operatore, error: operatoreError } = await (supabase as any)
          .from("tbutenti")
          .select("id, email, microsoft_connection_id, studio_id")
          .eq("id", item.operatore_responsabile_id)
          .maybeSingle();

        if (operatoreError || !operatore?.id || !operatore?.microsoft_connection_id) {
          throw new Error("Operatore senza connessione Microsoft valida");
        }

        const result = await sendEmail({
          to: item.email_destinatario,
          subject: item.oggetto,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <h2 style="color:#dc2626;">Promemoria scadenza contenzioso</h2>
              <p>${item.corpo}</p>
              <hr />
              <p style="font-size:12px;color:#666;">
                Studio Manager Pro - Email automatica
              </p>
            </div>
          `,
          text: item.corpo,
          senderUserId: operatore.id,
          microsoftConnectionId: operatore.microsoft_connection_id,
          sendMode: "user",
        });

        await (supabase as any).from("tbalert_log").insert({
          studio_id: operatore.studio_id || null,
          modulo: "contenzioso",
          riferimento_tabella: "tbcontenzioso_alert_email",
          riferimento_id: item.id,
          tipo_alert: tipoAlert,
          data_scadenza: item.data_scadenza,
          giorni_preavviso: item.giorni_preavviso,
          destinatario_utente_id: item.operatore_responsabile_id,
          destinatario_email: item.email_destinatario,
          messaggio_interno_creato: false,
          email_inviata: !!result.success,
          marker_univoco: markerUnivoco,
          errore: result.success ? null : String(result.error || "Errore invio email"),
          inviato_at: new Date().toISOString(),
        });

        logCreati++;

        if (!result.success) {
          throw new Error(result.error || "Invio email non riuscito");
        }

        await (supabase as any)
          .from("tbcontenzioso_alert_email")
          .update({
            inviato: true,
            inviato_at: new Date().toISOString(),
            errore: null,
          })
          .eq("id", item.id);

        inviati++;
      } catch (error: any) {
        falliti++;

        await (supabase as any)
          .from("tbcontenzioso_alert_email")
          .update({
            errore: error?.message || "Errore invio email",
          })
          .eq("id", item.id);

        await (supabase as any).from("tbalert_log").insert({
          studio_id: null,
          modulo: "contenzioso",
          riferimento_tabella: "tbcontenzioso_alert_email",
          riferimento_id: item.id,
          tipo_alert: tipoAlert,
          data_scadenza: item.data_scadenza,
          giorni_preavviso: item.giorni_preavviso,
          destinatario_utente_id: item.operatore_responsabile_id,
          destinatario_email: item.email_destinatario,
          messaggio_interno_creato: false,
          email_inviata: false,
          marker_univoco: `${markerUnivoco}:errore:${Date.now()}`,
          errore: error?.message || "Errore invio email",
          inviato_at: new Date().toISOString(),
        });

        logCreati++;
      }
    }

    return res.status(200).json({
      success: true,
      processati,
      inviati,
      falliti,
      gia_inviati: giaInviati,
      log_creati: logCreati,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore invio alert contenzioso",
    });
  }
}
