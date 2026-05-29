import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

const festivitaFisse: Record<string, string> = {
  "01-01": "Capodanno",
  "01-06": "Epifania",
  "04-25": "Festa della Liberazione",
  "05-01": "Festa del Lavoro",
  "06-02": "Festa della Repubblica",
  "08-15": "Ferragosto",
  "11-01": "Ognissanti",
  "12-08": "Immacolata Concezione",
  "12-25": "Natale",
  "12-26": "Santo Stefano",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function weekdayIT(d: Date) {
  const js = d.getDay();

  if (js === 0 || js === 6) return null;

  return js; // 1 lunedì - 5 venerdì
}

function isFestivo(d: Date) {
  const key = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return festivitaFisse[key] || null;
}

function getWorkingDays(anno: number, mese: number) {
  const days: Date[] = [];
  const d = new Date(anno, mese - 1, 1);

  while (d.getMonth() === mese - 1) {
    const wd = weekdayIT(d);

    if (wd) {
      days.push(new Date(d));
    }

    d.setDate(d.getDate() + 1);
  }

  return days;
}

function getSecondoGiorno(settimanaIndex: number, utenteIndex: number) {
  const pattern = [1, 3, 4, 5]; // lunedì, mercoledì, giovedì, venerdì
  return pattern[(settimanaIndex + utenteIndex) % pattern.length];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Metodo non consentito",
    });
  }

  const { gruppo_id, anno, mese } = req.body;

  if (!gruppo_id || !anno || !mese) {
    return res.status(400).json({
      error: "gruppo_id, anno e mese sono obbligatori",
    });
  }

  const { data: gruppo, error: gruppoError } = await supabaseAdmin
    .from("tbpayroll_smart_gruppi")
    .select("*")
    .eq("id", gruppo_id)
    .single();

  if (gruppoError) {
    return res.status(500).json({
      error: gruppoError.message,
    });
  }

  const { data: utenti, error: utentiError } = await supabaseAdmin
    .from("tbpayroll_smart_gruppi_utenti")
    .select("utente_id, ordine")
    .eq("gruppo_id", gruppo_id)
    .eq("attivo", true)
    .order("ordine", { ascending: true });

  if (utentiError) {
    return res.status(500).json({
      error: utentiError.message,
    });
  }

  const workingDays = getWorkingDays(Number(anno), Number(mese));
  const rows: any[] = [];

  for (const day of workingDays) {
    const wd = weekdayIT(day);
    if (!wd) continue;

    const festivoNome = isFestivo(day);
    const weekIndex = Math.floor((day.getDate() - 1) / 7);

    for (let i = 0; i < (utenti || []).length; i++) {
      const utente = utenti![i];

      let presenza = false;
      let nota = null;

      if (festivoNome) {
        presenza = false;
        nota = festivoNome;
      } else if (wd === gruppo.giorno_fisso) {
        presenza = true;
      } else {
        const secondoGiorno = getSecondoGiorno(weekIndex, i);
        presenza = wd === secondoGiorno;
      }

      rows.push({
        gruppo_id,
        utente_id: utente.utente_id,
        data: isoDate(day),
        anno: Number(anno),
        mese: Number(mese),
        giorno_settimana: wd,
        presenza,
        festivo: !!festivoNome,
        nota,
        generato_auto: true,
      });
    }
  }

  await supabaseAdmin
    .from("tbpayroll_smart_calendario")
    .delete()
    .eq("gruppo_id", gruppo_id)
    .eq("anno", Number(anno))
    .eq("mese", Number(mese));

  const { error: insertError } = await supabaseAdmin
    .from("tbpayroll_smart_calendario")
    .insert(rows);

  if (insertError) {
    return res.status(500).json({
      error: insertError.message,
    });
  }

  return res.status(200).json({
    ok: true,
    gruppo_id,
    anno: Number(anno),
    mese: Number(mese),
    righe: rows.length,
  });
}
