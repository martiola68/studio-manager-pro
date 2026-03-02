// src/services/microsoftGraphService.ts
import { decrypt, encrypt } from "@/lib/encryption365";
import { ConfidentialClientApplication, LogLevel } from "@azure/msal-node";
import { supabase } from "@/lib/supabase/client";

/* =========================================
   hasMicrosoft365 (retro-compatibile)
   - nuova firma: (studioId, userId)
   - firma comoda: (userId)
========================================= */

export function hasMicrosoft365(studioId: string, userId: string): Promise<boolean>;
export function hasMicrosoft365(userId: string): Promise<boolean>;

export async function hasMicrosoft365(a: string, b?: string): Promise<boolean> {
  // firma nuova: (studioId, userId)
  if (typeof b === "string") {
    const studioId = a;
    const userId = b;

    const { data, error } = await supabase
      .from("tbmicrosoft365_user_tokens")
      .select("id")
      .eq("studio_id", studioId)
      .eq("user_id", userId)
      .is("revoked_at", null)
      .maybeSingle();

    return !!data && !error;
  }

  // firma compatibile: (userId) -> ricavo studioId da tbutenti
  const userId = a;

  const { data: uRow, error: uErr } = await supabase
    .from("tbutenti")
    .select("studio_id")
    .eq("id", userId)
    .maybeSingle();

  if (uErr || !uRow?.studio_id) return false;

  const { data, error } = await supabase
    .from("tbmicrosoft365_user_tokens")
    .select("id")
    .eq("studio_id", uRow.studio_id)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();

  return !!data && !error;
}

/* =========================================
   Types
========================================= */

type M365SettingsRow = {
  client_id: string;
  tenant_id: string;
  client_secret_encrypted: string;
};

type TokenRow = {
  token_cache_encrypted: string;
  scopes: string | null;
  revoked_at: string | null;
};

/* =========================================
   Helpers
========================================= */

function buildScopes(scopesStr: string | null): string[] {
  const scopes =
    scopesStr
      ?.split(" ")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  // fallback (evita ".default" delegato non coerente)
  if (scopes.length === 0) return ["User.Read"];

  return scopes;
}

async function getUserTokenRow(studioId: string, userId: string): Promise<TokenRow> {
  const { data, error } = await supabase
    .from("tbmicrosoft365_user_tokens")
    .select("token_cache_encrypted, scopes, revoked_at")
    .eq("studio_id", studioId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .single<TokenRow>();

  if (error || !data?.token_cache_encrypted) {
    throw new Error(
      "Microsoft 365 non configurato o token non valido. Connetti il tuo account in Impostazioni → Microsoft 365"
    );
  }

  return data;
}

async function getStudioSettings(studioId: string): Promise<M365SettingsRow> {
  const { data, error } = await supabase
    .from("tbmicrosoft_settings")
    .select("client_id, tenant_id, client_secret_encrypted")
    .eq("studio_id", studioId)
    .single<M365SettingsRow>();

  if (error || !data?.client_id || !data?.tenant_id || !data?.client_secret_encrypted) {
    throw new Error(
      "Microsoft 365 non configurato per lo studio (client credentials mancanti)."
    );
  }

  return data;
}

async function createMsalAppWithCache(
  settings: M365SettingsRow,
  decryptedSerializedCache: string
): Promise<{
  msalApp: ConfidentialClientApplication;
  cacheState: { cacheHasChanged: boolean };
}> {
  const cacheState = { cacheHasChanged: false };

  const cachePlugin = {
    beforeCacheAccess: async (cacheContext: any) => {
      cacheContext.tokenCache.deserialize(decryptedSerializedCache);
    },
    afterCacheAccess: async (cacheContext: any) => {
      if (cacheContext.cacheHasChanged) {
        cacheState.cacheHasChanged = true;
      }
    },
  };

  const clientSecret = decrypt(settings.client_secret_encrypted);

  const msalApp = new ConfidentialClientApplication({
    auth: {
      clientId: settings.client_id,
      authority: `https://login.microsoftonline.com/${settings.tenant_id}`,
      clientSecret,
    },
    cache: { cachePlugin },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Error,
        piiLoggingEnabled: false,
      },
    },
  });

  return { msalApp, cacheState };
}

