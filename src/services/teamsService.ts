// src/services/teamsService.ts
import { graphApiCall } from "./microsoftGraphService";
import { getSupabaseClient } from "@/lib/supabase/client";

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

export type TeamsMeetingResult =
  | { success: true; joinUrl: string | null; id: string | null }
  | { success: false; error: string };

type SendMessageResult = { success: true } | { success: false; error: string };

type DirectMessagePayload = {
  content: string;
  contentType: "html" | "text";
  importance?: "normal" | "high" | "urgent";
};

/**
 * ✅ Overload retro-compatibile:
 * - Nuova firma: (studioId, userId, recipientEmail, message)
 * - Vecchia firma: (userId, recipientEmail, message)
 */
async function sendDirectMessage(
  studioId: string,
  userId: string,
  recipientEmail: string,
  message: DirectMessagePayload
): Promise<SendMessageResult>;
async function sendDirectMessage(
  userId: string,
  recipientEmail: string,
  message: DirectMessagePayload
): Promise<SendMessageResult>;
async function sendDirectMessage(
  a: string,
  b: string,
  c: any,
  d?: any
): Promise<SendMessageResult> {
  try {
    let studioId: string;
    let userId: string;
    let recipientEmail: string;
    let message: DirectMessagePayload;

    // Nuova chiamata: (studioId, userId, recipientEmail, message)
    if (typeof d !== "undefined") {
      studioId = a;
      userId = b;
      recipientEmail = c;
      message = d;
    } else {
      // Vecchia chiamata: (userId, recipientEmail, message)
      userId = a;
      recipientEmail = b;
      message = c;

      // ✅ Recupero studioId dal DB (token owner = userId)
      const supabase = getSupabaseClient();
      const { data: uRow, error: uErr } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", userId)
        .maybeSingle();

      if (uErr || !uRow?.studio_id) {
        return {
          success: false,
          error: "Impossibile determinare studioId per invio DM Teams.",
        };
      }

      studioId = uRow.studio_id as string;
    }

    // 1) prova a trovare chat 1:1 esistente (best-effort)
    const chats = await graphApiCall<{ value: any[] }>(
      studioId,
      userId,
      "/me/chats?$top=50"
    );

    // best-effort: prendo una oneOnOne (senza filtrare per destinatario: API non è banale senza espansioni)
    let oneOnOne = (chats.value ?? []).find((c1) => c1?.chatType === "oneOnOne");

    // 2) se non trovata, crea chat 1:1
   if (!oneOnOne) {
  const created = await graphApiCall<any>(studioId, userId, "/chats", {
    method: "POST",
    body: JSON.stringify({
      chatType: "oneOnOne",
      members: [
        {
          "@odata.type": "#microsoft.graph.aadUserConversationMember",
          roles: ["owner"],
          "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${encodeURIComponent(userEmail)}')`,
        },
        {
          "@odata.type": "#microsoft.graph.aadUserConversationMember",
          roles: ["owner"],
          "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${encodeURIComponent(recipientEmail)}')`,
        },
      ],
    }),
  });
      oneOnOne = created;
    }

    if (!oneOnOne?.id) {
      return {
        success: false,
        error: "Impossibile determinare/creare la chat 1:1.",
      };
    }

    // 3) invia messaggio
    await graphApiCall(studioId, userId, `/chats/${oneOnOne.id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        body: {
          contentType: message.contentType,
          content: message.content,
        },
        importance: message.importance ?? "normal",
      }),
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error sending direct message:", error);
    return { success: false, error: error?.message || String(error) };
  }
}

export const teamsService = {
  /**
   * Ottiene i team dell'utente
   */
  getUserTeams: async (studioId: string, userId: string): Promise<Team[]> => {
    try {
      const response = await graphApiCall<{ value: Team[] }>(
        studioId,
        userId,
        "/me/joinedTeams"
      );
      return response.value ?? [];
    } catch (error) {
      console.error("Error fetching user teams:", error);
      return [];
    }
  },

  /**
   * Ottiene i canali di un team
   */
  getTeamChannels: async (
    studioId: string,
    userId: string,
    teamId: string
  ): Promise<Channel[]> => {
    try {
      const response = await graphApiCall<{ value: Channel[] }>(
        studioId,
        userId,
        `/teams/${teamId}/channels`
      );
      return response.value ?? [];
    } catch (error) {
      console.error(`Error fetching channels for team ${teamId}:`, error);
      return [];
    }
  },

  /**
   * Invia un messaggio a un canale Teams
   */
  sendMessageToChannel: async (
    studioId: string,
    userId: string,
    teamId: string,
    channelId: string,
    messageHtml: string
  ): Promise<SendMessageResult> => {
    try {
      await graphApiCall(
        studioId,
        userId,
        `/teams/${teamId}/channels/${channelId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            body: {
              contentType: "html",
              content: messageHtml,
            },
          }),
        }
      );
      return { success: true };
    } catch (error: any) {
      console.error("Error sending message to Teams:", error);
      return { success: false, error: error?.message || String(error) };
    }
  },

  /**
   * Crea un meeting Teams (OnlineMeeting) e ritorna joinUrl + id
   * NOTE: per /me/onlineMeetings spesso serve scope OnlineMeetings.ReadWrite (delegato)
   */
  createTeamsMeeting: async (
    studioId: string,
    userId: string,
    subject: string,
    startTime: Date,
    endTime: Date
  ): Promise<TeamsMeetingResult> => {
    try {
      const response = await graphApiCall<any>(
        studioId,
        userId,
        "/me/onlineMeetings",
        {
          method: "POST",
          body: JSON.stringify({
            subject,
            startDateTime: startTime.toISOString(),
            endDateTime: endTime.toISOString(),
          }),
        }
      );

      return {
        success: true,
        joinUrl: response?.joinUrl ?? null,
        id: response?.id ?? null,
      };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  },

  /**
   * Invia un messaggio diretto (chat 1:1) — retro-compatibile
   */
  sendDirectMessage,
};
