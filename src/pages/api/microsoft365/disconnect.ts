import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin"; // <-- se non ce l'hai, vedi nota sotto

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

export default async function handler(req: NextApiRequest, res: NextApiResponse<DisconnectResponse>) {
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

    let userId: string | null = session?.user?.id ?? null;

    // 2) Fallback: Bearer token (se cookie assente o errore sessione)
    if (!userId) {
      const bearer = getBearerToken(req);
      if (bearer) {
        // Qui uso un client admin o "public" server-side che possa validare JWT.
        // Se usi supabaseAdmin (service role) è super affidabile.
        const { data, error } = await supabaseAdmin.auth.getUser(bearer);
        if (!error) userId = data.user?.id ?? null;
      }
    }

    if (!userId) {
      // Se vuoi, puoi loggare sessionError per debug, senza esporlo al client
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

    const { error: deleteError, data: deletedRows } = await supabase
      .from("tbmicrosoft_tokens")
      .delete()
      .eq("user_id", userId)
      .select("user_id"); // per avere feedback su quante righe hai eliminato

    if (deleteError) {
      console.error("[Microsoft 365 Disconnect] Delete error:", {
        userId,
        error: deleteError.message,
      });

      return res.status(500).json({
        success: false,
        error: "Errore durante la disconnessione. Riprova.",
      });
    }

    console.log("[Microsoft 365 Disconnect] Success:", {
      userId,
      tokensDeleted: deletedRows?.length ?? 0,
    });

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
