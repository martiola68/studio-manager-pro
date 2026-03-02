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
*createTeamsMeeting: 
*/
createTeamsMeeting:async (
  userId: string,
  subject: string,
  startTime: Date,
  endTime: Date,
  attendeesEmails?: string[]
) => {

const tokenUserId = userId;
  
  try {
  createTeamsMeeting: async (
  userId: string,
  subject: string,
  startTime: Date,
  endTime: Date,
  attendeesEmails?: string[]
) => {
  const tokenUserId = userId;

  try {
    const response = await graphApiCall<any>(tokenUserId, "/me/onlineMeetings", {
      method: "POST",
      body: JSON.stringify({
        subject,
        startDateTime: startTime.toISOString(),
        endDateTime: endTime.toISOString(),
      }),
    });

    return {
      success: true,
      joinUrl: response?.joinUrl ?? null,
      id: response?.id ?? null,
    };
  } catch (error: any) {
    console.error("Error creating Teams meeting:", error);
    return { success: false, error: error?.message || String(error) };
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
