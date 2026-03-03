// src/services/microsoftGraphService.ts
// ✅ CLIENT-SAFE: niente @azure/msal-node qui dentro
import { getSupabaseClient } from "@/lib/supabase/client";

export function hasMicrosoft365(studioId: string, userId: string): Promise<boolean>;
export function hasMicrosoft365(userId: string): Promise<boolean>;

/**
 * Client-side check: delega al server.
 * Manteniamo la firma retro-compatibile ma NON usiamo direttamente studioId/userId lato client.
 */
export async function hasMicrosoft365(_a: string, _b?: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;

  // Se non ho sessione, sicuramente non è connesso
  if (!token) return false;

  const res = await fetch("/api/m365/status", {
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
  // --- 1) Normalizza firme legacy (2 arg / 3 arg / 4 arg)
  let endpoint: string;
  let options: RequestInit | undefined;

  // vecchia firma: (userId, endpoint, options?)
  if (typeof b === "string" && (typeof c === "object" || typeof c === "undefined")) {
    endpoint = b;
    options = c as RequestInit | undefined;
  } else {
    // nuova firma: (studioId, userId, endpoint, options?)
    endpoint = c as string;
    options = d as RequestInit | undefined;
  }

  // --- 2) Costruisci request per proxy (endpoint/method/body SEMPRE presenti)
  const method = String(options?.method || "GET").toUpperCase();

  // body: se è già stringa la passo così; se è oggetto lo serializzo; se null/undefined -> undefined
  const rawBody: any = (options as any)?.body;
  const body =
    typeof rawBody === "string"
      ? rawBody
      : rawBody != null
      ? JSON.stringify(rawBody)
      : undefined;

  // --- 3) Token Supabase (Authorization verso proxy)
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error("Sessione non valida. Rifai login.");
  }

  // --- 4) Validazioni minime (evita 400 dal proxy)
  if (!endpoint || typeof endpoint !== "string") {
    throw new Error("Missing endpoint/method: endpoint mancante");
  }
  if (!method || typeof method !== "string") {
    throw new Error("Missing endpoint/method: method mancante");
  }

  // --- 5) Call proxy
  const res = await fetch("/api/m365/graph", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
      Authorization: `Bearer ${token}`, // dopo, così non viene sovrascritto
    } as any,
    body: JSON.stringify({
      endpoint,
      method,
      body,
    }),
  });

  // --- 6) Parse risposta
  if (res.status === 204) return {} as T;

  const text = await res.text().catch(() => "");
  const json = text ? (JSON.parse(text) as any) : null;

  if (!res.ok) {
    const msg = (json && (json.error || json.message)) || text || "Errore proxy Graph";
    throw new Error(`Graph proxy error (${res.status}): ${msg}`);
  }

  return (json ?? ({} as any)) as T;
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

export async function sendEmail(
  _userId: string,
  message: GraphSendMailMessage
): Promise<void> {
  await graphApiCall("/me/sendMail", {
    method: "POST",
    body: {
      message,
      saveToSentItems: true,
    },
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
      body: {
        body: { contentType: "html", content: messageHtml },
      },
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
