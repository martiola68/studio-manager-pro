import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function oggiISO() {
  return new Date().toISOString().slice(0, 10);
}

function aggiungiGiorniISO(giorni: number) {
  const d = new Date();
  d.setDate(d.getDate() + giorni);
  return d.toISOString().slice(0, 10);
}

function giorniRitardo(data: string | null) {
  if (!data) return 0;

  const oggi = new Date(oggiISO());
  const scadenza = new Date(data);
  const diff = oggi.getTime() - scadenza.getTime();

  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        success: false,
        error: "Metodo non consentito",
      });
    }

    const { studio_id } = req.query;

    if (typeof studio_id !== "string" || !studio_id) {
      return res.status(400).json({
        success: false,
        error: "studio_id obbligatorio",
      });
    }

    const oggi = oggiISO();
    const tra30 = aggiungiGiorniISO(30);
    const annoCorrente = new Date().getFullYear();

    const [
      incarichiAttivi,
      controlliDaEseguire,
      controlliScaduti,
      followupAperti,
      followupCritici,
      relazioniAnno,
      controlliProssimi,
      followupApertiLista,
      followupScadutiLista,
    ] = await Promise.all([
   supabaseAdmin
  .from("tbrevisione_incarichi")
  .select("id", { count: "exact", head: true })
  .eq("studio_id", studio_id),

      supabaseAdmin
        .from("tbrevisione_controlli")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studio_id)
        .gte("data_scadenza", oggi)
        .neq("stato", "COMPLETATO"),

      supabaseAdmin
        .from("tbrevisione_controlli")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studio_id)
        .lt("data_scadenza", oggi)
        .neq("stato", "COMPLETATO"),

      supabaseAdmin
        .from("tbrevisione_followup")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studio_id)
        .eq("stato", "aperto"),

      supabaseAdmin
        .from("tbrevisione_followup")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studio_id)
        .eq("stato", "aperto")
        .in("gravita", ["alta", "critica", "ALTA", "CRITICA"]),

      supabaseAdmin
        .from("tbrevisione_relazioni")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studio_id)
        .eq("anno", annoCorrente),

      supabaseAdmin
        .from("vw_revisione_controlli")
        .select("*")
        .eq("studio_id", studio_id)
        .gte("data_scadenza", oggi)
        .lte("data_scadenza", tra30)
        .neq("stato", "COMPLETATO")
        .order("data_scadenza", { ascending: true })
        .limit(10),

      supabaseAdmin
        .from("tbrevisione_followup")
        .select("*")
        .eq("studio_id", studio_id)
        .eq("stato", "aperto")
        .order("data_follow_up", { ascending: true })
        .limit(10),

      supabaseAdmin
        .from("tbrevisione_followup")
        .select("*")
        .eq("studio_id", studio_id)
        .eq("stato", "aperto")
        .lt("data_follow_up", oggi)
        .order("data_follow_up", { ascending: true })
        .limit(10),
    ]);

    const followupScadutiConRitardo = (followupScadutiLista.data || []).map(
      (item: any) => ({
        ...item,
        giorni_ritardo: giorniRitardo(item.data_follow_up),
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        kpi: {
          incarichi_attivi: incarichiAttivi.count || 0,
          controlli_da_eseguire: controlliDaEseguire.count || 0,
          controlli_scaduti: controlliScaduti.count || 0,
          followup_aperti: followupAperti.count || 0,
          followup_critici: followupCritici.count || 0,
          relazioni_generate_anno: relazioniAnno.count || 0,
        },
        controlli_prossimi: controlliProssimi.data || [],
        followup_aperti: followupApertiLista.data || [],
        followup_scaduti: followupScadutiConRitardo,
      },
    });
  } catch (error: any) {
    console.error("Errore API revisione-controllo/dashboard:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno server",
    });
  }
}
