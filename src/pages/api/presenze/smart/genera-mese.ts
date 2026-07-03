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
  return js;
}

function getWorkingDays(anno: number, mese: number) {
  const days: Date[] = [];
  const d = new Date(anno, mese - 1, 1);

  while (d.getMonth() === mese - 1) {
    if (weekdayIT(d)) days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }

  return days;
}

function mondayOfWeekDate(d: Date) {
  const copy = new Date(d);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function weekIndexFromExcelBase(d: Date) {
  const base = new Date(2025, 11, 1); // 01/12/2025 lunedì, base Excel
  const monday = mondayOfWeekDate(d);

  return Math.floor(
    (monday.getTime() - base.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
}

function extraUserIndexForDay(weekIndex: number, weekday: number, utentiCount: number) {
  if (utentiCount === 0) return null;

  const posizioneGiorno: Record<number, number> = {
    1: 0, // lunedì
    3: 1, // mercoledì
    4: 2, // giovedì
    5: 3, // venerdì
  };

  const pos = posizioneGiorno[weekday];

  if (pos === undefined) return null;

  return (weekIndex + pos) % utentiCount;
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

  if (!gruppo?.studio_id) {
    return res.status(400).json({
      error: "Gruppo smart working senza studio_id",
    });
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

  const utentiAttivi = utenti || [];

  if (utentiAttivi.length === 0) {
    return res.status(400).json({ error: "Nessun utente attivo nel gruppo" });
  }

  const giornoFisso = Number(gruppo.giorno_fisso || 2);
  const festivitaMap = await loadFestivita(Number(anno), Number(mese));
  const days = getWorkingDays(Number(anno), Number(mese));

const rows: any[] = [];

for (const day of days) {
  const wd = weekdayIT(day);
  if (!wd) continue;

  const dataKey = isoDate(day);
  const festivoNome = festivitaMap.get(dataKey) || null;

  const weekIndex = weekIndexFromExcelBase(day);
  const extraIndex = extraUserIndexForDay(
    weekIndex,
    wd,
    utentiAttivi.length
  );

  for (let userIndex = 0; userIndex < utentiAttivi.length; userIndex++) {
    const utente = utentiAttivi[userIndex];

    const presenza =
      !festivoNome &&
      (wd === giornoFisso || userIndex === extraIndex);

    rows.push({
      studio_id: gruppo.studio_id,
      gruppo_id,
      utente_id: utente.utente_id,
      data: dataKey,
      anno: Number(anno),
      mese: Number(mese),
      giorno_settimana: wd,
      presenza,
      festivo: !!festivoNome,
      nota: festivoNome,
      generato_auto: true,
    });
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
