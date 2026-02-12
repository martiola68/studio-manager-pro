import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";
import { encrypt } from "@/lib/encryption365";

/**
 * Microsoft OAuth Callback Endpoint
 * 
 * Gestisce il redirect da Microsoft dopo login:
 * - Valida state anti-CSRF
 * - Scambia authorization code → access_token + refresh_token
 * - Salva token cifrati nel database
 * - Redirect a pagina impostazioni
 * 
 * Security:
 * - State validation (anti-CSRF)
 * - PKCE validation (code_verifier)
 * - Token encryption (AES-256-GCM)
 */

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
  id_token?: string;
}

interface MicrosoftUserInfo {
  id: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  try {
    // 1. Recupera parametri callback
    const { code, state, error, error_description } = req.query;

    // 2. Gestione errori Microsoft
    if (error) {
      console.error("[OAuth Callback] Microsoft error:", error, error_description);
      return res.redirect(
        `/impostazioni/microsoft365?error=${encodeURIComponent(error as string)}&message=${encodeURIComponent(error_description as string || "Autorizzazione negata")}`
      );
    }

    if (!code || !state) {
      console.error("[OAuth Callback] Missing code or state");
      return res.redirect(
        "/impostazioni/microsoft365?error=invalid_request&message=Parametri+mancanti"
      );
    }

    // 3. Recupera cookies (state, code_verifier, user_id)
    const cookies = parseCookies(req.headers.cookie || "");
    const savedState = cookies.oauth_state;
    const codeVerifier = cookies.oauth_code_verifier;
    const userId = cookies.oauth_user_id;

    // 4. Valida state anti-CSRF
    if (!savedState || savedState !== state) {
      console.error("[OAuth Callback] State mismatch:", { savedState, receivedState: state });
      return res.redirect(
        "/impostazioni/microsoft365?error=invalid_state&message=Stato+non+valido+(CSRF)"
      );
    }

    if (!codeVerifier || !userId) {
      console.error("[OAuth Callback] Missing code_verifier or user_id in cookies");
      return res.redirect(
        "/impostazioni/microsoft365?error=invalid_session&message=Sessione+non+valida"
      );
    }

    // 5. Recupera configurazione studio
    const { data: userData, error: userError } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", userId)
      .single();

    if (userError || !userData?.studio_id) {
      console.error("[OAuth Callback] Studio not found:", userError);
      return res.redirect(
        "/impostazioni/microsoft365?error=studio_not_found&message=Studio+non+trovato"
      );
    }

    const studioId = userData.studio_id;

    // 6. Recupera configurazione Microsoft 365
    const { data: configData, error: configError } = await supabase
      .from("tbmicrosoft365_config" as any)
      .select("client_id, client_secret_encrypted, tenant_id")
      .eq("studio_id", studioId)
      .single();

    if (configError || !configData) {
      console.error("[OAuth Callback] Config not found:", configError);
      return res.redirect(
        "/impostazioni/microsoft365?error=config_not_found&message=Configurazione+non+trovata"
      );
    }

    // 7. Decifra client_secret
    const { decrypt } = await import("@/lib/encryption365");
    const clientSecret = decrypt(configData.client_secret_encrypted);

    // 8. Scambia authorization code → access_token
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://studio-manager-pro.vercel.app"}/api/auth/microsoft/callback`;

    const tokenUrl = `https://login.microsoftonline.com/${configData.tenant_id}/oauth2/v2.0/token`;

    const tokenParams = new URLSearchParams({
      client_id: configData.client_id,
      client_secret: clientSecret,
      code: code as string,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier
    });

    console.log("[OAuth Callback] Exchanging code for token...");

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: tokenParams.toString()
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error("[OAuth Callback] Token exchange failed:", errorData);
      return res.redirect(
        `/impostazioni/microsoft365?error=token_exchange_failed&message=${encodeURIComponent(errorData.error_description || "Errore scambio token")}`
      );
    }

    const tokens: TokenResponse = await tokenResponse.json();

    console.log("[OAuth Callback] Token received:", {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in
    });

    // 9. Recupera informazioni utente Microsoft
    let microsoftUserId: string | null = null;

    try {
      const userInfoResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`
        }
      });

      if (userInfoResponse.ok) {
        const userInfo: MicrosoftUserInfo = await userInfoResponse.json();
        microsoftUserId = userInfo.id;
        console.log("[OAuth Callback] Microsoft user info:", {
          id: userInfo.id,
          displayName: userInfo.displayName,
          mail: userInfo.mail
        });
      }
    } catch (error) {
      console.warn("[OAuth Callback] Failed to fetch user info (non-critical):", error);
    }

    // 10. Cifra token (AES-256-GCM)
    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

    console.log("[OAuth Callback] Tokens encrypted successfully");

    // 11. Calcola scadenza
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // 12. Salva o aggiorna token in database
    const { error: upsertError } = await supabase
      .from("tbmicrosoft_tokens")
      .upsert({
        user_id: userId,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: expiresAt.toISOString(),
        microsoft_user_id: microsoftUserId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "user_id"
      });

    if (upsertError) {
      console.error("[OAuth Callback] Database error:", upsertError);
      return res.redirect(
        "/impostazioni/microsoft365?error=database_error&message=Errore+salvataggio+token"
      );
    }

    console.log("[OAuth Callback] Token saved successfully for user:", userId);

    // 13. Pulisci cookies
    res.setHeader("Set-Cookie", [
      "oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
      "oauth_code_verifier=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
      "oauth_user_id=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    ]);

    // 14. Redirect a pagina impostazioni con successo
    res.redirect("/impostazioni/microsoft365?success=true");

  } catch (error) {
    console.error("[OAuth Callback] Unexpected error:", error);
    return res.redirect(
      `/impostazioni/microsoft365?error=server_error&message=${encodeURIComponent(error instanceof Error ? error.message : "Errore sconosciuto")}`
    );
  }
}

/**
 * Parse cookies from Cookie header
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  return cookieHeader.split(";").reduce((cookies, cookie) => {
    const [name, value] = cookie.trim().split("=");
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
    return cookies;
  }, {} as Record<string, string>);
}