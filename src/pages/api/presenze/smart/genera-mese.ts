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

function getWorkingDays(anno: number, mese: number) {
  const days: Date[] = [];
  const d = new Date(anno, mese - 1, 1);

  while (d.getMonth() === mese - 1) {
    if (weekdayIT(d)) days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }

  return days;
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

async function loadUltimePresenzeExtra(gruppoId: string, anno: number, mese: number) {
  const start = `${anno}-${pad(mese)}-01`;

  const { data, error } = await supabaseAdmin
    .from("tbpresenze_smart_calendario")
    .select("utente_id, data, giorno_settimana")
    .eq("gruppo_id", gruppoId)
    .eq("presenza", true)
    .lt("data", start)
    .neq("giorno_settimana", 2)
    .order("data", { ascending: false })
    .limit(20);

  if (error) throw error;

  return data || [];
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
  const giornoFisso = Number(gruppo.giorno_fisso || 2);

  const festivitaMap = await loadFestivita(Number(anno), Number(mese));
  const days = getWorkingDays(Number(anno), Number(mese));

  const rows: any[] = [];

  const presenzeSettimana = new Map<string, number>();

  const ultimeExtra = await loadUltimePresenzeExtra(
  gruppo_id,
  Number(anno),
  Number(mese)
);

const ultimiUtentiExtra = ultimeExtra.map((r) => r.utente_id);

let rotazioneIndex = 0;

for (let i = 0; i < utentiAttivi.length; i++) {
  const candidato = utentiAttivi[i];

  if (!ultimiUtentiExtra.includes(candidato.utente_id)) {
    rotazioneIndex = i;
    break;
  }
}

  for (const day of days) {
    const wd = weekdayIT(day);
    if (!wd) continue;

    const key = isoDate(day);
    const festivoNome = festivitaMap.get(key) || null;
 const monday = new Date(day);
monday.setDate(day.getDate() - ((day.getDay() || 7) - 1));
const settimanaKey = isoDate(monday);

let extraUtenteId: string | null = null;

if (!festivoNome && wd !== giornoFisso) {
  const giorniExtraConsentiti = [1, 3, 4, 5];

  if (giorniExtraConsentiti.includes(wd) && utentiAttivi.length > 0) {
    for (let tentativi = 0; tentativi < utentiAttivi.length; tentativi++) {
      const candidato = utentiAttivi[rotazioneIndex];
      const keySettimanaUtente = `${settimanaKey}_${candidato.utente_id}`;
      const presenzeGiaAssegnate = presenzeSettimana.get(keySettimanaUtente) || 0;

      rotazioneIndex = (rotazioneIndex + 1) % utentiAttivi.length;

      if (presenzeGiaAssegnate < 1) {
        extraUtenteId = candidato.utente_id;
        break;
      }
    }
  }
}
for (let userIndex = 0; userIndex < utentiAttivi.length; userIndex++) {
  const utente = utentiAttivi[userIndex];

  let presenza = false;

  if (!festivoNome) {
    presenza = wd === giornoFisso || utente.utente_id === extraUtenteId;
  }

  if (presenza) {
  const keySettimanaUtente = `${settimanaKey}_${utente.utente_id}`;
  presenzeSettimana.set(
    keySettimanaUtente,
    (presenzeSettimana.get(keySettimanaUtente) || 0) + 1
  );
}

  rows.push({
    studio_id: gruppo.studio_id,
    gruppo_id,
    utente_id: utente.utente_id,
    data: key,
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
