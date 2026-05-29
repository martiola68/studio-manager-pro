import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const settore =
    typeof req.query.settore === "string" ? req.query.settore : null;

  const tipoRapporto =
    typeof req.query.tipo_rapporto === "string"
      ? req.query.tipo_rapporto
      : null;

  let query = supabaseAdmin
    .from("tbutenti")
    .select("id, nome, cognome, email, settore, tipo_rapporto, attivo")
    .eq("attivo", true)
    .order("cognome", { ascending: true });

  if (settore) {
    query = query.eq("settore", settore);
  }

  if (tipoRapporto) {
    query = query.eq("tipo_rapporto", tipoRapporto);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({
      error: error.message,
    });
  }

  return res.status(200).json(data || []);
}
