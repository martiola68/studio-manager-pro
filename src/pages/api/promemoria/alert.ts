import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmailServer } from "@/services/sendEmailServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Metodo non consentito" });
  }

  const cronSecret = process.env.CRON_SECRET || "x9KfP2LmQ8zYtA71vBnR";
  const querySecret = typeof req.query.secret === "string" ? req.query.secret : null;

  if (!cronSecret || querySecret !== cronSecret) {
    return res.status(401).json({ success: false, error: "Non autorizzato" });
  }

  const supabase = getSupabaseAdmin();

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  const traSetteGiorni = new Date(oggi);
  traSetteGiorni.setDate(traSetteGiorni.getDate() + 7);

  const oggiIso = oggi.toISOString().split("T")[0];
  const setteGiorniIso = traSetteGiorni.toISOString().split("T")[0];

  try {
    const { data: promemoria, error } = await supabase
      .from("tbpromemoria")
      .select(`
        *,
        destinatario:tbutenti!destinatario_id (
          id, nome, cognome, email
        )
      `)
      .neq("working_progress", "Completato")
      .in("data_scadenza", [oggiIso, setteGiorniIso]);

    if (error) throw error;

    let emailInviate = 0;
    let emailFallite = 0;
    let saltati = 0;
    let giaInviati = 0;
    let logCreati = 0;

    for (const p of promemoria || []) {
      const scadenza = new Date(p.data_scadenza);
      scadenza.setHours(0, 0, 0, 0);

      const giorniRimasti = Math.round(
        (scadenza.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24)
      );

      const tipoAlert = giorniRimasti === 7 ? "7gg" : "oggi";

      if (
        (tipoAlert === "7gg" && p.alert_7gg_inviato) ||
        (tipoAlert === "oggi" && p.alert_oggi_inviato)
      ) {
        giaInviati++;
        continue;
      }

      if (!p.studio_id || !p.destinatario?.email) {
        saltati++;
        continue;
      }

      const markerUnivoco = `promemoria:${p.id}:${tipoAlert}:${p.data_scadenza}`;

      const { data: logEsistente } = await supabase
        .from("tbalert_log")
        .select("id")
        .eq("marker_univoco", markerUnivoco)
        .maybeSingle();

      if (logEsistente) {
        giaInviati++;
        continue;
      }

      const { data: studio, error: studioError } = await supabase
        .from("tbstudio")
        .select("microsoft_connection_id")
        .eq("id", p.studio_id)
        .maybeSingle();

      if (studioError || !studio?.microsoft_connection_id) {
        saltati++;
        continue;
      }

      const subject =
        tipoAlert === "7gg"
          ? `Promemoria in scadenza tra 7 giorni: ${p.titolo}`
          : `Promemoria in scadenza oggi: ${p.titolo}`;

      const html = `
        <div style="font-family: Arial, sans-serif; font-size: 14px; color: #1f2937; line-height: 1.6;">
          <p>Gentile ${p.destinatario.nome || "utente"},</p>
          <p>${
            tipoAlert === "7gg"
              ? "ti ricordiamo che il seguente promemoria andrà in scadenza tra 7 giorni."
              : "ti ricordiamo che il seguente promemoria scade oggi."
          }</p>
          <ul>
            <li><strong>Titolo:</strong> ${p.titolo}</li>
            <li><strong>Scadenza:</strong> ${new Date(p.data_scadenza).toLocaleDateString("it-IT")}</li>
            <li><strong>Priorità:</strong> ${p.priorita || "-"}</li>
            <li><strong>Stato:</strong> ${p.working_progress || "-"}</li>
            <li><strong>Descrizione:</strong> ${p.descrizione || "Nessuna descrizione"}</li>
          </ul>
        </div>
      `.trim();

      const result = await sendEmailServer({
        senderUserId: p.operatore_id,
        microsoftConnectionId: studio.microsoft_connection_id,
        to: p.destinatario.email,
        subject,
        html,
      });

      await supabase.from("tbalert_log").insert({
        studio_id: p.studio_id,
        modulo: "promemoria",
        riferimento_tabella: "tbpromemoria",
        riferimento_id: p.id,
        tipo_alert: tipoAlert,
        data_scadenza: p.data_scadenza,
        giorni_preavviso: tipoAlert === "7gg" ? 7 : 0,
        destinatario_utente_id: p.destinatario?.id || p.destinatario_id,
        destinatario_email: p.destinatario.email,
        messaggio_interno_creato: false,
        email_inviata: !!result.success,
        marker_univoco: markerUnivoco,
        errore: result.success ? null : String(result.error || "Errore invio email"),
        inviato_at: new Date().toISOString(),
      });

      logCreati++;

      if (result.success) {
        emailInviate++;

        await supabase
          .from("tbpromemoria")
          .update(
            tipoAlert === "7gg"
              ? {
                  alert_7gg_inviato: true,
                  alert_7gg_inviato_at: new Date().toISOString(),
                }
              : {
                  alert_oggi_inviato: true,
                  alert_oggi_inviato_at: new Date().toISOString(),
                }
          )
          .eq("id", p.id);
      } else {
        emailFallite++;
        console.error("Errore email promemoria:", result.error);
      }
    }

    return res.status(200).json({
      success: true,
      date: { oggiIso, setteGiorniIso },
      promemoria_trovati: promemoria?.length || 0,
      email_inviate: emailInviate,
      email_fallite: emailFallite,
      gia_inviati: giaInviati,
      log_creati: logCreati,
      saltati,
    });
  } catch (error: any) {
    console.error("Errore alert promemoria:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno",
    });
  }
}
