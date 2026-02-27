export const runtime = "nodejs";
export const config = { runtime: "nodejs" };

// src/pages/api/auth/microsoft/login.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function getBaseUrl(req: NextApiRequest) {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_URL;

  if (envUrl) {
    if (envUrl.startsWith("http://") || envUrl.startsWith("https://")) return envUrl;
    return `https://${envUrl}`;
  }

  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
  return `${proto}://${host}`;
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
    BodySchema.safeParse(req.body);

    const supabaseAdmin = getSupabaseAdmin();

    // 1) token Supabase (utente loggato nell'app)
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

    // 2) studio_id (serve solo per legare poi tokens all'utente/studio)
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

    // 3) Non leggere config studio qui. Usa ENV fisse per OAuth delegated.
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const tenantId = process.env.MICROSOFT_TENANT_ID;

    if (!clientId || !tenantId) {
      return res.status(500).json({
        error: "Microsoft OAuth env missing",
        details: "Set MICROSOFT_CLIENT_ID and MICROSOFT_TENANT_ID in Vercel env (Production + Preview).",
      });
    }

    // 4) state + cookie
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

    // 5) URL authorize
    const redirectUri = `${getBaseUrl(req)}/api/auth/microsoft/callback`;

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
