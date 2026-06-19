import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "DELETE") {
      return res.status(405).json({ error: "Metodo non consentito" });
    }

    const { id } = req.query;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "ID richiesta mancante" });
    }

    const { data, error } = await supabaseAdmin
      .from("tbferie_permessi_richieste")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        error: "Nessun record eliminato. ID inesistente o già cancellato.",
      });
    }

    return res.status(200).json({
      success: true,
      deletedId: id,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Errore interno server",
    });
  }
}
