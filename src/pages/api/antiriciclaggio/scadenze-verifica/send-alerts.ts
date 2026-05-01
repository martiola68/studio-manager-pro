import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { microsoftGraphService } from "@/services/microsoftGraphService";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GIORNI_ALERT = [30, 15, 7, 0];

function formatDateIT(value: string) {
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.query.secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: "Non autorizzato" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDates = GIORNI_ALERT.map((giorni) => {
      const d = new Date(today);
      d.setDate(d.getDate() + giorni);

      return {
        giorni,
        date: d.toISOString().slice(0, 10),
      };
    });

    const scadenze = targetDates.map((x) => x.date);

    const { data: av1Rows, error: av1Error } = await supabaseAdmin
      .from("tbAV1")
      .select(`
        id,
        studio_id,
        cliente_id,
        pratica_id,
        ScadenzaVerifica,
        tbclienti (
          id,
          ragione_sociale,
          cod_cliente
        )
      `)
      .not("pratica_id", "is", null)
      .not("ScadenzaVerifica", "is", null)
      .in("ScadenzaVerifica", scadenze);

    if (av1Error) throw av1Error;

    let processate = 0;
    let inviate = 0;
    let saltate = 0;

    const debugEmails: any[] = [];

    for (const av1 of av1Rows || []) {
      processate++;

      const praticaId = av1.pratica_id;
      const scadenzaVerifica = av1.ScadenzaVerifica;

      const debug: any = {
        pratica_id: praticaId,
        av1_id_usato_solo_debug: av1.id,
        scadenza_verifica: scadenzaVerifica,
        step: "inizio",
      };

      debugEmails.push(debug);

      if (!praticaId || !scadenzaVerifica) {
        debug.motivo_salto = "pratica_id o ScadenzaVerifica mancanti";
        saltate++;
        continue;
      }

      const target = targetDates.find((x) => x.date === scadenzaVerifica);

      if (!target) {
        debug.motivo_salto = "scadenza non nel range alert";
        saltate++;
        continue;
      }

      debug.giorni_prima = target.giorni;

      const { data: pratica, error: praticaError } = await supabaseAdmin
        .from("tbPraticheAML")
        .select(`
          id,
          studio_id,
          cliente_id,
          operatore_responsabile_id,
          tipo_prestazione,
          stato
        `)
        .eq("id", praticaId)
        .maybeSingle();

      if (praticaError || !pratica) {
        debug.motivo_salto = praticaError?.message || "pratica non trovata";
        saltate++;
        continue;
      }

      debug.studio_id = pratica.studio_id;
      debug.cliente_id = pratica.cliente_id;
      debug.operatore_responsabile_id = pratica.operatore_responsabile_id;
      debug.stato_pratica = pratica.stato;

      const cliente = Array.isArray((av1 as any).tbclienti)
        ? (av1 as any).tbclienti[0]
        : (av1 as any).tbclienti;

      const nomeCliente =
        cliente?.ragione_sociale ||
        cliente?.cod_cliente ||
        `Cliente ${pratica.cliente_id || av1.cliente_id || ""}`.trim();

      debug.cliente = nomeCliente;

      const { data: alreadySent, error: alreadySentError } = await supabaseAdmin
        .from("tbAVScadenzeVerificaAlert")
        .select("id")
        .eq("pratica_id", pratica.id)
        .eq("giorni_prima", target.giorni)
        .eq("scadenza_verifica", scadenzaVerifica)
        .maybeSingle();

      if (alreadySentError) {
        debug.motivo_salto = alreadySentError.message;
        saltate++;
        continue;
      }

      if (alreadySent) {
        debug.motivo_salto = "alert già inviato";
        saltate++;
        continue;
      }

      if (!pratica.operatore_responsabile_id) {
        debug.motivo_salto = "operatore_responsabile_id mancante";
        saltate++;
        continue;
      }

      const { data: operatore, error: operatoreError } = await supabaseAdmin
        .from("tbutenti")
        .select("id, email, nome, cognome")
        .eq("id", pratica.operatore_responsabile_id)
        .maybeSingle();

      debug.email_trovata = operatore?.email || null;
      debug.nome_operatore = operatore
        ? [operatore.nome, operatore.cognome].filter(Boolean).join(" ")
        : null;

      if (operatoreError || !operatore?.email) {
        debug.motivo_salto =
          operatoreError?.message || "email operatore mancante";
        saltate++;
        continue;
      }

      const { data: studio, error: studioError } = await supabaseAdmin
        .from("tbstudio")
        .select("email, microsoft_connection_id")
        .eq("id", pratica.studio_id)
        .maybeSingle();

      debug.studio_email = studio?.email || null;
      debug.microsoft_connection_id = studio?.microsoft_connection_id || null;

      if (studioError || !studio?.microsoft_connection_id) {
        debug.motivo_salto =
          studioError?.message || "Connessione Microsoft studio mancante";
        saltate++;
        continue;
      }

      const emailDestinatario = operatore.email;

      const nomeOperatore = [operatore.nome, operatore.cognome]
        .filter(Boolean)
        .join(" ");

      const giorniLabel =
        target.giorni === 0 ? "oggi" : `tra ${target.giorni} giorni`;

      const subject = `Scadenza verifica AML ${giorniLabel} - ${nomeCliente}`;

      const html = `
        <div style="font-family: Arial, sans-serif; color: #111827; font-size: 14px; line-height: 1.6;">
          <h2 style="margin: 0 0 16px 0; color: #b45309;">
            Scadenza verifica AML
          </h2>

          <p>Ciao ${nomeOperatore || ""},</p>

          <p>
            la verifica AML del cliente <strong>${nomeCliente}</strong>
            scade <strong>${giorniLabel}</strong>.
          </p>

          <div style="margin: 18px 0; padding: 14px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;">
            <p style="margin: 0;">
              <strong>Data scadenza:</strong> ${formatDateIT(scadenzaVerifica)}
            </p>
            <p style="margin: 6px 0 0 0;">
              <strong>Tipo prestazione:</strong> ${pratica.tipo_prestazione || "-"}
            </p>
          </div>

          <p>
            Verifica se la pratica deve essere rinnovata oppure archiviata.
          </p>

          <p style="margin-top: 24px; color: #6b7280; font-size: 12px;">
            Questa è una email automatica, non rispondere a questo messaggio.
          </p>
        </div>
      `.trim();

      try {
        debug.step = "invio_email";

        await microsoftGraphService.sendEmail(
          operatore.id,
          studio.microsoft_connection_id,
          {
            subject,
            body: {
              contentType: "HTML",
              content: html,
            },
            toRecipients: [
              {
                emailAddress: {
                  address: emailDestinatario,
                },
              },
            ],
          }
        );

        debug.step = "email_inviata";
      } catch (sendError: any) {
        debug.motivo_salto =
          sendError?.message || "Errore invio Microsoft Graph";
        saltate++;
        continue;
      }

      const { error: insertAlertError } = await supabaseAdmin
        .from("tbAVScadenzeVerificaAlert")
        .insert({
          studio_id: pratica.studio_id,
          pratica_id: pratica.id,
          cliente_id: pratica.cliente_id || av1.cliente_id,
          giorni_prima: target.giorni,
          scadenza_verifica: scadenzaVerifica,
          destinatario_email: emailDestinatario,
        });

      if (insertAlertError) {
        debug.alert_salvato = false;
        debug.errore_salvataggio_alert = insertAlertError.message;
      } else {
        debug.alert_salvato = true;
      }

      inviate++;
    }

    return res.status(200).json({
      ok: true,
      processate,
      inviate,
      saltate,
      debugEmails,
    });
  } catch (err: any) {
    console.error("Errore cron scadenze verifica AML:", err);

    return res.status(500).json({
      ok: false,
      error: err?.message || "Errore cron scadenze verifica AML",
    });
  }
}
