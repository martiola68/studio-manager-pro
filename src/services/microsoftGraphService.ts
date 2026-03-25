// src/services/microsoftGraphService.ts
import { getSupabaseClient } from "@/lib/supabase/client";

/* =========================================================
   hasMicrosoft365 (client -> server status)
========================================================= */

export function hasMicrosoft365(studioId: string, userId: string): Promise<boolean>;
export function hasMicrosoft365(userId: string): Promise<boolean>;

export async function hasMicrosoft365(a: string, b?: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  if (!token) return false;

  const qs = new URLSearchParams();
  if (b) {
    qs.set("studioId", a);
    qs.set("userId", b);
  } else {
    qs.set("userId", a);
  }

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

export function graphApiCall<T = any>(endpoint: string, options?: RequestInit): Promise<T>;
export function graphApiCall<T = any>(userId: string, endpoint: string, options?: RequestInit): Promise<T>;
export function graphApiCall<T = any>(
  studioId: string,
  userId: string,
  endpoint: string,
  options?: RequestInit
): Promise<T>;

export async function graphApiCall<T = any>(a: any, b?: any, c?: any, d?: any): Promise<T> {
  let studioId: string | undefined;
  let userId: string | undefined;
  let endpoint: string | undefined;
  let options: RequestInit | undefined;

  // (endpoint) oppure (endpoint, options)
  if (typeof a === "string" && (typeof b === "undefined" || typeof b === "object") && typeof c === "undefined") {
    endpoint = a;
    options = b as RequestInit | undefined;
  }
  // (userId, endpoint, options)
  else if (typeof a === "string" && typeof b === "string" && (typeof c === "undefined" || typeof c === "object")) {
    userId = a;
    endpoint = b;
    options = c as RequestInit | undefined;
  }
  // (studioId, userId, endpoint, options)
  else if (typeof a === "string" && typeof b === "string" && typeof c === "string") {
    studioId = a;
    userId = b;
    endpoint = c;
    options = d as RequestInit | undefined;
  } else {
    throw new Error("graphApiCall: firma non riconosciuta");
  }

  const method = String(options?.method || "GET").toUpperCase();

  const rawBody: any = (options as any)?.body;
  const body =
    typeof rawBody === "string"
      ? rawBody
      : rawBody != null
      ? JSON.stringify(rawBody)
      : undefined;

  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  if (!token) {
    throw new Error("Sessione non valida. Rifai login.");
  }

  if (!endpoint || typeof endpoint !== "string") {
    throw new Error("endpoint/method: endpoint mancante");
  }

  const res = await fetch("/api/microsoft365/graph", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
      Authorization: `Bearer ${token}`,
    } as any,
    body: JSON.stringify({
      studioId,
      userId,
      endpoint,
      method,
      body,
    }),
  });

  if (res.status === 204) return {} as T;

  const text = await res.text().catch(() => "");
  const json = text ? (JSON.parse(text) as any) : null;

  if (!res.ok) {
    const msg = (json && (json.error || json.message)) || text || "Errore proxy Graph";
    throw new Error(`Graph proxy error (${res.status}): ${msg}`);
  }

  return (json ?? ({} as any)) as T;
}

/* =========================================================
   Wrapper legacy
========================================================= */

export type GraphSendMailMessage = {
  subject: string;
  body: {
    contentType: "Text" | "HTML";
    content: string;
  };
  toRecipients: Array<{ emailAddress: { address: string } }>;
  ccRecipients?: Array<{ emailAddress: { address: string } }>;
};

export async function sendEmail(userId: string, message: GraphSendMailMessage): Promise<void> {
  await graphApiCall(userId, "/me/sendMail", {
    method: "POST",
    body: {
      message,
      saveToSentItems: true,
    } as any,
  } as any);
}

export async function sendChannelMessage(
  userId: string,
  teamId: string,
  channelId: string,
  messageHtml: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await graphApiCall(userId, `/teams/${teamId}/channels/${channelId}/messages`, {
      method: "POST",
      body: {
        body: { contentType: "html", content: messageHtml },
      } as any,
    } as any);

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
