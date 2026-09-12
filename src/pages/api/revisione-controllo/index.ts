import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getScadenzaTrimestre(anno: number, trimestre: number) {
  if (trimestre === 1) return `${anno}-04-30`;
  if (trimestre === 2) return `${anno}-07-31`;
  if (trimestre === 3) return `${anno}-10-31`;
  return `${anno + 1}-01-31`;
}

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

      return res.status(200).json({
        success: true,
        data: data || [],
      });
    }

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
        preincarico_id,
        data_accettazione,
        note_finali,
        accettazione_finale,
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

      let preincarico: any = null;
      if (preincarico_id) {
        const { data: pre, error: preError } = await supabaseAdmin
          .from("tbrevisione_preincarichi")
          .select("id,studio_id,cliente_id,stato,pratica_revisione_id")
          .eq("id", preincarico_id)
          .maybeSingle();
        if (preError) throw preError;
        if (!pre) return res.status(404).json({ success: false, error: "Presa in carico non trovata" });
        if (pre.studio_id !== studio_id || pre.cliente_id !== cliente_id) {
          return res.status(409).json({ success: false, error: "Presa in carico non coerente con studio o cliente" });
        }
        if (pre.pratica_revisione_id) {
          const { data: existing, error: existingError } = await supabaseAdmin
            .from("tbrevisione_incarichi")
            .select("*")
            .eq("id", pre.pratica_revisione_id)
            .maybeSingle();
          if (existingError) throw existingError;
          return res.status(200).json({ success: true, data: existing, already_exists: true });
        }
        if (pre.stato === "generato") {
          return res.status(409).json({ success: false, error: "Presa in carico già generata ma priva di collegamento alla pratica" });
        }
        preincarico = pre;
      }
const annoInizio = new Date(
  `${data_inizio}T00:00:00`
).getFullYear();

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

    esercizio: annoInizio,
    stato_fascicolo: "PIANIFICAZIONE",
  })
        .select("*")
        .single();

      if (error) throw error;

const rowsControlli = [1, 2, 3, 4].map((trimestre) => ({
  studio_id,
  incarico_id: data.id,
  anno: annoInizio,
  trimestre,
  data_scadenza: getScadenzaTrimestre(annoInizio, trimestre),
  stato: "DA_FARE",
}));

      const { error: controlliError } = await supabaseAdmin
        .from("tbrevisione_controlli")
        .upsert(rowsControlli, {
          onConflict: "incarico_id,anno,trimestre",
          ignoreDuplicates: true,
        });

      if (controlliError) {
        await supabaseAdmin.from("tbrevisione_incarichi").delete().eq("id", data.id);
        throw controlliError;
      }

      if (preincarico) {
        const { error: docError } = await supabaseAdmin
          .from("tbrevisione_preincarico_documenti")
          .upsert({
            studio_id,
            preincarico_id,
            tipo: "ACCETTAZIONE_FINALE",
            versione: 1,
            stato: "confermato",
            contenuto: { ...(accettazione_finale || {}), pratica_revisione_id: data.id, confermato: true },
            confermato_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: "preincarico_id,tipo" });

        if (docError) {
          await supabaseAdmin.from("tbrevisione_controlli").delete().eq("incarico_id", data.id);
          await supabaseAdmin.from("tbrevisione_incarichi").delete().eq("id", data.id);
          throw docError;
        }

        const { error: preUpdateError } = await supabaseAdmin
          .from("tbrevisione_preincarichi")
          .update({
            stato: "generato",
            accettato: true,
            data_accettazione: data_accettazione || data_nomina || null,
            note_finali: note_finali || null,
            pratica_revisione_id: data.id,
            step_corrente: 8,
            updated_at: new Date().toISOString(),
          })
          .eq("id", preincarico_id)
          .neq("stato", "generato");

        if (preUpdateError) {
          await supabaseAdmin.from("tbrevisione_preincarico_documenti").delete().eq("preincarico_id", preincarico_id).eq("tipo", "ACCETTAZIONE_FINALE");
          await supabaseAdmin.from("tbrevisione_controlli").delete().eq("incarico_id", data.id);
          await supabaseAdmin.from("tbrevisione_incarichi").delete().eq("id", data.id);
          throw preUpdateError;
        }
      }

      return res.status(201).json({ success: true, data, already_exists: false });
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
