// src/pages/api/m365/callback.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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

function parseCookies(header?: string) {
  const out: Record<string, string> = {};
  if (!header) return out;
  header.split(";").forEach((part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(v.join("="));
  });
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }

  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res.redirect(`${getBaseUrl()}/impostazioni/microsoft365?m365_error=${encodeURIComponent(String(error_description || error))}`);
    }
    if (!code || !state) {
      return res.redirect(`${getBaseUrl()}/impostazioni/microsoft365?m365_error=missing_code_or_state`);
    }

    const cookies = parseCookies(req.headers.cookie);
    const packed = cookies["m365_state"];
    if (!packed) {
      return res.redirect(`${getBaseUrl()}/impostazioni/microsoft365?m365_error=missing_state_cookie`);
    }

    let payload: any;
    try {
      payload = JSON.parse(Buffer.from(packed, "base64url").toString("utf8"));
    } catch {
      return res.redirect(`${getBaseUrl()}/impostazioni/microsoft365?m365_error=bad_state_cookie`);
    }

    if (!payload?.state || payload.state !== state) {
      return res.redirect(`${getBaseUrl()}/impostazioni/microsoft365?m365_error=state_mismatch`);
    }

    const userId = payload.userId as string;
    const studioId = payload.studioId as string;

    const tenantId = process.env.MICROSOFT_TENANT_ID;
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
      return res.redirect(`${getBaseUrl()}/impostazioni/microsoft365?m365_error=missing_microsoft_env`);
    }

    const redirectUri = `${getBaseUrl()}/api/m365/callback`;

    // Exchange code -> tokens
    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: redirectUri,
      }),
    });

    const tokenJson: any = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("[m365 callback] token exchange failed", tokenJson);
      return res.redirect(`${getBaseUrl()}/impostazioni/microsoft365?m365_error=token_exchange_failed`);
    }

    const access_token = tokenJson.access_token as string | undefined;
    const refresh_token = tokenJson.refresh_token as string | undefined;
    const expires_in = Number(tokenJson.expires_in || 0);
    const scope = tokenJson.scope as string | undefined;

    if (!access_token) {
      return res.redirect(`${getBaseUrl()}/impostazioni/microsoft365?m365_error=missing_access_token`);
    }

    const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

    const supabaseAdmin = getSupabaseAdmin();

    // Save tokens (upsert)
    const { error: upErr } = await supabaseAdmin
      .from("tb_m365_tokens")
      .upsert(
        {
          user_id: userId,
          studio_id: studioId,
          access_token,
          refresh_token: refresh_token || null,
          expires_at,
          scope: scope || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upErr) {
      console.error("[m365 callback] db upsert failed", upErr);
      return res.redirect(`${getBaseUrl()}/impostazioni/microsoft365?m365_error=db_save_failed`);
    }

    // clear cookie
    const isProd = process.env.NODE_ENV === "production";
    res.setHeader(
      "Set-Cookie",
      [
        `m365_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; ${isProd ? "Secure;" : ""}`,
      ].join(" ")
    );

    return res.redirect(`${getBaseUrl()}/impostazioni/microsoft365?m365=connected`);
  } catch (e: any) {
    console.error("[m365 callback] error", e);
    return res.redirect(`${getBaseUrl()}/impostazioni/microsoft365?m365_error=internal`);
  }
}
