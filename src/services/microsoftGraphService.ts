import { supabase } from "@/lib/supabase/client";

const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";

/**
 * Ottiene un access token valido per Microsoft Graph
 * Gestisce automaticamente il refresh se necessario
 */
async function getValidAccessToken(userId: string): Promise<string | null> {
  console.log("🔐 [getValidAccessToken] START - userId:", userId);
  
  // 1. Ottieni lo studio_id dell'utente
  const { data: utente, error: utenteError } = await supabase
    .from("tbutenti")
    .select("studio_id")
    .eq("id", userId)
    .single();

  console.log("🔍 [getValidAccessToken] Studio query:", { 
    found: !!utente, 
    studio_id: utente?.studio_id,
    error: utenteError?.message 
  });

  if (!utente || !utente.studio_id) {
    console.error("❌ Utente non trovato o senza studio");
    return null;
  }

  // 2. Ottieni il token corrente
  const { data: tokenData, error: tokenError } = await supabase
    .from("tbmicrosoft_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  console.log("🔍 [getValidAccessToken] Token query:", { 
    found: !!tokenData,
    token_id: tokenData?.id,
    expires_at: tokenData?.expires_at,
    has_access_token: !!tokenData?.access_token,
    has_refresh_token: !!tokenData?.refresh_token,
    error: tokenError?.message
  });

  if (!tokenData) {
    console.error("❌ Token Microsoft non trovato - account non connesso");
    return null;
  }

  // 3. Controlla se il token è ancora valido
  const now = new Date();
  const expiresAt = new Date(tokenData.expires_at);
  const isExpired = now >= expiresAt;

  console.log("⏰ [getValidAccessToken] Token validity:", {
    now: now.toISOString(),
    expires: expiresAt.toISOString(),
    isExpired,
    minutesUntilExpiry: Math.floor((expiresAt.getTime() - now.getTime()) / 60000)
  });

  if (!isExpired) {
    console.log("✅ [getValidAccessToken] Token ancora valido, ritorno access_token");
    return tokenData.access_token;
  }

  // 4. Token scaduto - esegui refresh
  console.log("🔄 Token scaduto, eseguo refresh...");

  // 4a. Ottieni credenziali Azure
  const { data: config, error: configError } = await supabase
    .from("microsoft365_config")
    .select("client_id, client_secret, tenant_id")
    .eq("studio_id", utente.studio_id)
    .single();

  console.log("🔍 [getValidAccessToken] Config query:", {
    found: !!config,
    has_client_id: !!config?.client_id,
    has_client_secret: !!config?.client_secret,
    has_tenant_id: !!config?.tenant_id,
    error: configError?.message
  });

  if (!config || !config.client_id || !config.client_secret || !config.tenant_id) {
    console.error("❌ Configurazione Microsoft 365 incompleta o non trovata");
    return null;
  }

  // 4b. Chiama API refresh token
  try {
    const params = new URLSearchParams();
    params.append("client_id", config.client_id);
    params.append("client_secret", config.client_secret);
    params.append("refresh_token", tokenData.refresh_token);
    params.append("grant_type", "refresh_token");

    console.log("🔄 [getValidAccessToken] Calling refresh token API...");

    const response = await fetch(
      `https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      }
    );

    console.log("🔄 [getValidAccessToken] Refresh response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Errore refresh token:", errorText);
      return null;
    }

    const data = await response.json();
    console.log("✅ [getValidAccessToken] Token refreshed successfully");

    // 4c. Aggiorna token nel database
    const newExpiresAt = new Date(now.getTime() + data.expires_in * 1000);

    const { error: updateError } = await supabase
      .from("tbmicrosoft_tokens")
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token || tokenData.refresh_token,
        expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", tokenData.id);

    if (updateError) {
      console.error("❌ Errore aggiornamento token:", updateError);
    }

    console.log("✅ Token refreshed e salvato, expires:", newExpiresAt.toISOString());
    return data.access_token;
  } catch (error) {
    console.error("❌ Errore durante refresh token:", error);
    return null;
  }
}

export const microsoftGraphService = {
  /**
   * Metodo generico per chiamate al Graph API
   */
  async graphRequest(userId: string, endpoint: string, method: string = "GET", body?: any) {
    console.log("📡 [graphRequest] START:", { userId, endpoint, method });
    
    const accessToken = await getValidAccessToken(userId);
    
    console.log("🔑 [graphRequest] Access token obtained:", !!accessToken);
    
    if (!accessToken) {
      console.error("❌ [graphRequest] No access token available");
      throw new Error("Microsoft 365 non connesso o token non valido");
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    const url = endpoint.startsWith("http") ? endpoint : `${GRAPH_API_BASE}${endpoint}`;
    
    console.log("📡 [graphRequest] Calling:", { url, method });

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      console.log("📡 [graphRequest] Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Graph Request Error (${method} ${endpoint}):`, errorText);
        throw new Error(`Graph API Error: ${response.status} - ${errorText}`);
      }

      // Gestione risposte vuote (es. 204 No Content)
      if (response.status === 204) {
        console.log("✅ [graphRequest] Success (204 No Content)");
        return null;
      }

      const data = await response.json();
      console.log("✅ [graphRequest] Success, data keys:", Object.keys(data));
      return data;
    } catch (error) {
      console.error("❌ [graphRequest] Exception:", error);
      throw error;
    }
  },

  /**
   * Verifica se l'utente è connesso
   */
  async isConnected(userId: string): Promise<boolean> {
    console.log("🔍 [isConnected] Inizio verifica per userId:", userId);
    console.log("🔍 [isConnected] Type of userId:", typeof userId);
    console.log("🔍 [isConnected] userId is valid UUID:", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId));
    
    try {
      // Primo tentativo: query diretta
      console.log("🔍 [isConnected] Tentativo 1: Query diretta con user_id");
      const { data: tokenData, error } = await supabase
        .from("tbmicrosoft_tokens")
        .select("id, user_id, expires_at")
        .eq("user_id", userId)
        .maybeSingle();

      console.log("🔍 [isConnected] Query result:", { 
        hasData: !!tokenData, 
        hasError: !!error,
        data: tokenData ? {
          id: tokenData.id,
          user_id: tokenData.user_id,
          expires_at: tokenData.expires_at
        } : null,
        errorDetails: error ? {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        } : null
      });

      if (error) {
        console.error("❌ [isConnected] Error in query:", error);
        
        // Secondo tentativo: query con cast esplicito
        console.log("🔍 [isConnected] Tentativo 2: Query con cast UUID");
        const { data: tokenData2, error: error2 } = await supabase
          .from("tbmicrosoft_tokens")
          .select("id, user_id, expires_at")
          .eq("user_id", userId.toLowerCase())
          .maybeSingle();

        if (error2) {
          console.error("❌ [isConnected] Error in second attempt:", error2);
          return false;
        }

        if (tokenData2) {
          console.log("✅ [isConnected] Token found in second attempt, id:", tokenData2.id);
          return true;
        }
        
        return false;
      }

      if (tokenData) {
        console.log("✅ [isConnected] Token found, id:", tokenData.id);
        console.log("✅ [isConnected] Token user_id:", tokenData.user_id);
        console.log("✅ [isConnected] Token expires_at:", tokenData.expires_at);
        
        // Verifica se il token è scaduto
        const now = new Date();
        const expiresAt = new Date(tokenData.expires_at);
        const isExpired = now >= expiresAt;
        
        console.log("🔍 [isConnected] Token expired:", isExpired);
        console.log("🔍 [isConnected] Now:", now.toISOString());
        console.log("🔍 [isConnected] Expires:", expiresAt.toISOString());
        
        return true; // Token esiste (anche se scaduto, getValidAccessToken farà refresh)
      } else {
        console.log("❌ [isConnected] No token found for user:", userId);
        
        // Terzo tentativo: lista tutti i token per debug
        console.log("🔍 [isConnected] Tentativo 3: Lista tutti i token (debug)");
        const { data: allTokens, error: error3 } = await supabase
          .from("tbmicrosoft_tokens")
          .select("id, user_id");

        if (error3) {
          console.error("❌ [isConnected] Error listing all tokens:", error3);
        } else {
          console.log("📋 [isConnected] All tokens in database:", allTokens);
          console.log("📋 [isConnected] Looking for userId:", userId);
          
          // Cerca manualmente
          const found = allTokens?.find(t => {
            const match = t.user_id === userId || 
                         t.user_id.toLowerCase() === userId.toLowerCase() ||
                         t.user_id.replace(/-/g, '') === userId.replace(/-/g, '');
            if (match) {
              console.log("🎯 [isConnected] FOUND MATCH:", t);
            }
            return match;
          });
          
          if (found) {
            console.log("✅ [isConnected] Token found in manual search!");
            return true;
          }
        }
        
        return false;
      }
    } catch (err) {
      console.error("❌ [isConnected] Exception:", err);
      return false;
    }
  },

  /**
   * Disconnette l'account rimuovendo i token
   */
  async disconnectAccount(userId: string): Promise<boolean> {
    const { error } = await supabase
      .from("tbmicrosoft_tokens")
      .delete()
      .eq("user_id", userId);

    return !error;
  },

  /**
   * Invia email (Outlook)
   */
  async sendEmail(userId: string, message: any) {
    const payload = message.message ? message : { message, saveToSentItems: true };
    return this.graphRequest(userId, "/me/sendMail", "POST", payload);
  },

  /**
   * CALENDAR METHODS
   */
  
  async createEvent(userId: string, event: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const data = await this.graphRequest(userId, "/me/calendar/events", "POST", event);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore creazione evento",
      };
    }
  },

  async updateEvent(userId: string, eventId: string, updates: any): Promise<{ success: boolean; error?: string }> {
    try {
      await this.graphRequest(userId, `/me/calendar/events/${eventId}`, "PATCH", updates);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore aggiornamento evento",
      };
    }
  },

  async deleteEvent(userId: string, eventId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.graphRequest(userId, `/me/calendar/events/${eventId}`, "DELETE");
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore cancellazione evento",
      };
    }
  },

  async getEvents(userId: string, startDate?: string, endDate?: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      let endpoint = "/me/calendar/events";
      
      if (startDate && endDate) {
        const params = new URLSearchParams({
          $filter: `start/dateTime ge '${startDate}' and end/dateTime le '${endDate}'`,
          $orderby: "start/dateTime",
        });
        endpoint += `?${params.toString()}`;
      }

      const data = await this.graphRequest(userId, endpoint, "GET");
      return { success: true, data: data.value || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore recupero eventi",
      };
    }
  },

  /**
   * TEAMS METHODS
   */

  async sendChannelMessage(userId: string, teamId: string, channelId: string, content: string) {
    return this.graphRequest(userId, `/teams/${teamId}/channels/${channelId}/messages`, "POST", {
      body: { content },
    });
  },

  async sendChatMessage(userId: string, userEmail: string, content: string) {
    // 1. Create chat
    const chat = await this.graphRequest(userId, "/chats", "POST", {
      chatType: "oneOnOne",
      members: [
        {
          "@odata.type": "#microsoft.graph.aadUserConversationMember",
          roles: ["owner"],
          "user@odata.bind": `${GRAPH_API_BASE}/users('${userEmail}')`,
        },
      ],
    });

    // 2. Send message
    return this.graphRequest(userId, `/chats/${chat.id}/messages`, "POST", {
      body: { content },
    });
  },

  async getTeams(userId: string) {
    console.log("📋 [getTeams] START for userId:", userId);
    const data = await this.graphRequest(userId, "/me/joinedTeams", "GET");
    console.log("📋 [getTeams] Teams found:", data?.value?.length || 0);
    return data.value || [];
  },

  async getChannels(userId: string, teamId: string) {
    console.log("📋 [getChannels] START for teamId:", teamId);
    const data = await this.graphRequest(userId, `/teams/${teamId}/channels`, "GET");
    console.log("📋 [getChannels] Channels found:", data?.value?.length || 0);
    return data.value || [];
  },

  /**
   * Recupera lista completa di team e relativi canali
   */
  async getTeamsWithChannels(userId: string): Promise<{
    success: boolean;
    teams?: Array<{
      id: string;
      displayName: string;
      description?: string;
      channels: Array<{
        id: string;
        displayName: string;
        description?: string;
      }>;
    }>;
    error?: string;
  }> {
    console.log("🎯 [getTeamsWithChannels] START for userId:", userId);
    
    try {
      // 1. Recupera tutti i team
      console.log("📋 [getTeamsWithChannels] Fetching teams...");
      const teams = await this.getTeams(userId);
      console.log("📋 [getTeamsWithChannels] Teams retrieved:", teams.length);
      
      // 2. Per ogni team, recupera i canali
      console.log("📋 [getTeamsWithChannels] Fetching channels for each team...");
      const teamsWithChannels = await Promise.all(
        teams.map(async (team: any, index: number) => {
          console.log(`📋 [getTeamsWithChannels] Processing team ${index + 1}/${teams.length}:`, team.displayName);
          try {
            const channels = await this.getChannels(userId, team.id);
            console.log(`✅ Team "${team.displayName}": ${channels.length} channels`);
            return {
              id: team.id,
              displayName: team.displayName,
              description: team.description,
              channels: channels.map((channel: any) => ({
                id: channel.id,
                displayName: channel.displayName,
                description: channel.description,
              })),
            };
          } catch (error) {
            console.error(`❌ Errore recupero canali per team ${team.id}:`, error);
            return {
              id: team.id,
              displayName: team.displayName,
              description: team.description,
              channels: [],
            };
          }
        })
      );

      console.log("✅ [getTeamsWithChannels] SUCCESS - Total teams:", teamsWithChannels.length);
      return { success: true, teams: teamsWithChannels };
    } catch (error) {
      console.error("❌ [getTeamsWithChannels] ERROR:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore recupero team",
      };
    }
  },

  async createChannel(userId: string, teamId: string, channelName: string, description?: string) {
    return this.graphRequest(userId, `/teams/${teamId}/channels`, "POST", {
      displayName: channelName,
      description: description || "",
    });
  },
};