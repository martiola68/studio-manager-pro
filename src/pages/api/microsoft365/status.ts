import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const connectionId =
      typeof req.query.connection_id === "string"
        ? req.query.connection_id
        : typeof req.query.microsoftConnectionId === "string"
          ? req.query.microsoftConnectionId
          : null;

    if (!connectionId) {
      return res.status(200).json({
        connected: false,
        debug: "missing_connection_id",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .select("token_cache_encrypted, revoked_at, scopes, connected_at")
      .eq("microsoft_connection_id", connectionId)
      .is("revoked_at", null)
      .order("connected_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("[m365/status] error", error);
      return res.status(200).json({
        connected: false,
        debug: "query_error",
      });
    }

    const tokenRow = data?.[0] ?? null;

    return res.status(200).json({
      connected: !!tokenRow?.token_cache_encrypted,
      connected_at: tokenRow?.connected_at ?? null,
      scopes: tokenRow?.scopes ?? null,
      debug: "status_ultra_safe_v1",
    });
  } catch (e) {
    console.error("[m365/status] fatal", e);
    return res.status(200).json({
      connected: false,
      debug: "catch_error",
    });
  }
}
