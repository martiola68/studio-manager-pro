import { supabase } from "@/lib/supabase/client";

interface MicrosoftTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface CalendarEvent {
  id?: string;
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  body?: {
    contentType: string;
    content: string;
  };
  location?: {
    displayName: string;
  };
  attendees?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
    type: string;
  }>;
  isOnlineMeeting?: boolean;
  onlineMeetingProvider?: string;
}

interface EmailMessage {
  subject: string;
  body: {
    contentType: string;
    content: string;
  };
  toRecipients: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
  ccRecipients?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
  attachments?: Array<{
    "@odata.type": string;
    name: string;
    contentBytes: string;
  }>;
}

export const microsoftGraphService = {
  async getStoredTokens(userId: string): Promise<MicrosoftTokens | null> {
    const { data, error } = await supabase
      .from("tbmicrosoft_tokens")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Errore recupero token:", error);
      return null;
    }

    if (!data) {
      console.log("Nessun token salvato per l'utente");
      return null;
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(data.expires_at).getTime()
    };
  },

  async saveTokens(
    userId: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      // Table not yet in types but casted to any
      await supabase
        .from("tbmicrosoft_tokens" as any)
        .upsert({
          user_id: userId,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error("Error saving tokens:", error);
      throw error;
    }
  },

  async refreshAccessToken(userId: string): Promise<string> {
    try {
      const tokens = await this.getStoredTokens(userId);
      if (!tokens) throw new Error("No tokens found");

      const response = await fetch("/api/auth/microsoft/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: tokens.refresh_token }),
      });

      if (!response.ok) throw new Error("Failed to refresh token");

      const data = await response.json();
      
      await this.saveTokens(
        userId,
        data.access_token,
        data.refresh_token || tokens.refresh_token,
        data.expires_in
      );

      return data.access_token;
    } catch (error) {
      console.error("Error refreshing token:", error);
      throw error;
    }
  },

  async getValidAccessToken(userId: string): Promise<string> {
    const tokens = await this.getStoredTokens(userId);
    
    if (!tokens) throw new Error("User not connected to Microsoft 365");

    if (Date.now() >= tokens.expires_at - 5 * 60 * 1000) {
      return await this.refreshAccessToken(userId);
    }

    return tokens.access_token;
  },

  async graphRequest(
    userId: string,
    endpoint: string,
    method: string = "GET",
    body?: any
  ): Promise<any> {
    try {
      const accessToken = await this.getValidAccessToken(userId);

      const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Graph API request failed");
      }

      return await response.json();
    } catch (error) {
      console.error("Graph API request error:", error);
      throw error;
    }
  },

  async createCalendarEvent(userId: string, event: CalendarEvent): Promise<any> {
    return await this.graphRequest(userId, "/me/calendar/events", "POST", event);
  },

  async updateCalendarEvent(
    userId: string,
    eventId: string,
    event: Partial<CalendarEvent>
  ): Promise<any> {
    return await this.graphRequest(
      userId,
      `/me/calendar/events/${eventId}`,
      "PATCH",
      event
    );
  },

  async deleteCalendarEvent(userId: string, eventId: string): Promise<void> {
    await this.graphRequest(userId, `/me/calendar/events/${eventId}`, "DELETE");
  },

  async getCalendarEvents(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    const response = await this.graphRequest(
      userId,
      `/me/calendar/calendarView?startDateTime=${startDate}&endDateTime=${endDate}&$orderby=start/dateTime`
    );
    return response.value || [];
  },

  async sendEmail(userId: string, message: EmailMessage): Promise<void> {
    await this.graphRequest(userId, "/me/sendMail", "POST", { message });
  },

  async createTeamsMeeting(
    userId: string,
    subject: string,
    startDateTime: string,
    endDateTime: string,
    attendees: string[]
  ): Promise<any> {
    const meeting = {
      subject,
      startDateTime,
      endDateTime,
      participants: {
        attendees: attendees.map((email) => ({
          identity: {
            user: {
              id: email,
            },
          },
          role: "attendee",
        })),
      },
    };

    return await this.graphRequest(userId, "/me/onlineMeetings", "POST", meeting);
  },

  async createCalendarEventWithTeams(
    userId: string,
    event: CalendarEvent
  ): Promise<any> {
    const eventWithTeams = {
      ...event,
      isOnlineMeeting: true,
      onlineMeetingProvider: "teamsForBusiness",
    };

    return await this.createCalendarEvent(userId, eventWithTeams);
  },

  async disconnectAccount(userId: string): Promise<void> {
    try {
      // Table not yet in types but casted to any
      await supabase
        .from("tbmicrosoft_tokens" as any)
        .delete()
        .eq("user_id", userId);
    } catch (error) {
      console.error("Error disconnecting account:", error);
      throw error;
    }
  },

  async isConnected(userId: string): Promise<boolean> {
    // Controlla se esistono i token per l'utente
    const tokens = await this.getStoredTokens(userId);
    if (!tokens) return false;
    
    // Recupera lo studio_id dell'utente
    const { data: userData, error: userError } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", userId)
      .single();
    
    if (userError || !userData?.studio_id) {
      console.error("Errore recupero studio_id:", userError);
      return false;
    }
    
    // Controlla se le features Teams sono abilitate per lo studio
    const { data: configData, error: configError } = await supabase
      .from("microsoft365_config")
      .select("enabled, features")
      .eq("studio_id", userData.studio_id)
      .single();
    
    if (configError) {
      console.error("Errore recupero config Microsoft 365:", configError);
      return false;
    }
    
    // Verifica che Microsoft 365 sia abilitato E che features.teams sia true
    const isEnabled = configData?.enabled === true;
    
    // Fix TypeScript error: cast JSONB features to specific type
    const features = configData?.features as unknown as { teams?: boolean } | null;
    const teamsEnabled = features?.teams === true;
    
    console.log(`isEnabled: ${isEnabled}, teamsEnabled: ${teamsEnabled}`);
    
    return isEnabled && teamsEnabled;
  },

  async getUserProfile(userId: string): Promise<any> {
    return await this.graphRequest(userId, "/me");
  },
};