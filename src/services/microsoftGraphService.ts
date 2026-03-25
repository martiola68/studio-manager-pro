// src/services/microsoftGraphService.ts
import { getSupabaseClient } from "@/lib/supabase/client";

/* =========================================================
   Types
========================================================= */

type GraphRequestOptions = RequestInit & {
  microsoftConnectionId?: string;
};

/* =========================================================
   hasMicrosoft365 (client -> server status)
========================================================= */

export async function hasMicrosoft365(
  userId: string,
  microsoftConnectionId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  if (!token) return false;
  if (!userId || !microsoftConnectionId) return false;

  const qs = new URLSearchParams();
  qs.set("userId", userId);
  qs.set("microsoftConnectionId", microsoftConnectionId);

  const res = await fetch(`/api/microsoft365/status?${qs.toString()}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });

  const json = await res.json().catch(() => null);
  return !!json?.connected;
}

/* =========================================================
   graphApiCall (client facade -> /api/microsoft365/graph)
========================================================= */

export async function graphApiCall<T = any>(
  userId: string,
  endpoint: string,
  options?: GraphRequestOptions
): Promise<T> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  if (!token) {
    throw new Error("Sessione non valida. Rifai login.");
  }

  if (!userId) {
    throw new Error("graphApiCall: userId mancante");
  }

  if (!endpoint || typeof endpoint !== "string") {
    throw new Error("graphApiCall: endpoint mancante");
  }

  const method = String(options?.method || "GET").toUpperCase();

  const rawBody: any = options?.body;
  const body =
    typeof rawBody === "string"
      ? rawBody
      : rawBody != null
      ? JSON.stringify(rawBody)
      : undefined;

  const res = await fetch("/api/microsoft365/graph", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
      Authorization: `Bearer ${token}`,
    } as any,
    body: JSON.stringify({
      userId,
      endpoint,
      method,
      body,
      microsoftConnectionId: options?.microsoftConnectionId || null,
    }),
  });

  if (res.status === 204) {
    return {} as T;
  }

  const text = await res.text().catch(() => "");
  const json = text ? (JSON.parse(text) as any) : null;

  if (!res.ok) {
    const msg = (json && (json.error || json.message)) || text || "Errore proxy Graph";
    throw new Error(`Graph proxy error (${res.status}): ${msg}`);
  }

  return (json ?? ({} as any)) as T;
}

/* =========================================================
   Wrapper
========================================================= */

export type GraphSendMailMessage = {
  subject: string;
  body: {
    contentType: "Text" | "HTML";
    content: string;
  };
  toRecipients: Array<{ emailAddress: { address: string } }>;
  ccRecipients?: Array<{ emailAddress: { address: string } }>;
  bccRecipients?: Array<{ emailAddress: { address: string } }>;
};

export async function sendEmail(
  userId: string,
  microsoftConnectionId: string,
  message: GraphSendMailMessage
): Promise<void> {
  await graphApiCall(userId, "/me/sendMail", {
    method: "POST",
    microsoftConnectionId,
    body: {
      message,
      saveToSentItems: true,
    } as any,
  });
}

export async function sendChannelMessage(
  userId: string,
  microsoftConnectionId: string,
  teamId: string,
  channelId: string,
  messageHtml: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await graphApiCall(userId, `/teams/${teamId}/channels/${channelId}/messages`, {
      method: "POST",
      microsoftConnectionId,
      body: {
        body: { contentType: "html", content: messageHtml },
      } as any,
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
}

export const microsoftGraphService = {
  graphApiCall,
  hasMicrosoft365,
  sendEmail,
  sendChannelMessage,
};
