// src/services/microsoftGraphService.ts
import { decrypt, encrypt } from "@/lib/encryption365";
import { ConfidentialClientApplication, LogLevel } from "@azure/msal-node";
import { supabase } from "@/lib/supabase/client";

export async function hasMicrosoft365(
  studioId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("tbmicrosoft365_user_tokens")
    .select("id")
    .eq("studio_id", studioId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();

  return !!data && !error;
}

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

function buildScopes(scopesStr: string | null): string[] {
  const scopes =
    scopesStr
      ?.split(" ")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  // fallback sicuro: se non hai salvato scopes, qui è meglio fallire esplicitamente
  // oppure usare un default che sai essere quello richiesto dal tuo flusso.
  if (scopes.length === 0) {
    // esempio tipico per eventi + online meeting:
    // "User.Read Calendars.ReadWrite OnlineMeetings.ReadWrite"
    // ma lascio fallback "User.Read" per evitare .default delegato.
    return ["User.Read"];
  }

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

  if (
    error ||
    !data?.client_id ||
    !data?.tenant_id ||
    !data?.client_secret_encrypted
  ) {
    throw new Error(
      "Microsoft 365 non configurato per lo studio (client credentials mancanti)."
    );
  }

  return data;
}

async function createMsalAppWithCache(
  settings: M365SettingsRow,
  decryptedSerializedCache: string
): Promise<{ msalApp: ConfidentialClientApplication; cacheState: { cacheHasChanged: boolean } }> {
  const cacheState = { cacheHasChanged: false };

  const cachePlugin = {
    beforeCacheAccess: async (cacheContext: any) => {
      // carica la cache “as-is” dal DB (decriptata)
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
    // non blocco la chiamata Graph, ma loggo perché al prossimo giro potresti perdere refresh/rotazioni
    console.error("[Graph Service] Failed to persist updated token cache:", error);
  }
}

async function acquireAccessToken(
  studioId: string,
  userId: string
): Promise<{ accessToken: string; msalApp: ConfidentialClientApplication; cacheHasChanged: boolean }> {
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
    result = await msalApp.acquireTokenSilent({
      account,
      scopes,
    });
  } catch (e) {
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

  // se MSAL ha aggiornato cache (refresh/rotazione), persistila
  await persistUpdatedCacheIfNeeded(studioId, userId, msalApp, cacheState.cacheHasChanged);

  return { accessToken, msalApp, cacheHasChanged: cacheState.cacheHasChanged };
}

export async function graphApiCall<T = any>(
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
  // imposta content-type solo se stai mandando body (evita problemi su GET senza body in alcune proxy)
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 204) return {} as T;

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    console.error(`[Graph Service] API error (${res.status}):`, errorText);
    throw new Error(`Microsoft Graph API error (${res.status}): ${errorText}`);
  }

  // alcune risposte possono essere vuote anche se non 204 (raro, ma possibile)
  const text = await res.text();
  if (!text) return {} as T;

  return JSON.parse(text) as T;
}
