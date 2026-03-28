// src/pages/api/microsoft365/graph.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * ============================================================
 * CONFIG
 * ============================================================
 * Se nel tuo progetto il nome reale della tabella token cache
 * è diverso, cambia solo TOKENS_TABLE.
 */

const CONNECTIONS_TABLE = "microsoft365_connections";
const TOKENS_TABLE = "microsoft_token_cache"; // <-- cambia qui solo se nel progetto ha un nome diverso

const GRAPH_BASE_URL = "https://graph.microsoft.com";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

type MicrosoftConnectionRow = {
  id: string;
  user_id?: string | null;
  studio_id?: string | null;
  nome?: string | null;
  name?: string | null;
  tenant_id?: string | null;
  client_id?: string | null;
  client_secret?: string | null;
  active?: boolean | null;
  enabled?: boolean | null;
  is_default?: boolean | null;
  [key: string]: unknown;
};

type TokenCacheRow = {
  id?: string;
  user_id?: string | null;
  microsoft_connection_id?: string | null;
  connection_id?: string | null;
  tenant_id?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: string | null;
  token_type?: string | null;
  scope?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

type ApiError = {
  error: string;
  details?: unknown;
};

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function getBearerTokenFromRequest(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function getAuthenticatedUserId(
  req: NextApiRequest
): Promise<string | null> {
  try {
    const jwt = getBearerTokenFromRequest(req);
    if (!jwt) return null;

    const supabase = createClient(
      getEnv("NEXT_PUBLIC_SUPABASE_URL"),
      getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        },
      }
    );

    const { data, error } = await supabase.auth.getUser(jwt);
    if (error || !data?.user?.id) return null;

    return data.user.id;
  } catch {
    return null;
  }
}

function readMicrosoftConnectionId(req: NextApiRequest): string | null {
  const headerValue =
    (req.headers["x-microsoft-connection-id"] as string | undefined) ??
    (req.headers["x-microsoftconnectionid"] as string | undefined);

  const queryValue =
    typeof req.query.microsoftConnectionId === "string"
      ? req.query.microsoftConnectionId
      : typeof req.query.connectionId === "string"
      ? req.query.connectionId
      : null;

  const bodyValue =
    req.body && typeof req.body === "object"
      ? typeof req.body.microsoftConnectionId === "string"
        ? req.body.microsoftConnectionId
        : typeof req.body.connectionId === "string"
        ? req.body.connectionId
        : null
      : null;

  return headerValue || queryValue || bodyValue || null;
}

function readGraphPath(req: NextApiRequest): string {
  const fromQuery =
    typeof req.query.path === "string"
      ? req.query.path
      : Array.isArray(req.query.path)
      ? req.query.path.join("/")
      : "";

  const fromBody =
    req.body && typeof req.body === "object" && typeof req.body.path === "string"
      ? req.body.path
      : "";

  const raw = fromQuery || fromBody || "";

  if (!raw) {
    throw new Error("Missing Graph path");
  }

  return raw.startsWith("/") ? raw : `/${raw}`;
}

function readGraphMethod(req: NextApiRequest): string {
  if (req.body && typeof req.body === "object" && typeof req.body.method === "string") {
    return req.body.method.toUpperCase();
  }
  return (req.method || "GET").toUpperCase();
}

function readGraphQuery(req: NextApiRequest): Record<string, string> {
  const bodyQuery =
    req.body && typeof req.body === "object" && req.body.query && typeof req.body.query === "object"
      ? req.body.query
      : {};

  const queryParams: Record<string, string> = {};

  for (const [key, value] of Object.entries(req.query)) {
    if (key === "path" || key === "microsoftConnectionId" || key === "connectionId") continue;
    if (typeof value === "string") queryParams[key] = value;
    if (Array.isArray(value)) queryParams[key] = value[value.length - 1] ?? "";
  }

  for (const [key, value] of Object.entries(bodyQuery)) {
    if (typeof value === "string") queryParams[key] = value;
  }

  return queryParams;
}

function buildGraphUrl(path: string, query: Record<string, string>): string {
  const url = new URL(`${GRAPH_BASE_URL}${path}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

function isConnectionEnabled(connection: MicrosoftConnectionRow): boolean {
  if (typeof connection.enabled === "boolean") return connection.enabled;
  if (typeof connection.active === "boolean") return connection.active;
  return true;
}

async function loadUserConnections(
  supabase: SupabaseClient,
  userId: string
): Promise<MicrosoftConnectionRow[]> {
  const { data, error } = await supabase
    .from(CONNECTIONS_TABLE)
    .select("*")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Errore lettura connessioni Microsoft: ${error.message}`);
  }

  return (data ?? []) as MicrosoftConnectionRow[];
}

