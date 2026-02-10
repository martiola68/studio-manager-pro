import { supabase } from "@/lib/supabase/client";

const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";

/**
 * Ottiene un access token valido per Microsoft Graph
 * Gestisce automaticamente il refresh se necessario
 */
async function getValidAccessToken(userId: string): Promise<string | null> {
  // 1. Ottieni lo studio_id dell'utente
  const { data: utente } = await supabase
    .from("tbutenti")
    .select("studio_id")
    .eq("id", userId)
    .single();

  if (!utente || !utente.studio_id) {
    console.error("❌ Utente non trovato o senza studio");
    return null;
  }

  // 2. Ottieni il token corrente
  const { data: tokenData } = await supabase
    .from("tbmicrosoft_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!tokenData) {
    console.error("❌ Token Microsoft non trovato - account non connesso");
    return null;
  }

  // 3. Controlla se il token è ancora valido
  const now = new Date();
  const expiresAt = new Date(tokenData.expires_at);

  if (now < expiresAt) {
    // Token ancora valido
    return tokenData.access_token;
  }

  // 4. Token scaduto - esegui refresh
  console.log("🔄 Token scaduto, eseguo refresh...");

  // 4a. Ottieni credenziali Azure
  const { data: config } = await supabase
    .from("microsoft365_config")
    .select("client_id, client_secret, tenant_id")
    .eq("studio_id", utente.studio_id)
    .single();

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

    if (!response.ok) {
      console.error("❌ Errore refresh token:", await response.text());
      return null;
    }

    const data = await response.json();

    // 4c. Aggiorna token nel database
    const newExpiresAt = new Date(now.getTime() + data.expires_in * 1000);

    await supabase
      .from("tbmicrosoft_tokens")
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token || tokenData.refresh_token,
        expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", tokenData.id);

    console.log("✅ Token refreshed con successo");
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
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      throw new Error("Microsoft 365 non connesso o token non valido");
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    const url = endpoint.startsWith("http") ? endpoint : `${GRAPH_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Graph Request Error (${method} ${endpoint}):`, errorText);
      throw new Error(`Graph API Error: ${response.status} - ${errorText}`);
    }

    // Gestione risposte vuote (es. 204 No Content)
    if (response.status === 204) return null;

    return response.json();
  },

  /**
   * Verifica se l'utente è connesso
   */
  async isConnected(userId: string): Promise<boolean> {
    console.log("🔍 [isConnected] Inizio verifica per userId:", userId);
    console.log("🔍 [isConnected] Type of userId:", typeof userId);
    
    try {
      const { data: tokenData, error } = await supabase
        .from("tbmicrosoft_tokens")
        .select("id")
        .eq("user_id", userId)
        .single();

      console.log("🔍 [isConnected] Query result:", { 
        hasData: !!tokenData, 
        hasError: !!error,
        errorDetails: error ? {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        } : null
      });

      if (error) {
        console.error("❌ [isConnected] Error checking connection:", error);
        return false;
      }

      if (tokenData) {
        console.log("✅ [isConnected] Token found, id:", tokenData.id);
        return true;
      } else {
        console.log("❌ [isConnected] No token found for user:", userId);
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
    const data = await this.graphRequest(userId, "/me/joinedTeams", "GET");
    return data.value || [];
  },

  async getChannels(userId: string, teamId: string) {
    const data = await this.graphRequest(userId, `/teams/${teamId}/channels`, "GET");
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
    try {
      // 1. Recupera tutti i team
      const teams = await this.getTeams(userId);
      
      // 2. Per ogni team, recupera i canali
      const teamsWithChannels = await Promise.all(
        teams.map(async (team: any) => {
          try {
            const channels = await this.getChannels(userId, team.id);
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
            console.error(`Errore recupero canali per team ${team.id}:`, error);
            return {
              id: team.id,
              displayName: team.displayName,
              description: team.description,
              channels: [],
            };
          }
        })
      );

      return { success: true, teams: teamsWithChannels };
    } catch (error) {
      console.error("Errore getTeamsWithChannels:", error);
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