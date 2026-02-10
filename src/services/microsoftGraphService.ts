import { supabase } from "@/lib/supabase/client";

/**
 * Microsoft Graph API Service
 * Gestisce autenticazione, refresh token e chiamate API
 */

interface GraphTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface UserToken {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  user_id: string;
}

/**
 * Ottiene il token valido per l'utente
 * Rinnova automaticamente se scaduto
 */
export async function getValidToken(userId: string): Promise<string> {
  // Recupera token dal database
  const { data: tokenData, error } = await supabase
    .from("tbmicrosoft_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single();

  if (error || !tokenData) {
    throw new Error("Microsoft 365 non configurato per questo utente");
  }

  const expiresAt = new Date(tokenData.expires_at);
  const now = new Date();

  // Token ancora valido (con buffer di 5 minuti)
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return tokenData.access_token;
  }

  // Token scaduto - refresh necessario
  console.log("🔄 Token scaduto, eseguo refresh...");
  return await refreshToken(userId, tokenData.refresh_token);
}

/**
 * Rinnova il token usando refresh_token
 */
async function refreshToken(userId: string, refreshToken: string): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error("Configurazione Microsoft 365 mancante");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ Refresh token failed:", errorText);
    throw new Error("Impossibile rinnovare il token Microsoft. Riconnetti l'account.");
  }

  const tokenData: GraphTokenResponse = await response.json();

  // Calcola scadenza
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

  // Aggiorna token nel database
  const { error: updateError } = await supabase
    .from("tbmicrosoft_tokens")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (updateError) {
    console.error("❌ Errore aggiornamento token:", updateError);
    throw new Error("Errore durante il salvataggio del nuovo token");
  }

  console.log("✅ Token rinnovato con successo");
  return tokenData.access_token;
}

/**
 * Effettua una chiamata a Microsoft Graph API
 */
export async function graphApiCall<T>(
  userId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getValidToken(userId);

  const url = `https://graph.microsoft.com/v1.0${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Graph API error (${endpoint}):`, errorText);
    throw new Error(`Graph API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Verifica se l'utente ha Microsoft 365 configurato
 */
export async function hasMicrosoft365(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("tbmicrosoft_tokens")
    .select("user_id")
    .eq("user_id", userId)
    .single();

  return !error && !!data;
}