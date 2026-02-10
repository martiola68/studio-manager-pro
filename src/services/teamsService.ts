import { graphApiCall } from "./microsoftGraphService";

interface Team {
  id: string;
  displayName: string;
  description?: string;
}

interface Channel {
  id: string;
  displayName: string;
  description?: string;
  webUrl?: string;
}

export const teamsService = {
  /**
   * Ottiene i team dell'utente
   */
  getUserTeams: async (userId: string) => {
    try {
      const response = await graphApiCall<{ value: Team[] }>(userId, "/me/joinedTeams");
      return response.value || [];
    } catch (error) {
      console.error("Error fetching user teams:", error);
      return [];
    }
  },

  /**
   * Ottiene i canali di un team
   */
  getTeamChannels: async (userId: string, teamId: string) => {
    try {
      const response = await graphApiCall<{ value: Channel[] }>(userId, `/teams/${teamId}/channels`);
      return response.value || [];
    } catch (error) {
      console.error(`Error fetching channels for team ${teamId}:`, error);
      return [];
    }
  },

  /**
   * Invia un messaggio a un canale Teams
   */
  sendMessageToChannel: async (userId: string, teamId: string, channelId: string, message: string) => {
    try {
      await graphApiCall(userId, `/teams/${teamId}/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          body: {
            contentType: "html",
            content: message
          }
        })
      });
      return { success: true };
    } catch (error: any) {
      console.error("Error sending message to Teams:", error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Crea un link per una riunione Teams
   */
  createTeamsMeeting: async (userId: string, subject: string, startTime: Date, endTime: Date, attendeesEmails?: string[]) => {
    try {
      const meeting: any = {
        subject,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: "UTC"
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: "UTC"
        },
        isOnlineMeeting: true,
        onlineMeetingProvider: "teamsForBusiness"
      };

      if (attendeesEmails && attendeesEmails.length > 0) {
        meeting.attendees = attendeesEmails.map(email => ({
          emailAddress: {
            address: email,
            name: email 
          },
          type: "required"
        }));
      }

      const response = await graphApiCall<any>(userId, "/me/events", {
        method: "POST",
        body: JSON.stringify(meeting)
      });
      
      return {
        success: true,
        joinUrl: response.onlineMeeting?.joinUrl || response.webLink,
        id: response.id
      };
    } catch (error: any) {
      console.error("Error creating Teams meeting:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Invia un messaggio diretto (chat 1:1) a un utente
   */
  sendDirectMessage: async (senderId: string, recipientEmail: string, message: { content: string, contentType: "html" | "text", importance?: "normal" | "high" | "urgent" }) => {
    try {
      // 1. Trova/Crea la chat
      const chat = await graphApiCall<any>(senderId, "/chats", {
        method: "POST",
        body: JSON.stringify({
          chatType: "oneOnOne",
          members: [
            {
              "@odata.type": "#microsoft.graph.aadUserConversationMember",
              roles: ["owner"],
              "user@odata.bind": `https://graph.microsoft.com/v1.0/me`
            },
            {
              "@odata.type": "#microsoft.graph.aadUserConversationMember",
              roles: ["owner"],
              "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${recipientEmail}')`
            }
          ]
        })
      });

      // 2. Invia il messaggio
      await graphApiCall(senderId, `/chats/${chat.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          body: {
            contentType: message.contentType,
            content: message.content
          },
          importance: message.importance || "normal"
        })
      });

      return { success: true };
    } catch (error: any) {
      console.error("Error sending direct message:", error);
      return { success: false, error: error.message };
    }
  }
};

// Aggiungi alias per retrocompatibilità e comodità
export const teamsServiceExtended = {
  ...teamsService,
  createOnlineMeeting: teamsService.createTeamsMeeting
};

// Sovrascrivi l'export di default o named export se necessario, 
// ma qui stiamo estendendo l'oggetto teamsService originale in-place per mantenere i riferimenti
Object.assign(teamsService, { createOnlineMeeting: teamsService.createTeamsMeeting });
