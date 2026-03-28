// src/pages/api/microsoft365/graph.ts

import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { ConfidentialClientApplication, LogLevel, AccountInfo } from "@azure/msal-node";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/encryption365";

const CONNECTIONS_TABLE = "microsoft365_connections";
const TOKENS_TABLE = "tbmicrosoft365_user_tokens";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

type ApiError = {
  error: string;
  details?: unknown;
};

type AuthUser = {
  id: string;
  email?: string | null;
};

type StudioUserRow = {
  id: string;
  studio_id: string;
  email?: string | null;
};

type MicrosoftConnectionRow = {
  id: string;
  studio_id?: string | null;
  user_id?: string | null;
  nome?: string | null;
  name?: string | null;
  tenant_id?: string | null;
  client_id?: string | null;
  client_secret?: string | null;
  encrypted_client_secret?: string | null;
  enabled?: boolean | null;
  active?: boolean | null;
  is_default?: boolean | null;
  [key: string]: unknown;
};

type Microsoft365ConfigRow = {
  client_id?: string | null;
  tenant_id?: string | null;
  client_secret?: string | null;
  enabled?: boolean | null;
};

type TokenRow = {
  id: string;
  studio_id: string;
  user_id: string;
  token_cache_encrypted: string;
  scopes?: string | null;
  connected_at?: string | null;
  updated_at?: string | null;
  revoked_at?: string | null;
  microsoft_connection_id?: string | null;
};

type GraphProxyBody = {
  path?: string;
  method?: string;
  query?: Record<string, unknown>;
  body?: unknown;
  scopes?: string[];
  microsoftConnectionId?: string;
  connectionId?: string;
};

function getBearerToken(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function getAuthUser(req: NextApiRequest): Promise<{ user: AuthUser; token: string } | { error: string }> {
  const token = getBearerToken(req);
  if (!token) return { error: "Missing Authorization Bearer token" };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return { error: "Utente non autenticato" };
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
    },
    token,
  };
}

async function getUtenteStudio(authUser: AuthUser): Promise<{ utente: StudioUserRow } | { error: string }> {
  const orParts: string[] = [`id.eq.${authUser.id}`];
  if (authUser.email) {
    orParts.push(`email.eq.${authUser.email}`);
  }

  const { data, error } = await supabaseAdmin
    .from("tbutenti")
    .select("id, studio_id, email")
    .or(orParts.join(","))
    .maybeSingle();

  if (error || !data?.studio_id) {
    return { error: "Studio utente non trovato" };
  }

  return { utente: data as StudioUserRow };
}

function normalizeSecretValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function looksEncrypted(value: string): boolean {
  try {
    const parsed = JSON.parse(value);
    return !!parsed && typeof parsed === "object";
  } catch {
    return false;
  }
}

export function getDecryptedClientSecret(input: unknown): string | null {
  const raw =
    typeof input === "string"
      ? normalizeSecretValue(input)
      : input && typeof input === "object"
      ? normalizeSecretValue((input as Record<string, unknown>).client_secret) ||
        normalizeSecretValue((input as Record<string, unknown>).encrypted_client_secret) ||
        normalizeSecretValue((input as Record<string, unknown>).clientSecret) ||
        normalizeSecretValue((input as Record<string, unknown>).secret)
      : null;

  if (!raw) return null;

  if (!looksEncrypted(raw)) {
    return raw;
  }

  try {
    return decrypt(raw);
  } catch {
    return raw;
  }
}

export function maskClientSecret(secret: string | null | undefined): string {
  if (!secret) return "";
  if (secret.length <= 8) return "*".repeat(secret.length);
  return `${secret.slice(0, 4)}${"*".repeat(Math.max(4, secret.length - 8))}${secret.slice(-4)}`;
}

export function getClientSecretFingerprint(secret: string | null | undefined): string {
  if (!secret) return "";
  return crypto.createHash("sha256").update(secret).digest("hex");
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

  const body = (req.body ?? {}) as GraphProxyBody;

  const bodyValue =
    typeof body.microsoftConnectionId === "string"
      ? body.microsoftConnectionId
      : typeof body.connectionId === "string"
      ? body.connectionId
      : null;

  return headerValue || queryValue || bodyValue || null;
}

function readGraphPath(req: NextApiRequest): string {
  const queryPath =
    typeof req.query.path === "string"
      ? req.query.path
      : Array.isArray(req.query.path)
      ? req.query.path.join("/")
      : "";

  const body = (req.body ?? {}) as GraphProxyBody;
  const bodyPath = typeof body.path === "string" ? body.path : "";

  const rawPath = queryPath || bodyPath;

  if (!rawPath) {
    throw new Error("Missing Graph path");
  }

  return rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
}

