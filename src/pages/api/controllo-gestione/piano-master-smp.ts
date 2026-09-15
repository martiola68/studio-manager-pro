import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, error: "Metodo non consentito" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("tbcontrollo_gestione_voci")
      .select("id,codice,descrizione,sezione,macrovoce")
      .order("sezione", { ascending: true })
      .order("codice", { ascending: true });

    if (error) throw error;

    const rows = data || [];
    const sezioni = Array.from(
      new Set(rows.map((row: any) => String(row?.sezione || "").trim()).filter(Boolean))
    );
    const macrovoci = Array.from(
      new Set(rows.map((row: any) => String(row?.macrovoce || "").trim()).filter(Boolean))
    );

    return res.status(200).json({
      success: true,
      data: rows,
      riepilogo: {
        numero_voci: rows.length,
        numero_sezioni: sezioni.length,
        numero_macrovoci: macrovoci.length,
      },
    });
  } catch (error: any) {
    console.error("Errore caricamento Piano Master SMP:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore caricamento Piano Master SMP",
    });
  }
}
