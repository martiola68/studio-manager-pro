import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId richiesto" });
    }

    // Elimina utente da Auth
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      console.error("Errore eliminazione Auth:", error);
      return res.status(500).json({ 
        error: "Errore eliminazione utente",
        details: error.message
      });
    }

    return res.status(200).json({
      success: true,
      message: "Utente eliminato con successo"
    });

  } catch (error: any) {
    console.error("Errore API delete-user:", error);
    return res.status(500).json({ 
      error: "Errore interno del server",
      details: error.message
    });
  }
}