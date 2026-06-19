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

const currentYear = oggi.getFullYear();
const currentMonthIndex = oggi.getMonth();

const inizioMese = toDate(new Date(currentYear, currentMonthIndex, 1));
const fineMese = toDate(new Date(currentYear, currentMonthIndex + 1, 0));

const { data: dipendenti, error } = await supabase
  .from("tbutenti")
  .select("id, nome, cognome, email")
  .eq("attivo", true)
  .eq("tipo_rapporto", "Dipendente");

if (error) throw error;

const daSollecitare: any[] = [];

for (const dipendente of dipendenti || []) {
  if (!dipendente.email) continue;

  const { count, error: countError } = await supabase
    .from("tbpresenze_dipendenti")
    .select("id", { count: "exact", head: true })
    .eq("utente_id", dipendente.id)
    .gte("data_presenza", inizioMese)
    .lte("data_presenza", fineMese);

  if (countError) throw countError;

  if ((count || 0) >= 4) continue;

  daSollecitare.push({
    id: dipendente.id,
    nome: dipendente.nome,
    cognome: dipendente.cognome,
    email: dipendente.email,
    presenze_compilate: count || 0,
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
