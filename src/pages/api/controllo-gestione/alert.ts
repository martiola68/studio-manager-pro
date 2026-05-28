import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

const SECRET = process.env.CRON_SECRET || "x9KfP2LmQ8zYtA71vBnR";

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function getMesiCadenza(cadenza?: string | null) {
  switch (cadenza) {
    case "mensile":
      return 1;
    case "trimestrale":
      return 3;
    case "quadrimestrale":
      return 4;
    case "semestrale":
      return 6;
    default:
      return 1;
  }
}

function parseDbDate(value?: string | null) {
  if (!value) return null;

  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;

  return new Date(y, m - 1, d);
}

function formatDateIT(value?: string | null) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function getPeriodoAlert() {
  const now = new Date();

  const start = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor(
    (now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
  );

  const week = Math.ceil((days + start.getDay() + 1) / 7);

  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function isInRitardo(dataEsecuzione?: string | null, cadenza?: string | null) {
  const ultima = parseDbDate(dataEsecuzione);
  if (!ultima) return false;

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  const scadenza = addMonths(ultima, getMesiCadenza(cadenza));
  scadenza.setHours(0, 0, 0, 0);

  return oggi > scadenza;
}

async function inviaEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY mancante");
  }

  const from =
    process.env.RESEND_FROM ||
    "Studio Manager Pro <noreply@studio-manager-pro.it>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Errore invio email Resend");
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const querySecret =
    typeof req.query.secret === "string" ? req.query.secret : null;

  if (!SECRET || querySecret !== SECRET) {
    return res.status(401).json({
      ok: false,
      error: "Non autorizzato",
    });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Metodo non consentito",
    });
  }

  const periodoAlert = getPeriodoAlert();

  const { data: controlli, error } = await supabaseAdmin
    .from("tbcontrollo_gestione")
    .select(`
      id,
      cliente_id,
      cadenza_controllo,
      data_esecuzione,
      note,
      cliente:tbclienti(ragione_sociale, nome),
      utenti:tbcontrollo_gestione_utenti(
        utente:tbutenti(id, nome, cognome, email)
      )
    `)
    .eq("archiviato", false);

  if (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }

  const results: any[] = [];

  for (const controllo of controlli || []) {
    if (!isInRitardo(controllo.data_esecuzione, controllo.cadenza_controllo)) {
      continue;
    }

    const { data: alertEsistente, error: alertCheckError } = await supabaseAdmin
      .from("tbcontrollo_gestione_alert")
      .select("id")
      .eq("controllo_id", controllo.id)
      .eq("periodo_alert", periodoAlert)
      .maybeSingle();

    if (alertCheckError) {
      results.push({
        controllo_id: controllo.id,
        ok: false,
        error: alertCheckError.message,
      });
      continue;
    }

    if (alertEsistente) {
      results.push({
        controllo_id: controllo.id,
        ok: true,
        skipped: true,
        reason: "Alert già inviato questa settimana",
      });
      continue;
    }

    const cliente = Array.isArray(controllo.cliente)
  ? controllo.cliente[0]
  : controllo.cliente;

const societa =
  cliente?.ragione_sociale ||
  cliente?.nome ||
  controllo.cliente_id;

    const emails =
      controllo.utenti
        ?.map((u: any) => u.utente?.email)
        .filter(Boolean) || [];

    if (emails.length === 0) {
      results.push({
        controllo_id: controllo.id,
        ok: false,
        error: "Nessun utente assegnato con email",
      });
      continue;
    }

    const subject = `Controllo di gestione in ritardo - ${societa}`;

    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">
        <p>Buongiorno,</p>

        <p>
          il controllo di gestione della società <strong>${societa}</strong>
          risulta in ritardo.
        </p>

        <p>
          <strong>Cadenza:</strong> ${controllo.cadenza_controllo || "-"}<br />
          <strong>Ultima data esecuzione:</strong> ${formatDateIT(controllo.data_esecuzione)}
        </p>

        <p>
          Si invita a procedere con il controllo di gestione e ad aggiornare la pratica
          su Studio Manager Pro.
        </p>

        <p>Grazie.</p>
      </div>
    `;

    try {
      for (const email of emails) {
        await inviaEmail(email, subject, html);
      }

      const { error: insertAlertError } = await supabaseAdmin
        .from("tbcontrollo_gestione_alert")
        .insert({
          controllo_id: controllo.id,
          periodo_alert: periodoAlert,
        });

      if (insertAlertError) {
        throw insertAlertError;
      }

      results.push({
        controllo_id: controllo.id,
        societa,
        ok: true,
        emails,
      });
    } catch (err: any) {
      results.push({
        controllo_id: controllo.id,
        societa,
        ok: false,
        error: err.message || String(err),
      });
    }
  }

  return res.status(200).json({
    ok: true,
    periodoAlert,
    results,
  });
}
