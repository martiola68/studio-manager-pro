import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
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

    // 🔍 1. Recupero user_id da DB
    const { data: utente, error: fetchError } = await supabaseAdmin
      .from("tbutenti")
      .select("user_id")
      .eq("id", userId)
      .single();

    if (fetchError) {
      console.error("Errore fetch utente:", fetchError);
      return res.status(500).json({
        error: "Errore lettura utente",
        details: fetchError.message,
      });
    }

    // 🔥 2. Elimina da Auth SOLO se esiste user_id
    if (utente?.user_id) {
      const { error: authError } =
        await supabaseAdmin.auth.admin.deleteUser(utente.user_id);

      if (authError) {
        console.error("Errore eliminazione Auth:", authError);
        // NON bloccare → continuiamo comunque
      }
    }

    // 🗑️ 3. Elimina da tbutenti
    const { error: dbError } = await supabaseAdmin
      .from("tbutenti")
      .delete()
      .eq("id", userId);

    if (dbError) {
      console.error("Errore eliminazione DB:", dbError);
      return res.status(500).json({
        error: "Errore eliminazione utente",
        details: dbError.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Utente eliminato completamente",
    });

  } catch (error: any) {
    console.error("Errore API delete-user:", error);
    return res.status(500).json({
      error: "Errore interno del server",
      details: error.message,
    });
  }
}
