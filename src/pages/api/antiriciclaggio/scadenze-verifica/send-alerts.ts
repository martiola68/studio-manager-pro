import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendEmailServer } from "@/services/sendEmailServer";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const GIORNI_ALERT = [30, 15, 7, 0];

function formatDateIT(value: string) {
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Metodo non consentito",
    });
  }

  const cronSecret = process.env.CRON_SECRET;

  const querySecret =
    typeof req.query.secret === "string" ? req.query.secret : null;

  const authHeader = req.headers.authorization;

  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const receivedSecret = querySecret || bearerToken;

  if (!cronSecret || receivedSecret !== cronSecret) {
    return res.status(401).json({
      ok: false,
      error: "Non autorizzato",
    });
  }

  try {
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

    const result = {
      processate: 0,
      inviate: 0,
      saltate: 0,
      debugEmails: [] as any[],
    };

    const { data: av1Rows, error: av1Error } = await (supabaseAdmin as any)
      .from("tbAV1")
      .select("pratica_id, ScadenzaVerifica")
      .not("pratica_id", "is", null)
      .not("ScadenzaVerifica", "is", null)
      .in("ScadenzaVerifica", scadenze);

    if (av1Error) throw av1Error;

    for (const av1 of av1Rows || []) {
      result.processate++;

      const praticaId = av1.pratica_id;
      const scadenzaVerifica = av1.ScadenzaVerifica;

      const debug: any = {
        pratica_id: praticaId,
        scadenza_verifica: scadenzaVerifica,
      };

      result.debugEmails.push(debug);

      const target = targetDates.find((x) => x.date === scadenzaVerifica);

      if (!target) {
        debug.motivo_salto = "scadenza fuori target";
        result.saltate++;
        continue;
      }

      debug.giorni_prima = target.giorni;

      const { data: pratica, error: praticaError } = await (supabaseAdmin as any)
        .from("tbPraticheAML")
        .select(`
          id,
          studio_id,
          cliente_id,
          operatore_responsabile_id,
          tipo_prestazione
        `)
        .eq("id", praticaId)
        .maybeSingle();

      if (praticaError || !pratica) {
        debug.motivo_salto = praticaError?.message || "pratica non trovata";
        result.saltate++;
        continue;
      }

      if (!pratica.operatore_responsabile_id) {
        debug.motivo_salto = "operatore_responsabile_id mancante";
        result.saltate++;
        continue;
      }

      const { data: cliente, error: clienteError } = await (supabaseAdmin as any)
        .from("tbclienti")
        .select("id, ragione_sociale, cod_cliente")
        .eq("id", pratica.cliente_id)
        .maybeSingle();

      if (clienteError) {
        debug.motivo_salto = clienteError.message;
        result.saltate++;
        continue;
      }

      const { data: operatore, error: operatoreError } = await (
        supabaseAdmin as any
      )
        .from("tbutenti")
        .select("id, nome, cognome, email")
        .eq("id", pratica.operatore_responsabile_id)
        .maybeSingle();

      if (operatoreError || !operatore?.email) {
        debug.motivo_salto =
          operatoreError?.message || "email operatore mancante";
        result.saltate++;
        continue;
      }

      const nomeCliente =
        cliente?.ragione_sociale ||
        cliente?.cod_cliente ||
        `Cliente ${pratica.cliente_id}`;

      const emailDestinatario = operatore.email;

      const nomeOperatore = [operatore.nome, operatore.cognome]
        .filter(Boolean)
        .join(" ");

      debug.cliente = nomeCliente;
      debug.operatore_responsabile_id = pratica.operatore_responsabile_id;
      debug.email_trovata = emailDestinatario;
      debug.nome_operatore = nomeOperatore || null;

      const { data: alreadySent, error: alreadySentError } = await (
        supabaseAdmin as any
      )
        .from("tbAVScadenzeVerificaAlert")
        .select("id")
        .eq("pratica_id", pratica.id)
        .eq("giorni_prima", target.giorni)
        .eq("scadenza_verifica", scadenzaVerifica)
        .maybeSingle();

      if (alreadySentError) {
        debug.motivo_salto = alreadySentError.message;
        result.saltate++;
        continue;
      }

      if (alreadySent) {
        debug.motivo_salto = "alert già inviato";
        result.saltate++;
        continue;
      }

      const giorniLabel =
        target.giorni === 0 ? "oggi" : `tra ${target.giorni} giorni`;

      const subject = `Scadenza verifica AML ${giorniLabel} - ${nomeCliente}`;

      const html = `
        <div style="font-family: Arial, sans-serif; font-size: 14px; color: #111;">
          <p>Ciao ${nomeOperatore || ""},</p>

          <p>
            La verifica AML del cliente <strong>${nomeCliente}</strong>
            scade <strong>${giorniLabel}</strong>.
          </p>

          <ul>
            <li><strong>Data scadenza:</strong> ${formatDateIT(scadenzaVerifica)}</li>
            <li><strong>Tipo prestazione:</strong> ${pratica.tipo_prestazione || "-"}</li>
          </ul>

          <p>Verifica se la pratica deve essere rinnovata oppure archiviata.</p>

          <p style="font-size: 12px; color: #666;">
            Questa è una email automatica, non rispondere a questo messaggio.
          </p>
        </div>
      `.trim();

      const text = `
Scadenza verifica AML - ${nomeCliente}

La verifica AML del cliente ${nomeCliente} scade ${giorniLabel}.

Data scadenza: ${formatDateIT(scadenzaVerifica)}
Tipo prestazione: ${pratica.tipo_prestazione || "-"}

Verifica se la pratica deve essere rinnovata oppure archiviata.
      `.trim();

    const { data: studio } = await (supabaseAdmin as any)
  .from("tbstudio")
  .select("microsoft_connection_id")
  .eq("id", pratica.studio_id)
  .maybeSingle();

if (!studio?.microsoft_connection_id) {
  debug.motivo_salto = "microsoft_connection_id mancante";
  result.saltate++;
  continue;
}

const emailResult = await sendEmailServer({
  userId: operatore.id,
  microsoftConnectionId: studio.microsoft_connection_id,
  to: emailDestinatario,
  subject,
  html,
});

      if (!emailResult.success) {
        debug.motivo_salto = emailResult.error || "errore invio email";
        result.saltate++;
        continue;
      }

      const { error: insertError } = await (supabaseAdmin as any)
        .from("tbAVScadenzeVerificaAlert")
        .insert({
          studio_id: pratica.studio_id,
          pratica_id: pratica.id,
          cliente_id: pratica.cliente_id,
          giorni_prima: target.giorni,
          scadenza_verifica: scadenzaVerifica,
          destinatario_email: emailDestinatario,
        });

      if (insertError) {
        debug.motivo_salto = insertError.message;
        result.saltate++;
        continue;
      }

      debug.email_inviata = true;
      result.inviate++;
    }

    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Errore cron scadenze verifica AML",
    });
  }
}
