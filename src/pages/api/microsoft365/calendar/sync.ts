// src/pages/api/microsoft365/calendar/sync.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/encryption365";
import { ConfidentialClientApplication, LogLevel } from "@azure/msal-node";

function getBearerToken(req: NextApiRequest): string | null {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function appBaseUrl(req: NextApiRequest) {
  const proto =
    (req.headers["x-forwarded-proto"] as string) ||
    (req.headers["x-forwarded-protocol"] as string) ||
    "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // 1) Auth utente (Supabase access token)
    const token = getBearerToken(req) || null;
    if (!token) return res.status(401).json({ error: "Missing Authorization Bearer token" });

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userRes?.user) return res.status(401).json({ error: "Utente non autenticato" });
    const authUser = userRes.user;

    // 2) Mappa su tbutenti
    const { data: utente, error: uErr } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id, email")
      .or(`id.eq.${authUser.id},email.eq.${authUser.email}`)
      .maybeSingle();

    if (uErr || !utente?.studio_id) return res.status(400).json({ error: "Studio utente non trovato" });

    const userId = utente.id;
    const studioId = utente.studio_id;

    // 3) Leggi config studio (serve per MSAL)
    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("microsoft365_config")
      .select("client_id, tenant_id, client_secret, enabled")
      .eq("studio_id", studioId)
      .maybeSingle();

    if (cfgErr || !cfg?.client_id) return res.status(400).json({ error: "Configurazione Microsoft 365 incompleta" });
    if (cfg.enabled === false) return res.status(400).json({ error: "Microsoft 365 disabilitato per lo studio" });

    const tenantId = cfg.tenant_id || "common";
    const clientSecret = cfg.client_secret; // (se tu lo cifri in DB, qui devi fare decrypt sul campo giusto)

    // 4) Leggi token cache (questa è LA fonte)
    const { data: tokenRow, error: tErr } = await supabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .select("token_cache_encrypted, revoked_at")
      .eq("studio_id", studioId)
      .eq("user_id", userId)
      .maybeSingle();

    if (tErr || !tokenRow?.token_cache_encrypted) {
      return res.status(401).json({ error: "Token cache mancante: connetti Microsoft 365" });
    }
    if (tokenRow.revoked_at !== null) {
      return res.status(401).json({ error: "Token revocato: riconnetti Microsoft 365" });
    }

    const serializedCache = decrypt(tokenRow.token_cache_encrypted);

    // 5) MSAL con cache deserializzata
    const msalApp = new ConfidentialClientApplication({
      auth: {
        clientId: cfg.client_id,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        clientSecret,
      },
      system: {
        loggerOptions: {
          logLevel: LogLevel.Error,
          piiLoggingEnabled: false,
        },
      },
    });

    msalApp.getTokenCache().deserialize(serializedCache);

    const accounts = await msalApp.getTokenCache().getAllAccounts();
    const account = accounts?.[0];
    if (!account) {
      return res.status(401).json({ error: "Account MSAL non trovato in cache: riconnetti Microsoft 365" });
    }

    // 6) Prendi access token SILENT (qui MSAL usa refresh token internamente)
    const scopes = [
      "openid",
      "profile",
      "offline_access",
      "User.Read",
      "Calendars.ReadWrite",
    ];

    const result = await msalApp.acquireTokenSilent({
      account,
      scopes,
    });

    if (!result?.accessToken) {
      return res.status(500).json({ error: "Access token mancante" });
    }

    // 7) (Opzionale ma consigliato) risalva cache aggiornata (rotazione refresh token ecc.)
    const newSerializedCache = msalApp.getTokenCache().serialize();
    const newEncryptedCache = encrypt(newSerializedCache);

    await supabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .update({ token_cache_encrypted: newEncryptedCache, updated_at: new Date().toISOString() })
      .eq("studio_id", studioId)
      .eq("user_id", userId);

    // 8) Ora fai Graph con result.accessToken
    // ESEMPIO: prendi 10 eventi
    const graphRes = await fetch("https://graph.microsoft.com/v1.0/me/events?$top=10", {
      headers: { Authorization: `Bearer ${result.accessToken}` },
    });

    const graphJson = await graphRes.json();
    if (!graphRes.ok) {
      return res.status(500).json({
        error: "Errore Graph",
        details: graphJson,
      });
    }

    // Qui al posto di "return" devi fare la tua vera logica di sync su DB
    return res.status(200).json({
      ok: true,
      fetched: Array.isArray(graphJson?.value) ? graphJson.value.length : 0,
    });
  } catch (e: any) {
    console.error("[calendar/sync]", e);
    return res.status(500).json({ error: e?.message || "Errore interno sync" });
  }
}
