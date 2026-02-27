// src/pages/api/m365/connect.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Ok = { url: string };
type Err = { error: string; details?: any };

function getBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL;

  const fallback = "https://studio-manager-pro.vercel.app";
  const v = (raw || fallback).trim().replace(/\/+$/, "");

  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  return `https://${v}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // 1) auth utente (Supabase access token)
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "Invalid session", details: userErr?.message });
    }

    const userId = userData.user.id;

    // 2) studio_id
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("tbutenti")
      .select("studio_id")
      .eq("id", userId)
      .maybeSingle();

    if (uerr) return res.status(500).json({ error: "Failed to read user studio", details: uerr.message });
    if (!urow?.studio_id) return res.status(400).json({ error: "Studio non trovato" });

    const studioId = String(urow.studio_id);

    // 3) env Microsoft
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const tenantId = process.env.MICROSOFT_TENANT_ID;

    if (!clientId || !tenantId) {
      return res.status(500).json({
        error: "Microsoft OAuth env missing",
        details: "Set MICROSOFT_CLIENT_ID and MICROSOFT_TENANT_ID in Vercel env.",
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

    // 5) authorize URL
    const baseUrl = getBaseUrl();
    const redirectUri = `${baseUrl}/api/m365/callback`;

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
    console.error("[m365 connect] error", e);
    return res.status(500).json({ error: "Internal error", details: e?.message || "unknown" });
  }
}