function readGraphMethod(req: NextApiRequest): string {
  const body = (req.body ?? {}) as GraphProxyBody;

  if (typeof body.method === "string" && body.method.trim()) {
    return body.method.trim().toUpperCase();
  }

  return (req.method || "GET").toUpperCase();
}

function readGraphQuery(req: NextApiRequest): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(req.query)) {
    if (["path", "microsoftConnectionId", "connectionId"].includes(key)) continue;

    if (typeof value === "string") {
      result[key] = value;
    } else if (Array.isArray(value) && value.length > 0) {
      result[key] = value[value.length - 1] ?? "";
    }
  }

  const body = (req.body ?? {}) as GraphProxyBody;
  if (body.query && typeof body.query === "object") {
    for (const [key, value] of Object.entries(body.query)) {
      if (typeof value === "string") {
        result[key] = value;
      }
    }
  }

  return result;
}

function readRequestedScopes(req: NextApiRequest): string[] {
  const body = (req.body ?? {}) as GraphProxyBody;

  if (Array.isArray(body.scopes) && body.scopes.length > 0) {
    return body.scopes.filter((v): v is string => typeof v === "string" && !!v.trim());
  }

  return ["User.Read", "Calendars.ReadWrite", "Mail.Send"];
}

function buildGraphUrl(path: string, query: Record<string, string>): string {
  const url = new URL(`https://graph.microsoft.com${path}`);

  for (const [key, value] of Object.entries(query)) {
    if (value !== "") {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

function readForwardHeaders(req: NextApiRequest): HeadersInit {
  const headers: Record<string, string> = {};

  const contentType = req.headers["content-type"];
  const prefer = req.headers["prefer"];
  const consistencyLevel =
    req.headers["consistencylevel"] || req.headers["consistency-level"];

  if (typeof contentType === "string") {
    headers["Content-Type"] = contentType;
  }

  if (typeof prefer === "string") {
    headers["Prefer"] = prefer;
  }

  if (typeof consistencyLevel === "string") {
    headers["ConsistencyLevel"] = consistencyLevel;
  }

  return headers;
}

function readForwardBody(req: NextApiRequest, method: string): BodyInit | undefined {
  if (method === "GET" || method === "HEAD") return undefined;

  const body = (req.body ?? {}) as GraphProxyBody;
  if (body.body !== undefined) {
    return typeof body.body === "string" ? body.body : JSON.stringify(body.body);
  }

  if (req.body == null) return undefined;
  if (typeof req.body === "string") return req.body;

  if (typeof req.body === "object") {
    const {
      path,
      method: _method,
      query,
      scopes,
      microsoftConnectionId,
      connectionId,
      ...rest
    } = req.body as Record<string, unknown>;

    void path;
    void _method;
    void query;
    void scopes;
    void microsoftConnectionId;
    void connectionId;

    return Object.keys(rest).length > 0 ? JSON.stringify(rest) : undefined;
  }

  return undefined;
}

function isConnectionEnabled(connection: MicrosoftConnectionRow): boolean {
  if (typeof connection.enabled === "boolean") return connection.enabled;
  if (typeof connection.active === "boolean") return connection.active;
  return true;
}

async function getMicrosoft365Config(studioId: string): Promise<{ cfg: Microsoft365ConfigRow } | { error: string }> {
  const { data, error } = await supabaseAdmin
    .from("microsoft365_config")
    .select("client_id, tenant_id, client_secret, enabled")
    .eq("studio_id", studioId)
    .maybeSingle();

  if (error || !data?.client_id) {
    return { error: "Configurazione Microsoft 365 incompleta" };
  }

  if (data.enabled === false) {
    return { error: "Microsoft 365 disabilitato per lo studio" };
  }

  return { cfg: data as Microsoft365ConfigRow };
}

async function loadConnections(studioId: string, userId: string): Promise<MicrosoftConnectionRow[]> {
  const triedQueries: MicrosoftConnectionRow[][] = [];

  const byStudioAndUser = await supabaseAdmin
    .from(CONNECTIONS_TABLE)
    .select("*")
    .eq("studio_id", studioId)
    .eq("user_id", userId);

  if (!byStudioAndUser.error && Array.isArray(byStudioAndUser.data) && byStudioAndUser.data.length > 0) {
    triedQueries.push(byStudioAndUser.data as MicrosoftConnectionRow[]);
  }

  const byStudio = await supabaseAdmin
    .from(CONNECTIONS_TABLE)
    .select("*")
    .eq("studio_id", studioId);

  if (!byStudio.error && Array.isArray(byStudio.data) && byStudio.data.length > 0) {
    triedQueries.push(byStudio.data as MicrosoftConnectionRow[]);
  }

  const merged = new Map<string, MicrosoftConnectionRow>();
  for (const bucket of triedQueries) {
    for (const row of bucket) {
      if (row?.id) merged.set(row.id, row);
    }
  }

  return Array.from(merged.values());
}

function resolveConnection(
  connections: MicrosoftConnectionRow[],
  requestedConnectionId: string | null
): MicrosoftConnectionRow | null {
  const enabled = connections.filter(isConnectionEnabled);

  if (requestedConnectionId) {
    return enabled.find((c) => c.id === requestedConnectionId) ?? null;
  }

  const explicitDefault = enabled.find((c) => c.is_default === true);
  if (explicitDefault) return explicitDefault;

  if (enabled.length === 1) return enabled[0];

  const userOwned = enabled.find((c) => !!c.user_id);
  if (userOwned) return userOwned;

  return enabled[0] ?? null;
}

async function loadTokenRow(params: {
  studioId: string;
  userId: string;
  microsoftConnectionId: string | null;
}): Promise<TokenRow | null> {
  const { studioId, userId, microsoftConnectionId } = params;

  if (microsoftConnectionId) {
    const { data, error } = await supabaseAdmin
      .from(TOKENS_TABLE)
      .select("*")
      .eq("studio_id", studioId)
      .eq("user_id", userId)
      .eq("microsoft_connection_id", microsoftConnectionId)
      .is("revoked_at", null)
      .maybeSingle();

    if (!error && data) {
      return data as TokenRow;
    }
  }

  const { data: legacyData, error: legacyError } = await supabaseAdmin
    .from(TOKENS_TABLE)
    .select("*")
    .eq("studio_id", studioId)
    .eq("user_id", userId)
    .is("microsoft_connection_id", null)
    .is("revoked_at", null)
    .maybeSingle();

  if (!legacyError && legacyData) {
    return legacyData as TokenRow;
  }

  return null;
}

function buildMsalApp(params: { clientId: string; tenantId: string; clientSecret: string }) {
  return new ConfidentialClientApplication({
    auth: {
      clientId: params.clientId,
      authority: `https://login.microsoftonline.com/${params.tenantId || "common"}`,
      clientSecret: params.clientSecret,
    },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Error,
        piiLoggingEnabled: false,
      },
    },
  });
}

async function acquireAccessTokenFromCache(params: {
  msalApp: ConfidentialClientApplication;
  serializedCache: string;
  scopes: string[];
}) {
  params.msalApp.getTokenCache().deserialize(params.serializedCache);

  const accounts = await params.msalApp.getTokenCache().getAllAccounts();
  const account: AccountInfo | undefined = accounts?.[0];

  if (!account) {
    return { error: "Account MSAL non trovato in cache: riconnetti Microsoft 365" as const };
  }

  try {
    const result = await params.msalApp.acquireTokenSilent({
      account,
      scopes: params.scopes,
    });

    if (!result?.accessToken) {
      return { error: "Access token mancante" as const };
    }

    const newSerializedCache = params.msalApp.getTokenCache().serialize();

    return {
      accessToken: result.accessToken,
      account,
      newSerializedCache,
    };
  } catch (e: any) {
    return {
      error: "Impossibile ottenere token silent: riconnetti Microsoft 365 (token scaduto o consenso mancante)" as const,
      details: e?.message ?? String(e),
    };
  }
}

async function persistCacheIfChanged(params: {
  studioId: string;
  userId: string;
  microsoftConnectionId: string | null;
  oldSerialized: string;
  newSerialized: string;
}) {
  const { studioId, userId, microsoftConnectionId, oldSerialized, newSerialized } = params;

  if (!newSerialized || newSerialized === oldSerialized) return;

  const newEncryptedCache = encrypt(newSerialized);

  let query = supabaseAdmin
    .from(TOKENS_TABLE)
    .update({
      token_cache_encrypted: newEncryptedCache,
      updated_at: new Date().toISOString(),
    })
    .eq("studio_id", studioId)
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (microsoftConnectionId) {
    query = query.eq("microsoft_connection_id", microsoftConnectionId);
  } else {
    query = query.is("microsoft_connection_id", null);
  }

  await query;
}

async function sendUpstreamResponse(res: NextApiResponse, upstream: Response): Promise<void> {
  res.status(upstream.status);

  const contentType = upstream.headers.get("content-type");
  const etag = upstream.headers.get("etag");
  const odataVersion = upstream.headers.get("odata-version");

  if (contentType) res.setHeader("Content-Type", contentType);
  if (etag) res.setHeader("ETag", etag);
  if (odataVersion) res.setHeader("OData-Version", odataVersion);

  if (contentType?.includes("application/json")) {
    const json = await upstream.json().catch(() => null);
    res.send(json);
    return;
  }

  const text = await upstream.text().catch(() => "");
  res.send(text);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json | ApiError>) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const auth = await getAuthUser(req);
    if ("error" in auth) {
      return res.status(401).json({ error: auth.error });
    }

    const mapped = await getUtenteStudio({
      id: auth.user.id,
      email: auth.user.email,
    });

    if ("error" in mapped) {
      return res.status(400).json({ error: mapped.error });
    }

    const requesterUserId = mapped.utente.id;
    const studioId = mapped.utente.studio_id;

    const cfgRes = await getMicrosoft365Config(studioId);
    if ("error" in cfgRes) {
      return res.status(400).json({ error: cfgRes.error });
    }

    const clientId = cfgRes.cfg.client_id || "";
    const tenantId = cfgRes.cfg.tenant_id || "common";
    const clientSecret = getDecryptedClientSecret(cfgRes.cfg.client_secret);

    if (!clientId || !clientSecret) {
      return res.status(400).json({
        error: "Configurazione Microsoft 365 incompleta: client_id o client_secret mancanti",
      });
    }

    const requestedConnectionId = readMicrosoftConnectionId(req);
    const connections = await loadConnections(studioId, requesterUserId);
    const selectedConnection = resolveConnection(connections, requestedConnectionId);

    if (requestedConnectionId && !selectedConnection) {
      return res.status(404).json({
        error: "Connessione Microsoft non trovata o non abilitata",
        details: {
          studio_id: studioId,
          user_id: requesterUserId,
          microsoftConnectionId: requestedConnectionId,
        },
      });
    }

    const effectiveConnectionId = selectedConnection?.id ?? null;

    const tokenRow = await loadTokenRow({
      studioId,
      userId: requesterUserId,
      microsoftConnectionId: effectiveConnectionId,
    });

    if (!tokenRow?.token_cache_encrypted) {
      return res.status(401).json({
        error: "Token Microsoft non trovato per la connessione selezionata",
        details: {
          studio_id: studioId,
          user_id: requesterUserId,
          microsoftConnectionId: effectiveConnectionId,
        },
      });
    }

    let serializedCache: string;
    try {
      serializedCache = decrypt(tokenRow.token_cache_encrypted);
    } catch (e: any) {
      return res.status(500).json({
        error: "Impossibile decifrare la token cache Microsoft",
        details: e?.message ?? String(e),
      });
    }

    const msalApp = buildMsalApp({
      clientId,
      tenantId,
      clientSecret,
    });

    const scopes = readRequestedScopes(req);

    const tokenRes = await acquireAccessTokenFromCache({
      msalApp,
      serializedCache,
      scopes,
    });

    if ("error" in tokenRes) {
      return res.status(401).json({
        error: tokenRes.error,
        details: tokenRes.details,
      });
    }

    await persistCacheIfChanged({
      studioId,
      userId: requesterUserId,
      microsoftConnectionId: tokenRow.microsoft_connection_id ?? effectiveConnectionId,
      oldSerialized: serializedCache,
      newSerialized: tokenRes.newSerializedCache,
    });

    const graphPath = readGraphPath(req);
    const graphMethod = readGraphMethod(req);
    const graphQuery = readGraphQuery(req);
    const graphUrl = buildGraphUrl(graphPath, graphQuery);

    const upstream = await fetch(graphUrl, {
      method: graphMethod,
      headers: {
        ...readForwardHeaders(req),
        Authorization: `Bearer ${tokenRes.accessToken}`,
        Accept: "application/json",
      },
      body: readForwardBody(req, graphMethod),
    });

    return await sendUpstreamResponse(res, upstream);
  } catch (e: any) {
    console.error("[microsoft365/graph]", e);
    return res.status(500).json({
      error: e?.message || "Errore interno Microsoft Graph proxy",
    });
  }
}
