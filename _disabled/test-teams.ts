import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseClient } from "@/lib/supabase/client";
import { graphApiCall } from "@/services/microsoftGraphService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = getSupabaseClient() as any;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { action, teamId, channelId, message } = req.body ?? {};

    // 1) Auth token (Bearer ...)
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token mancante" });
    }

    const jwt = authHeader.substring(7);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(jwt);

    if (authError || !user?.email) {
      return res.status(401).json({ error: "Token non valido o email mancante" });
    }

    // 2) db user id (tbutenti.id)
    const { data: userData, error: userError } = await supabase
      .from("tbutenti")
      .select("id, studio_id")
      .eq("email", user.email)
      .single();

    if (userError || !userData?.id) {
      return res.status(404).json({ error: "Utente non trovato nel database" });
    }
    if (!userData?.studio_id) {
      return res.status(400).json({ error: "studio_id mancante per l'utente" });
    }

    const dbUserId = userData.id as string;
    const studioId = userData.studio_id as string;

    switch (action) {
      case "check_connection": {
        const { data: tok, error: tokErr } = await supabase
          .from("tbmicrosoft365_user_tokens")
          .select("id")
          .eq("studio_id", studioId)
          .eq("user_id", dbUserId)
          .is("revoked_at", null)
          .maybeSingle();

        const isConnected = !!tok && !tokErr;

        return res.status(200).json({
          success: true,
          isConnected,
          message: isConnected ? "Connesso a Microsoft 365" : "Non connesso",
        });
      }

      case "get_teams": {
        const teamsResp = await graphApiCall<{ value: any[] }>(
          studioId,
          dbUserId,
          "/me/joinedTeams",
          { method: "GET" }
        );

        return res.status(200).json({ success: true, teams: teamsResp?.value ?? [] });
      }

      case "send_message": {
        if (!teamId || !channelId) {
          return res.status(400).json({ error: "Team ID e Channel ID richiesti" });
        }

        const body = {
          body: {
            contentType: "html",
            content: message || "Messaggio di test da Studio Manager Pro",
          },
        };

        await graphApiCall(
          studioId,
          dbUserId,
          `/teams/${teamId}/channels/${channelId}/messages`,
          {
            method: "POST",
            body: JSON.stringify(body),
          }
        );

        return res.status(200).json({ success: true, message: "Messaggio inviato con successo" });
      }

      default:
        return res.status(400).json({ error: "Azione non valida" });
    }
  } catch (error: any) {
    console.error("Errore API test-teams:", error);
    return res.status(500).json({
      error: error?.message || "Errore server interno",
      code: "SERVER_ERROR",
    });
  }
}
