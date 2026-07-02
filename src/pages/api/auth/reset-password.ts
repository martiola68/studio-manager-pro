import { NextApiRequest, NextApiResponse } from "next";
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

function generaPasswordTemporanea() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%";
  return Array.from({ length: 12 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: "Email obbligatoria" });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ success: false, error: "Non autenticato" });
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user?.email) {
      return res.status(401).json({ success: false, error: "Sessione non valida" });
    }

    const { data: utente } = await supabaseAdmin
      .from("tbutenti")
      .select("tipo_utente")
      .eq("email", user.email)
      .single();

    if (!utente || utente.tipo_utente !== "Admin") {
      return res.status(403).json({
        success: false,
        error: "Solo gli amministratori possono resettare le password",
      });
    }

    const emailNorm = String(email).trim().toLowerCase();

    const { data: listData, error: listError } =
      await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (listError) {
      return res.status(400).json({
        success: false,
        error: "Errore ricerca utente Auth",
        details: listError.message,
      });
    }

    const authUser = listData.users.find(
      (u) => String(u.email || "").trim().toLowerCase() === emailNorm
    );

    if (!authUser) {
      return res.status(404).json({
        success: false,
        error: "Utente non trovato in Supabase Auth",
      });
    }

    const temporaryPassword = generaPasswordTemporanea();

    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        password: temporaryPassword,
        email_confirm: true,
      });

    if (updateError) {
      return res.status(400).json({
        success: false,
        error: "Errore aggiornamento password",
        details: updateError.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password temporanea generata correttamente",
      temporaryPassword,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Errore interno del server",
      details: error instanceof Error ? error.message : "Errore sconosciuto",
    });
  }
}
