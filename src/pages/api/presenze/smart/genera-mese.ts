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
  return js; // 1 lun, 2 mar, 3 mer, 4 gio, 5 ven
}

function getWeeks(anno: number, mese: number) {
  const weeks: Date[][] = [];
  let week: Date[] = [];
  const d = new Date(anno, mese - 1, 1);

  while (d.getMonth() === mese - 1) {
    const wd = weekdayIT(d);

    if (wd) {
      if (wd === 1 && week.length > 0) {
        weeks.push(week);
        week = [];
      }

      week.push(new Date(d));
    }

    d.setDate(d.getDate() + 1);
  }

  if (week.length > 0) weeks.push(week);

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

async function loadUltimiExtraPrecedenti(
  gruppoId: string,
  utentiIds: string[],
  anno: number,
  mese: number,
  giornoFisso: number
) {
  const start = `${anno}-${pad(mese)}-01`;

  const { data } = await supabaseAdmin
    .from("tbpresenze_smart_calendario")
    .select("utente_id, data, giorno_settimana")
    .eq("gruppo_id", gruppoId)
    .in("utente_id", utentiIds)
    .eq("presenza", true)
    .eq("festivo", false)
    .lt("data", start)
    .neq("giorno_settimana", giornoFisso)
    .order("data", { ascending: false });

  const map = new Map<string, number | null>();

  utentiIds.forEach((id) => map.set(id, null));

  (data || []).forEach((r) => {
    if (!map.get(r.utente_id)) {
      map.set(r.utente_id, Number(r.giorno_settimana));
    }
  });

  return map;
}

function assegnaExtraSettimana(params: {
  utenti: { utente_id: string; ordine: number }[];
  giorniDisponibili: number[];
  ultimoExtra: Map<string, number | null>;
  weekIndex: number;
}) {
  const { utenti, giorniDisponibili, ultimoExtra, weekIndex } = params;

  const giorniBase = [1, 3, 4, 5]; // lun, mer, gio, ven
  const giorni = giorniBase.filter((g) => giorniDisponibili.includes(g));

  const assegnazioni = new Map<string, number | null>();
  const usati = new Set<number>();

  const utentiOrdinati = [...utenti].sort((a, b) => a.ordine - b.ordine);

  for (let i = 0; i < utentiOrdinati.length; i++) {
    const utente = utentiOrdinati[i];

    const rotazione = [
      ...giorniBase.slice((weekIndex + i) % giorniBase.length),
      ...giorniBase.slice(0, (weekIndex + i) % giorniBase.length),
    ].filter((g) => giorni.includes(g));

    let scelto =
      rotazione.find((g) => {
        if (usati.has(g)) return false;

        const precedente = ultimoExtra.get(utente.utente_id) || null;

        if (precedente === 5 && g === 1) return false;

        return true;
      }) || null;

    if (!scelto) {
      scelto =
        rotazione.find((g) => {
          const precedente = ultimoExtra.get(utente.utente_id) || null;
          if (precedente === 5 && g === 1) return false;
          return true;
        }) || null;
    }

    assegnazioni.set(utente.utente_id, scelto);

    if (scelto) {
      usati.add(scelto);
      ultimoExtra.set(utente.utente_id, scelto);
    } else {
      ultimoExtra.set(utente.utente_id, null);
    }
  }

  return assegnazioni;
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

  const utentiAttivi = utenti || [];
  const giornoFisso = Number(gruppo.giorno_fisso || 2);
  const presenzeSettimanali = Number(gruppo.presenze_settimanali || 2);

  const festivitaMap = await loadFestivita(Number(anno), Number(mese));
  const weeks = getWeeks(Number(anno), Number(mese));

  const ultimoExtra = await loadUltimiExtraPrecedenti(
    gruppo_id,
    utentiAttivi.map((u) => u.utente_id),
    Number(anno),
    Number(mese),
    giornoFisso
  );

  const rows: any[] = [];

  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
    const week = weeks[weekIndex];

    const giorniDisponibiliExtra = week
      .filter((d) => !festivitaMap.has(isoDate(d)))
      .map((d) => weekdayIT(d))
      .filter((d): d is number => !!d)
      .filter((d) => d !== giornoFisso);

    const extraPerUtente = assegnaExtraSettimana({
      utenti: utentiAttivi,
      giorniDisponibili: giorniDisponibiliExtra,
      ultimoExtra,
      weekIndex,
    });

    for (const utente of utentiAttivi) {
      const presenzeScelte = new Set<string>();

      const martedi = week.find(
        (d) => weekdayIT(d) === giornoFisso && !festivitaMap.has(isoDate(d))
      );

      if (martedi && presenzeScelte.size < presenzeSettimanali) {
        presenzeScelte.add(isoDate(martedi));
      }

      const extraGiorno = extraPerUtente.get(utente.utente_id);

      if (extraGiorno && presenzeScelte.size < presenzeSettimanali) {
        const extraData = week.find(
          (d) => weekdayIT(d) === extraGiorno && !festivitaMap.has(isoDate(d))
        );

        if (extraData) {
          presenzeScelte.add(isoDate(extraData));
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
