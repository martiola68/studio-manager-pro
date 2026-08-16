import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;

    if (typeof id !== "string" || !id) {
      return res.status(400).json({
        success: false,
        error: "ID incarico non valido",
      });
    }

    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("vw_revisione_incarichi")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data,
      });
    }

    if (req.method === "PUT") {
      const {
  tipo_incarico,
  data_nomina,
  data_inizio,
  data_fine,
  periodicita,
  responsabile_id,
  attivo,
  note,

  esercizio,
  materialita,
  materialita_operativa,
  errore_chiaramente_trascurabile,
  rischio_complessivo,
  stato_fascicolo,
  conclusione_finale,
} = req.body;

      const updateData: Record<string, any> = {
  updated_at: new Date().toISOString(),
};

/*
 * Campi incarico
 */
if (typeof tipo_incarico !== "undefined") {
  updateData.tipo_incarico = tipo_incarico;
}

if (typeof data_nomina !== "undefined") {
  updateData.data_nomina = data_nomina || null;
}

if (typeof data_inizio !== "undefined") {
  updateData.data_inizio = data_inizio;
}

if (typeof data_fine !== "undefined") {
  updateData.data_fine = data_fine || null;
}

if (typeof periodicita !== "undefined") {
  updateData.periodicita =
    periodicita || "TRIMESTRALE";
}

if (typeof responsabile_id !== "undefined") {
  updateData.responsabile_id =
    responsabile_id || null;
}

if (typeof attivo !== "undefined") {
  updateData.attivo =
    typeof attivo === "boolean"
      ? attivo
      : true;
}

if (typeof note !== "undefined") {
  updateData.note = note || null;
}

/*
 * Campi fascicolo / pianificazione
 */
if (typeof esercizio !== "undefined") {
  updateData.esercizio =
    esercizio === null ||
    esercizio === ""
      ? null
      : Number(esercizio);
}

if (typeof materialita !== "undefined") {
  updateData.materialita =
    materialita === null ||
    materialita === ""
      ? null
      : Number(materialita);
}

if (
  typeof materialita_operativa !==
  "undefined"
) {
  updateData.materialita_operativa =
    materialita_operativa === null ||
    materialita_operativa === ""
      ? null
      : Number(materialita_operativa);
}

if (
  typeof errore_chiaramente_trascurabile !==
  "undefined"
) {
  updateData.errore_chiaramente_trascurabile =
    errore_chiaramente_trascurabile === null ||
    errore_chiaramente_trascurabile === ""
      ? null
      : Number(
          errore_chiaramente_trascurabile
        );
}

if (
  typeof rischio_complessivo !==
  "undefined"
) {
  updateData.rischio_complessivo =
    rischio_complessivo || null;
}

if (
  typeof stato_fascicolo !==
  "undefined"
) {
  updateData.stato_fascicolo =
    stato_fascicolo || "PIANIFICAZIONE";
}

if (
  typeof conclusione_finale !==
  "undefined"
) {
  updateData.conclusione_finale =
    conclusione_finale || null;
}

      const { data, error } = await supabaseAdmin
  .from("tbrevisione_incarichi")
  .update(updateData)
  .eq("id", id)
  .select("*")
  .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data,
      });
    }

    if (req.method === "DELETE") {
      const { error } = await supabaseAdmin
        .from("tbrevisione_incarichi")
        .delete()
        .eq("id", id);

      if (error) throw error;

      return res.status(200).json({
        success: true,
      });
    }

    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  } catch (error: any) {
    console.error("Errore API revisione-controllo/[id]:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno server",
    });
  }
}
