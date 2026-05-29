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

async function loadFestivita(anno: number, mese: number) {
  const start = `${anno}-${pad(mese)}-01`;
  const endDate = new Date(anno, mese, 0);
  const end = `${anno}-${pad(mese)}-${pad(endDate.getDate())}`;

  const { data, error } = await supabaseAdmin
    .from("tbfestivita")
    .select("data_festivita, descrizione")
    .gte("data_festivita", start)
    .lte("data_festivita", end);

  if (error) {
    throw error;
  }

  const map = new Map<string, string>();

  (data || []).forEach((f) => {
    map.set(f.data_festivita, f.descrizione);
  });

  return map;
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

function scegliGiornoExtra(
  week: Date[],
  giornoFisso: number,
  weekIndex: number,
  utenteIndex: number,
  festivitaMap: Map<string, string>
) {
  const pattern = [1, 3, 4, 5]; // lun, mer, gio, ven
  const candidati = pattern
    .map((wd) => week.find((d) => weekdayIT(d) === wd))
    .filter((d): d is Date => !!d)
    .filter((d) => weekdayIT(d) !== giornoFisso)
    .filter((d) => !festivitaMap.has(isoDate(d)));

  if (candidati.length === 0) return null;

  const index = (weekIndex + utenteIndex) % candidati.length;
  return candidati[index];
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

  const weeks = getWeeks(Number(anno), Number(mese));
  const rows: any[] = [];

  const festivitaMap = await loadFestivita(Number(anno), Number(mese));

  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
    const week = weeks[weekIndex];

    for (let utenteIndex = 0; utenteIndex < (utenti || []).length; utenteIndex++) {
      const utente = utenti![utenteIndex];

      const presenzeScelte = new Set<string>();

    const giornoFisso = week.find(
  (d) =>
    weekdayIT(d) === gruppo.giorno_fisso &&
    !festivitaMap.has(isoDate(d))
);

      if (giornoFisso) {
        presenzeScelte.add(isoDate(giornoFisso));
      }

      const totaleRichiesto = Number(gruppo.presenze_settimanali || 2);
      const mancanti = Math.max(0, totaleRichiesto - presenzeScelte.size);

      if (mancanti > 0) {
       const extra = scegliGiornoExtra(
  week,
  gruppo.giorno_fisso,
  weekIndex,
  utenteIndex,
  festivitaMap
);
        if (extra) {
          presenzeScelte.add(isoDate(extra));
        }
      }

      for (const day of week) {
        const wd = weekdayIT(day);
        if (!wd) continue;

       const festivoNome = festivitaMap.get(isoDate(day)) || null;

        rows.push({
          gruppo_id,
          utente_id: utente.utente_id,
          data: isoDate(day),
          anno: Number(anno),
          mese: Number(mese),
          giorno_settimana: wd,
          presenza: !festivoNome && presenzeScelte.has(isoDate(day)),
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
