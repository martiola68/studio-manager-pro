import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const { studio_id, attivo } = req.query;

      let query = supabaseAdmin
        .from("vw_revisione_incarichi")
        .select("*")
        .order("ragione_sociale", { ascending: true });

      if (typeof studio_id === "string" && studio_id) {
        query = query.eq("studio_id", studio_id);
      }

      if (typeof attivo === "string") {
        query = query.eq("attivo", attivo === "true");
      }

      const { data, error } = await query;

     if (error) throw error;

const annoInizio = data_inizio
  ? new Date(`${data_inizio}T00:00:00`).getFullYear()
  : new Date().getFullYear();

const rowsControlli = [1, 2, 3, 4].map((trimestre) => {
  const dataScadenza =
    trimestre === 1
      ? `${annoInizio}-04-30`
      : trimestre === 2
        ? `${annoInizio}-07-31`
        : trimestre === 3
          ? `${annoInizio}-10-31`
          : `${annoInizio + 1}-01-31`;

  return {
    incarico_id: data.id,
    anno: annoInizio,
    trimestre,
    data_scadenza: dataScadenza,
    stato: "DA_FARE",
  };
});

const { error: controlliError } = await supabaseAdmin
  .from("tbrevisione_controlli")
  .upsert(rowsControlli, {
    onConflict: "incarico_id,anno,trimestre",
    ignoreDuplicates: true,
  });

if (controlliError) throw controlliError;

return res.status(201).json({
  success: true,
  data,
});

    if (req.method === "POST") {
      const {
        studio_id,
        cliente_id,
        tipo_incarico,
        data_nomina,
        data_inizio,
        data_fine,
        responsabile_id,
        note,
      } = req.body;

      if (!studio_id) {
        return res.status(400).json({
          success: false,
          error: "studio_id obbligatorio",
        });
      }

      if (!cliente_id) {
        return res.status(400).json({
          success: false,
          error: "Cliente obbligatorio",
        });
      }

      if (!tipo_incarico) {
        return res.status(400).json({
          success: false,
          error: "Tipo incarico obbligatorio",
        });
      }

      if (!data_inizio) {
        return res.status(400).json({
          success: false,
          error: "Data inizio obbligatoria",
        });
      }

      const { data, error } = await supabaseAdmin
        .from("tbrevisione_incarichi")
        .insert({
          studio_id,
          cliente_id,
          tipo_incarico,
          data_nomina: data_nomina || null,
          data_inizio,
          data_fine: data_fine || null,
          responsabile_id: responsabile_id || null,
          periodicita: "TRIMESTRALE",
          attivo: true,
          note: note || null,
        })
        .select("*")
        .single();

      if (error) throw error;

      return res.status(201).json({
        success: true,
        data,
      });
    }

    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  } catch (error: any) {
    console.error("Errore API revisione-controllo:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno server",
    });
  }
}
