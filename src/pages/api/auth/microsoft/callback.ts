import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";

/**
 * Callback endpoint per OAuth Microsoft
 * GET /api/auth/microsoft/callback?code=xxx&state=user_id
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { code, state, error: oauthError } = req.query;

    // Gestione errori OAuth
    if (oauthError) {
      console.error("❌ OAuth error:", oauthError);
      return res.send(`
        <html>
          <body>
            <h2>❌ Errore Autenticazione</h2>
            <p>${oauthError}</p>
            <script>
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `);
    }

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Authorization code is required" });
    }

    if (!state || typeof state !== "string") {
      return res.status(400).json({ error: "User ID (state) is required" });
    }

    const userId = state;

    // Credenziali Microsoft
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const tenantId = process.env.MICROSOFT_TENANT_ID;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

    if (!clientId || !clientSecret || !tenantId || !redirectUri) {
      throw new Error("Microsoft 365 configuration missing");
    }

    console.log("🔐 [Microsoft Callback] Exchanging code for token...");
    console.log("🔐 [Microsoft Callback] User ID:", userId);

    // Scambia authorization code per access token
    const tokenParams = new URLSearchParams();
    tokenParams.append("client_id", clientId);
    tokenParams.append("client_secret", clientSecret);
    tokenParams.append("code", code);
    tokenParams.append("redirect_uri", redirectUri);
    tokenParams.append("grant_type", "authorization_code");

    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenParams,
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("❌ Token exchange failed:", errorText);
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    console.log("✅ [Microsoft Callback] Token received");

    // Calcola scadenza token (expires_in è in secondi)
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    console.log("💾 [Microsoft Callback] Saving token to database...");
    console.log("💾 [Microsoft Callback] User ID:", userId);
    console.log("💾 [Microsoft Callback] Expires at:", expiresAt.toISOString());

    // Prima elimina eventuali token esistenti per questo utente
    await supabase
      .from("tbmicrosoft_tokens")
      .delete()
      .eq("user_id", userId);

    // Poi inserisci il nuovo token
    const { error: upsertError } = await supabase
      .from("tbmicrosoft_tokens")
      .insert({
        user_id: userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      console.error("❌ Database error:", upsertError);
      throw new Error(`Database error: ${upsertError.message}`);
    }

    console.log("✅ [Microsoft Callback] Token saved successfully");

    // Pagina di successo con auto-close
    res.send(`
      <html>
        <head>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 2rem;
              border-radius: 1rem;
              box-shadow: 0 10px 30px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 400px;
            }
            .icon {
              font-size: 4rem;
              margin-bottom: 1rem;
            }
            h2 {
              color: #10b981;
              margin: 0 0 1rem 0;
            }
            p {
              color: #6b7280;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✅</div>
            <h2>Account Connesso!</h2>
            <p>Microsoft 365 è stato collegato con successo.</p>
            <p style="margin-top: 1rem; font-size: 0.875rem;">Questa finestra si chiuderà automaticamente...</p>
          </div>
          <script>
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error("❌ Callback error:", error);
    
    res.send(`
      <html>
        <head>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f87171 0%, #dc2626 100%);
            }
            .container {
              background: white;
              padding: 2rem;
              border-radius: 1rem;
              box-shadow: 0 10px 30px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 400px;
            }
            .icon {
              font-size: 4rem;
              margin-bottom: 1rem;
            }
            h2 {
              color: #dc2626;
              margin: 0 0 1rem 0;
            }
            p {
              color: #6b7280;
              margin: 0.5rem 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h2>Errore Connessione</h2>
            <p>${error.message || "Si è verificato un errore"}</p>
            <p style="margin-top: 1rem; font-size: 0.875rem;">Questa finestra si chiuderà automaticamente...</p>
          </div>
          <script>
            setTimeout(() => {
              window.close();
            }, 5000);
          </script>
        </body>
      </html>
    `);
  }
}