import { supabase } from "@/lib/supabase/client";

/**
 * Microsoft Graph API Service
 * Gestisce autenticazione, refresh token e chiamate API
 */

interface GraphTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

/**
 * Ottiene il token valido per l'utente
 * Rinnova automaticamente se scaduto
 */
async function getValidToken(userId: string): Promise<string | null> {
  try {
    // Recupera il token dal database
    const { data: tokenData, error } = await supabase
      .from("tbmicrosoft_tokens")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("❌ Errore recupero token:", error);
      return null;
    }

    if (!tokenData) {
      console.log("⚠️  Nessun token trovato per utente:", userId);
      return null;
    }

    // ✅ VALIDAZIONE AGGIUNTA: Verifica che il token sia una stringa valida
    if (!tokenData.access_token || typeof tokenData.access_token !== "string" || tokenData.access_token.trim().length === 0) {
      console.error("❌ Token access_token non valido o vuoto");
      return null;
    }

    // ✅ VALIDAZIONE AGGIUNTA: Verifica formato JWT (deve contenere almeno 2 punti)
    const tokenParts = tokenData.access_token.split(".");
    if (tokenParts.length !== 3) {
      console.error("❌ Token non è un JWT valido (formato errato)");
      return null;
    }

    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();

    // Se il token è ancora valido (con margine di 5 minuti), ritornalo
    if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
      return tokenData.access_token;
    }

    // Token scaduto, prova a rinnovarlo
    console.log("🔄 Token scaduto, tentativo refresh...");
    
    const newAccessToken = await refreshToken(userId, tokenData.refresh_token);
    return newAccessToken;
  } catch (error) {
    console.error("❌ Errore in getValidToken:", error);
    return null;
  }
}

/**
 * Rinnova il token usando refresh_token (se disponibile) o client_credentials
 */
async function refreshToken(userId: string, refreshToken: string | null): Promise<string> {
  const { data: configData, error } = await supabase
    .from("microsoft365_config" as any)
    .select("client_id, client_secret, tenant_id")
    .limit(1)
    .maybeSingle();

  const config = configData as any;

  if (error || !config) {
    throw new Error("Configurazione Microsoft 365 mancante");
  }

  const tokenUrl = `https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append("client_id", config.client_id);
  params.append("client_secret", config.client_secret);

  // Se esiste refresh_token, usa il flusso authorization_code
  // Altrimenti usa client_credentials (app-only)
  if (refreshToken) {
    params.append("refresh_token", refreshToken);
    params.append("grant_type", "refresh_token");
  } else {
    // Flusso client_credentials (app-only)
    params.append("grant_type", "client_credentials");
    params.append("scope", "https://graph.microsoft.com/.default");
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ Refresh token failed:", errorText);
    throw new Error("Impossibile rinnovare il token Microsoft. Riconnetti l'account.");
  }

  const tokenData: GraphTokenResponse = await response.json();

  // Calcola scadenza
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

  // Aggiorna token nel database
  const { error: updateError } = await supabase
    .from("tbmicrosoft_tokens")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || refreshToken,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (updateError) {
    console.error("❌ Errore aggiornamento token:", updateError);
    throw new Error("Errore durante il salvataggio del nuovo token");
  }

  console.log("✅ Token rinnovato con successo");
  return tokenData.access_token;
}

/**
 * Esegue una chiamata autenticata a Microsoft Graph API
 */
async function graphApiCall<T = any>(
  userId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getValidToken(userId);

  if (!token) {
    console.error("❌ Impossibile ottenere token valido per chiamata Graph API");
    throw new Error("Microsoft 365 non configurato o token non valido. Configura l'integrazione in Impostazioni → Microsoft 365");
  }

  const url = `https://graph.microsoft.com/v1.0${endpoint}`;

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
    console.error(`❌ Graph API Error (${response.status}):`, errorText);
    throw new Error(`Microsoft Graph API error: ${errorText}`);
  }

  return response.json();
}

/**
 * Verifica se l'utente ha Microsoft 365 configurato
 */
async function hasMicrosoft365(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("tbmicrosoft_tokens")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return !error && !!data;
}

// Wrapper object per mantenere compatibilità con le chiamate esistenti
export const microsoftGraphService = {
  // Metodi base
  getValidToken,
  graphApiCall, // Alias per uso diretto
  graphRequest: async (userId: string, endpoint: string, method: string = "GET", body?: any) => {
    return graphApiCall(userId, endpoint, {
      method,
      body: body ? JSON.stringify(body) : undefined
    });
  },
  
  // Metodi utility
  isConnected: hasMicrosoft365,
  
  disconnectAccount: async (userId: string) => {
    const { error } = await supabase
      .from("tbmicrosoft_tokens")
      .delete()
      .eq("user_id", userId);
      
    if (error) throw error;
  },

  // Teams methods
  getTeamsWithChannels: async (userId: string) => {
    try {
      // 1. Get joined teams
      const teamsResponse = await graphApiCall<{ value: any[] }>(userId, "/me/joinedTeams");
      const teams = teamsResponse.value || [];
      
      const teamsWithChannels = [];
      
      // 2. Get channels for each team
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

  // Email methods
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

// Esporta anche le funzioni singole per chi le usa direttamente
export { getValidToken, graphApiCall, hasMicrosoft365 };