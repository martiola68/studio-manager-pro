import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@/lib/supabase/server";

interface DisconnectResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DisconnectResponse>
) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use POST or DELETE.",
    });
  }

  try {
    const supabase = createClient(req, res);
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return res.status(401).json({
        success: false,
        error: "Non autenticato. Effettua il login.",
      });
    }

    const userId = session.user.id;

    const { error: deleteError, count } = await supabase
      .from("tbmicrosoft_tokens")
      .delete()
      .eq("user_id", userId);

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
      tokensDeleted: count || 0,
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