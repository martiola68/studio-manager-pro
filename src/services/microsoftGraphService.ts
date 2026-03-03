// src/services/microsoftGraphService.ts
// ✅ CLIENT-SAFE: niente @azure/msal-node qui dentro

export function hasMicrosoft365(studioId: string, userId: string): Promise<boolean>;
export function hasMicrosoft365(userId: string): Promise<boolean>;

/**
 * Client-side check: delega al server.
 * Manteniamo la firma retro-compatibile ma NON usiamo direttamente studioId/userId lato client.
 */
export async function hasMicrosoft365(_a: string, _b?: string): Promise<boolean> {
  const res = await fetch("/api/m365/status", {
    method: "GET",
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });

  const json = await res.json().catch(() => null);
  return !!json?.connected;
}

/**
 * ✅ graphApiCall retro-compatibile (client facade):
 * - nuova firma: (studioId, userId, endpoint, options)
 * - vecchia firma: (userId, endpoint, options)
 *
 * NOTA: studioId/userId qui sono ignorati: l'API server ricava userId dalla sessione.
 */
export function graphApiCall<T = any>(
  studioId: string,
  userId: string,
  endpoint: string,
  options?: RequestInit
): Promise<T>;

export function graphApiCall<T = any>(
  userId: string,
  endpoint: string,
  options?: RequestInit
): Promise<T>;

export async function graphApiCall<T = any>(
  a: string,
  b: any,
  c?: any,
  d?: any
): Promise<T> {
  let endpoint: string;
  let options: RequestInit | undefined;

  // vecchia firma: (userId, endpoint, options)
  if (typeof b === "string" && (typeof c === "object" || typeof c === "undefined")) {
    endpoint = b;
    options = c;
  } else {
    // nuova firma: (studioId, userId, endpoint, options)
    endpoint = c as string;
    options = d as RequestInit | undefined;
  }

  const method = (options?.method || "GET").toUpperCase();
  const body =
    typeof options?.body === "string"
      ? options.body
      : options?.body
      ? JSON.stringify(options.body)
      : undefined;

  const res = await fetch("/api/m365/graph", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    } as any,
    body: JSON.stringify({
      endpoint,
      method,
      body,
    }),
  });

  if (res.status === 204) return {} as T;

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Graph proxy error (${res.status}): ${errText}`);
  }

  const text = await res.text();
  if (!text) return {} as T;

  return JSON.parse(text) as T;
}

/* =========================
   Email + Teams wrappers richiesti dai servizi legacy
========================= */

export type GraphSendMailMessage = {
  subject: string;
  body: {
    contentType: "Text" | "HTML";
    content: string;
  };
  toRecipients: Array<{ emailAddress: { address: string } }>;
  ccRecipients?: Array<{ emailAddress: { address: string } }>;
};

export async function sendEmail(_userId: string, message: GraphSendMailMessage): Promise<void> {
  await graphApiCall("/me/sendMail", {
    method: "POST",
    body: JSON.stringify({
      message,
      saveToSentItems: true,
    }),
  } as any);
}

export async function sendChannelMessage(
  _userId: string,
  teamId: string,
  channelId: string,
  messageHtml: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await graphApiCall(`/teams/${teamId}/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        body: { contentType: "html", content: messageHtml },
      }),
    } as any);

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
}

// ✅ legacy export atteso da vari file
export const microsoftGraphService = {
  graphApiCall,
  hasMicrosoft365,
  sendEmail,
  sendChannelMessage,
};
