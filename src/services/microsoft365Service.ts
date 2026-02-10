import { supabase } from "@/lib/supabase/client";
import { decrypt } from "@/lib/encryption365";
import { z } from "zod";

/**
 * Microsoft 365 Service - Client Credentials Only
 * 
 * Manages app-only authentication and Graph API calls.
 * Uses Zod for runtime validation of database and API responses.
 */

// Zod Schema for Database Config
export const M365ConfigSchema = z.object({
  id: z.string().uuid().optional(),
  studio_id: z.string().uuid(),
  client_id: z.string(),
  client_secret_encrypted: z.string(),
  tenant_id: z.string(),
  organizer_email: z.string().nullable().optional(),
  enabled: z.boolean().optional().default(true),
  // Fields for Teams (optional)
  teams_default_team_id: z.string().nullable().optional(),
  teams_default_channel_id: z.string().nullable().optional(),
  teams_alert_channel_id: z.string().nullable().optional(),
  teams_scadenze_channel_id: z.string().nullable().optional(),
});

export type M365Config = z.infer<typeof M365ConfigSchema>;

// Zod Schema for Microsoft Token Response
const TokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
});

/**
 * Get M365 configuration for a studio with validation
 */
export async function getM365Config(studioId: string): Promise<M365Config | null> {
  const { data, error } = await supabase
    .from("tbmicrosoft365_config" as any)
    .select("*")
    .eq("studio_id", studioId)
    .maybeSingle();

  if (error) {
    console.error("[M365 Service] Database error:", error);
    return null;
  }

  if (!data) return null;

  // Runtime validation
  const parsed = M365ConfigSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[M365 Service] Config validation failed:", parsed.error);
    return null;
  }

  return parsed.data;
}

/**
 * Check if M365 is enabled for a studio
 */
export async function isM365Enabled(studioId: string): Promise<boolean> {
  const config = await getM365Config(studioId);
  return !!(config && config.enabled && config.client_id && config.tenant_id);
}

/**
 * Get app-only access token using client_credentials
 */
export async function getAppOnlyToken(studioId: string): Promise<string | null> {
  try {
    const config = await getM365Config(studioId);
    
    if (!config || !config.enabled) {
      console.error("[M365 Service] M365 not configured or disabled for studio:", studioId);
      return null;
    }

    // Decrypt client secret
    const clientSecret = decrypt(config.client_secret_encrypted);

    // Request token with client_credentials
    const tokenUrl = `https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: config.client_id,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[M365 Service] Token request failed:", errorData);
      return null;
    }

    const json = await response.json();
    
    // Validate token response
    const parsed = TokenResponseSchema.safeParse(json);
    if (!parsed.success) {
      console.error("[M365 Service] Invalid token response shape:", parsed.error);
      return null;
    }

    return parsed.data.access_token;
  } catch (error) {
    console.error("[M365 Service] Error getting app-only token:", error);
    return null;
  }
}

/**
 * Make a Graph API call with app-only token
 */
export async function graphApiCall(
  studioId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response | null> {
  try {
    const token = await getAppOnlyToken(studioId);
    
    if (!token) {
      console.error("[M365 Service] Failed to obtain access token");
      return null;
    }

    const url = endpoint.startsWith("https://")
      ? endpoint
      : `https://graph.microsoft.com/v1.0${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    return response;
  } catch (error) {
    console.error("[M365 Service] Graph API call error:", error);
    return null;
  }
}

/**
 * Get organizer email for studio (for calendar events)
 */
export async function getOrganizerEmail(studioId: string): Promise<string | null> {
  const config = await getM365Config(studioId);
  return config?.organizer_email || null;
}

// Export all functions
export default {
  getM365Config,
  isM365Enabled,
  getAppOnlyToken,
  graphApiCall,
  getOrganizerEmail,
};