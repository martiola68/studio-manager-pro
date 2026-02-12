import type { NextApiRequest, NextApiResponse } from "next";
import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
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
 * Uses cookie-based auth for session validation.
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
    const supabase = createPagesServerClient({ req, res });
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    console.log("[OAuth Login] Session check:", {
      hasUser: !!user,
      userId: user?.id,
      error: userError?.message,
      host: req.headers.host,
      origin: req.headers.origin,
    });

    if (userError || !user) {
      console.error("[OAuth Login] Auth error:", userError);
      return res.status(401).json({ 
        error: "Non autenticato",
        details: "Sessione non valida. Effettua il login."
      });
    }

    const { data: userData, error: studioError } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    if (studioError || !userData?.studio_id) {
      console.error("[OAuth Login] Studio lookup failed:", studioError);
      return res.status(400).json({ 
        error: "Studio non trovato",
        details: "Configurazione studio mancante."
      });
    }

    const studioId = userData.studio_id;
    console.log("[OAuth Login] Studio found:", studioId);

    const supabaseAdmin = getSupabaseAdmin();
    const { data: config } = await supabaseAdmin
      .from("microsoft365_config")
      .select("client_id, tenant_id")
      .eq("studio_id", studioId)
      .single();

    if (!config) {
      console.error("[OAuth Login] No M365 config found for studio:", studioId);
      return res.status(400).json({ 
        error: "Microsoft 365 non configurato",
        details: "Chiedi all'amministratore di configurare Microsoft 365 in Impostazioni → Microsoft 365"
      });
    }

    const configData = config as unknown as {
      client_id: string;
      tenant_id: string;
    };

    console.log("[OAuth Login] Config loaded:", {
      studioId,
      tenantId: configData.tenant_id,
      hasClientId: !!configData.client_id
    });

    const state = crypto.randomBytes(32).toString("hex");
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    res.setHeader("Set-Cookie", [
      `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      `oauth_code_verifier=${codeVerifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      `oauth_user_id=${user.id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    ]);

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL 
      || process.env.NEXT_PUBLIC_APP_URL 
      || "https://studio-manager-pro.vercel.app";
    
    const redirectUri = `${baseUrl}/api/auth/microsoft/callback`;

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
      authUrl: authUrl.toString().substring(0, 100) + "...",
      hasPKCE: true
    });

    res.redirect(302, authUrl.toString());

  } catch (error) {
    console.error("[OAuth Login] Unexpected error:", error);
    return res.status(500).json({ 
      error: "Errore interno del server",
      details: error instanceof Error ? error.message : "Errore sconosciuto"
    });
  }
}