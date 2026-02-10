import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("🔄 Microsoft Callback ricevuto");
    
    const { code, state, error } = req.query;

    if (error) {
      console.error("❌ Errore OAuth Microsoft:", error);
      return res.send(`
        <html>
          <body>
            <script>
              window.opener?.postMessage({ type: 'oauth_error', error: '${error}' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    if (!code || typeof code !== "string") {
      console.error("❌ Code mancante nel callback");
      return res.send(`
        <html>
          <body>
            <script>
              window.opener?.postMessage({ type: 'oauth_error', error: 'no_code' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    if (!state || typeof state !== "string") {
      console.error("❌ State mancante nel callback");
      return res.send(`
        <html>
          <body>
            <script>
              window.opener?.postMessage({ type: 'oauth_error', error: 'no_state' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    console.log("✅ Code ricevuto (length):", code.length);
    console.log("🔐 State ricevuto, decodifico...");

    const stateData = JSON.parse(Buffer.from(state, "base64").toString());
    const { user_id, studio_id } = stateData;

    console.log("📋 State decodificato:", { user_id, studio_id });

    if (!user_id || !studio_id) {
      console.error("❌ State invalido - user_id o studio_id mancante");
      return res.send(`
        <html>
          <body>
            <script>
              window.opener?.postMessage({ type: 'oauth_error', error: 'invalid_state' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("🔍 Recupero configurazione Microsoft per studio:", studio_id);

    const { data: config, error: configError } = await supabase
      .from("microsoft365_config")
      .select("client_id, client_secret, tenant_id")
      .eq("studio_id", studio_id)
      .single();

    if (configError || !config) {
      console.error("❌ Configurazione non trovata:", configError);
      return res.send(`
        <html>
          <body>
            <script>
              window.opener?.postMessage({ type: 'oauth_error', error: 'config_not_found' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    console.log("✅ Configurazione trovata, scambio code per token...");

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://studio-manager-pro.vercel.app"}/api/auth/microsoft/callback`;

    console.log("🔗 Redirect URI per token:", redirectUri);
    console.log("🔑 Richiesta token a Microsoft...");

    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: config.client_id,
          client_secret: config.client_secret,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("❌ Errore scambio token:", errorData);
      return res.send(`
        <html>
          <body>
            <script>
              window.opener?.postMessage({ type: 'oauth_error', error: 'token_exchange_failed', details: ${JSON.stringify(errorData)} }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    const tokens = await tokenResponse.json();
    console.log("✅ Token ricevuti da Microsoft");
    console.log("📊 Token info:", {
      has_access_token: !!tokens.access_token,
      has_refresh_token: !!tokens.refresh_token,
      expires_in: tokens.expires_in
    });

    // Decodifica e logga i dettagli del token per debug
    if (tokens.access_token) {
      try {
        const decodedToken = jwt.decode(tokens.access_token) as any;
        console.log("🔍 DECODED ACCESS TOKEN:");
        console.log("   - AUD (Audience):", decodedToken?.aud); // Deve essere https://graph.microsoft.com
        console.log("   - SCP (Scopes):", decodedToken?.scp);   // Deve contenere Team.ReadBasic.All
        console.log("   - ISS (Issuer):", decodedToken?.iss);
        console.log("   - EXP (Expires):", new Date((decodedToken?.exp || 0) * 1000).toISOString());
        
        if (decodedToken?.aud !== "https://graph.microsoft.com" && decodedToken?.aud !== "00000003-0000-0000-c000-000000000000") {
          console.error("⚠️ ATTENZIONE: L'audience del token non è Graph API! Potrebbe essere un ID Token scambiato per Access Token.");
        }
      } catch (e) {
        console.error("❌ Errore decodifica token per debug:", e);
      }
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    console.log("💾 Salvataggio token nel database...");
    console.log("📋 User ID:", user_id);
    console.log("⏰ Scadenza:", expiresAt);

    const { error: saveError } = await supabase
      .from("tbmicrosoft_tokens" as any)
      .upsert({
        user_id: user_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      });

    if (saveError) {
      console.error("❌ Errore salvataggio token:", saveError);
      return res.send(`
        <html>
          <body>
            <script>
              window.opener?.postMessage({ type: 'oauth_error', error: 'save_failed', details: ${JSON.stringify(saveError)} }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    console.log("✅ Token salvati con successo!");
    console.log("🎉 OAuth completato - chiudo popup");

    return res.send(`
      <html>
        <body>
          <script>
            console.log('✅ OAuth Microsoft completato con successo!');
            window.opener?.postMessage({ type: 'oauth_success' }, '*');
            setTimeout(() => window.close(), 500);
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error("❌ Errore callback Microsoft:", error);
    return res.send(`
      <html>
        <body>
          <script>
            window.opener?.postMessage({ type: 'oauth_error', error: 'unexpected', details: '${error.message}' }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
  }
}