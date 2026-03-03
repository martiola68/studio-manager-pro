// src/pages/api/m365/graph.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { decrypt, encrypt } from "@/lib/encryption365";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ConfidentialClientApplication, LogLevel } from "@azure/msal-node";

type M365SettingsRow = {
  client_id: string;
  tenant_id: string;
  client_secret_encrypted: string;
};

type TokenRow = {
  token_cache_encrypted: string;
  scopes: string | null;
  revoked_at: string | null;
};

function buildScopes(scopesStr: string | null): string[] {
  const scopes =
    scopesStr
      ?.split(" ")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  return scopes.length ? scopes : ["User.Read"];
}

async function acquireAccessToken(studioId: string, userId: string): Promise<string> {
  const { data: tokenRow, error: tokenErr } = await supabaseAdmin
    .from("tbmicrosoft365_user_tokens")
    .select("token_cache_encrypted, scopes, revoked_at")
    .eq("studio_id", studioId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .single<TokenRow>();

  if (tokenErr || !tokenRow?.token_cache_encrypted) {
    throw new Error("Microsoft 365 non configurato o token non valido.");
  }

  const { data: settings, error: setErr } = await supabaseAdmin
    .from("tbmicrosoft_settings")
    .select("client_id, tenant_id, client_secret_encrypted")
    .eq("studio_id", studioId)
    .single<M365SettingsRow>();

  if (setErr || !settings?.client_id || !settings?.tenant_id || !settings?.client_secret_encrypted) {
    throw new Error("Microsoft 365 non configurato per lo studio (client credentials mancanti).");
  }

  const serializedCache = decrypt(tokenRow.token_cache_encrypted);
  const clientSecret = decrypt(settings.client_secret_encrypted);

  let cacheHasChanged = false;
  const cachePlugin = {
    beforeCacheAccess: async (ctx: any) => {
      ctx.tokenCache.deserialize(serializedCache);
    },
    afterCacheAccess: async (ctx: any) => {
      if (ctx.cacheHasChanged) cacheHasChanged = true;
    },
  };

  const msalApp = new ConfidentialClientApplication({
    auth: {
      clientId: settings.client_id,
      authority: `https://login.microsoftonline.com/${settings.tenant_id}`,
      clientSecret,
    },
    cache: { cachePlugin },
    system: {
      loggerOptions: { logLevel: LogLevel.Error, piiLoggingEnabled: false },
    },
  });

  const accounts = await msalApp.getTokenCache().getAllAccounts();
  const account = accounts?.[0];
  if (!account) throw new Error("Token cache Microsoft non valido (account mancante).");

  const scopes = buildScopes(tokenRow.scopes);

  const result = await msalApp.acquireTokenSilent({ account, scopes });
  const accessToken = result?.accessToken;
  if (!accessToken) throw new Error("Impossibile ottenere access token Microsoft.");

  // persist cache aggiornata
  if (cacheHasChanged) {
    const newSerialized = msalApp.getTokenCache().serialize();
    const newEncrypted = encrypt(newSerialized);

    await supabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .update({
        token_cache_encrypted: newEncrypted,
        revoked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("studio_id", studioId)
      .eq("user_id", userId);
  }

  return accessToken;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    // 1) autenticazione supabase (Bearer)
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Missing Authorization Bearer token" });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: "Invalid session" });

    const userId = userData.user.id;

    // 2) studioId da tbutenti
    const { data: uRow, error: uRowErr } = await supabaseAdmin
      .from("tbutenti")
      .select("studio_id")
      .eq("id", userId)
      .maybeSingle();

    if (uRowErr || !uRow?.studio_id) return res.status(400).json({ error: "Studio non trovato" });

    const studioId = uRow.studio_id as string;

    // 3) payload
    const { endpoint, method, body } = req.body || {};
    if (!endpoint || !method) return res.status(400).json({ error: "Missing endpoint/method" });

    const accessToken = await acquireAccessToken(studioId, userId);

    const url = endpoint.startsWith("https://")
      ? endpoint
      : `https://graph.microsoft.com/v1.0${endpoint}`;

    const graphRes = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ?? undefined,
    });

    if (graphRes.status === 204) return res.status(204).end();

    const text = await graphRes.text().catch(() => "");
    if (!graphRes.ok) return res.status(graphRes.status).send(text);

    // se è JSON valido lo rimando tale e quale
    return res.status(200).send(text || "{}");
  } catch (e: any) {
    console.error("[/api/m365/graph]", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