function resolveConnection(
  connections: MicrosoftConnectionRow[],
  requestedId: string | null
): MicrosoftConnectionRow | null {
  const enabledConnections = connections.filter(isConnectionEnabled);

  if (requestedId) {
    const exact = enabledConnections.find((c) => c.id === requestedId);
    if (exact) return exact;
    return null;
  }

  const explicitDefault = enabledConnections.find((c) => c.is_default === true);
  if (explicitDefault) return explicitDefault;

  return enabledConnections[0] ?? null;
}

async function loadCachedTokenForConnection(
  supabase: SupabaseClient,
  userId: string,
  connection: MicrosoftConnectionRow
): Promise<TokenCacheRow | null> {
  /**
   * Filtriamo SEMPRE per:
   * - user_id
   * - connessione
   *
   * Supportiamo sia microsoft_connection_id sia connection_id
   * perché in alcuni progetti storici cambia il nome colonna.
   */

  let lastError: unknown = null;

  // Tentativo 1: microsoft_connection_id
  {
    const { data, error } = await supabase
      .from(TOKENS_TABLE)
      .select("*")
      .eq("user_id", userId)
      .eq("microsoft_connection_id", connection.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data as TokenCacheRow;
    }

    if (!error && !data) {
      // nessun token, proseguiamo col fallback
    } else {
      lastError = error;
    }
  }

  // Tentativo 2: connection_id
  {
    const { data, error } = await supabase
      .from(TOKENS_TABLE)
      .select("*")
      .eq("user_id", userId)
      .eq("connection_id", connection.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data as TokenCacheRow;
    }

    if (!error && !data) {
      // nessun token
    } else {
      lastError = error;
    }
  }

  // Tentativo 3: fallback stretto su user_id + tenant_id
  // utile solo se il progetto storico non salvava il riferimento diretto alla connessione
  if (connection.tenant_id) {
    const { data, error } = await supabase
      .from(TOKENS_TABLE)
      .select("*")
      .eq("user_id", userId)
      .eq("tenant_id", connection.tenant_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data as TokenCacheRow;
    }

    if (error) {
      lastError = error;
    }
  }

  if (lastError) {
    console.error("Errore token cache:", lastError);
  }

  return null;
}

function isTokenExpired(token: TokenCacheRow | null): boolean {
  if (!token?.expires_at) return false;

  const expiresAtMs = new Date(token.expires_at).getTime();
  if (Number.isNaN(expiresAtMs)) return false;

  // margine di sicurezza di 60 secondi
  return expiresAtMs <= Date.now() + 60_000;
}

async function refreshAccessToken(params: {
  connection: MicrosoftConnectionRow;
  cachedToken: TokenCacheRow;
  supabase: SupabaseClient;
  userId: string;
}): Promise<TokenCacheRow | null> {
  const { connection, cachedToken, supabase, userId } = params;

  const tenantId = connection.tenant_id;
  const clientId = connection.client_id;
  const clientSecret = connection.client_secret;
  const refreshToken = cachedToken.refresh_token;

  if (!tenantId || !clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);
  body.set(
    "scope",
    typeof cachedToken.scope === "string" && cachedToken.scope.trim()
      ? cachedToken.scope
      : "https://graph.microsoft.com/.default offline_access"
  );

  const resp = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const payload = await resp.json().catch(() => null);

  if (!resp.ok || !payload?.access_token) {
    console.error("Refresh token Microsoft fallito:", payload);
    return null;
  }

  const expiresIn = Number(payload.expires_in ?? 3600);
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const updatePayload = {
    user_id: userId,
    microsoft_connection_id: connection.id,
    tenant_id: tenantId,
    access_token: payload.access_token as string,
    refresh_token: (payload.refresh_token as string) || refreshToken,
    expires_at: expiresAt,
    token_type: (payload.token_type as string) || "Bearer",
    scope:
      (payload.scope as string) ||
      (typeof cachedToken.scope === "string" ? cachedToken.scope : null),
    updated_at: new Date().toISOString(),
  };

  // upsert 1: usando microsoft_connection_id
  {
    const { error } = await supabase.from(TOKENS_TABLE).upsert(updatePayload, {
      onConflict: "user_id,microsoft_connection_id",
    });

    if (!error) {
      return updatePayload;
    }
  }

  // fallback update per schemi legacy
  {
    const { error } = await supabase
      .from(TOKENS_TABLE)
      .update(updatePayload)
      .eq("user_id", userId)
      .eq("tenant_id", tenantId);

    if (!error) {
      return updatePayload;
    }
  }

  return updatePayload;
}

