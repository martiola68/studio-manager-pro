import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error("Microsoft OAuth error:", error);
      return res.redirect("/impostazioni/microsoft365?error=auth_failed");
    }

    if (!code || typeof code !== "string") {
      return res.redirect("/impostazioni/microsoft365?error=no_code");
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
    const tenantId = process.env.MICROSOFT_TENANT_ID || "common";

    if (!clientId || !clientSecret || !redirectUri) {
      return res.redirect("/impostazioni/microsoft365?error=config_missing");
    }

    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Token exchange error:", errorData);
      return res.redirect("/impostazioni/microsoft365?error=token_exchange_failed");
    }

    const tokens = await tokenResponse.json();

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.id) {
      return res.redirect("/login?error=not_authenticated");
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // @ts-ignore - Table not yet in types
    const { error: saveError } = await supabase
      .from("tbmicrosoft_tokens" as any)
      .upsert({
        user_id: session.user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      });

    if (saveError) {
      console.error("Error saving tokens:", saveError);
      return res.redirect("/impostazioni/microsoft365?error=save_failed");
    }

    let redirectUrl = "/impostazioni/microsoft365?success=true";
    
    if (state && typeof state === "string") {
      try {
        const stateData = JSON.parse(Buffer.from(state, "base64").toString());
        if (stateData.redirect) {
          redirectUrl = `${stateData.redirect}?success=true`;
        }
      } catch (e) {
        console.error("Error parsing state:", e);
      }
    }

    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Microsoft callback error:", error);
    res.redirect("/impostazioni/microsoft365?error=unexpected");
  }
}