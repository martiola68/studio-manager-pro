import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseClient } from "@/lib/supabase/client";
import { z } from "zod";

/**
 * API: Save Teams Configuration
 */

const SaveTeamsConfigSchema = z.object({
  studioId: z.string().uuid(),
  teamId: z.string().optional().nullable(),
  defaultChannelId: z.string().optional().nullable(),
  alertChannelId: z.string().optional().nullable(),
  scadenzeChannelId: z.string().optional().nullable(),
});

const TeamsConfigRowSchema = z.object({
  teams_default_team_id: z.string().nullable(),
  teams_default_channel_id: z.string().nullable(),
  teams_alert_channel_id: z.string().nullable(),
  teams_scadenze_channel_id: z.string().nullable(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    const supabase = getSupabaseClient() as any;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const parseResult = SaveTeamsConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Invalid request data", 
        details: parseResult.error.flatten() 
      });
    }

    const {
      studioId,
      teamId,
      defaultChannelId,
      alertChannelId,
      scadenzeChannelId,
    } = parseResult.data;

    console.log("[Teams Config] Saving Teams configuration for studio:", studioId);

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

    const parsedDB = TeamsConfigRowSchema.safeParse(data);
    if (!parsedDB.success) {
      throw new Error("Database returned invalid data structure");
    }

    const result = parsedDB.data;

    return res.status(200).json({
      success: true,
      message: "Teams configuration saved successfully",
      config: result,
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
