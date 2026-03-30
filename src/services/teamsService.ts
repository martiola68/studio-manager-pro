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

type UserMicrosoftContext = {
  studioId: string | null;
  microsoftConnectionId: string | null;
};

async function getUserMicrosoftContext(
  userId: string
): Promise<UserMicrosoftContext> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("tbutenti")
    .select("studio_id, microsoft_connection_id")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return {
      studioId: null,
      microsoftConnectionId: null,
    };
  }

  return {
    studioId: data.studio_id ? String(data.studio_id) : null,
    microsoftConnectionId: data.microsoft_connection_id
      ? String(data.microsoft_connection_id)
      : null,
  };
}

/**
 * Risolve sempre la microsoft_connection_id corretta senza rompere
 * la retrocompatibilità e senza rompere la logica multi-tenant.
 *
 * Supporta:
 * - primo parametro = studioId
 * - primo parametro = microsoftConnectionId
 * - nessun parametro esplicito (fallback da userId)
 */
async function resolveMicrosoftConnectionId(
  providedStudioOrConnectionId: string | null | undefined,
  userId: string
): Promise<string | null> {
  const supabase = getSupabaseClient();
  const userCtx = await getUserMicrosoftContext(userId);

  // Fallback immediato: se l'utente ha già la connection assegnata
  // e non viene passato nulla, usiamo quella.
  if (!providedStudioOrConnectionId) {
    return userCtx.microsoftConnectionId ?? null;
  }

  const provided = String(providedStudioOrConnectionId);

  // Se coincide già con la connection attuale dell'utente, ok.
  if (
    userCtx.microsoftConnectionId &&
    provided === String(userCtx.microsoftConnectionId)
  ) {
    return userCtx.microsoftConnectionId;
  }

  // Se coincide con lo studio dell'utente, usa la connection assegnata all'utente.
  if (userCtx.studioId && provided === String(userCtx.studioId)) {
    return userCtx.microsoftConnectionId ?? null;
  }

  // Se il valore passato è proprio l'id di una connection valida, accettalo.
  // Questo aiuta nei casi multi-tenant / doppia connessione / chiamate dirette.
  const { data: connectionRow, error: connectionErr } = await supabase
    .from("microsoft365_connections")
    .select("id, enabled")
    .eq("id", provided)
    .maybeSingle();

  if (!connectionErr && connectionRow?.id) {
    return String(connectionRow.id);
  }

  // Ultimo fallback sicuro: connection dell'utente.
  return userCtx.microsoftConnectionId ?? null;
}

/**
 * ✅ Overload retro-compatibile:
 * - Nuova firma: (studioIdOrMicrosoftConnectionId, userId, recipientEmail, message)
 * - Vecchia firma: (userId, recipientEmail, message)
 */
