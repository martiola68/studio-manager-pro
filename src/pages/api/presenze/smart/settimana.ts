import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  const studioId =
    typeof req.query.studio_id === "string" ? req.query.studio_id : "";
  const start =
    typeof req.query.start === "string" ? req.query.start : "";
  const end =
    typeof req.query.end === "string" ? req.query.end : "";

  if (!studioId || !start || !end) {
    return res.status(400).json({
      error: "studio_id, start ed end sono obbligatori",
    });
  }

  const { data: gruppi, error: gruppiError } = await supabaseAdmin
    .from("tbpresenze_smart_gruppi")
    .select("id, scelta_libera")
    .eq("studio_id", studioId)
    .eq("attivo", true);

  if (gruppiError) {
    return res.status(500).json({ error: gruppiError.message });
  }

  const gruppoIds = (gruppi || []).map((g: any) => String(g.id));

  if (gruppoIds.length === 0) {
    return res.status(200).json([]);
  }

  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from("tbpresenze_smart_gruppi_utenti")
    .select("gruppo_id, utente_id, giorni_presenza")
    .in("gruppo_id", gruppoIds)
    .eq("attivo", true);

  if (membershipsError) {
    return res.status(500).json({ error: membershipsError.message });
  }

  const membershipSet = new Set(
    (memberships || []).map(
      (m: any) => `${String(m.gruppo_id)}_${String(m.utente_id)}`
    )
  );

  const { data, error } = await supabaseAdmin
    .from("tbpresenze_smart_calendario")
    .select("id, gruppo_id, utente_id, data, presenza, festivo, nota")
    .eq("studio_id", studioId)
    .in("gruppo_id", gruppoIds)
    .gte("data", start)
    .lte("data", end)
    .order("data", { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const righeCalendario = (data || []).filter((row: any) =>
    membershipSet.has(`${String(row.gruppo_id)}_${String(row.utente_id)}`)
  );

  const gruppiById = new Map(
    (gruppi || []).map((g: any) => [String(g.id), g])
  );

  const existingKeys = new Set(
    righeCalendario.map(
      (row: any) =>
        `${String(row.gruppo_id)}_${String(row.utente_id)}_${String(row.data)}`
    )
  );

  const { data: festivita, error: festivitaError } = await supabaseAdmin
    .from("tbfestivita")
    .select("data_festivita, descrizione")
    .gte("data_festivita", start)
    .lte("data_festivita", end);

  if (festivitaError) {
    return res.status(500).json({ error: festivitaError.message });
  }

  const festivitaMap = new Map(
    (festivita || []).map((f: any) => [
      String(f.data_festivita),
      String(f.descrizione || "Festivo / Non lavorativo"),
    ])
  );

  const dateRange: Array<{ data: string; weekday: number }> = [];
  const cursor = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);

  while (cursor <= endDate) {
    const weekday = cursor.getDay();
    if (weekday >= 1 && weekday <= 5) {
      const yyyy = cursor.getFullYear();
      const mm = String(cursor.getMonth() + 1).padStart(2, "0");
      const dd = String(cursor.getDate()).padStart(2, "0");
      dateRange.push({
        data: `${yyyy}-${mm}-${dd}`,
        weekday,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const righeDerivate: any[] = [];

  for (const membership of memberships || []) {
    const gruppoId = String((membership as any).gruppo_id || "");
    const utenteId = String((membership as any).utente_id || "");
    const gruppo: any = gruppiById.get(gruppoId);

    if (!gruppo?.scelta_libera) continue;

    const giorniPresenza = Array.isArray((membership as any).giorni_presenza)
      ? (membership as any).giorni_presenza.map(Number)
      : [];

    for (const giorno of dateRange) {
      const key = `${gruppoId}_${utenteId}_${giorno.data}`;
      if (existingKeys.has(key)) continue;

      const festivoNome = festivitaMap.get(giorno.data) || null;

      righeDerivate.push({
        id: `derived-${gruppoId}-${utenteId}-${giorno.data}`,
        gruppo_id: gruppoId,
        utente_id: utenteId,
        data: giorno.data,
        presenza: !festivoNome && giorniPresenza.includes(giorno.weekday),
        festivo: !!festivoNome,
        nota: festivoNome,
        derivato_da_gruppo: true,
      });
    }
  }

  const righe = [...righeCalendario, ...righeDerivate].sort(
    (a: any, b: any) =>
      String(a.data).localeCompare(String(b.data)) ||
      String(a.utente_id).localeCompare(String(b.utente_id))
  );

  return res.status(200).json(righe);
}
