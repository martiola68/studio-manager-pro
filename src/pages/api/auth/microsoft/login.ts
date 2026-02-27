export const runtime = "nodejs";
export const config = { runtime: "nodejs" };

// src/pages/api/auth/microsoft/login.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * IMPORTANTISSIMO:
 * Non usare mai VERCEL_URL / host della request per costruire redirect_uri,
 * altrimenti finisci sui domini "deployment" (studio-manager-xxxx...vercel.app)
 * e Azure risponde con AADSTS50011 (redirect mismatch).
 */
function getCanonicalBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL || // <-- consigliata
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL;

  if (!raw) {
    // Fallback sicuro: metti qui il dominio definitivo se vuoi evitare errori
    // (meglio comunque configurare APP_BASE_URL o NEXTAUTH_URL su Vercel)
    return "https://studio-manager-pro.vercel.app";
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw.replace(/\/+$/, "");
  return `https://${raw.replace(/\/+$/, "")}`;
}

const BodySchema = z.object({}).passthrough();

type Ok = { url: string };
type Err = { error: string; details?: any };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Body vuoto ok, ma valida comunque (no throw)
    BodySchema.safeParse(req.body);

    const supabaseAdmin = getSupabaseAdmin();

    // 1) Token Supabase (utente loggato nell'app)
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);

    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "Invalid session", details: userErr?.message });
    }

    const userId = userData.user.id;

    // 2) studio_id (serve per legare i token delegati all'utente/studio)
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("tbutenti")
      .select("studio_id")
      .eq("id", userId)
      .maybeSingle();

    if (uerr) {
      return res.status(500).json({ error: "Failed to read user studio", details: uerr.message });
    }
    if (!urow?.studio_id) {
      return res.status(400).json({ error: "Studio non trovato" });
    }

    const studioId = String(urow.studio_id);

    // 3) OAuth delegated: usa ENV fisse
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const tenantId = process.env.MICROSOFT_TENANT_ID;

    if (!clientId || !tenantId) {
      return res.status(500).json({
        error: "Microsoft OAuth env missing",
        details:
          "Set MICROSOFT_CLIENT_ID and MICROSOFT_TENANT_ID in Vercel env (Production + Preview).",
      });
    }

    // 4) state + cookie (per validare callback)
    const state = crypto.randomBytes(16).toString("hex");
    const payload = JSON.stringify({ state, studioId, userId, t: Date.now() });
    const cookieValue = Buffer.from(payload).toString("base64url");

    const isProd = process.env.NODE_ENV === "production";

    res.setHeader(
      "Set-Cookie",
      [
        `m365_state=${cookieValue}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        "Max-Age=600",
        isProd ? "Secure" : "",
      ]
        .filter(Boolean)
        .join("; ")
    );

    // 5) URL authorize: redirect_uri DEVE essere sempre quello "canonico"
    const baseUrl = getCanonicalBaseUrl();
    const redirectUri = `${baseUrl}/api/auth/microsoft/callback`;

    const scopes = [
      "openid",
      "profile",
      "offline_access",
      "User.Read",
      "Calendars.ReadWrite",
      "Mail.Send",
      "OnlineMeetings.ReadWrite",
    ];

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: scopes.join(" "),
      state,
    });

    const authorizeUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;

    return res.status(200).json({ url: authorizeUrl });
  } catch (e: any) {
    console.error("[m365 login] error", e);
    return res.status(500).json({ error: "Internal error", details: e?.message || "unknown" });
  }
}
