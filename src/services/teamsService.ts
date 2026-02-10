import { supabase } from "@/lib/supabase/client";
import { microsoftGraphService } from "./microsoftGraphService";

export const teamsService = {
  /**
   * Crea un meeting Teams online
   */
  async createOnlineMeeting(
    userId: string,
    subject: string,
    startDateTime: string,
    endDateTime: string,
    attendeesEmails: string[] = []
  ): Promise<{
    success: boolean;
    joinUrl?: string;
    joinWebUrl?: string;
    meetingId?: string;
    error?: string;
  }> {
    try {
      console.log("🎥 Creazione meeting Teams...", { subject, startDateTime, endDateTime });

      // Prepara attendees per Microsoft Graph
      const attendees = attendeesEmails.map(email => ({
        emailAddress: {
          address: email,
          name: email.split("@")[0]
        },
        type: "required"
      }));

      // Payload per creare online meeting
      const meetingPayload = {
        startDateTime,
        endDateTime,
        subject,
        participants: {
          attendees
        }
      };

      // Crea meeting via Microsoft Graph
      const result = await microsoftGraphService.graphRequest(
        userId,
        "/me/onlineMeetings",
        "POST",
        meetingPayload
      );

      if (!result || !result.joinWebUrl) {
        throw new Error("Errore creazione meeting Teams - risposta non valida");
      }

      console.log("✅ Meeting Teams creato con successo:", result.joinWebUrl);

      return {
        success: true,
        joinUrl: result.joinUrl,
        joinWebUrl: result.joinWebUrl,
        meetingId: result.id
      };
    } catch (error: any) {
      console.error("❌ Errore creazione meeting Teams:", error);
      return {
        success: false,
        error: error.message || "Errore creazione meeting Teams"
      };
    }
  },

  /**
   * Invia messaggio diretto a un utente
   */
  async sendDirectMessage(
    userId: string,
    recipientEmail: string,
    message: { content: string; contentType: "text" | "html"; importance?: "normal" | "high" | "urgent" }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("💬 Invio messaggio diretto Teams...", recipientEmail);

      // Crea chat 1:1 se non esiste
      const chat = await microsoftGraphService.graphRequest(userId, "/chats", "POST", {
        chatType: "oneOnOne",
        members: [
          {
            "@odata.type": "#microsoft.graph.aadUserConversationMember",
            roles: ["owner"],
            "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${recipientEmail}')`
          }
        ]
      });

      if (!chat || !chat.id) {
        throw new Error("Impossibile creare chat");
      }

      // Invia messaggio
      await microsoftGraphService.graphRequest(
        userId,
        `/chats/${chat.id}/messages`,
        "POST",
        {
          body: {
            content: message.content,
            contentType: message.contentType,
            importance: message.importance
          }
        }
      );

      console.log("✅ Messaggio Teams inviato con successo");
      return { success: true };
    } catch (error: any) {
      console.error("❌ Errore invio messaggio Teams:", error);
      return {
        success: false,
        error: error.message || "Errore invio messaggio Teams"
      };
    }
  },

  /**
   * Invia messaggio a un canale Teams
   */
  async sendChannelMessage(
    userId: string,
    teamId: string,
    channelId: string,
    content: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("📢 Invio messaggio canale Teams...", { teamId, channelId });

      await microsoftGraphService.graphRequest(
        userId,
        `/teams/${teamId}/channels/${channelId}/messages`,
        "POST",
        {
          body: {
            content,
            contentType: "html"
          }
        }
      );

      console.log("✅ Messaggio canale Teams inviato con successo");
      return { success: true };
    } catch (error: any) {
      console.error("❌ Errore invio messaggio canale Teams:", error);
      return {
        success: false,
        error: error.message || "Errore invio messaggio canale Teams"
      };
    }
  },

  /**
   * Recupera lista team disponibili
   */
  async getTeams(userId: string) {
    try {
      const data = await microsoftGraphService.graphRequest(userId, "/me/joinedTeams", "GET");
      return data.value || [];
    } catch (error) {
      console.error("Errore recupero teams:", error);
      return [];
    }
  },

  /**
   * Recupera canali di un team
   */
  async getChannels(userId: string, teamId: string) {
    try {
      const data = await microsoftGraphService.graphRequest(
        userId,
        `/teams/${teamId}/channels`,
        "GET"
      );
      return data.value || [];
    } catch (error) {
      console.error("Errore recupero canali:", error);
      return [];
    }
  }
};