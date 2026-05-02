import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/encryption365";
import { ConfidentialClientApplication, LogLevel } from "@azure/msal-node";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 🔐 AUTH CRON
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Non autorizzato" });
  }

  try {
    const { endpoint, method, body, userId, microsoftConnectionId } = req.body;

    if (!endpoint || !method || !userId) {
      return res.status(400).json({ error: "Missing params" });
    }

    // 👇 recupero utente
    const { data: user } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id")
      .eq("id", userId)
      .single();

    if (!user) {
      return res.status(400).json({ error: "Utente non trovato" });
    }

    // 👇 connessione Microsoft
    const { data: connection } = await supabaseAdmin
      .from("microsoft365_connections")
      .select("*")
      .eq("id", microsoftConnectionId)
      .single();

    if (!connection) {
      return res.status(400).json({ error: "Connessione Microsoft non trovata" });
    }

    // 👇 token cache
    const { data: tokenRow } = await supabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .select("*")
      .eq("user_id", userId)
      .eq("microsoft_connection_id", microsoftConnectionId)
      .is("revoked_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!tokenRow?.token_cache_encrypted) {
      return res.status(400).json({ error: "Token Microsoft mancante" });
    }

    const cache = decrypt(tokenRow.token_cache_encrypted);
    const clientSecret = decrypt(connection.client_secret);

    const msal = new ConfidentialClientApplication({
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

    msal.getTokenCache().deserialize(cache);

    const accounts = await msal.getTokenCache().getAllAccounts();
    const account = accounts[0];

    if (!account) {
      return res.status(400).json({ error: "Account Microsoft mancante" });
    }

    const result = await msal.acquireTokenSilent({
      account,
      scopes: ["https://graph.microsoft.com/.default"],
    });

    const accessToken = result?.accessToken;

    if (!accessToken) {
      return res.status(500).json({ error: "Token Microsoft non ottenuto" });
    }

    // 👉 chiamata Graph
    const graphRes = await fetch(
      `https://graph.microsoft.com/v1.0${endpoint}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      }
    );

    const text = await graphRes.text();

    return res.status(graphRes.status).send(text || "{}");
  } catch (err: any) {
    console.error("CRON GRAPH ERROR:", err);
    return res.status(500).json({
      error: err?.message || "Errore interno cron graph",
    });
  }
}
