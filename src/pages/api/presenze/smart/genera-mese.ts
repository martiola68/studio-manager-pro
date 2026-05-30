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
  (data || []).forEach((f) => map.set(f.data_festivita, f.descrizione));
  return map;
}

async function loadUltimiExtra(
  gruppoId: string,
  utentiIds: string[],
  anno: number,
  mese: number,
  giornoFisso: number
) {
  const start = `${anno}-${pad(mese)}-01`;

  const { data } = await supabaseAdmin
    .from("tbpresenze_smart_calendario")
    .select("utente_id, giorno_settimana, data")
    .eq("gruppo_id", gruppoId)
    .in("utente_id", utentiIds)
    .eq("presenza", true)
    .eq("festivo", false)
    .neq("giorno_settimana", giornoFisso)
    .lt("data", start)
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

function assegnaExtraPerGiorno(params: {
  utenti: { utente_id: string; ordine: number }[];
  giorniExtraDisponibili: number[];
  weekIndex: number;
  ultimoExtra: Map<string, number | null>;
}) {
  const { utenti, giorniExtraDisponibili, weekIndex, ultimoExtra } = params;

  const assegnazioni = new Map<string, number>();
  const utentiOrdinati = [...utenti].sort((a, b) => a.ordine - b.ordine);

  const utentiRuotati = [
    ...utentiOrdinati.slice(weekIndex % utentiOrdinati.length),
    ...utentiOrdinati.slice(0, weekIndex % utentiOrdinati.length),
  ];

  const utentiGiaAssegnati = new Set<string>();

  for (const giorno of giorniExtraDisponibili) {
    const candidato = utentiRuotati.find((u) => {
      if (utentiGiaAssegnati.has(u.utente_id)) return false;

      const precedente = ultimoExtra.get(u.utente_id) || null;

      if (precedente === 5 && giorno === 1) return false;

      return true;
    });

    if (!candidato) continue;

    assegnazioni.set(candidato.utente_id, giorno);
    utentiGiaAssegnati.add(candidato.utente_id);
    ultimoExtra.set(candidato.utente_id, giorno);
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

  const ultimoExtra = await loadUltimiExtra(
    gruppo_id,
    utentiAttivi.map((u) => u.utente_id),
    Number(anno),
    Number(mese),
    giornoFisso
  );

  const rows: any[] = [];

  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
    const week = weeks[weekIndex];

    const giorniExtraDisponibili = week
      .filter((d) => !festivitaMap.has(isoDate(d)))
      .map((d) => weekdayIT(d))
      .filter((d): d is number => !!d)
      .filter((d) => d !== giornoFisso)
      .sort((a, b) => a - b);

    const extraPerUtente =
      presenzeSettimanali > 1
        ? assegnaExtraPerGiorno({
            utenti: utentiAttivi,
            giorniExtraDisponibili,
            weekIndex,
            ultimoExtra,
          })
        : new Map<string, number>();

    for (const utente of utentiAttivi) {
      const presenzeScelte = new Set<string>();

      const giornoFissoData = week.find(
        (d) =>
          weekdayIT(d) === giornoFisso &&
          !festivitaMap.has(isoDate(d))
      );

      if (giornoFissoData) {
        presenzeScelte.add(isoDate(giornoFissoData));
      }

      const extraGiorno = extraPerUtente.get(utente.utente_id);

      if (extraGiorno) {
        const extraData = week.find(
          (d) =>
            weekdayIT(d) === extraGiorno &&
            !festivitaMap.has(isoDate(d))
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
