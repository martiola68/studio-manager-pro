import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseAdmin = getSupabaseAdmin();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  const { gruppo_id } = req.body;

  if (!gruppo_id) {
    return res.status(400).json({ error: "gruppo_id obbligatorio" });
  }

  const { error } = await supabaseAdmin
    .from("tbpresenze_smart_gruppi")
    .delete()
    .eq("id", gruppo_id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
