import type { NextApiRequest, NextApiResponse } from "next";
import { decrypt, encrypt } from "@/lib/encryption365";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  ConfidentialClientApplication,
  LogLevel,
  AccountInfo,
} from "@azure/msal-node";

export function getDecryptedClientSecret(encryptedSecret: string) {
  if (!encryptedSecret) {
    throw new Error("client_secret mancante");
  }

  const plain = decrypt(encryptedSecret);

  if (!plain || plain.length < 20) {
    throw new Error("client_secret decrypt fallito o troppo corto");
  }

  return plain;
}

type TokenRow = {
  token_cache_encrypted: string;
  scopes: string | null;
  revoked_at: string | null;
  microsoft_connection_id: string | null;
};

type ConnectionRow = {
  id: string;
  studio_id: string;
  nome_connessione: string;
  tenant_id: string | null;
  client_id: string | null;
  client_secret: string | null;
  enabled: boolean;
  connected_email: string | null;
  organizer_email: string | null;
  is_default: boolean;
  sort_order: number;
};

type ResolvedConnection = ConnectionRow & {
  tenant_id: string;
  client_id: string;
  client_secret: string;
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
  if (endpoint.startsWith("https://")) {
    return endpoint;
  }

  const ep = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  if (ep.startsWith("/v1.0/") || ep.startsWith("/beta/")) {
    return `https://graph.microsoft.com${ep}`;
  }

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

async function resolveMicrosoftConnection(
  studioId: string,
  userId: string
): Promise<ResolvedConnection> {
  const { data: utente, error: utenteErr } = await supabaseAdmin
    .from("tbutenti")
    .select("id, studio_id, microsoft_connection_id")
    .eq("id", userId)
    .single();

  if (utenteErr || !utente?.studio_id) {
    throw new Error("Utente/studio non trovato per Microsoft 365.");
  }

  let connection: ConnectionRow | null = null;

  if (utente.microsoft_connection_id) {
    const { data, error } = await supabaseAdmin
      .from("microsoft365_connections")
      .select(
        "id, studio_id, nome_connessione, tenant_id, client_id, client_secret, enabled, connected_email, organizer_email, is_default, sort_order"
      )
      .eq("id", utente.microsoft_connection_id)
      .eq("studio_id", studioId)
      .eq("enabled", true)
      .single<ConnectionRow>();

    if (!error && data) {
      connection = data;
    }
  }

  if (!connection) {
    const { data, error } = await supabaseAdmin
      .from("microsoft365_connections")
      .select(
        "id, studio_id, nome_connessione, tenant_id, client_id, client_secret, enabled, connected_email, organizer_email, is_default, sort_order"
      )
      .eq("studio_id", studioId)
      .eq("enabled", true)
      .eq("is_default", true)
      .single<ConnectionRow>();

    if (!error && data) {
      connection = data;
    }
  }

  if (!connection) {
    const { data, error } = await supabaseAdmin
      .from("microsoft365_connections")
      .select(
        "id, studio_id, nome_connessione, tenant_id, client_id, client_secret, enabled, connected_email, organizer_email, is_default, sort_order"
      )
      .eq("studio_id", studioId)
      .eq("enabled", true)
      .order("sort_order", { ascending: true })
      .limit(1)
      .single<ConnectionRow>();

    if (!error && data) {
      connection = data;
    }
  }

  if (!connection) {
    throw new Error("Connessione Microsoft 365 non trovata o non attiva.");
  }

  const { client_id, tenant_id, client_secret } = connection;

  if (!client_id || !tenant_id || !client_secret) {
    throw new Error(
      `Connessione Microsoft incompleta: ${connection.nome_connessione}`
    );
  }

  return {
    ...connection,
    client_id,
    tenant_id,
    client_secret,
  };
}

async function acquireAccessToken(
  studioId: string,
  userId: string
): Promise<{ accessToken: string; connection: ResolvedConnection }> {
  const connection = await resolveMicrosoftConnection(studioId, userId);

  const { data: tokenRow, error: tokenErr } = await supabaseAdmin
    .from("tbmicrosoft365_user_tokens")
    .select(
      "token_cache_encrypted, scopes, revoked_at, microsoft_connection_id"
    )
    .eq("studio_id", studioId)
    .eq("user_id", userId)
    .eq("microsoft_connection_id", connection.id)
    .maybeSingle<TokenRow>();

  if (tokenErr || !tokenRow?.token_cache_encrypted) {
    throw new Error(
      `Microsoft 365 non configurato o token cache mancante per la connessione ${connection.nome_connessione}. Riconnetti Microsoft 365.`
    );
  }

  if (tokenRow.revoked_at !== null) {
    throw new Error(
      `Token Microsoft revocato per la connessione ${connection.nome_connessione}: riconnetti Microsoft 365.`
    );
  }

  const oldSerializedCache = decrypt(tokenRow.token_cache_encrypted);
  const clientSecret = decrypt(connection.client_secret);

  const msalApp = new ConfidentialClientApplication({
    auth: {
      clientId: connection.client_id,
      authority: `https://login.microsoftonline.com/${connection.tenant_id}`,
      clientSecret,
    },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Error,
        piiLoggingEnabled: false,
      },
    },
  });

  msalApp.getTokenCache().deserialize(oldSerializedCache);

  const accounts = await msalApp.getTokenCache().getAllAccounts();
  const account: AccountInfo | undefined = accounts?.[0];

  if (!account) {
    throw new Error(
      `Token cache Microsoft non valido per la connessione ${connection.nome_connessione} (account mancante).`
    );
  }

  const scopes = buildScopes(tokenRow.scopes);

  let result;
  try {
    result = await msalApp.acquireTokenSilent({ account, scopes });
  } catch (e: any) {
    throw new Error(
      `Impossibile ottenere access token Microsoft in silent: riconnetti Microsoft 365. (${e?.message ?? "silent_failed"})`
    );
  }

  const accessToken = result?.accessToken;
  if (!accessToken) {
    throw new Error("Impossibile ottenere access token Microsoft.");
  }

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
      .eq("user_id", userId)
      .eq("microsoft_connection_id", connection.id);
  }

  return { accessToken, connection };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return res
        .status(401)
        .json({ error: "Missing Authorization Bearer token" });
    }

    const { data: userData, error: userErr } =
      await supabaseAdmin.auth.getUser(token);

    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const userId = userData.user.id;

    const { data: uRow, error: uRowErr } = await supabaseAdmin
      .from("tbutenti")
      .select("studio_id")
      .eq("id", userId)
      .maybeSingle();

    if (uRowErr || !uRow?.studio_id) {
      return res.status(400).json({ error: "Studio non trovato" });
    }

    const studioId = uRow.studio_id as string;

    const { endpoint, method, body } = req.body || {};
    if (!endpoint || !method) {
      return res.status(400).json({ error: "Missing endpoint/method" });
    }

    const url = normalizeGraphUrl(String(endpoint));
    if (!isAllowedGraphUrl(url)) {
      return res.status(400).json({
        error: "Endpoint non consentito (solo graph.microsoft.com)",
      });
    }

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

    if (graphRes.status === 204) {
      return res.status(204).end();
    }

    const ct = graphRes.headers.get("content-type") || "";
    const raw = await graphRes.text().catch(() => "");

    if (!graphRes.ok) {
      return res.status(graphRes.status).send(raw || "{}");
    }

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
