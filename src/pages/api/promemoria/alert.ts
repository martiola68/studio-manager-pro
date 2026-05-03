import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";
import { promemoriaService } from "@/services/promemoriaService";

const SECRET = process.env.CRON_SECRET || "x9KfP2LmQ8zYtA71vBnR";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  }

  const querySecret =
    typeof req.query.secret === "string" ? req.query.secret : null;

  if (!SECRET || querySecret !== SECRET) {
    return res.status(401).json({
      success: false,
      error: "Non autorizzato",
    });
  }

  try {
    const { data: sender, error } = await supabase
      .from("tbutenti")
      .select("id, studio_id")
      .not("studio_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (error || !sender?.id || !sender?.studio_id) {
      throw new Error("Nessun utente/studio valido per invio alert promemoria");
    }

    const result = await promemoriaService.controllaEInviaNotificheScadenza(
      sender.id,
      sender.studio_id
    );

    return res.status(200).json({
      success: true,
      message: "Alert promemoria processati correttamente",
      result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore invio alert promemoria",
    });
  }
}