async function persistUpdatedCacheIfNeeded(
  studioId: string,
  userId: string,
  msalApp: ConfidentialClientApplication,
  cacheHasChanged: boolean
) {
  if (!cacheHasChanged) return;

  const newSerialized = msalApp.getTokenCache().serialize();
  const newEncrypted = encrypt(newSerialized);

  const { error } = await supabase
    .from("tbmicrosoft365_user_tokens")
    .update({
      token_cache_encrypted: newEncrypted,
      revoked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("studio_id", studioId)
    .eq("user_id", userId);

  if (error) {
    console.error("[Graph Service] Failed to persist updated token cache:", error);
  }
}

async function acquireAccessToken(
  studioId: string,
  userId: string
): Promise<{ accessToken: string }> {
  const [tokenRow, settings] = await Promise.all([
    getUserTokenRow(studioId, userId),
    getStudioSettings(studioId),
  ]);

  const serializedCache = decrypt(tokenRow.token_cache_encrypted);
  const { msalApp, cacheState } = await createMsalAppWithCache(settings, serializedCache);

  const accounts = await msalApp.getTokenCache().getAllAccounts();
  const account = accounts?.[0];

  if (!account) {
    throw new Error(
      "Token cache Microsoft non valido (account mancante). Riconnetti in Impostazioni → Microsoft 365"
    );
  }

  const scopes = buildScopes(tokenRow.scopes);

  let result;
  try {
    result = await msalApp.acquireTokenSilent({ account, scopes });
  } catch {
    throw new Error(
      "Token Microsoft scaduto o non rinnovabile. Riconnetti in Impostazioni → Microsoft 365"
    );
  }

  const accessToken = result?.accessToken;
  if (!accessToken) {
    throw new Error(
      "Impossibile ottenere access token Microsoft. Riconnetti in Impostazioni → Microsoft 365"
    );
  }

  await persistUpdatedCacheIfNeeded(studioId, userId, msalApp, cacheState.cacheHasChanged);

  return { accessToken };
}

/* =========================================
   graphApiCall (retro-compatibile)
   - nuova firma: (studioId, userId, endpoint, options)
   - vecchia firma: (userId, endpoint, options)
========================================= */

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
  // Caso vecchio: (userId, endpoint, options?)
  if (typeof b === "string" && (typeof c === "object" || typeof c === "undefined")) {
    const userId = a;
    const endpoint = b;
    const options: RequestInit = (c ?? {}) as RequestInit;

    const { data: uRow, error: uErr } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", userId)
      .maybeSingle();

    if (uErr || !uRow?.studio_id) {
      throw new Error("Impossibile determinare lo studio dell'utente (studioId) per Microsoft Graph.");
    }

    const studioId = uRow.studio_id as string;
    return graphApiCallInternal<T>(studioId, userId, endpoint, options);
  }

  // Caso nuovo: (studioId, userId, endpoint, options?)
  const studioId = a;
  const userId = b as string;
  const endpoint = c as string;
  const options: RequestInit = (d ?? {}) as RequestInit;

  return graphApiCallInternal<T>(studioId, userId, endpoint, options);
}

async function graphApiCallInternal<T = any>(
  studioId: string,
  userId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { accessToken } = await acquireAccessToken(studioId, userId);

  const url = endpoint.startsWith("https://")
    ? endpoint
    : `https://graph.microsoft.com/v1.0${endpoint}`;

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 204) return {} as T;

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    console.error(`[Graph Service] API error (${res.status}):`, errorText);
    throw new Error(`Microsoft Graph API error (${res.status}): ${errorText}`);
  }

  const text = await res.text();
  if (!text) return {} as T;

  return JSON.parse(text) as T;
}

/* =========================================
   sendEmail (per compatibilità con emailService)
========================================= */

export type GraphSendMailMessage = {
  subject: string;
  body: {
    contentType: "Text" | "HTML";
    content: string;
  };
  toRecipients: Array<{
    emailAddress: { address: string };
  }>;
  ccRecipients?: Array<{
    emailAddress: { address: string };
  }>;
};

export async function sendEmail(userId: string, message: GraphSendMailMessage): Promise<void> {
  // usa la firma compatibile: graphApiCall(userId, endpoint, options)
  await graphApiCall(userId, `/users/${userId}/sendMail`, {
    method: "POST",
    body: JSON.stringify({
      message,
      saveToSentItems: true,
    }),
  });
}

/* =========================================
   microsoftGraphService export (legacy)
========================================= */

export const microsoftGraphService = {
  graphApiCall,
  hasMicrosoft365,
  sendEmail,
};
