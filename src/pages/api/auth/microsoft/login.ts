import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("[OAuth Login] Request received:", {
      host: req.headers.host,
      origin: req.headers.origin,
      cookies: Object.keys(req.cookies),
    });

    const supabase = createClient(req, res);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    console.log("[OAuth Login] Session check:", {
      authenticated: !!session,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      sessionError: sessionError?.message,
    });

    if (!session) {
      console.log("[OAuth Login] No session - returning 401");
      return res.status(401).json({
        error: "Non autenticato",
        details: "Sessione non valida. Effettua il login.",
      });
    }

    const user = session.user;

    console.log("[OAuth Login] User authenticated:", {
      userId: user.id,
      email: user.email,
    });

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

    console.log("[OAuth Login] Redirect URI:", {
      baseUrl,
      redirectUri,
      envSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      envAppUrl: process.env.NEXT_PUBLIC_APP_URL,
    });

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