// src/pages/api/m365/graph.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { decrypt, encrypt } from "@/lib/encryption365";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ConfidentialClientApplication, LogLevel, AccountInfo } from "@azure/msal-node";

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

function normalizeGraphUrl(endpoint: string): string {
  // Consenti:
  // - "/me/events" (prefisso v1.0 automatico)
  // - "/v1.0/me" o "/beta/me"
  // - URL completo "https://graph.microsoft.com/..."
  if (endpoint.startsWith("https://")) return endpoint;

  const ep = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  if (ep.startsWith("/v1.0/") || ep.startsWith("/beta/")) {
    return `https://graph.microsoft.com${ep}`;
  }

  // default: v1.0
  return `https://graph.microsoft.com/v1.0${ep}`;
}

function isAllowedGraphUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    return u.hostname === "graph.microsoft.com";
  } catch {
    return false;
  }
}

async function acquireAccessToken(studioId: string, userId: string): Promise<{ accessToken: string }> {
  // 1) cache + scopes utente
  const { data: tokenRow, error: tokenErr } = await supabaseAdmin
    .from("tbmicrosoft365_user_tokens")
    .select("token_cache_encrypted, scopes, revoked_at")
    .eq("studio_id", studioId)
    .eq("user_id", userId)
    .maybeSingle<TokenRow>();

  if (tokenErr || !tokenRow?.token_cache_encrypted) {
    throw new Error("Microsoft 365 non configurato o token cache mancante.");
  }
  if (tokenRow.revoked_at !== null) {
    throw new Error("Token Microsoft revocato: riconnetti Microsoft 365.");
  }

  // 2) settings studio
  const { data: settings, error: setErr } = await supabaseAdmin
    .from("microsoft365_config")
    .select("client_id, tenant_id, client_secret")
    .eq("studio_id", studioId)
    .single<{ client_id: string; tenant_id: string; client_secret: string }>();

  if (setErr || !settings?.client_id || !settings?.tenant_id || !settings?.client_secret) {
    throw new Error("Microsoft 365 non configurato per lo studio (client credentials mancanti).");
  }

  // 3) decrypt cache + secret
  const oldSerializedCache = decrypt(tokenRow.token_cache_encrypted);
  const clientSecret = decrypt(settings.client_secret); // come hai indicato tu

  // 4) msal app + deserialize cache
  const msalApp = new ConfidentialClientApplication({
    auth: {
      clientId: settings.client_id,
      authority: `https://login.microsoftonline.com/${settings.tenant_id}`,
      clientSecret,
    },
    system: {
      loggerOptions: { logLevel: LogLevel.Error, piiLoggingEnabled: false },
    },
  });

  msalApp.getTokenCache().deserialize(oldSerializedCache);

  // 5) account
  const accounts = await msalApp.getTokenCache().getAllAccounts();
  const account: AccountInfo | undefined = accounts?.[0];
  if (!account) throw new Error("Token cache Microsoft non valido (account mancante).");

  // 6) silent token (MSAL usa refresh internamente)
  const scopes = buildScopes(tokenRow.scopes);
  let result;
  try {
    result = await msalApp.acquireTokenSilent({ account, scopes });
  } catch (e: any) {
    // tipico: refresh token scaduto/invalid_grant/interaction_required
    throw new Error(
      `Impossibile ottenere access token Microsoft in silent: riconnetti Microsoft 365. (${e?.message ?? "silent_failed"})`
    );
  }

  const accessToken = result?.accessToken;
  if (!accessToken) throw new Error("Impossibile ottenere access token Microsoft.");

  // 7) salva cache aggiornata (rotazione refresh token ecc.)
  const newSerializedCache = msalApp.getTokenCache().serialize();
  if (newSerializedCache && newSerializedCache !== oldSerializedCache) {
    const newEncrypted = encrypt(newSerializedCache);

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

  return { accessToken };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    // 1) auth supabase (Bearer)
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

    const url = normalizeGraphUrl(String(endpoint));
    if (!isAllowedGraphUrl(url)) return res.status(400).json({ error: "Endpoint non consentito (solo graph.microsoft.com)" });

    const httpMethod = String(method).toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(httpMethod)) {
      return res.status(400).json({ error: "Metodo non supportato" });
    }

    const { accessToken } = await acquireAccessToken(studioId, userId);

    const graphRes = await fetch(url, {
      method: httpMethod,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(httpMethod !== "GET" && httpMethod !== "DELETE"
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body:
        httpMethod !== "GET" && httpMethod !== "DELETE" && body != null
          ? typeof body === "string"
            ? body
            : JSON.stringify(body)
          : undefined,
    });

    if (graphRes.status === 204) return res.status(204).end();

    const ct = graphRes.headers.get("content-type") || "";
    const raw = await graphRes.text().catch(() => "");

    if (!graphRes.ok) {
      // rimando l’errore di Graph così com’è, evitando 500 “nostri”
      return res.status(graphRes.status).send(raw || "{}");
    }

    // Se è JSON valido, rimando JSON; altrimenti testo.
    if (ct.includes("application/json")) {
      try {
        return res.status(200).json(JSON.parse(raw || "{}"));
      } catch {
        return res.status(200).send(raw || "{}");
      }
    }

    return res.status(200).send(raw || "");
  } catch (e: any) {
    console.error("[/api/m365/graph]", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
