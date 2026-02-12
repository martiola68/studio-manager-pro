import { supabase } from "@/lib/supabase/client";
import { decrypt } from "@/lib/encryption365";

/**
 * Microsoft Graph API Service - DELEGATED ONLY
 * 
 * Uses OAuth 2.0 delegated permissions (user tokens).
 * NO app-only fallback - all operations require authenticated user.
 * 
 * Token refresh is automatic when token expires.
 */

interface GraphTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

/**
 * Get valid token for user (with automatic refresh)
 */
async function getValidToken(userId: string): Promise<string | null> {
  try {
    const { data: tokenData, error } = await supabase
      .from("tbmicrosoft_tokens")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[Graph Service] Database error:", error);
      return null;
    }

    if (!tokenData) {
      console.log("[Graph Service] No token found for user:", userId);
      return null;
    }

    const accessToken = decrypt(tokenData.access_token);
    
    if (!accessToken || typeof accessToken !== "string" || accessToken.trim().length === 0) {
      console.error("[Graph Service] Invalid access token (empty or corrupted)");
      await cleanupInvalidToken(userId);
      return null;
    }

    const tokenParts = accessToken.split(".");
    if (tokenParts.length !== 3) {
      console.error("[Graph Service] Invalid JWT format");
      await cleanupInvalidToken(userId);
      return null;
    }

    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();

    if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
      return accessToken;
    }

    console.log("[Graph Service] Token expired, attempting refresh...");
    
    if (!tokenData.refresh_token) {
      console.error("[Graph Service] No refresh token available");
      await cleanupInvalidToken(userId);
      return null;
    }

    const newAccessToken = await refreshToken(userId, tokenData.refresh_token);
    return newAccessToken;
  } catch (error) {
    console.error("[Graph Service] Error in getValidToken:", error);
    return null;
  }
}

/**
 * Cleanup invalid/corrupted tokens from database
 */
async function cleanupInvalidToken(userId: string): Promise<void> {
  try {
    await supabase
      .from("tbmicrosoft_tokens")
      .delete()
      .eq("user_id", userId);
    
    console.log("[Graph Service] Cleaned up invalid token for user:", userId);
  } catch (error) {
    console.error("[Graph Service] Failed to cleanup token:", error);
  }
}

/**
 * Refresh access token using refresh_token
 */
async function refreshToken(userId: string, encryptedRefreshToken: string): Promise<string> {
  try {
    const refreshTokenValue = decrypt(encryptedRefreshToken);
    
    if (!refreshTokenValue) {
      throw new Error("Invalid refresh token (decryption failed)");
    }

    const { data: userData, error: userError } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", userId)
      .single();

    if (userError || !userData?.studio_id) {
      throw new Error("Studio not found for user");
    }

    const { data: rawConfigData, error: configError } = await supabase
      .from("microsoft365_config")
      .select("client_id, client_secret_encrypted, tenant_id")
      .eq("studio_id", userData.studio_id)
      .single();

    if (configError || !rawConfigData) {
      throw new Error("Microsoft 365 configuration not found");
    }

    // Cast esplicito per risolvere errori TypeScript
    const configData = rawConfigData as unknown as {
      client_id: string;
      client_secret_encrypted: string;
      tenant_id: string;
    };

    const clientSecret = decrypt(configData.client_secret_encrypted);

    const tokenUrl = `https://login.microsoftonline.com/${configData.tenant_id}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: configData.client_id,
      client_secret: clientSecret,
      refresh_token: refreshTokenValue,
      grant_type: "refresh_token"
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Graph Service] Refresh token failed:", errorText);
      
      await cleanupInvalidToken(userId);
      
      throw new Error("Token refresh failed. Please reconnect your Microsoft 365 account.");
    }

    const tokenData: GraphTokenResponse = await response.json();

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    const { encrypt } = await import("@/lib/encryption365");
    const encryptedAccessToken = encrypt(tokenData.access_token);
    const newEncryptedRefreshToken = tokenData.refresh_token ? encrypt(tokenData.refresh_token) : encryptedRefreshToken;

    const { error: updateError } = await supabase
      .from("tbmicrosoft_tokens")
      .update({
        access_token: encryptedAccessToken,
        refresh_token: newEncryptedRefreshToken,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId);

    if (updateError) {
      console.error("[Graph Service] Failed to update token:", updateError);
      throw new Error("Failed to save refreshed token");
    }

    console.log("[Graph Service] Token refreshed successfully");
    return tokenData.access_token;
  } catch (error) {
    console.error("[Graph Service] Refresh error:", error);
    throw error;
  }
}

/**
 * Make authenticated Graph API call
 */
async function graphApiCall<T = any>(
  userId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getValidToken(userId);

  if (!token) {
    throw new Error(
      "Microsoft 365 non configurato o token non valido. " +
      "Connetti il tuo account in Impostazioni → Microsoft 365"
    );
  }

  const url = endpoint.startsWith("https://")
    ? endpoint
    : `https://graph.microsoft.com/v1.0${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Graph Service] API error (${response.status}):`, errorText);
    throw new Error(`Microsoft Graph API error: ${errorText}`);
  }

  return response.json();
}

/**
 * Check if user has Microsoft 365 connected
 */
async function hasMicrosoft365(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("tbmicrosoft_tokens")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return !error && !!data;
}

/**
 * Disconnect Microsoft 365 account
 */
async function disconnectAccount(userId: string): Promise<void> {
  const { error } = await supabase
    .from("tbmicrosoft_tokens")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw new Error("Failed to disconnect Microsoft 365 account");
  }

  console.log("[Graph Service] User disconnected:", userId);
}

export const microsoftGraphService = {
  getValidToken,
  graphApiCall,
  graphRequest: async (userId: string, endpoint: string, method: string = "GET", body?: any) => {
    return graphApiCall(userId, endpoint, {
      method,
      body: body ? JSON.stringify(body) : undefined
    });
  },
  
  isConnected: hasMicrosoft365,
  disconnectAccount,

  getTeamsWithChannels: async (userId: string) => {
    try {
      const teamsResponse = await graphApiCall<{ value: any[] }>(userId, "/me/joinedTeams");
      const teams = teamsResponse.value || [];
      
      const teamsWithChannels = [];
      
      for (const team of teams) {
        try {
          const channelsResponse = await graphApiCall<{ value: any[] }>(
            userId, 
            `/teams/${team.id}/channels`
          );
          
          teamsWithChannels.push({
            id: team.id,
            displayName: team.displayName,
            description: team.description,
            channels: channelsResponse.value || []
          });
        } catch (e) {
          console.warn(`Could not fetch channels for team ${team.id}`, e);
          teamsWithChannels.push({
            id: team.id,
            displayName: team.displayName,
            description: team.description,
            channels: []
          });
        }
      }
      
      return { success: true, teams: teamsWithChannels };
    } catch (error: any) {
      console.error("Error fetching teams:", error);
      return { success: false, error: error.message };
    }
  },

  sendChannelMessage: async (userId: string, teamId: string, channelId: string, messageHtml: string) => {
    try {
      await graphApiCall(userId, `/teams/${teamId}/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          body: {
            contentType: "html",
            content: messageHtml
          }
        })
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  sendEmail: async (userId: string, message: any) => {
    return graphApiCall(userId, "/me/sendMail", {
      method: "POST",
      body: JSON.stringify({
        message,
        saveToSentItems: true
      })
    });
  }
};

export { getValidToken, graphApiCall, hasMicrosoft365 };