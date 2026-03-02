import { decrypt } from "@/lib/encryption365";
import { ConfidentialClientApplication, LogLevel } from "@azure/msal-node";
import { supabase } from "@/lib/supabase/client"; // o dove lo importi già

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

async function graphApiCall<T = any>(
  studioId: string,
  userId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // 1) leggi token cache utente
  const { data: tokenRow, error: tokenErr } = await supabase
    .from("tbmicrosoft365_user_tokens")
    .select("token_cache_encrypted, scopes, revoked_at")
    .eq("studio_id", studioId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .single();

  if (tokenErr || !tokenRow?.token_cache_encrypted) {
    throw new Error(
      "Microsoft 365 non configurato o token non valido. Connetti il tuo account in Impostazioni → Microsoft 365"
    );
  }

  // 2) leggi configurazione studio (client credentials)
  const { data: settings, error: setErr } = await supabase
    .from("tbmicrosoft_settings")
    .select("client_id, tenant_id, client_secret_encrypted")
    .eq("studio_id", studioId)
    .single<M365SettingsRow>();

  if (setErr || !settings?.client_id || !settings?.tenant_id || !settings?.client_secret_encrypted) {
    throw new Error("Microsoft 365 non configurato per lo studio (client credentials mancanti).");
  }

  const clientSecret = decrypt(settings.client_secret_encrypted);

  // 3) ricostruisci MSAL token cache da token_cache_encrypted
  const serializedCache = decrypt(tokenRow.token_cache_encrypted);

  let cacheHasChanged = false;
  const cachePlugin = {
    beforeCacheAccess: async (cacheContext: any) => {
      cacheContext.tokenCache.deserialize(serializedCache);
    },
    afterCacheAccess: async (cacheContext: any) => {
      if (cacheContext.cacheHasChanged) {
        cacheHasChanged = true;
      }
    },
  };

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

  const accounts = await msalApp.getTokenCache().getAllAccounts();
  const account = accounts?.[0];
  if (!account) {
    throw new Error(
      "Token cache Microsoft non valido (account mancante). Riconnetti in Impostazioni → Microsoft 365"
    );
  }

  const scopes =
    tokenRow.scopes?.split(" ").map((s: string) => s.trim()).filter(Boolean) ??
    ["https://graph.microsoft.com/.default"];

  let accessToken: string;
  try {
    const result = await msalApp.acquireTokenSilent({
      account,
      scopes,
    });
    accessToken = result?.accessToken || "";
  } catch (e: any) {
    throw new Error(
      "Token Microsoft scaduto o non rinnovabile. Riconnetti in Impostazioni → Microsoft 365"
    );
  }

  if (!accessToken) {
    throw new Error(
      "Impossibile ottenere access token Microsoft. Riconnetti in Impostazioni → Microsoft 365"
    );
  }

  // 4) se cache è cambiata, risalva token_cache_encrypted (refresh token/rotazioni)
  if (cacheHasChanged) {
    const newSerialized = msalApp.getTokenCache().serialize();
    const newEncrypted = (await import("@/lib/encryption365")).encrypt(newSerialized);

    await supabase
      .from("tbmicrosoft365_user_tokens")
      .update({
        token_cache_encrypted: newEncrypted,
        revoked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("studio_id", studioId)
      .eq("user_id", userId);
  }

  // 5) chiamata Graph
  const url = endpoint.startsWith("https://")
    ? endpoint
    : `https://graph.microsoft.com/v1.0${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Graph Service] API error (${response.status}):`, errorText);
    throw new Error(`Microsoft Graph API error: ${errorText}`);
  }

  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export { graphApiCall };
