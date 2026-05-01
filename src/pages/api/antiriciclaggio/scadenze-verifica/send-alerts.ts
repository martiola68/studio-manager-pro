import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/services/emailService";

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
    const secret = req.query.secret;

    if (secret !== process.env.CRON_SECRET) {
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
      .in("ScadenzaVerifica", scadenze);

    if (av1Error) throw av1Error;

    let processate = 0;
    let inviate = 0;
    let saltate = 0;

    for (const av1 of av1Rows || []) {
      processate++;

      if (!av1.pratica_id || !av1.ScadenzaVerifica) {
        saltate++;
        continue;
      }

      const { data: pratica, error: praticaError } = await supabaseAdmin
        .from("tbPraticheAML")
        .select(`
          id,
          studio_id,
          cliente_id,
          operatore_responsabile_id,
          tipo_prestazione,
          ciclo_aml,
          stato
        `)
        .eq("id", av1.pratica_id)
        .maybeSingle();

      if (praticaError || !pratica?.id) {
        saltate++;
        continue;
      }

      const cliente = Array.isArray((av1 as any).tbclienti)
        ? (av1 as any).tbclienti[0]
        : (av1 as any).tbclienti;

      const nomeCliente =
        cliente?.ragione_sociale || cliente?.cod_cliente || "Cliente";

      const target = targetDates.find((x) => x.date === av1.ScadenzaVerifica);

      if (!target) {
        saltate++;
        continue;
      }

      const { data: rinnovo } = await supabaseAdmin
        .from("tbPraticheAML")
        .select("id")
        .eq("studio_id", pratica.studio_id)
        .eq("cliente_id", pratica.cliente_id)
        .eq("tipo_prestazione", pratica.tipo_prestazione)
        .gt("ciclo_aml", Number(pratica.ciclo_aml || 1))
        .limit(1)
        .maybeSingle();

      if (rinnovo) {
        saltate++;
        continue;
      }

      const { data: alreadySent } = await supabaseAdmin
        .from("tbAVScadenzeVerificaAlert")
        .select("id")
        .eq("pratica_id", pratica.id)
        .eq("giorni_prima", target.giorni)
        .eq("scadenza_verifica", av1.ScadenzaVerifica)
        .maybeSingle();

      if (alreadySent) {
        saltate++;
        continue;
      }

      if (!pratica.operatore_responsabile_id) {
        saltate++;
        continue;
      }

      const { data: operatore, error: operatoreError } = await supabaseAdmin
        .from("tbutenti")
        .select("id, email, nome, cognome")
        .eq("id", pratica.operatore_responsabile_id)
        .maybeSingle();

      if (operatoreError || !operatore?.email) {
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
              <strong>Data scadenza:</strong> ${formatDateIT(av1.ScadenzaVerifica)}
            </p>
            <p style="margin: 6px 0 0 0;">
              <strong>Tipo prestazione:</strong> ${pratica.tipo_prestazione || "-"}
            </p>
            <p style="margin: 6px 0 0 0;">
              <strong>Ciclo AML:</strong> ${pratica.ciclo_aml || 1}
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

      const text = `
Scadenza verifica AML - ${nomeCliente}

La verifica AML del cliente ${nomeCliente} scade ${giorniLabel}.

Data scadenza: ${formatDateIT(av1.ScadenzaVerifica)}
Tipo prestazione: ${pratica.tipo_prestazione || "-"}
Ciclo AML: ${pratica.ciclo_aml || 1}

Verifica se la pratica deve essere rinnovata oppure archiviata.
      `.trim();

      const result = await sendEmail({
        to: emailDestinatario,
        subject,
        html,
        text,
        sendMode: "studio",
      });

      if (!result.success) {
        console.error("Errore invio alert scadenza AML:", result.error);
        saltate++;
        continue;
      }

      const { error: insertAlertError } = await supabaseAdmin
        .from("tbAVScadenzeVerificaAlert")
        .insert({
          studio_id: av1.studio_id,
          pratica_id: pratica.id,
          cliente_id: av1.cliente_id,
          av1_id: av1.id,
          giorni_prima: target.giorni,
          scadenza_verifica: av1.ScadenzaVerifica,
          destinatario_email: emailDestinatario,
        });

      if (insertAlertError) {
        console.error("Errore salvataggio alert scadenza AML:", insertAlertError);
      }

      inviate++;
    }

    return res.status(200).json({
      ok: true,
      processate,
      inviate,
      saltate,
    });
  } catch (err: any) {
    console.error("Errore cron scadenze verifica AML:", err);

    return res.status(500).json({
      error: err?.message || "Errore cron scadenze verifica AML",
    });
  }
}
