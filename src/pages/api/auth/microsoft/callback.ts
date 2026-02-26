// src/pages/api/auth/microsoft/callback.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { createClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "@/lib/encryption365";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function getBaseUrl(req: NextApiRequest) {
  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const host = req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;

    const redirectBackBase = "/impostazioni/microsoft365";

    if (!code || !state) {
      return res.redirect(
        `${redirectBackBase}?error=1&message=${encodeURIComponent("Parametri mancanti")}`
      );
    }

    // 1) leggi cookie state
    const cookie = req.cookies["m365_state"];
    if (!cookie) {
      return res.redirect(
        `${redirectBackBase}?error=1&message=${encodeURIComponent("State mancante")}`
      );
    }

    const decoded = JSON.parse(Buffer.from(cookie, "base64url").toString("utf8"));
    if (decoded.state !== state) {
      return res.redirect(
        `${redirectBackBase}?error=1&message=${encodeURIComponent("State non valida")}`
      );
    }

    const { studioId, userId } = decoded as { studioId: string; userId: string };

    // 2) carica config studio completa (serve secret)
    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("tbmicrosoft365_config" as any)
      .select("client_id, tenant_id, client_secret_encrypted, enabled")
      .eq("studio_id", studioId)
      .single();

    if (cfgErr || !cfg || !cfg.enabled) {
      return res.redirect(
        `${redirectBackBase}?error=1&message=${encodeURIComponent("Config studio non valida")}`
      );
    }

    const clientSecret = decrypt(cfg.client_secret_encrypted);
    const redirectUri = `${getBaseUrl(req)}/api/auth/microsoft/callback`;

    // 3) MSAL app
    const msalApp = new ConfidentialClientApplication({
      auth: {
        clientId: cfg.client_id,
        authority: `https://login.microsoftonline.com/${cfg.tenant_id}`,
        clientSecret,
      },
    });

    const scopes = [
      "openid",
      "profile",
      "offline_access",
      "User.Read",
      "Calendars.ReadWrite",
      "Mail.Send",
      "OnlineMeetings.ReadWrite",
    ];

    // 4) scambia code per token
    const result = await msalApp.acquireTokenByCode({
      code,
      redirectUri,
      scopes,
    });

    if (!result?.accessToken) {
      return res.redirect(
        `${redirectBackBase}?error=1&message=${encodeURIComponent("Token non ottenuto")}`
      );
    }

    // 5) salva token cache (NON access token)
    const cachePlain = msalApp.getTokenCache().serialize();
    const token_cache_encrypted = encrypt(cachePlain);

    const { error: upErr } = await supabaseAdmin
      .from("tbmicrosoft365_user_tokens" as any)
      .upsert(
        {
          studio_id: studioId,
          user_id: userId,
          token_cache_encrypted,
          scopes: scopes.join(" "),
          revoked_at: null,
        },
        { onConflict: "studio_id,user_id" }
      );

    if (upErr) {
      console.error("[m365 callback] upsert error", upErr);
      return res.redirect(
        `${redirectBackBase}?error=1&message=${encodeURIComponent("Errore salvataggio token")}`
      );
    }

    // 6) pulisci cookie state
    res.setHeader(
      "Set-Cookie",
      `m365_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
    );

    return res.redirect(`${redirectBackBase}?success=true`);
  } catch (e: any) {
    console.error("[m365 callback] error", e);
    return res.redirect(
      `/impostazioni/microsoft365?error=1&message=${encodeURIComponent("Errore callback")}`
    );
  }
}