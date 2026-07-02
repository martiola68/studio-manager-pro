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
  const maiuscole = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const minuscole = "abcdefghijkmnopqrstuvwxyz";
  const numeri = "23456789";
  const speciali = "!@$%";

  const all = maiuscole + minuscole + numeri + speciali;

  let password =
    maiuscole[Math.floor(Math.random() * maiuscole.length)] +
    minuscole[Math.floor(Math.random() * minuscole.length)] +
    numeri[Math.floor(Math.random() * numeri.length)] +
    speciali[Math.floor(Math.random() * speciali.length)];

  while (password.length < 12) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email obbligatoria" });
    }

    // 🔐 Verifica autenticazione
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Sessione non valida" });
    }

    // 🔐 Verifica Admin
    const { data: utente } = await supabaseAdmin
      .from("tbutenti")
      .select("tipo_utente")
      .eq("email", user.email)
      .single();

    if (!utente || utente.tipo_utente !== "Admin") {
      return res.status(403).json({
        error: "Solo gli amministratori possono resettare le password",
      });
    }

    // 🔥 URL corretto (QUI ERA IL TUO PROBLEMA)
  let userToReset: any = null;
let page = 1;

while (!userToReset) {
  const { data: targetUser, error: listError } =
    await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

  if (listError) {
    return res.status(400).json({
      error: "Errore ricerca utente",
      details: listError.message,
    });
  }

  userToReset = targetUser.users.find(
    (u) =>
      String(u.email || "").toLowerCase().trim() ===
      String(email || "").toLowerCase().trim()
  );

  if (userToReset || targetUser.users.length < 1000) {
    break;
  }

  page += 1;
}

if (!userToReset) {
  return res.status(404).json({
    success: false,
    error: "Utente non trovato in Supabase Auth",
    details: `Nessun utente Auth trovato con email ${email}`,
  });
}

const temporaryPassword = generaPasswordTemporanea();

const { error: updateError } =
  await supabaseAdmin.auth.admin.updateUserById(userToReset.id, {
    password: temporaryPassword,
  });

if (updateError) {
  return res.status(400).json({
    error: "Errore aggiornamento password",
    details: updateError.message,
  });
}

return res.status(200).json({
  success: true,
  message: "Password temporanea generata correttamente",
  temporaryPassword,
  warning: "Mostrare questa password solo una volta e comunicarla in modo sicuro all'utente.",
});
  } catch (error) {
    console.error("Errore API reset-password:", error);
    return res.status(500).json({
      error: "Errore interno del server",
      details:
        error instanceof Error ? error.message : "Errore sconosciuto",
    });
  }
}
