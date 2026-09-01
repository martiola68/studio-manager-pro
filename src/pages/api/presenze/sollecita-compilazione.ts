import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function toDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function getBearerToken(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  }

  try {
    const supabase = createClient(req, res);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    let authUserId = session?.user?.id || null;
    let authEmail = session?.user?.email || null;

    if (!authUserId) {
      const token = getBearerToken(req);
      if (token) {
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (!error && data.user) {
          authUserId = data.user.id;
          authEmail = data.user.email || null;
        }
      }
    }

    if (!authUserId && !authEmail) {
      console.warn("[Solleciti presenze] Non autenticato", {
        sessionError: sessionError?.message,
        hasBearer: Boolean(getBearerToken(req)),
      });
      return res.status(401).json({ ok: false, error: "Non autenticato" });
    }

    let utenteQuery = supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id")
      .eq("attivo", true);

    if (authUserId) {
      utenteQuery = utenteQuery.eq("user_id", authUserId);
    } else if (authEmail) {
      utenteQuery = utenteQuery.eq("email", authEmail);
    }

    const { data: utenteCorrente, error: utenteError } = await utenteQuery.maybeSingle();

    if (utenteError || !utenteCorrente?.studio_id) {
      console.error("[Solleciti presenze] Studio utente non disponibile", {
        authUserId,
        authEmail,
        error: utenteError?.message,
      });
      return res.status(403).json({ ok: false, error: "Studio utente non disponibile" });
    }

    const studioId = utenteCorrente.studio_id;

    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    const inizioMese = toDate(new Date(oggi.getFullYear(), oggi.getMonth(), 1));
    const fineMese = toDate(new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0));

    const { data: dipendenti, error } = await supabaseAdmin
      .from("tbutenti")
      .select("id, nome, cognome, email")
      .eq("studio_id", studioId)
      .eq("attivo", true)
      .eq("tipo_rapporto", "Dipendente")
      .not("email", "is", null);

    if (error) throw error;

    const incompleti: any[] = [];

    for (const dipendente of dipendenti || []) {
      const { count, error: countError } = await supabaseAdmin
        .from("tbpresenze_dipendenti")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .eq("utente_id", dipendente.id)
        .gte("data_presenza", inizioMese)
        .lte("data_presenza", fineMese);

      if (countError) throw countError;

      const presenzeCompilate = count || 0;
      if (presenzeCompilate >= 4) continue;

      const oggiKey = toDate(oggi);

      const { count: giorniLavorativiTrascorsi, error: giorniError } = await supabaseAdmin
        .from("tbpresenze_dipendenti")
        .select("data_presenza", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .eq("utente_id", dipendente.id)
        .gte("data_presenza", inizioMese)
        .lte("data_presenza", oggiKey);

      if (giorniError) throw giorniError;

      const mancanti = Math.max(
        Number(giorniLavorativiTrascorsi || 0) - presenzeCompilate,
        4 - presenzeCompilate
      );

      incompleti.push({
        utente_id: dipendente.id,
        nome: dipendente.nome,
        cognome: dipendente.cognome,
        email: dipendente.email,
        presenze_compilate: presenzeCompilate,
        mancanti,
        livello: mancanti >= 3 ? "urgente" : "normale",
        selezionato: true,
      });
    }

    return res.status(200).json({
      ok: true,
      mese: { inizio: inizioMese, fine: fineMese },
      count: incompleti.length,
      dipendenti: incompleti,
    });
  } catch (error: any) {
    console.error("Errore anteprima solleciti:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Errore anteprima solleciti",
    });
  }
}
