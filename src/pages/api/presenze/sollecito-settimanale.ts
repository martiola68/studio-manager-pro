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

function getPreviousWeekRange(referenceDate = new Date()) {
  const current = new Date(referenceDate);
  current.setHours(0, 0, 0, 0);

  const day = current.getDay(); // dom 0, lun 1
  const diffToCurrentMonday = day === 0 ? -6 : 1 - day;

  const currentMonday = new Date(current);
  currentMonday.setDate(current.getDate() + diffToCurrentMonday);

  const previousMonday = new Date(currentMonday);
  previousMonday.setDate(currentMonday.getDate() - 7);

  const previousFriday = new Date(previousMonday);
  previousFriday.setDate(previousMonday.getDate() + 4);

  return {
    start: previousMonday,
    end: previousFriday,
    startKey: toDateKey(previousMonday),
    endKey: toDateKey(previousFriday),
  };
}

function getWeekdays(start: Date, end: Date) {
  const days: string[] = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const weekday = d.getDay();

    if (weekday >= 1 && weekday <= 5) {
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

    const week = getPreviousWeekRange(today);
    const workingDays = getWeekdays(week.start, week.end);

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
        .gte("data_presenza", week.startKey)
        .lte("data_presenza", week.endKey);

      if (presenzeError) throw presenzeError;

      const giorniCompilati = new Set(
        (presenze || [])
          .filter((p) => p.codice_presenza && p.codice_presenza !== "-")
          .map((p) => p.data_presenza)
      );

      const giorniMancanti = workingDays.filter((day) => !giorniCompilati.has(day));

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
            risultano ancora da compilare alcune presenze della settimana
            <strong>${formatDateIT(week.start)} - ${formatDateIT(week.end)}</strong>.
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

risultano ancora da compilare alcune presenze della settimana ${formatDateIT(
        week.start
      )} - ${formatDateIT(week.end)}.

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
      week_start: week.startKey,
      week_end: week.endKey,
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
