import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import crypto from "crypto";
import type { Database } from "@/integrations/supabase/types";

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

/**
 * Helper per leggere i cookie di autenticazione Supabase
 */
function getSupabaseAuthCookies(req: NextApiRequest): string {
  const cookies = req.cookies;
  const authCookies: string[] = [];
  
  // Supabase usa cookie con pattern: sb-<project-ref>-auth-token
  Object.keys(cookies).forEach((key) => {
    if (key.startsWith("sb-") && key.includes("-auth-token")) {
      authCookies.push(`${key}=${cookies[key]}`);
    }
  });
  
  return authCookies.join("; ");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ✅ LOGGING INIZIALE
    console.log("[OAuth Login] Request received:", {
      method: req.method,
      host: req.headers.host,
      origin: req.headers.origin,
      referer: req.headers.referer,
      userAgent: req.headers["user-agent"],
      hasCookies: !!req.headers.cookie,
      cookieKeys: Object.keys(req.cookies || {}).filter(k => k.startsWith("sb-")),
    });

    // ✅ 1. Crea client Supabase con cookie support manuale
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            // Passa i cookie di auth al client Supabase
            cookie: getSupabaseAuthCookies(req),
          },
        },
      }
    );
    
    // ✅ 2. Leggi utente autenticato da cookies
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    console.log("[OAuth Login] Session check:", {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      error: userError?.message,
      errorCode: userError?.status,
    });

    if (userError || !user) {
      console.error("[OAuth Login] Auth error:", {
        error: userError,
        message: "No valid session found in cookies"
      });
      return res.status(401).json({ 
        error: "Non autenticato",
        details: "Sessione non valida. Effettua il login."
      });
    }

    console.log("[OAuth Login] User authenticated:", {
      userId: user.id,
      email: user.email,
    });

    // ✅ 3. Recupera studio_id dell'utente
    const { data: userData, error: studioError } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    console.log("[OAuth Login] Studio lookup:", {
      found: !!userData?.studio_id,
      studioId: userData?.studio_id,
      error: studioError?.message,
    });

    if (studioError || !userData?.studio_id) {
      console.error("[OAuth Login] Studio lookup failed:", studioError);
      return res.status(400).json({ 
        error: "Studio non trovato",
        details: "Configurazione studio mancante."
      });
    }

    const studioId = userData.studio_id;

    // ✅ 4. Recupera config M365 per lo studio
    const supabaseAdmin = getSupabaseAdmin();
    const { data: config, error: configError } = await supabaseAdmin
      .from("microsoft365_config")
      .select("client_id, tenant_id")
      .eq("studio_id", studioId)
      .single();

    console.log("[OAuth Login] Config lookup:", {
      found: !!config,
      studioId,
      hasClientId: !!config?.client_id,
      hasTenantId: !!config?.tenant_id,
      error: configError?.message,
    });

    if (configError || !config) {
      console.error("[OAuth Login] No M365 config found:", {
        studioId,
        error: configError
      });
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
      clientIdLength: configData.client_id.length,
      clientIdPrefix: configData.client_id.substring(0, 8) + "...",
    });

    // ✅ 5. Genera parametri OAuth (PKCE, State)
    const state = crypto.randomBytes(32).toString("hex");
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    // ✅ 6. Setta cookies per callback
    // Usa SameSite=Lax per permettere il ritorno dopo redirect esterno
    res.setHeader("Set-Cookie", [
      `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      `oauth_code_verifier=${codeVerifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      `oauth_user_id=${user.id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    ]);

    // ✅ 7. Costruisci Redirect URI
    // FORZA dominio production da env, fallback a studio-manager-pro.vercel.app
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL 
      || process.env.NEXT_PUBLIC_APP_URL 
      || "https://studio-manager-pro.vercel.app";
    
    const redirectUri = `${baseUrl}/api/auth/microsoft/callback`;

    console.log("[OAuth Login] Redirect URI:", {
      baseUrl,
      redirectUri,
      envSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      envAppUrl: process.env.NEXT_PUBLIC_APP_URL,
    });

    // ✅ 8. Scopes richiesti
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

    // ✅ 9. Costruisci Authorization URL
    const authUrl = new URL(`https://login.microsoftonline.com/${configData.tenant_id}/oauth2/v2.0/authorize`);
    
    authUrl.searchParams.set("client_id", configData.client_id);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("response_mode", "query");

    console.log("[OAuth Login] Authorization URL generated:", {
      userId: user.id,
      studioId,
      tenantId: configData.tenant_id,
      redirectUri,
      authUrlLength: authUrl.toString().length,
      authUrlStart: authUrl.toString().substring(0, 100) + "...",
      hasPKCE: true,
      hasState: true,
    });

    // ✅ 10. Esegui Redirect 302
    console.log("[OAuth Login] Redirecting to Microsoft (302)");
    res.redirect(302, authUrl.toString());

  } catch (error) {
    console.error("[OAuth Login] Unexpected error:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({ 
      error: "Errore interno del server",
      details: error instanceof Error ? error.message : "Errore sconosciuto"
    });
  }
}