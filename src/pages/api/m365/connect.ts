// src/pages/api/m365/connect.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

function base64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function sha256(verifier: string) {
  return crypto.createHash("sha256").update(verifier).digest();
}

function getBearerToken(req: NextApiRequest): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const bearer = getBearerToken(req);
    if (!bearer) return res.status(401).json({ error: "Missing Authorization bearer token" });

    // 1) valida utente Supabase (DELEGATED flow legato all'utente)
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(bearer);
    if (userErr || !userRes.user) {
      return res.status(401).json({ error: "Invalid session" });
    }
    const userId = userRes.user.id;

    // 2) studio_id dell'utente
    const { data: uRow, error: uErr } = await supabaseAdmin
      .from("tbutenti")
      .select("studio_id")
      .eq("id", userId)
      .single();

    if (uErr || !uRow?.studio_id) {
      return res.status(400).json({ error: "Studio non trovato per l'utente" });
    }

    const studioId = uRow.studio_id;

    // 3) carica config M365 dello studio
    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("microsoft365_config")
      .select("client_id, tenant_id, enabled")
      .eq("studio_id", studioId)
      .maybeSingle();

    if (cfgErr) return res.status(500).json({ error: "DB error", details: cfgErr.message });
    if (!cfg) return res.status(400).json({ error: "Microsoft 365 non configurato per questo studio" });
    if (!cfg.enabled) return res.status(400).json({ error: "Microsoft 365 disabilitato per questo studio" });

    // 4) PKCE + state
    const codeVerifier = base64url(crypto.randomBytes(32));
    const codeChallenge = base64url(sha256(codeVerifier));
    const state = base64url(crypto.randomBytes(24));

    // 5) salva stato temporaneo (consigliato) in tabella
    // Se non ce l'hai, crea tabella "tbmicrosoft_oauth_state" (state, user_id, code_verifier, created_at)
    // Se la tua callback già usa cookie/state altrove, allinea lì.
    await supabaseAdmin.from("tbmicrosoft_oauth_state").insert({
      state,
      user_id: userId,
      code_verifier: codeVerifier,
    });

    // 6) costruisci authorize url (DELEGATED)
    const tenant = cfg.tenant_id; // oppure "common" se vuoi multi-tenant
    const redirectUri = "https://studio-manager-pro.vercel.app/api/m365/callback";

    const params = new URLSearchParams({
      client_id: cfg.client_id,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: [
        "openid",
        "profile",
        "offline_access",
        "User.Read",
        // aggiungi qui gli scope delegated che ti servono (Calendars.ReadWrite, Mail.Read, etc)
      ].join(" "),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;

    return res.status(200).json({ url });
  } catch (e: any) {
    console.error("[m365 connect] error:", e);
    return res.status(500).json({ error: "Internal error", details: e?.message });
  }
}
