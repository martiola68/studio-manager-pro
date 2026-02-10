import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";
import { microsoftGraphService } from "@/services/microsoftGraphService";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { action, teamId, channelId, message } = req.body;

    // Verifica token auth
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Token mancante" });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user || !user.email) {
      return res.status(401).json({ error: "Token non valido o email mancante" });
    }

    // Recupera l'utente dal DB per avere l'ID corretto
    const { data: userData, error: userError } = await supabase
      .from("tbutenti")
      .select("id")
      .eq("email", user.email!)
      .single();

    if (userError || !userData || !userData.id) {
      return res.status(404).json({ error: "Utente non trovato nel database" });
    }

    const dbUserId = userData.id as string;

    switch (action) {
      case "check_connection":
        const isConnected = await microsoftGraphService.isConnected(dbUserId);
        return res.status(200).json({ 
          success: true, 
          isConnected,
          message: isConnected ? "Connesso a Microsoft 365" : "Non connesso"
        });

      case "get_teams":
        const teams = await microsoftGraphService.getTeamsWithChannels(dbUserId);
        return res.status(200).json({ success: true, teams });

      case "send_message":
        if (!teamId || !channelId) {
          return res.status(400).json({ error: "Team ID e Channel ID richiesti" });
        }
        
        await microsoftGraphService.sendChannelMessage(
          dbUserId,
          teamId,
          channelId,
          message || "Messaggio di test da Studio Manager Pro"
        );
        return res.status(200).json({ success: true, message: "Messaggio inviato con successo" });

      default:
        return res.status(400).json({ error: "Azione non valida" });
    }

  } catch (error: any) {
    console.error("Errore API test-teams:", error);
    return res.status(500).json({
      error: error.message || "Errore server interno",
      code: "SERVER_ERROR"
    });
  }
}