async function sendDirectMessage(
  studioIdOrMicrosoftConnectionId: string,
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
    let studioIdOrMicrosoftConnectionId: string | null = null;
    let userId: string;
    let recipientEmail: string;
    let message: DirectMessagePayload;

    // Nuova chiamata: (studioIdOrMicrosoftConnectionId, userId, recipientEmail, message)
    if (typeof d !== "undefined") {
      studioIdOrMicrosoftConnectionId = a;
      userId = b;
      recipientEmail = c;
      message = d;
    } else {
      // Vecchia chiamata: (userId, recipientEmail, message)
      userId = a;
      recipientEmail = b;
      message = c;
    }

    const microsoftConnectionId = await resolveMicrosoftConnectionId(
      studioIdOrMicrosoftConnectionId,
      userId
    );

    if (!microsoftConnectionId) {
      return {
        success: false,
        error:
          "Impossibile determinare microsoftConnectionId per invio DM Teams.",
      };
    }

    // 1) Prova a trovare una chat 1:1 esistente (best-effort)
    const chats = await graphApiCall<{ value: any[] }>(userId, "/me/chats?$top=50", {
      microsoftConnectionId,
    });

    let oneOnOne = (chats.value ?? []).find((chat) => chat?.chatType === "oneOnOne");

    // 2) Recupero utente Microsoft corrente
    const me = await graphApiCall<any>(userId, "/me?$select=id,mail,userPrincipalName", {
      microsoftConnectionId,
    });

    const currentMicrosoftUser = me?.id || me?.mail || me?.userPrincipalName;

    if (!currentMicrosoftUser) {
      return {
        success: false,
        error: "Impossibile determinare l'utente Microsoft corrente.",
      };
    }

    // 3) Se non trovata, crea chat 1:1
    if (!oneOnOne) {
      try {
        const created = await graphApiCall<any>(userId, "/chats", {
          method: "POST",
          microsoftConnectionId,
          body: JSON.stringify({
            chatType: "oneOnOne",
            members: [
              {
                "@odata.type": "#microsoft.graph.aadUserConversationMember",
                roles: ["owner"],
                "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${encodeURIComponent(
                  currentMicrosoftUser
                )}')`,
              },
              {
                "@odata.type": "#microsoft.graph.aadUserConversationMember",
                roles: ["owner"],
                "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${encodeURIComponent(
                  recipientEmail
                )}')`,
              },
            ],
          }),
        });

        oneOnOne = created;
      } catch (err: any) {
        console.warn(
          "DM Teams non inviabile per destinatario non risolto:",
          recipientEmail,
          err
        );

        // Mantengo il comportamento best-effort già presente
        return { success: true };
      }
    }

    if (!oneOnOne?.id) {
      return {
        success: false,
        error: "Impossibile determinare/creare la chat 1:1.",
      };
    }

    // 4) Invia messaggio
    await graphApiCall(userId, `/chats/${oneOnOne.id}/messages`, {
      method: "POST",
      microsoftConnectionId,
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
   * Il primo parametro può essere:
   * - studioId
   * - microsoftConnectionId
   */
  getUserTeams: async (
    studioIdOrMicrosoftConnectionId: string,
    userId: string
  ): Promise<Team[]> => {
    try {
      const microsoftConnectionId = await resolveMicrosoftConnectionId(
        studioIdOrMicrosoftConnectionId,
        userId
      );

      if (!microsoftConnectionId) {
        console.error("Impossibile determinare microsoftConnectionId per getUserTeams");
        return [];
      }

      const response = await graphApiCall<{ value: Team[] }>(userId, "/me/joinedTeams", {
        microsoftConnectionId,
      });

      return response.value ?? [];
    } catch (error) {
      console.error("Error fetching user teams:", error);
      return [];
    }
  },

  /**
   * Ottiene i canali di un team
   * Il primo parametro può essere:
   * - studioId
   * - microsoftConnectionId
   */
  getTeamChannels: async (
    studioIdOrMicrosoftConnectionId: string,
    userId: string,
    teamId: string
  ): Promise<Channel[]> => {
    try {
      const microsoftConnectionId = await resolveMicrosoftConnectionId(
        studioIdOrMicrosoftConnectionId,
        userId
      );

      if (!microsoftConnectionId) {
        console.error("Impossibile determinare microsoftConnectionId per getTeamChannels");
        return [];
      }

      const response = await graphApiCall<{ value: Channel[] }>(
        userId,
        `/teams/${teamId}/channels`,
        {
          microsoftConnectionId,
        }
      );

      return response.value ?? [];
    } catch (error) {
      console.error(`Error fetching channels for team ${teamId}:`, error);
      return [];
    }
  },

  /**
   * Invia un messaggio a un canale Teams
   * Il primo parametro può essere:
   * - studioId
   * - microsoftConnectionId
   */
  sendMessageToChannel: async (
    studioIdOrMicrosoftConnectionId: string,
    userId: string,
    teamId: string,
    channelId: string,
    messageHtml: string
  ): Promise<SendMessageResult> => {
    try {
      const microsoftConnectionId = await resolveMicrosoftConnectionId(
        studioIdOrMicrosoftConnectionId,
        userId
      );

      if (!microsoftConnectionId) {
        return {
          success: false,
          error:
            "Impossibile determinare microsoftConnectionId per invio messaggio Teams.",
        };
      }

      await graphApiCall(
        userId,
        `/teams/${teamId}/channels/${channelId}/messages`,
        {
          method: "POST",
          microsoftConnectionId,
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
   * Il primo parametro può essere:
   * - studioId
   * - microsoftConnectionId
   */
  createTeamsMeeting: async (
    studioIdOrMicrosoftConnectionId: string,
    userId: string,
    subject: string,
    startTime: Date,
    endTime: Date
  ): Promise<TeamsMeetingResult> => {
    try {
      const microsoftConnectionId = await resolveMicrosoftConnectionId(
        studioIdOrMicrosoftConnectionId,
        userId
      );

      if (!microsoftConnectionId) {
        return {
          success: false,
          error:
            "Impossibile determinare microsoftConnectionId per creare il meeting Teams.",
        };
      }

      const response = await graphApiCall<any>(userId, "/me/onlineMeetings", {
        method: "POST",
        microsoftConnectionId,
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
      return { success: false, error: error?.message || String(error) };
    }
  },

  /**
   * Invia un messaggio diretto (chat 1:1) — retro-compatibile
   */
  sendDirectMessage,
};
