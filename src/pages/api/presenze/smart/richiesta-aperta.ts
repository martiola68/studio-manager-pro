import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const gruppo_id =
    typeof req.query.gruppo_id === "string" ? req.query.gruppo_id : null;

  if (!gruppo_id) {
    return res.status(400).json({ error: "gruppo_id obbligatorio" });
  }

  const { data, error } = await supabaseAdmin
    .from("tbpresenze_smart_cambi_turno")
    .select(`
      *,
      richiedente:tbutenti!tbpresenze_smart_cambi_turno_richiedente_id_fkey(
        id, nome, cognome, email
      ),
      sostituto:tbutenti!tbpresenze_smart_cambi_turno_sostituto_id_fkey(
        id, nome, cognome, email
      )
    `)
    .eq("gruppo_id", gruppo_id)
    .eq("stato", "aperta")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json(data || null);
}
