import { microsoftGraphService } from "./microsoftGraphService";

export interface TeamsMessage {
  content: string;
  contentType?: "text" | "html";
  importance?: "normal" | "high" | "urgent";
}

export interface TeamsChannel {
  id: string;
  displayName: string;
  description?: string;
}

export interface TeamsTeam {
  id: string;
  displayName: string;
  description?: string;
}

export const teamsService = {
  /**
   * Invia un messaggio diretto a un utente (Chat 1:1)
   */
  async sendDirectMessage(
    senderUserId: string,
    recipientEmail: string,
    message: TeamsMessage
  ): Promise<any> {
    try {
      // 1. Trova o crea la chat
      const chat = await microsoftGraphService.graphRequest(
        senderUserId,
        "/me/chats",
        "POST",
        {
          chatType: "oneOnOne",
          members: [
            {
              "@odata.type": "#microsoft.graph.aadUserConversationMember",
              roles: ["owner"],
              "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${senderUserId}')`
            },
            {
              "@odata.type": "#microsoft.graph.aadUserConversationMember",
              roles: ["owner"],
              "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${recipientEmail}')`
            }
          ]
        }
      );

      // 2. Invia il messaggio
      return await microsoftGraphService.graphRequest(
        senderUserId,
        `/me/chats/${chat.id}/messages`,
        "POST",
        {
          body: {
            content: message.content,
            contentType: message.contentType || "text"
          },
          importance: message.importance || "normal"
        }
      );
    } catch (error) {
      console.error("Error sending direct message:", error);
      throw error;
    }
  },

  /**
   * Invia un messaggio in un canale di un Team
   */
  async sendChannelMessage(
    userId: string,
    teamId: string,
    channelId: string,
    message: TeamsMessage
  ): Promise<any> {
    return await microsoftGraphService.graphRequest(
      userId,
      `/teams/${teamId}/channels/${channelId}/messages`,
      "POST",
      {
        body: {
          content: message.content,
          contentType: message.contentType || "text"
        },
        importance: message.importance || "normal"
      }
    );
  },

  /**
   * Ottiene la lista dei Team dell'utente
   */
  async getMyTeams(userId: string): Promise<TeamsTeam[]> {
    const response = await microsoftGraphService.graphRequest(
      userId,
      "/me/joinedTeams"
    );
    return response.value || [];
  },

  /**
   * Ottiene i canali di un Team
   */
  async getTeamChannels(userId: string, teamId: string): Promise<TeamsChannel[]> {
    const response = await microsoftGraphService.graphRequest(
      userId,
      `/teams/${teamId}/channels`
    );
    return response.value || [];
  },

  /**
   * Crea un meeting Teams
   */
  async createOnlineMeeting(
    userId: string,
    subject: string,
    startTime: string,
    endTime: string,
    attendeesEmails: string[] = []
  ): Promise<any> {
    const meeting = {
      subject,
      startDateTime: startTime,
      endDateTime: endTime,
      participants: {
        attendees: attendeesEmails.map(email => ({
          identity: {
            user: {
              id: email // Può richiedere l'ID utente o l'email a seconda della configurazione tenant
            }
          },
          role: "attendee"
        }))
      }
    };

    return await microsoftGraphService.graphRequest(
      userId,
      "/me/onlineMeetings",
      "POST",
      meeting
    );
  },

  /**
   * Invia una notifica di scadenza via Teams
   */
  async sendDeadlineAlert(
    userId: string,
    recipientEmail: string,
    deadlineTitle: string,
    dueDate: string,
    details?: string
  ): Promise<any> {
    const messageContent = `
      <h3>⚠️ Scadenza Imminente: ${deadlineTitle}</h3>
      <p><strong>Data scadenza:</strong> ${new Date(dueDate).toLocaleDateString("it-IT")}</p>
      ${details ? `<p>${details}</p>` : ""}
      <p><a href="https://studio-manager-pro.vercel.app/scadenze">Vedi dettagli</a></p>
    `;

    return await this.sendDirectMessage(userId, recipientEmail, {
      content: messageContent,
      contentType: "html",
      importance: "high"
    });
  }
};