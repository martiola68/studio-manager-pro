import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmailServer } from "@/services/sendEmailServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Metodo non consentito" });
  }

  try {
    const { promemoria_id, nuovo_stato } = req.body || {};

    if (!promemoria_id) {
      return res.status(400).json({ success: false, error: "promemoria_id obbligatorio" });
    }

    const supabase = getSupabaseAdmin();

    const { data: promemoria, error } = await supabase
      .from("tbpromemoria")
      .select(`
        id,
        titolo,
        descrizione,
        data_scadenza,
        working_progress,
        studio_id,
        operatore:tbutenti!tbpromemoria_operatore_id_fkey(id, nome, cognome, email),
        destinatario:tbutenti!tbpromemoria_destinatario_id_fkey(id, nome, cognome, email)
      `)
      .eq("id", promemoria_id)
      .single();

    if (error) throw error;

    if (!promemoria?.operatore?.email) {
      return res.status(200).json({ success: true, skipped: "Operatore senza email" });
    }

    if (!promemoria?.destinatario?.id) {
      return res.status(200).json({ success: true, skipped: "Destinatario mancante" });
    }

    if (promemoria.operatore.id === promemoria.destinatario.id) {
      return res.status(200).json({ success: true, skipped: "Stesso utente" });
    }

    const { data: studio } = await supabase
      .from("tbstudio")
      .select("microsoft_connection_id")
      .eq("id", promemoria.studio_id)
      .maybeSingle();

    if (!studio?.microsoft_connection_id) {
      return res.status(400).json({
        success: false,
        error: "Connessione Microsoft studio mancante",
      });
    }

    const mittenteNome = [promemoria.destinatario.nome, promemoria.destinatario.cognome]
      .filter(Boolean)
      .join(" ");

    const destinatarioNome = promemoria.operatore.nome || "utente";

    const dataScadenza = promemoria.data_scadenza
      ? new Date(promemoria.data_scadenza).toLocaleDateString("it-IT")
      : "-";

    const subject = `Aggiornamento stato promemoria: ${promemoria.titolo || "Promemoria"}`;

    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #1f2937; line-height: 1.6;">
        <p>Gentile ${destinatarioNome},</p>

        <p>
          ${mittenteNome || "Un utente"} ha aggiornato lo stato del promemoria che avevi assegnato.
        </p>

        <p><strong>Dettagli promemoria</strong></p>

        <ul>
          <li><strong>Titolo:</strong> ${promemoria.titolo || "-"}</li>
          <li><strong>Nuovo stato:</strong> ${nuovo_stato || promemoria.working_progress || "-"}</li>
          <li><strong>Scadenza:</strong> ${dataScadenza}</li>
          <li><strong>Descrizione:</strong> ${promemoria.descrizione || "-"}</li>
        </ul>

        <p>Accedi a Studio Manager Pro per visualizzare il promemoria.</p>
      </div>
    `.trim();

    const emailResult = await sendEmailServer({
      senderUserId: promemoria.destinatario.id,
      microsoftConnectionId: studio.microsoft_connection_id,
      to: promemoria.operatore.email,
      subject,
      html,
    });

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        error: emailResult.error || "Errore invio email",
      });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Errore email cambio stato promemoria:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno",
    });
  }
}
