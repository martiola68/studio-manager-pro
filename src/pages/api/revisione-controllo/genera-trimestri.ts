import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function scadenzaTrimestre(anno: number, trimestre: number) {
  if (trimestre === 1) return `${anno}-03-31`;
  if (trimestre === 2) return `${anno}-06-30`;
  if (trimestre === 3) return `${anno}-09-30`;
  return `${anno}-12-31`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Metodo non consentito",
      });
    }

    const { studio_id, anno, incarico_id } = req.body;

    if (!studio_id) {
      return res.status(400).json({
        success: false,
        error: "studio_id obbligatorio",
      });
    }

    const annoRif = Number(anno || new Date().getFullYear());

    let incarichiQuery = supabaseAdmin
  .from("tbrevisione_incarichi")
  .select("*")
  .eq("studio_id", studio_id);

    if (incarico_id) {
      incarichiQuery = incarichiQuery.eq("id", incarico_id);
    }

    const { data: incarichi, error: incarichiError } = await incarichiQuery;

    if (incarichiError) throw incarichiError;

    if (!incarichi || incarichi.length === 0) {
      return res.status(200).json({
        success: true,
        creati: 0,
        message: "Nessun incarico attivo trovato",
      });
    }

    let creati = 0;
    let saltati = 0;

    for (const incarico of incarichi) {
      for (const trimestre of [1, 2, 3, 4]) {
        const { data: esistente, error: checkError } = await supabaseAdmin
          .from("tbrevisione_controlli")
          .select("id")
          .eq("studio_id", studio_id)
          .eq("incarico_id", incarico.id)
          .eq("anno", annoRif)
          .eq("trimestre", trimestre)
          .maybeSingle();

        if (checkError) throw checkError;

        if (esistente) {
          saltati++;
          continue;
        }

        const { error: insertError } = await supabaseAdmin
          .from("tbrevisione_controlli")
          .insert({
            studio_id,
            incarico_id: incarico.id,
            cliente_id: incarico.cliente_id,
            anno: annoRif,
            trimestre,
            data_scadenza: scadenzaTrimestre(annoRif, trimestre),
            stato: "DA_ESEGUIRE",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertError) throw insertError;

        creati++;
      }
    }

    return res.status(200).json({
      success: true,
      creati,
      saltati,
    });
  } catch (error: any) {
    console.error("Errore genera trimestri revisione:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno server",
    });
  }
}
