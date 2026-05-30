import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function weekdayIT(d: Date) {
  const js = d.getDay();
  if (js === 0 || js === 6) return null;
  return js; // 1 lun - 5 ven
}

function getWeeks(anno: number, mese: number) {
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  const d = new Date(anno, mese - 1, 1);

  while (d.getMonth() === mese - 1) {
    const wd = weekdayIT(d);

    if (wd) {
      if (wd === 1 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      currentWeek.push(new Date(d));
    }

    d.setDate(d.getDate() + 1);
  }

  if (currentWeek.length > 0) weeks.push(currentWeek);

  return weeks;
}

async function loadFestivita(anno: number, mese: number) {
  const start = `${anno}-${pad(mese)}-01`;
  const endDate = new Date(anno, mese, 0);
  const end = `${anno}-${pad(mese)}-${pad(endDate.getDate())}`;

  const { data, error } = await supabaseAdmin
    .from("tbfestivita")
    .select("data_festivita, descrizione")
    .gte("data_festivita", start)
    .lte("data_festivita", end);

  if (error) throw error;

  const map = new Map<string, string>();

  (data || []).forEach((f) => {
    map.set(f.data_festivita, f.descrizione);
  });

  return map;
}

function scegliExtra(params: {
  availableDays: number[];
  userIndex: number;
  weekIndex: number;
  ultimoExtraPrecedente?: number | null;
}) {
  const { availableDays, userIndex, weekIndex, ultimoExtraPrecedente } = params;

  const rotazioni = [
    [4, 3, 5, 1], // ED
    [5, 4, 3, 1], // DD
    [1, 5, 4, 3], // RD
    [3, 1, 5, 4], // MF
  ];

  const base = rotazioni[userIndex % rotazioni.length];
  const shifted = [
    ...base.slice(weekIndex % base.length),
    ...base.slice(0, weekIndex % base.length),
  ];

  for (const giorno of shifted) {
    if (!availableDays.includes(giorno)) continue;

    // Se la settimana precedente ha fatto venerdì,
    // questa settimana non può fare lunedì.
    if (ultimoExtraPrecedente === 5 && giorno === 1) continue;

    return giorno;
  }

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  const { gruppo_id, anno, mese } = req.body;

  if (!gruppo_id || !anno || !mese) {
    return res.status(400).json({
      error: "gruppo_id, anno e mese sono obbligatori",
    });
  }

  const { data: gruppo, error: gruppoError } = await supabaseAdmin
    .from("tbpresenze_smart_gruppi")
    .select("*")
    .eq("id", gruppo_id)
    .single();

  if (gruppoError) {
    return res.status(500).json({ error: gruppoError.message });
  }

  const { data: utenti, error: utentiError } = await supabaseAdmin
    .from("tbpresenze_smart_gruppi_utenti")
    .select("utente_id, ordine")
    .eq("gruppo_id", gruppo_id)
    .eq("attivo", true)
    .order("ordine", { ascending: true });

  if (utentiError) {
    return res.status(500).json({ error: utentiError.message });
  }

  const festivitaMap = await loadFestivita(Number(anno), Number(mese));
  const weeks = getWeeks(Number(anno), Number(mese));
  const rows: any[] = [];

  const ultimoExtraPerUtente = new Map<string, number | null>();

  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
    const week = weeks[weekIndex];

    const giornoFissoNumero = Number(gruppo.giorno_fisso || 2);
    const totaleRichiesto = Number(gruppo.presenze_settimanali || 2);

    const availableDays = week
      .filter((d) => !festivitaMap.has(isoDate(d)))
      .map((d) => weekdayIT(d))
      .filter((d): d is number => !!d);

    for (let userIndex = 0; userIndex < (utenti || []).length; userIndex++) {
      const utente = utenti![userIndex];
      const presenzeScelte = new Set<string>();

      const giornoFisso = week.find(
        (d) =>
          weekdayIT(d) === giornoFissoNumero &&
          !festivitaMap.has(isoDate(d))
      );

      if (giornoFisso && presenzeScelte.size < totaleRichiesto) {
        presenzeScelte.add(isoDate(giornoFisso));
      }

      if (presenzeScelte.size < totaleRichiesto) {
        const ultimoExtraPrecedente =
          ultimoExtraPerUtente.get(utente.utente_id) || null;

        const extraDayNumber = scegliExtra({
          availableDays: availableDays.filter((d) => d !== giornoFissoNumero),
          userIndex,
          weekIndex,
          ultimoExtraPrecedente,
        });

        if (extraDayNumber) {
          const extraDate = week.find(
            (d) =>
              weekdayIT(d) === extraDayNumber &&
              !festivitaMap.has(isoDate(d))
          );

          if (extraDate && presenzeScelte.size < totaleRichiesto) {
            presenzeScelte.add(isoDate(extraDate));
            ultimoExtraPerUtente.set(utente.utente_id, extraDayNumber);
          }
        } else {
          ultimoExtraPerUtente.set(utente.utente_id, null);
        }
      }

      for (const day of week) {
        const wd = weekdayIT(day);
        if (!wd) continue;

        const key = isoDate(day);
        const festivoNome = festivitaMap.get(key) || null;

        rows.push({
          gruppo_id,
          utente_id: utente.utente_id,
          data: key,
          anno: Number(anno),
          mese: Number(mese),
          giorno_settimana: wd,
          presenza: !festivoNome && presenzeScelte.has(key),
          festivo: !!festivoNome,
          nota: festivoNome,
          generato_auto: true,
        });
      }
    }
  }

  await supabaseAdmin
    .from("tbpresenze_smart_calendario")
    .delete()
    .eq("gruppo_id", gruppo_id)
    .eq("anno", Number(anno))
    .eq("mese", Number(mese));

  const { error: insertError } = await supabaseAdmin
    .from("tbpresenze_smart_calendario")
    .insert(rows);

  if (insertError) {
    return res.status(500).json({ error: insertError.message });
  }

  return res.status(200).json({
    ok: true,
    righe: rows.length,
  });
}
