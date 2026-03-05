// src/pages/api/microsoft365/calendar/sync.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/encryption365";
import { ConfidentialClientApplication, LogLevel, AccountInfo } from "@azure/msal-node";
import { getDecryptedClientSecret } from "../graph";

function getBearerToken(req: NextApiRequest): string | null {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function getAuthUser(req: NextApiRequest) {
  const token = getBearerToken(req);
  if (!token) return { error: "Missing Authorization Bearer token" as const };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { error: "Utente non autenticato" as const };

  return { user: data.user, token };
}

async function getUtenteStudio(authUser: { id: string; email?: string | null }) {
  const { data: utente, error } = await supabaseAdmin
    .from("tbutenti")
    .select("id, studio_id, email")
    .or(`id.eq.${authUser.id},email.eq.${authUser.email}`)
    .maybeSingle();

  if (error || !utente?.studio_id) return { error: "Studio utente non trovato" as const };
  return { utente };
}

async function getM365Config(studioId: string) {
  const { data: cfg, error } = await supabaseAdmin
    .from("microsoft365_config")
    .select("client_id, tenant_id, client_secret, enabled")
    .eq("studio_id", studioId)
    .maybeSingle();

  if (error || !cfg?.client_id) return { error: "Configurazione Microsoft 365 incompleta" as const };
  if (cfg.enabled === false) return { error: "Microsoft 365 disabilitato per lo studio" as const };

  return { cfg };
}

async function getTokenCacheRow(studioId: string, userId: string) {
  const { data: tokenRow, error } = await supabaseAdmin
    .from("tbmicrosoft365_user_tokens")
    .select("token_cache_encrypted, revoked_at")
    .eq("studio_id", studioId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !tokenRow?.token_cache_encrypted) {
    return { error: "Token cache mancante: connetti Microsoft 365" as const };
  }
  if (tokenRow.revoked_at !== null) {
    return { error: "Token revocato: riconnetti Microsoft 365" as const };
  }
  return { tokenRow };
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

async function acquireAccessTokenFromCache(opts: {
  msalApp: ConfidentialClientApplication;
  serializedCache: string;
  scopes: string[];
}) {
  opts.msalApp.getTokenCache().deserialize(opts.serializedCache);

  const accounts = await opts.msalApp.getTokenCache().getAllAccounts();
  const account: AccountInfo | undefined = accounts?.[0];

  if (!account) {
    return { error: "Account MSAL non trovato in cache: riconnetti Microsoft 365" as const };
  }

  try {
    const result = await opts.msalApp.acquireTokenSilent({
      account,
      scopes: opts.scopes,
    });

    if (!result?.accessToken) return { error: "Access token mancante" as const };

    const newSerializedCache = opts.msalApp.getTokenCache().serialize();
    return {
      accessToken: result.accessToken,
      account,
      newSerializedCache,
    };
  } catch (e: any) {
    // Tipicamente: interaction_required / invalid_grant / refresh scaduto
    return {
      error:
        "Impossibile ottenere token silent: riconnetti Microsoft 365 (token scaduto o consenso mancante)" as const,
      details: e?.message ?? String(e),
    };
  }
}

async function persistCacheIfChanged(studioId: string, userId: string, oldSerialized: string, newSerialized: string) {
  if (!newSerialized || newSerialized === oldSerialized) return;

  const newEncryptedCache = encrypt(newSerialized);

  await supabaseAdmin
    .from("tbmicrosoft365_user_tokens")
    .update({ token_cache_encrypted: newEncryptedCache, updated_at: new Date().toISOString() })
    .eq("studio_id", studioId)
    .eq("user_id", userId);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // 1) Auth utente (Supabase access token)
    const auth = await getAuthUser(req);
    if ("error" in auth) return res.status(401).json({ error: auth.error });

    // 2) Mappa su tbutenti
    const mapped = await getUtenteStudio({ id: auth.user.id, email: auth.user.email });
    if ("error" in mapped) return res.status(400).json({ error: mapped.error });

    const userId = mapped.utente.id;
    const studioId = mapped.utente.studio_id;

    // 3) Config studio MSAL
    const cfgRes = await getM365Config(studioId);
    if ("error" in cfgRes) return res.status(400).json({ error: cfgRes.error });

    const tenantId = cfgRes.cfg.tenant_id || "common";
    const clientSecret = getDecryptedClientSecret(cfgRes.cfg.client_secret);

    if (!clientSecret) return res.status(400).json({ error: "client_secret mancante in configurazione Microsoft 365" });

    // 4) Token cache (FONTE UNICA)
    const tRes = await getTokenCacheRow(studioId, userId);
    if ("error" in tRes) return res.status(401).json({ error: tRes.error });

    const oldSerializedCache = decrypt(tRes.tokenRow.token_cache_encrypted);

    // 5) MSAL deserialize + acquireTokenSilent
    const msalApp = buildMsalApp({
      clientId: cfgRes.cfg.client_id,
      tenantId,
      clientSecret,
    });

    const scopes = [
      // per Graph "me/events" bastano Calendars.Read, ma ok ReadWrite se fai sync bidirezionale
      "User.Read",
      "Calendars.ReadWrite",
      // NOTA: openid/profile/offline_access non sono necessari qui (servono nel consent/initial auth),
      // ma non danno fastidio. Se vuoi, puoi rimuoverli.
    ];

    const tokenRes = await acquireAccessTokenFromCache({
      msalApp,
      serializedCache: oldSerializedCache,
      scopes,
    });

    if ("error" in tokenRes) {
      return res.status(401).json({ error: tokenRes.error, details: tokenRes.details });
    }

    // 6) Chiamata Graph (esempio)
    const graphUrl = "https://graph.microsoft.com/v1.0/me/events?$top=10&$orderby=start/dateTime";
    const graphRes = await fetch(graphUrl, {
      headers: {
        Authorization: `Bearer ${tokenRes.accessToken}`,
        Accept: "application/json",
      },
    });

    const contentType = graphRes.headers.get("content-type") || "";
    const graphBody = contentType.includes("application/json")
      ? await graphRes.json()
      : await graphRes.text();

    // 7) Persisti cache aggiornata (rotazione refresh token ecc.)
    await persistCacheIfChanged(studioId, userId, oldSerializedCache, tokenRes.newSerializedCache);

    if (!graphRes.ok) {
      // 401/403 tipicamente: consent mancante o token invalido
      return res.status(graphRes.status).json({
        error: "Errore Graph",
        status: graphRes.status,
        details: graphBody,
      });
    }

    // 8) Qui metti la tua logica di sync vera
 const events = (graphBody as any)?.value || [];

return res.status(200).json({
  ok: true,
  fetched: Array.isArray(events) ? events.length : 0,
  events: Array.isArray(events) ? events.map((e: any) => ({
    id: e.id,
    subject: e.subject,
    start: e.start,
    end: e.end,
    organizer: e.organizer,
    lastModifiedDateTime: e.lastModifiedDateTime,
  })) : [],
});
  } catch (e: any) {
    console.error("[calendar/sync]", e);
    return res.status(500).json({ error: e?.message || "Errore interno sync" });
  }
}
