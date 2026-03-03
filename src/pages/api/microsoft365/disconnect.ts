import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface DisconnectResponse {
  success: boolean;
  message?: string;
  error?: string;
}

function getBearerToken(req: NextApiRequest): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DisconnectResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use POST.",
    });
  }

  try {
    const supabase = createClient(req, res);

    // 1) Prova sessione via cookie
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    let authUserId: string | null = session?.user?.id ?? null;

    // 2) Fallback: Bearer token
    if (!authUserId) {
      const bearer = getBearerToken(req);
      if (bearer) {
        const { data, error } = await supabaseAdmin.auth.getUser(bearer);
        if (!error) authUserId = data.user?.id ?? null;
      }
    }

    if (!authUserId) {
      console.warn("[Microsoft 365 Disconnect] Not authenticated", {
        hasCookieSession: Boolean(session),
        sessionError: sessionError?.message,
        hasBearer: Boolean(getBearerToken(req)),
      });

      return res.status(401).json({
        success: false,
        error: "Non autenticato. Effettua il login.",
      });
    }

    // 3) Trova studio_id e user_id (tabella tbutenti)
    const { data: utente, error: utenteErr } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id")
      .or(`id.eq.${authUserId},email.eq.${session?.user?.email ?? ""}`)
      .maybeSingle();

    if (utenteErr || !utente?.id || !utente?.studio_id) {
      console.error("[Microsoft 365 Disconnect] tbutenti not found:", {
        authUserId,
        utenteErr: utenteErr?.message,
      });
      return res.status(500).json({
        success: false,
        error: "Impossibile determinare studio/utente.",
      });
    }

    const studioId = utente.studio_id;
    const userId = utente.id;

    // 4) Marca come revocato (NON cancellare la riga)
    const { error: revErr } = await supabaseAdmin
      .from("tbmicrosoft365_user_tokens")
      .update({
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("studio_id", studioId)
      .eq("user_id", userId);

    if (revErr) {
      console.error("[Microsoft 365 Disconnect] revoke update error:", {
        studioId,
        userId,
        error: revErr.message,
      });
      return res.status(500).json({
        success: false,
        error: "Errore durante la disconnessione. Riprova.",
      });
    }

    console.log("[Microsoft 365 Disconnect] Success:", { studioId, userId });

    return res.status(200).json({
      success: true,
      message: "Account Microsoft 365 disconnesso con successo.",
    });
  } catch (error) {
    console.error("[Microsoft 365 Disconnect] Unexpected error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Errore sconosciuto",
    });
  }
}
