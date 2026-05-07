import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    if (!token) {
      return res.status(401).json({ connected: false });
    }

    const { data: userRes, error: authError } =
      await supabaseAdmin.auth.getUser(token);

    if (authError) {
      console.error("[m365/status] auth error", authError);
      return res.status(401).json({ connected: false });
    }

    const authUser = userRes?.user;

    if (!authUser) {
      return res.status(401).json({ connected: false });
    }

    const { data: utente, error: utenteError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id")
      .or(`id.eq.${authUser.id},email.eq.${authUser.email}`)
      .maybeSingle();

    if (utenteError) {
      console.error("[m365/status] utente query error", utenteError);
      return res.status(200).json({ connected: false });
    }

    if (!utente?.id || !utente?.studio_id) {
      return res.status(200).json({ connected: false });
    }

    const requestedUserId =
      typeof req.query.userId === "string" && req.query.userId
        ? req.query.userId
        : utente.id;

    const requestedConnectionId =
      typeof req.query.microsoftConnectionId === "string" &&
      req.query.microsoftConnectionId
        ? req.query.microsoftConnectionId
        : null;

    let tokenQuery = supabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .select("token_cache_encrypted, revoked_at, scopes, connected_at")
      .eq("studio_id", utente.studio_id)
      .eq("user_id", requestedUserId)
      .is("revoked_at", null)
      .order("connected_at", { ascending: false })
      .limit(1);

    if (requestedConnectionId) {
      tokenQuery = tokenQuery.eq(
        "microsoft_connection_id",
        requestedConnectionId
      );
    }

    let { data: tokenRows, error: tokenError } = await tokenQuery;

    let tokenRow = tokenRows?.[0] ?? null;

    if (!tokenRow && requestedConnectionId) {
      console.warn("[m365/status] fallback without microsoft_connection_id", {
        requestedUserId,
        requestedConnectionId,
        studioId: utente.studio_id,
      });

      const fallbackResult = await supabaseAdmin
        .from("tbmicrosoft365_user_tokens")
        .select("token_cache_encrypted, revoked_at, scopes, connected_at")
        .eq("studio_id", utente.studio_id)
        .eq("user_id", requestedUserId)
        .is("revoked_at", null)
        .order("connected_at", { ascending: false })
        .limit(1);

      tokenRows = fallbackResult.data;
      tokenError = fallbackResult.error;
      tokenRow = tokenRows?.[0] ?? null;
    }

    if (tokenError) {
      console.error("[m365/status] token query error", tokenError);
    }

    console.log("[m365/status] debug", {
      authUserId: authUser.id,
      utenteId: utente.id,
      requestedUserId,
      requestedConnectionId,
      studioId: utente.studio_id,
      found: !!tokenRow,
      connectedAt: tokenRow?.connected_at ?? null,
      hasCache: !!tokenRow?.token_cache_encrypted,
    });

    const connected = !!tokenRow?.token_cache_encrypted;

    return res.status(200).json({
      connected,
      connected_at: tokenRow?.connected_at ?? null,
      scopes: tokenRow?.scopes ?? null,
    });
  } catch (e) {
    console.error("[m365/status]", e);
    return res.status(200).json({ connected: false });
  }
}
