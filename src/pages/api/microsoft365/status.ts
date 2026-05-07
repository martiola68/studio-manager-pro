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
    const connectionId =
      typeof req.query.connection_id === "string" && req.query.connection_id
        ? req.query.connection_id
        : typeof req.query.microsoftConnectionId === "string" &&
            req.query.microsoftConnectionId
          ? req.query.microsoftConnectionId
          : null;

    const requestedUserId =
      typeof req.query.userId === "string" && req.query.userId
        ? req.query.userId
        : null;

    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    let studioId: string | null = null;
    let userId: string | null = requestedUserId;

    if (token) {
      const { data: userRes } = await supabaseAdmin.auth.getUser(token);
      const authUser = userRes?.user;

      if (authUser) {
        const { data: utente } = await supabaseAdmin
          .from("tbutenti")
          .select("id, studio_id")
          .or(`id.eq.${authUser.id},email.eq.${authUser.email}`)
          .maybeSingle();

        studioId = utente?.studio_id ?? null;
        userId = requestedUserId ?? utente?.id ?? null;
      }
    }

    let tokenQuery = supabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .select("token_cache_encrypted, revoked_at, scopes, connected_at")
      .is("revoked_at", null)
      .order("connected_at", { ascending: false })
      .limit(1);

    if (studioId) {
      tokenQuery = tokenQuery.eq("studio_id", studioId);
    }

    if (userId) {
      tokenQuery = tokenQuery.eq("user_id", userId);
    }

    if (connectionId) {
      tokenQuery = tokenQuery.eq("microsoft_connection_id", connectionId);
    }

    const { data: tokenRows, error: tokenError } = await tokenQuery;

    if (tokenError) {
      console.error("[m365/status] token query error", tokenError);
      return res.status(200).json({ connected: false });
    }

    const tokenRow = tokenRows?.[0] ?? null;

    return res.status(200).json({
      connected: !!tokenRow?.token_cache_encrypted,
      connected_at: tokenRow?.connected_at ?? null,
      scopes: tokenRow?.scopes ?? null,
    });
  } catch (e) {
    console.error("[m365/status]", e);
    return res.status(200).json({ connected: false });
  }
}
