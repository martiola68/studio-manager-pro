import type { NextApiRequest, NextApiResponse } from "next";
import { decrypt, encrypt } from "@/lib/encryption365";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  ConfidentialClientApplication,
  LogLevel,
  AccountInfo,
} from "@azure/msal-node";
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};
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

function isAllowedGraphPath(pathname: string): boolean {
  return (
    pathname === "/v1.0" ||
    pathname.startsWith("/v1.0/") ||
    pathname === "/beta" ||
    pathname.startsWith("/beta/")
  );
}

function normalizeGraphPath(endpoint: string): string {
  if (typeof endpoint !== "string") {
    throw new Error("Endpoint non valido");
  }

  const trimmed = endpoint.trim();

  if (!trimmed) {
    throw new Error("Endpoint mancante");
  }

  // Non accettiamo URL assoluti: solo path relativi di Microsoft Graph
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    throw new Error("Passare solo path relativi Microsoft Graph");
  }

  const ep = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const fullPath =
    ep.startsWith("/v1.0") || ep.startsWith("/beta") ? ep : `/v1.0${ep}`;

  const parsed = new URL(`https://graph.microsoft.com${fullPath}`);

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "graph.microsoft.com" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    !isAllowedGraphPath(parsed.pathname)
  ) {
    throw new Error("Path Microsoft Graph non consentito");
  }

  return `${parsed.pathname}${parsed.search}`;
}

function buildGraphUrlFromPath(pathnameWithQuery: string): string {
  return `https://graph.microsoft.com${pathnameWithQuery}`;
}

async function resolveMicrosoftConnection(
  studioId: string,
  userId: string,
  requestedConnectionId?: string | null
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

  if (requestedConnectionId) {
    const { data, error } = await supabaseAdmin
      .from("microsoft365_connections")
      .select(
        "id, studio_id, nome_connessione, tenant_id, client_id, client_secret, enabled, connected_email, organizer_email, is_default, sort_order"
      )
      .eq("id", requestedConnectionId)
      .eq("studio_id", studioId)
      .eq("enabled", true)
      .maybeSingle<ConnectionRow>();

    if (!error && data) {
      connection = data;
    }
  }

  if (!connection && utente.microsoft_connection_id) {
    const { data, error } = await supabaseAdmin
      .from("microsoft365_connections")
      .select(
        "id, studio_id, nome_connessione, tenant_id, client_id, client_secret, enabled, connected_email, organizer_email, is_default, sort_order"
      )
      .eq("id", utente.microsoft_connection_id)
      .eq("studio_id", studioId)
      .eq("enabled", true)
      .maybeSingle<ConnectionRow>();

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
      .maybeSingle<ConnectionRow>();

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
      .maybeSingle<ConnectionRow>();

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
  userId: string,
  requestedConnectionId?: string | null
): Promise<{ accessToken: string; connection: ResolvedConnection }> {
  const connection = await resolveMicrosoftConnection(
    studioId,
    userId,
    requestedConnectionId
  );

  let tokenRow: TokenRow | null = null;

  const { data: strictTokenRow, error: strictTokenErr } = await supabaseAdmin
    .from("tbmicrosoft365_user_tokens")
    .select(
      "token_cache_encrypted, scopes, revoked_at, microsoft_connection_id, updated_at"
    )
    .eq("studio_id", studioId)
    .eq("user_id", userId)
    .eq("microsoft_connection_id", connection.id)
    .is("revoked_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!strictTokenErr && strictTokenRow?.token_cache_encrypted) {
    tokenRow = strictTokenRow as TokenRow;
  }

  if (!tokenRow) {
    const { data: fallbackTokenRow, error: fallbackTokenErr } = await supabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .select(
        "token_cache_encrypted, scopes, revoked_at, microsoft_connection_id, updated_at"
      )
      .eq("studio_id", studioId)
      .eq("user_id", userId)
      .eq("microsoft_connection_id", connection.id)
      .is("revoked_at", null)
      .not("token_cache_encrypted", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!fallbackTokenErr && fallbackTokenRow?.token_cache_encrypted) {
      tokenRow = fallbackTokenRow as TokenRow;
    }
  }

  if (!tokenRow?.token_cache_encrypted) {
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
  let clientSecret = "";

  try {
    clientSecret = decrypt(connection.client_secret);
  } catch {
    clientSecret = connection.client_secret;
  }

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
        microsoft_connection_id: connection.id,
      })
      .eq("studio_id", studioId)
      .eq("user_id", userId)
      .eq("microsoft_connection_id", tokenRow.microsoft_connection_id);
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

const authUserEmail = userData.user.email || "";

const { data: sessionUserRow, error: sessionUserErr } = await supabaseAdmin
  .from("tbutenti")
  .select("id, studio_id, email")
  .eq("email", authUserEmail)
  .maybeSingle();

if (sessionUserErr || !sessionUserRow?.studio_id || !sessionUserRow?.id) {
  return res.status(400).json({ error: "Utente studio non trovato" });
}

const sessionTbutentiId = String(sessionUserRow.id);
const sessionStudioId = String(sessionUserRow.studio_id);

    const {
      endpoint,
      method,
      body,
      userId: requestedUserId,
      microsoftConnectionId,
    } = req.body || {};

    if (!endpoint || !method) {
      return res.status(400).json({ error: "Missing endpoint/method" });
    }

  const effectiveUserId =
  typeof requestedUserId === "string" && requestedUserId.trim()
    ? requestedUserId.trim()
    : sessionTbutentiId;

    const { data: targetUserRow, error: targetUserErr } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id")
      .eq("id", effectiveUserId)
      .maybeSingle();

    if (targetUserErr || !targetUserRow?.studio_id) {
      return res.status(400).json({ error: "Utente target non trovato" });
    }

  const sameStudio = String(targetUserRow.studio_id) === sessionStudioId;

// Se sto lavorando con una connessione Microsoft esplicita, non blocco qui
// il multi-tenant solo perché lo studio_id del target non coincide.
// Il controllo di autorizzazione passa dalla connessione selezionata.
if (!sameStudio && !microsoftConnectionId) {
  return res.status(403).json({ error: "Utente target fuori dallo studio" });
}

   const graphPath = normalizeGraphPath(String(endpoint));
const url = buildGraphUrlFromPath(graphPath);

    const httpMethod = String(method).toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(httpMethod)) {
      return res.status(400).json({ error: "Metodo non supportato" });
    }

    const { accessToken } = await acquireAccessToken(
      sessionStudioId,
      effectiveUserId,
      microsoftConnectionId || null
    );

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
