import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const gruppo_id =
    typeof req.query.gruppo_id === "string" ? req.query.gruppo_id : null;

  const anno =
    typeof req.query.anno === "string" ? Number(req.query.anno) : null;

  const mese =
    typeof req.query.mese === "string" ? Number(req.query.mese) : null;

  if (!gruppo_id || !anno || !mese) {
    return res.status(400).json({
      error: "gruppo_id, anno e mese sono obbligatori",
    });
  }

  const { data, error } = await supabaseAdmin
    .from("tbpresenze_smart_calendario")
    .select(`
      *,
      utente:tbutenti(id, nome, cognome, email, settore, tipo_rapporto),
      gruppo:tbpresenze_smart_gruppi(*)
    `)
    .eq("gruppo_id", gruppo_id)
    .eq("anno", anno)
    .eq("mese", mese)
    .order("data", { ascending: true });

  if (error) {
    return res.status(500).json({
      error: error.message,
    });
  }

  return res.status(200).json(data || []);
}
