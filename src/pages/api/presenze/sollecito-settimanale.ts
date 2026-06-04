import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/services/emailService";

const SECRET = process.env.CRON_SECRET || "x9KfP2LmQ8zYtA71vBnR";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatDateIT(date: Date) {
  return date.toLocaleDateString("it-IT");
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function subtractWorkingDays(date: Date, workingDays: number) {
  const d = new Date(date);
  let count = 0;

  while (count < workingDays) {
    d.setDate(d.getDate() - 1);
    if (!isWeekend(d)) count++;
  }

  return d;
}

function getMonthRange(year: number, monthIndex: number) {
  return {
    start: new Date(year, monthIndex, 1),
    end: new Date(year, monthIndex + 1, 0),
    startKey: toDateKey(new Date(year, monthIndex, 1)),
    endKey: toDateKey(new Date(year, monthIndex + 1, 0)),
  };
}

function getWeekdays(start: Date, end: Date) {
  const days: string[] = [];

  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    if (!isWeekend(d)) {
      days.push(toDateKey(d));
    }
  }

  return days;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  }

  const authHeader = req.headers.authorization;

  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const querySecret =
    typeof req.query.secret === "string" ? req.query.secret : null;

  if (!SECRET || (bearerToken !== SECRET && querySecret !== SECRET)) {
    return res.status(401).json({
      success: false,
      error: "Non autorizzato",
    });
  }

  try {
    const today = new Date();

    // Esecuzione ordinaria solo lunedì.
    // Con ?force=true puoi testarla manualmente.
    const force = req.query.force === "true";

    if (today.getDay() !== 1 && !force) {
      return res.status(200).json({
        success: true,
        skipped: true,
        message: "Il sollecito presenze viene eseguito solo il lunedì.",
      });
    }

   today.setHours(0, 0, 0, 0);

const currentYear = today.getFullYear();
const currentMonthIndex = today.getMonth();

const meseCorrente = getMonthRange(currentYear, currentMonthIndex);
const mesePrecedente = getMonthRange(currentYear, currentMonthIndex - 1);

const limiteMeseCorrente = subtractWorkingDays(today, 5);

const workingDaysMesePrecedente = getWeekdays(
  mesePrecedente.start,
  mesePrecedente.end
);

const workingDaysMeseCorrente = getWeekdays(
  meseCorrente.start,
  limiteMeseCorrente
);

    const { data: dipendenti, error: dipendentiError } = await supabaseAdmin
      .from("tbdipendenti")
      .select("id, studio_id, utente_id, nome, cognome, email, attivo")
      .eq("attivo", true)
      .not("utente_id", "is", null)
      .not("email", "is", null);

    if (dipendentiError) throw dipendentiError;

    const results: any[] = [];

    for (const dipendente of dipendenti || []) {
      const { data: presenze, error: presenzeError } = await supabaseAdmin
  .from("tbpresenze_dipendenti")
  .select("data_presenza, codice_presenza")
  .eq("studio_id", dipendente.studio_id)
  .eq("utente_id", dipendente.utente_id)
  .gte("data_presenza", mesePrecedente.startKey)
  .lte("data_presenza", toDateKey(limiteMeseCorrente));

if (presenzeError) throw presenzeError;

const giorniCompilati = new Set(
  (presenze || [])
    .filter((p) => p.codice_presenza && p.codice_presenza !== "-")
    .map((p) => p.data_presenza)
);

const mancantiMesePrecedente = workingDaysMesePrecedente.filter(
  (day) => !giorniCompilati.has(day)
);

const mancantiMeseCorrente = workingDaysMeseCorrente.filter(
  (day) => !giorniCompilati.has(day)
);

const giorniMancanti =
  mancantiMesePrecedente.length > 0
    ? mancantiMesePrecedente
    : mancantiMeseCorrente;

      if (giorniMancanti.length === 0) {
        results.push({
          utente_id: dipendente.utente_id,
          email: dipendente.email,
          sent: false,
          reason: "settimana completa",
        });
        continue;
      }

      const nomeDipendente =
        `${dipendente.nome ?? ""} ${dipendente.cognome ?? ""}`.trim() ||
        dipendente.email;

      const subject = "Promemoria compilazione presenze settimanali";

      const html = `
        <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
          <p>Ciao ${nomeDipendente},</p>

          <p>
           risultano ancora da compilare alcune presenze obbligatorie.
          </p>

          <p><strong>Giorni mancanti:</strong> ${giorniMancanti
            .map((day) => new Date(`${day}T00:00:00`).toLocaleDateString("it-IT"))
            .join(", ")}</p>

          <p>
            Accedi a Studio Manager Pro e completa la compilazione delle presenze.
          </p>
        </div>
      `;

    const text = `
Ciao ${nomeDipendente},

risultano ancora da compilare alcune presenze obbligatorie.

Giorni mancanti: ${giorniMancanti
  .map((day) => new Date(`${day}T00:00:00`).toLocaleDateString("it-IT"))
  .join(", ")}

Accedi a Studio Manager Pro e completa la compilazione delle presenze.
`.trim();
      const emailResult = await sendEmail({
        to: dipendente.email,
        subject,
        html,
        text,
        sendMode: "studio",
      });

      results.push({
        utente_id: dipendente.utente_id,
        email: dipendente.email,
        sent: emailResult.success,
        missing_days: giorniMancanti,
        error: emailResult.success ? null : emailResult.error,
      });
    }

    return res.status(200).json({
      success: true,
      mese_precedente_start: mesePrecedente.startKey,
      mese_precedente_end: mesePrecedente.endKey,
      mese_corrente_start: meseCorrente.startKey,
      limite_mese_corrente: toDateKey(limiteMeseCorrente),
      checked: results.length,
      sent: results.filter((r) => r.sent).length,
      results,
    });
  } catch (error: any) {
    console.error("Errore sollecito presenze:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore invio sollecito presenze",
    });
  }
}
