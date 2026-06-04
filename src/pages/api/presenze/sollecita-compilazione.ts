import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function toDate(date: Date) {
  return date.toISOString().split("T")[0];
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
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Metodo non consentito",
    });
  }

  try {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    const isMonday = oggi.getDay() === 1;

    const currentYear = oggi.getFullYear();
    const currentMonthIndex = oggi.getMonth();

    const meseCorrente = getMonthRange(currentYear, currentMonthIndex);
    const mesePrecedente = getMonthRange(currentYear, currentMonthIndex - 1);

    const limiteMeseCorrente = subtractWorkingDays(oggi, 5);

    const { data: dipendenti, error } = await supabase
      .from("tbutenti")
      .select("id, nome, cognome, email")
      .eq("attivo", true)
      .eq("tipo_rapporto", "Dipendente");

    if (error) throw error;

    const daSollecitare: any[] = [];

    for (const dipendente of dipendenti || []) {
      if (!dipendente.email) continue;

      const giorniMancanti: string[] = [];

      // 1) MESE PRECEDENTE: basta anche un solo giorno lavorativo mancante
      for (
        let d = new Date(mesePrecedente.start);
        d <= mesePrecedente.end;
        d = addDays(d, 1)
      ) {
        if (isWeekend(d)) continue;

        const data = toDate(d);

        const { data: presenza } = await supabase
          .from("tbpresenze_dipendenti")
          .select("id")
          .eq("utente_id", dipendente.id)
          .eq("data_presenza", data)
          .maybeSingle();

        if (!presenza) {
          giorniMancanti.push(data);
          break;
        }
      }

      // 2) MESE CORRENTE: solo il lunedì e solo oltre 5 giorni lavorativi
      if (giorniMancanti.length === 0 && isMonday) {
        for (
          let d = new Date(meseCorrente.start);
          d <= limiteMeseCorrente && d <= oggi;
          d = addDays(d, 1)
        ) {
          if (isWeekend(d)) continue;

          const data = toDate(d);

          const { data: presenza } = await supabase
            .from("tbpresenze_dipendenti")
            .select("id")
            .eq("utente_id", dipendente.id)
            .eq("data_presenza", data)
            .maybeSingle();

          if (!presenza) {
            giorniMancanti.push(data);
            break;
          }
        }
      }

      if (giorniMancanti.length === 0) continue;

      daSollecitare.push({
        id: dipendente.id,
        nome: dipendente.nome,
        cognome: dipendente.cognome,
        email: dipendente.email,
        giorni_mancanti: giorniMancanti,
      });
    }

    return res.status(200).json({
      ok: true,
      count: daSollecitare.length,
      dipendenti: daSollecitare,
      oggi: toDate(oggi),
      isMonday,
      limite_mese_corrente: toDate(limiteMeseCorrente),
      note:
        "Mese corrente: controllo solo lunedì e oltre 5 giorni lavorativi. Mese precedente: basta un giorno lavorativo mancante.",
    });
  } catch (error: any) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
