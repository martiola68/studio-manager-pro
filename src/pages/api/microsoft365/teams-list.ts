import type { NextApiRequest, NextApiResponse } from "next";
import { getAppOnlyToken } from "@/services/microsoft365Service";

/**
 * API: List Microsoft Teams
 * 
 * Retrieves all Teams available in the organization.
 * Uses app-only authentication.
 * 
 * GET /api/microsoft365/teams-list?studioId=xxx
 */

interface Team {
  id: string;
  displayName: string;
  description: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { studioId } = req.query;

    if (!studioId || typeof studioId !== "string") {
      return res.status(400).json({ error: "Missing studioId parameter" });
    }

    console.log("[Teams List] Fetching teams for studio:", studioId);

    // Get app-only token
    const token = await getAppOnlyToken(studioId);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Failed to obtain access token",
      });
    }

    // Fetch teams from Graph API
    const response = await fetch("https://graph.microsoft.com/v1.0/groups?$filter=resourceProvisioningOptions/Any(x:x eq 'Team')", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[Teams List] Graph API error:", errorData);
      return res.status(response.status).json({
        success: false,
        error: "Failed to fetch teams",
        details: errorData.error?.message || "Unknown error",
      });
    }

    const data = await response.json();
    const teams: Team[] = data.value.map((team: unknown) => ({
      id: (team as { id: string }).id,
      displayName: (team as { displayName: string }).displayName,
      description: (team as { description?: string | null }).description || null,
    }));

    console.log(`[Teams List] Found ${teams.length} teams`);

    return res.status(200).json({
      success: true,
      teams,
    });
  } catch (error: unknown) {
    console.error("[Teams List] Error fetching teams:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: errorMessage,
    });
  }
}