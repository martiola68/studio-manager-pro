// src/pages/api/auth/microsoft/login.ts
export const runtime = "nodejs";
export const config = { runtime: "nodejs" };

import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

console.log("[m365 login] FILE LOADED - NODE RUNTIME");

function getBaseUrl(req: NextApiRequest) {
  // Prefer explicit app URL if configured (best for Vercel/proxies)
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_URL;

  if (envUrl) {
    // VERCEL_URL comes without protocol
    if (envUrl.startsWith("http://") || envUrl.startsWith("https://")) return envUrl;
    return `https://${envUrl}`;
  }

  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

const BodySchema = z.object({}).passthrough();

type Ok = { url: string };
type Err = { error: string; details?: any };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // (optional) validate body shape; we don't require anything for now
    BodySchema.safeParse(req.body);

    const supabaseAdmin = getSupabaseAdmin();

    // 1) Read Supabase user from Authorization bearer token
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

    // 2) Resolve studio_id for this user
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

    const studioId = urow.studio_id as string;
    
const clientId = process.env.MICROSOFT_CLIENT_ID!;
const tenantId = process.env.MICROSOFT_TENANT_ID!;
    
    if (!cfg) {
      return res.status(400).json({
        error: "Config Microsoft365 mancante",
        details: `Nessuna riga in microsoft365_config per studioId=${studioId}`,
      });
    }

    if (!cfg.enabled) {
      return res.status(403).json({ error: "Microsoft365 disabilitato" });
    }

    // 4) Create state and store it in an HttpOnly cookie
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
        `Max-Age=600`,
        isProd ? "Secure" : "",
      ]
        .filter(Boolean)
        .join("; ")
    );

    // 5) Build authorize URL (Delegated login)
    const redirectUri = `${getBaseUrl(req)}/api/auth/microsoft/callback`;

    // Scopes for user-based calendar + Teams meeting + send mail
    // NOTE: OnlineMeetings.ReadWrite is correct for delegated.
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
      client_id: cfg.client_id,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: scopes.join(" "),
      state,
    });

    const authorizeUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;

    console.log("[m365 login] authorizeUrl created for studio:", studioId);

    return res.status(200).json({ url: authorizeUrl });
  } catch (e: any) {
    console.error("[m365 login] fatal error", e);
    return res.status(500).json({
      error: "Internal error",
      details: e?.message || "unknown",
    });
  }
}
