import { supabase } from "@/lib/supabase/client";
import { decrypt } from "@/lib/encryption365";
import { tokenCache } from "@/services/tokenCacheService";
import { z } from "zod";

/**
 * Microsoft 365 Service - Client Credentials Only (Multi-Studio)
 * 
 * Each studio has its own Microsoft 365 tenant configuration.
 * Tokens are obtained on-demand using client_credentials flow.
 * In-memory caching prevents unnecessary token requests.
 * 
 * NO FALLBACK to environment variables - DB is the single source of truth.
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
 * 
 * @param studioId - UUID of the studio
 * @returns Validated config or null if not found/invalid
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

  if (!data) {
    console.log("[M365 Service] No configuration found for studio:", studioId);
    return null;
  }

  // Runtime validation with Zod
  const parsed = M365ConfigSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[M365 Service] Config validation failed:", parsed.error);
    return null;
  }

  return parsed.data;
}

/**
 * Check if M365 is enabled and configured for a studio
 */
export async function isM365Enabled(studioId: string): Promise<boolean> {
  const config = await getM365Config(studioId);
  return !!(config && config.enabled && config.client_id && config.tenant_id);
}

/**
 * Get app-only access token using client_credentials flow
 * 
 * Features:
 * - In-memory caching (5min safety margin)
 * - Automatic token refresh
 * - Zod validation of Microsoft response
 * - NO environment variable fallback
 * 
 * @param studioId - UUID of the studio
 * @returns Access token or null if failed
 */
export async function getAppOnlyToken(studioId: string): Promise<string | null> {
  try {
    // 1. Check cache first
    const cachedToken = tokenCache.get(studioId);
    if (cachedToken) {
      return cachedToken;
    }

    // 2. Get configuration from database
    const config = await getM365Config(studioId);
    
    if (!config || !config.enabled) {
      console.error("[M365 Service] M365 not configured or disabled for studio:", studioId);
      return null;
    }

    // 3. Decrypt client secret
    const clientSecret = decrypt(config.client_secret_encrypted);

    // 4. Request token with client_credentials
    const tokenUrl = `https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: config.client_id,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });

    console.log(`[M365 Service] Requesting new token for studio ${studioId}`);

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
    
    // 5. Validate token response with Zod
    const parsed = TokenResponseSchema.safeParse(json);
    if (!parsed.success) {
      console.error("[M365 Service] Invalid token response shape:", parsed.error);
      return null;
    }

    const { access_token, expires_in } = parsed.data;

    // 6. Cache token
    tokenCache.set(studioId, access_token, expires_in);

    return access_token;
  } catch (error) {
    console.error("[M365 Service] Error getting app-only token:", error);
    return null;
  }
}

/**
 * Make a Graph API call with app-only token
 * 
 * Automatically handles token acquisition and caching.
 * 
 * @param studioId - UUID of the studio
 * @param endpoint - Graph API endpoint (relative or absolute URL)
 * @param options - Fetch options (method, body, etc.)
 * @returns Response object or null if failed
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
 * Get organizer email for studio (used for calendar events)
 */
export async function getOrganizerEmail(studioId: string): Promise<string | null> {
  const config = await getM365Config(studioId);
  return config?.organizer_email || null;
}

/**
 * Invalidate cached token for a studio
 * 
 * Use this when configuration changes or token becomes invalid.
 */
export function invalidateToken(studioId: string): void {
  tokenCache.invalidate(studioId);
}

// Export all functions
export default {
  getM365Config,
  isM365Enabled,
  getAppOnlyToken,
  graphApiCall,
  getOrganizerEmail,
  invalidateToken,
};