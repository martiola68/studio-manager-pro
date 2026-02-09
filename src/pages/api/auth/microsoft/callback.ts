import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

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
    const { code, state, error } = req.query;

    if (error) {
      console.error("Microsoft OAuth error:", error);
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

    const stateData = JSON.parse(Buffer.from(state, "base64").toString());
    const { user_id, studio_id } = stateData;

    if (!user_id || !studio_id) {
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

    const { data: config, error: configError } = await supabase
      .from("microsoft365_config")
      .select("client_id, client_secret, tenant_id")
      .eq("studio_id", studio_id)
      .single();

    if (configError || !config) {
      console.error("Config error:", configError);
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

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://studio-manager-pro.vercel.app"}/api/auth/microsoft/callback`;

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
      console.error("Token exchange error:", errorData);
      return res.send(`
        <html>
          <body>
            <script>
              window.opener?.postMessage({ type: 'oauth_error', error: 'token_exchange_failed' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    const tokens = await tokenResponse.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

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
      console.error("Error saving tokens:", saveError);
      return res.send(`
        <html>
          <body>
            <script>
              window.opener?.postMessage({ type: 'oauth_error', error: 'save_failed' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    return res.send(`
      <html>
        <body>
          <script>
            window.opener?.postMessage({ type: 'oauth_success' }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Microsoft callback error:", error);
    return res.send(`
      <html>
        <body>
          <script>
            window.opener?.postMessage({ type: 'oauth_error', error: 'unexpected' }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
  }
}