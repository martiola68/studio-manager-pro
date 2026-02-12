import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";
import crypto from "crypto";

/**
 * Microsoft OAuth Login Endpoint
 * 
 * Inizia il flusso OAuth 2.0 con:
 * - State anti-CSRF (generato e salvato in cookie)
 * - PKCE (Code Verifier + Code Challenge)
 * - Redirect a Microsoft login
 * 
 * Pattern: Authorization Code Flow with PKCE
 */

interface ErrorResponse {
  error: string;
  details?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Verifica sessione utente
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ 
        error: "Non autenticato",
        details: "Sessione non valida. Effettua il login."
      });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ 
        error: "Utente non trovato",
        details: "Sessione non valida. Effettua il login."
      });
    }

    // 2. Recupera configurazione studio
    const { data: userData, error: studioError } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    if (studioError || !userData?.studio_id) {
      return res.status(400).json({ 
        error: "Studio non trovato",
        details: "Configurazione studio mancante."
      });
    }

    const studioId = userData.studio_id;

    // 3. Recupera configurazione Microsoft 365
    const { data: configData, error: configError } = await supabase
      .from("microsoft365_config")
      .select("client_id, tenant_id, enabled")
      .eq("studio_id", studioId)
      .maybeSingle();

    if (configError || !configData) {
      return res.status(400).json({ 
        error: "Microsoft 365 non configurato",
        details: "Chiedi all'amministratore di configurare Microsoft 365 in Impostazioni → Microsoft 365"
      });
    }

    if (!configData.enabled) {
      return res.status(400).json({ 
        error: "Microsoft 365 disabilitato",
        details: "L'integrazione Microsoft 365 è disabilitata per questo studio."
      });
    }

    // 4. Genera State anti-CSRF (32 bytes random hex)
    const state = crypto.randomBytes(32).toString("hex");

    // 5. Genera PKCE Code Verifier (43-128 chars, base64url)
    const codeVerifier = crypto.randomBytes(32).toString("base64url");

    // 6. Genera PKCE Code Challenge (SHA-256 hash del verifier)
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    // 7. Salva state + codeVerifier in cookie (HTTPOnly, Secure, SameSite)
    res.setHeader("Set-Cookie", [
      `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      `oauth_code_verifier=${codeVerifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      `oauth_user_id=${user.id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    ]);

    // 8. Costruisci URL autorizzazione Microsoft
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://studio-manager-pro.vercel.app"}/api/auth/microsoft/callback`;

    const scopes = [
      "User.Read",
      "Calendars.ReadWrite",
      "Contacts.ReadWrite",
      "Mail.Send",
      "OnlineMeetings.ReadWrite",
      "offline_access",
      "openid",
      "profile",
      "email"
    ].join(" ");

    const authUrl = new URL(`https://login.microsoftonline.com/${configData.tenant_id}/oauth2/v2.0/authorize`);
    
    authUrl.searchParams.set("client_id", configData.client_id);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("response_mode", "query");

    console.log("[OAuth Login] Redirecting to Microsoft:", {
      userId: user.id,
      studioId,
      tenantId: configData.tenant_id,
      redirectUri,
      hasPKCE: true
    });

    // 9. Redirect a Microsoft login
    res.redirect(302, authUrl.toString());

  } catch (error) {
    console.error("[OAuth Login] Unexpected error:", error);
    return res.status(500).json({ 
      error: "Errore interno del server",
      details: error instanceof Error ? error.message : "Errore sconosciuto"
    });
  }
}