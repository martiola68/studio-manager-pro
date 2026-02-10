import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";
import { microsoftGraphService } from "@/services/microsoftGraphService";

/**
 * API per recuperare lista team e canali disponibili
 * GET /api/microsoft365/teams-list
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Verifica autenticazione
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Token non valido" });
    }

    // 2. Recupera user_id dal database
    const { data: userData, error: userError } = await supabase
      .from("tbutenti")
      .select("id")
      .eq("email", user.email)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: "Utente non trovato" });
    }

    // Type guard esplicito
    if (typeof userData.id !== "string") {
      return res.status(404).json({ error: "ID utente non valido" });
    }

    // 3. Verifica se l'utente è connesso a Microsoft
    const isConnected = await microsoftGraphService.isConnected(userData.id);
    if (!isConnected) {
      return res.status(400).json({ 
        error: "Account Microsoft non connesso",
        code: "NOT_CONNECTED"
      });
    }

    // 4. Recupera lista team e canali
    const result = await microsoftGraphService.getTeamsWithChannels(userData.id);

    if (!result.success) {
      return res.status(500).json({ 
        error: result.error || "Errore recupero team",
        code: "GRAPH_ERROR"
      });
    }

    return res.status(200).json({
      success: true,
      teams: result.teams || []
    });

  } catch (error: any) {
    console.error("Errore API teams-list:", error);
    return res.status(500).json({
      error: error.message || "Errore server",
      code: "SERVER_ERROR"
    });
  }
}