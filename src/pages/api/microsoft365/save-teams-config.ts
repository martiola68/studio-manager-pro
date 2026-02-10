import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";

/**
 * API: Save Teams Configuration
 * 
 * Saves Teams channel IDs for notifications.
 * 
 * POST /api/microsoft365/save-teams-config
 * Body: {
 *   studioId: string,
 *   teamId?: string,
 *   defaultChannelId?: string,
 *   alertChannelId?: string,
 *   scadenzeChannelId?: string
 * }
 */

interface SaveTeamsConfigRequest {
  studioId: string;
  teamId?: string;
  defaultChannelId?: string;
  alertChannelId?: string;
  scadenzeChannelId?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      studioId,
      teamId,
      defaultChannelId,
      alertChannelId,
      scadenzeChannelId,
    } = req.body as SaveTeamsConfigRequest;

    if (!studioId) {
      return res.status(400).json({ error: "Missing studioId" });
    }

    console.log("[Teams Config] Saving Teams configuration for studio:", studioId);

    // Update config
    const { data, error } = await supabase
      .from("tbmicrosoft365_config" as any)
      .update({
        teams_default_team_id: teamId || null,
        teams_default_channel_id: defaultChannelId || null,
        teams_alert_channel_id: alertChannelId || null,
        teams_scadenze_channel_id: scadenzeChannelId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("studio_id", studioId)
      .select()
      .single();

    if (error) {
      console.error("[Teams Config] Error saving configuration:", error);
      throw error;
    }

    console.log("[Teams Config] Configuration saved successfully");

    return res.status(200).json({
      success: true,
      message: "Teams configuration saved successfully",
      config: {
        teams_default_team_id: data.teams_default_team_id,
        teams_default_channel_id: data.teams_default_channel_id,
        teams_alert_channel_id: data.teams_alert_channel_id,
        teams_scadenze_channel_id: data.teams_scadenze_channel_id,
      },
    });
  } catch (error: unknown) {
    console.error("[Teams Config] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      error: "Failed to save Teams configuration",
      details: errorMessage,
    });
  }
}