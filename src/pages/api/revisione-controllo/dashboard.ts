import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const userEmail = req.headers["x-user-email"] as string;

    if (!userEmail) {
      return res.status(401).json({ error: "Utente non identificato" });
    }

    const { data: utente, error: utenteError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id")
      .eq("email", userEmail)
      .single();

    if (utenteError || !utente?.studio_id) {
      return res.status(401).json({ error: "Studio non trovato per l'utente" });
    }

    const studioId = utente.studio_id;
    const oggi = todayISO();
    const tra30 = addDaysISO(30);
    const anno = new Date().getFullYear();

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
        .eq("studio_id", studioId)
        .eq("stato", "attivo"),

      supabaseAdmin
        .from("tbrevisione_controlli")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .gte("data_scadenza", oggi)
        .neq("stato", "completato"),

      supabaseAdmin
        .from("tbrevisione_controlli")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .lt("data_scadenza", oggi)
        .neq("stato", "completato"),

      supabaseAdmin
        .from("tbrevisione_followup")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .eq("stato", "aperto"),

      supabaseAdmin
        .from("tbrevisione_followup")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .eq("stato", "aperto")
        .in("gravita", ["alta", "critica"]),

      supabaseAdmin
        .from("tbrevisione_relazioni")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .eq("anno", anno),

      supabaseAdmin
        .from("vw_revisione_controlli")
        .select("*")
        .eq("studio_id", studioId)
        .gte("data_scadenza", oggi)
        .lte("data_scadenza", tra30)
        .neq("stato", "completato")
        .order("data_scadenza", { ascending: true })
        .limit(10),

      supabaseAdmin
        .from("tbrevisione_followup")
        .select("*")
        .eq("studio_id", studioId)
        .eq("stato", "aperto")
        .order("data_follow_up", { ascending: true })
        .limit(10),

      supabaseAdmin
        .from("tbrevisione_followup")
        .select("*")
        .eq("studio_id", studioId)
        .eq("stato", "aperto")
        .lt("data_follow_up", oggi)
        .order("data_follow_up", { ascending: true })
        .limit(10),
    ]);

    return res.status(200).json({
      kpi: {
        incarichiAttivi: incarichiAttivi.count || 0,
        controlliDaEseguire: controlliDaEseguire.count || 0,
        controlliScaduti: controlliScaduti.count || 0,
        followupAperti: followupAperti.count || 0,
        followupCritici: followupCritici.count || 0,
        relazioniAnno: relazioniAnno.count || 0,
      },
      controlliProssimi: controlliProssimi.data || [],
      followupAperti: followupApertiLista.data || [],
      followupScaduti: followupScadutiLista.data || [],
    });
  } catch (error: any) {
    console.error("Errore dashboard revisione:", error);
    return res.status(500).json({
      error: error.message || "Errore interno dashboard revisione",
    });
  }
}
