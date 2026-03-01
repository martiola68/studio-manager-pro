import type { NextApiRequest, NextApiResponse } from "next"
import { supabaseAdmin } from "@/lib/supabase/admin"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    // 🔐 auth utente Supabase
    const authHeader = req.headers.authorization || ""
    const token = authHeader.replace(/^Bearer\s+/i, "")

    if (!token) {
      return res.status(401).json({ connected: false })
    }

    const { data: userRes } = await supabaseAdmin.auth.getUser(token)
    const authUser = userRes?.user
    if (!authUser) {
      return res.status(401).json({ connected: false })
    }

    // 🔎 trova tbutenti
    const { data: utente } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id")
      .or(`id.eq.${authUser.id},email.eq.${authUser.email}`)
      .maybeSingle()

    if (!utente?.studio_id) {
      return res.status(200).json({ connected: false })
    }

    // 🔎 stato Microsoft 365 (UNICA VERITÀ)
    const { data: tokenRow } = await supabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .select("token_cache_encrypted, revoked_at, scopes, connected_at")
      .eq("studio_id", utente.studio_id)
      .eq("user_id", utente.id)
      .maybeSingle()

    const connected =
      !!tokenRow?.token_cache_encrypted && tokenRow.revoked_at === null

    return res.status(200).json({
      connected,
      connected_at: tokenRow?.connected_at ?? null,
      scopes: tokenRow?.scopes ?? null,
    })
  } catch (e) {
    console.error("[m365/status]", e)
    return res.status(200).json({ connected: false })
  }
}
