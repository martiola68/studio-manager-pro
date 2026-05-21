import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { promemoriaService } from "@/services/promemoriaService";

const SECRET = process.env.CRON_SECRET || "x9KfP2LmQ8zYtA71vBnR";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  }

  const querySecret = typeof req.query.secret === "string" ? req.query.secret : null;

  if (!SECRET || querySecret !== SECRET) {
    return res.status(401).json({
      success: false,
      error: "Non autorizzato",
    });
  }

  try {
     const supabase = getSupabaseAdmin();
    const { data: senders, error } = await supabase
      .from("tbutenti")
      .select("id, studio_id")
      .not("studio_id", "is", null)
      .eq("attivo", true);

    if (error) throw error;

    const studiMap = new Map<string, string>();

    for (const sender of senders || []) {
      if (sender.id && sender.studio_id && !studiMap.has(sender.studio_id)) {
        studiMap.set(sender.studio_id, sender.id);
      }
    }

    const results = [];

    for (const [studioId, senderId] of studiMap.entries()) {
      const result = await promemoriaService.controllaEInviaNotificheScadenza(
        senderId,
        studioId,
      );

      results.push({
        studio_id: studioId,
        sender_id: senderId,
        result,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Alert promemoria processati correttamente",
      studi_processati: results.length,
      results,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore invio alert promemoria",
    });
  }
}
