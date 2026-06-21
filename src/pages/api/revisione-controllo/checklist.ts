import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_CHECKLIST = [
  {
    area: "Area amministrativa",
    domanda: "Libri sociali aggiornati e regolarmente tenuti?",
    ordine: 10,
  },
  {
    area: "Area amministrativa",
    domanda: "Verbali precedenti e delibere risultano correttamente archiviati?",
    ordine: 20,
  },
  {
    area: "Area contabile",
    domanda: "La situazione contabile del trimestre risulta aggiornata?",
    ordine: 30,
  },
  {
    area: "Area contabile",
    domanda: "Sono state rilevate anomalie contabili significative?",
    ordine: 40,
  },
  {
    area: "Area fiscale",
    domanda: "Le principali scadenze fiscali risultano rispettate?",
    ordine: 50,
  },
  {
    area: "Area fiscale",
    domanda: "Sono presenti debiti tributari o previdenziali scaduti?",
    ordine: 60,
  },
  {
    area: "Area societaria",
    domanda: "Sono intervenute variazioni societarie rilevanti nel trimestre?",
    ordine: 70,
  },
  {
    area: "Area societaria",
    domanda: "Sono presenti situazioni di perdita o criticità patrimoniale rilevante?",
    ordine: 80,
  },
  {
    area: "Area tesoreria",
    domanda: "La situazione finanziaria e di tesoreria risulta coerente con l'andamento aziendale?",
    ordine: 90,
  },
  {
    area: "Area tesoreria",
    domanda: "Sono presenti tensioni finanziarie o ritardi rilevanti nei pagamenti?",
    ordine: 100,
  },
  {
    area: "Area personale",
    domanda: "Gli adempimenti relativi al personale risultano regolari?",
    ordine: 110,
  },
  {
    area: "Area personale",
    domanda: "Sono presenti criticità relative a dipendenti, paghe o contributi?",
    ordine: 120,
  },
  {
    area: "Continuità aziendale",
    domanda: "Sussistono elementi che possano incidere sulla continuità aziendale?",
    ordine: 130,
  },
  {
    area: "Contenzioso",
    domanda: "Sono presenti contenziosi, accertamenti o passività potenziali rilevanti?",
    ordine: 140,
  },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const { controllo_id, crea_default } = req.query;

      if (typeof controllo_id !== "string" || !controllo_id) {
        return res.status(400).json({
          success: false,
          error: "controllo_id obbligatorio",
        });
      }

      let { data, error } = await supabaseAdmin
        .from("tbrevisione_checklist")
        .select("*")
        .eq("controllo_id", controllo_id)
        .order("ordine", { ascending: true });

      if (error) throw error;

      if ((!data || data.length === 0) && crea_default === "true") {
        const rows = DEFAULT_CHECKLIST.map((item) => ({
          controllo_id,
          area: item.area,
          domanda: item.domanda,
          risposta: null,
          note: null,
          ordine: item.ordine,
        }));

        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("tbrevisione_checklist")
          .insert(rows)
          .select("*");

        if (insertError) throw insertError;

        data = inserted || [];
      }

      return res.status(200).json({
        success: true,
        data: data || [],
      });
    }

    if (req.method === "POST") {
      const { controllo_id, checklist } = req.body;

      if (!controllo_id) {
        return res.status(400).json({
          success: false,
          error: "controllo_id obbligatorio",
        });
      }

      if (!Array.isArray(checklist)) {
        return res.status(400).json({
          success: false,
          error: "checklist deve essere un array",
        });
      }

      const rows = checklist
        .filter((item: any) => item.area && item.domanda)
        .map((item: any, index: number) => ({
          id: item.id || undefined,
          controllo_id,
          area: item.area,
          domanda: item.domanda,
          risposta: item.risposta || null,
          note: item.note || null,
          ordine: Number(item.ordine ?? (index + 1) * 10),
          updated_at: new Date().toISOString(),
        }));

      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Nessuna voce checklist valida",
        });
      }

      const { data, error } = await supabaseAdmin
        .from("tbrevisione_checklist")
        .upsert(rows, {
          onConflict: "id",
        })
        .select("*");

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: data || [],
      });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;

      if (typeof id !== "string" || !id) {
        return res.status(400).json({
          success: false,
          error: "ID voce checklist obbligatorio",
        });
      }

      const { error } = await supabaseAdmin
        .from("tbrevisione_checklist")
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
    console.error("Errore API revisione-controllo/checklist:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno server",
    });
  }
}