function readForwardHeaders(req: NextApiRequest): HeadersInit {
  const contentType = req.headers["content-type"];
  const prefer = req.headers["prefer"];
  const consistencyLevel = req.headers["consistencylevel"] || req.headers["consistency-level"];

  const headers: Record<string, string> = {};

  if (typeof contentType === "string") headers["Content-Type"] = contentType;
  if (typeof prefer === "string") headers["Prefer"] = prefer;
  if (typeof consistencyLevel === "string") {
    headers["ConsistencyLevel"] = consistencyLevel;
  }

  return headers;
}

function readForwardBody(req: NextApiRequest, method: string): BodyInit | undefined {
  if (method === "GET" || method === "HEAD") return undefined;

  const body = req.body;

  if (body == null) return undefined;

  if (typeof body === "string") return body;

  if (typeof body === "object") {
    // rimuoviamo i campi di controllo interni
    const {
      path,
      method: _method,
      query,
      microsoftConnectionId,
      connectionId,
      ...rest
    } = body;

    return JSON.stringify(rest);
  }

  return undefined;
}

function setPassthroughResponse(
  res: NextApiResponse,
  upstream: Response,
  data: unknown
) {
  res.status(upstream.status);

  const contentType = upstream.headers.get("content-type");
  if (contentType) {
    res.setHeader("Content-Type", contentType);
  }

  const etag = upstream.headers.get("etag");
  if (etag) {
    res.setHeader("ETag", etag);
  }

  const odataVersion = upstream.headers.get("odata-version");
  if (odataVersion) {
    res.setHeader("OData-Version", odataVersion);
  }

  res.send(data as Json);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Json | ApiError>
) {
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    const userId = await getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        error: "Utente non autenticato",
      });
    }

    const supabase = getSupabaseAdmin();
    const requestedConnectionId = readMicrosoftConnectionId(req);
    const graphPath = readGraphPath(req);
    const graphMethod = readGraphMethod(req);
    const graphQuery = readGraphQuery(req);

    const userConnections = await loadUserConnections(supabase, userId);

    if (!userConnections.length) {
      return res.status(404).json({
        error: "Nessuna connessione Microsoft configurata per questo utente",
      });
    }

    const selectedConnection = resolveConnection(
      userConnections,
      requestedConnectionId
    );

    if (!selectedConnection) {
      return res.status(404).json({
        error: requestedConnectionId
          ? "Connessione Microsoft non trovata o non abilitata"
          : "Nessuna connessione Microsoft valida disponibile",
      });
    }

    let cachedToken = await loadCachedTokenForConnection(
      supabase,
      userId,
      selectedConnection
    );

    if (!cachedToken) {
      return res.status(401).json({
        error: "Token Microsoft non trovato per la connessione selezionata",
        details: {
          connectionId: selectedConnection.id,
          tenantId: selectedConnection.tenant_id ?? null,
        },
      });
    }

    if (isTokenExpired(cachedToken)) {
      const refreshed = await refreshAccessToken({
        connection: selectedConnection,
        cachedToken,
        supabase,
        userId,
      });

      if (refreshed?.access_token) {
        cachedToken = refreshed;
      }
    }

    if (!cachedToken?.access_token) {
      return res.status(401).json({
        error: "Access token Microsoft non disponibile",
        details: {
          connectionId: selectedConnection.id,
        },
      });
    }

    const graphUrl = buildGraphUrl(graphPath, graphQuery);

    const upstream = await fetch(graphUrl, {
      method: graphMethod,
      headers: {
        ...readForwardHeaders(req),
        Authorization: `Bearer ${cachedToken.access_token}`,
      },
      body: readForwardBody(req, graphMethod),
    });

    const upstreamContentType = upstream.headers.get("content-type") || "";

    if (upstreamContentType.includes("application/json")) {
      const payload = await upstream.json().catch(() => null);
      return setPassthroughResponse(res, upstream, payload);
    }

    const text = await upstream.text().catch(() => "");
    return setPassthroughResponse(res, upstream, text);
  } catch (error) {
    console.error("Errore API /api/microsoft365/graph:", error);

    return res.status(500).json({
      error: "Errore interno Microsoft Graph proxy",
      details: error instanceof Error ? error.message : error,
    });
  }
}
