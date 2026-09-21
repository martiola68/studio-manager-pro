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
    .select("id")
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
    .select("gruppo_id, utente_id")
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

  const righe = (data || []).filter((row: any) =>
    membershipSet.has(`${String(row.gruppo_id)}_${String(row.utente_id)}`)
  );

  return res.status(200).json(righe);
}
