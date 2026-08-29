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

const ALLOWED_FIELDS = [
  "nome",
  "cognome",
  "tipo_utente",
  "ruolo_operatore_id",
  "attivo",
  "settore",
  "responsabile",
  "responsabile_paghe",
  "responsabile_ferie_permessi",
  "microsoft_connection_id",
  "tipo_rapporto",
  "utente_comunicazioni",
] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    const {
      data: { user: authUser },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authUser) {
      return res.status(401).json({
        error: "Sessione non valida",
        details: authError?.message || "Utente non disponibile",
      });
    }

    const { data: adminRow, error: adminError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, user_id, email, tipo_utente, studio_id, attivo")
      .or(`user_id.eq.${authUser.id},email.eq.${authUser.email || ""}`)
      .limit(1)
      .maybeSingle();

    if (adminError || !adminRow) {
      return res.status(403).json({
        error: "Amministratore non trovato",
        details: adminError?.message || "Record utente assente",
      });
    }

    if (adminRow.tipo_utente !== "Admin" || adminRow.attivo === false) {
      return res.status(403).json({
        error: "Solo un amministratore attivo può modificare gli utenti",
      });
    }

    const { userId, updates } = req.body || {};

    if (!userId || !updates || typeof updates !== "object") {
      return res.status(400).json({ error: "Dati aggiornamento non validi" });
    }

    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id, email")
      .eq("id", userId)
      .maybeSingle();

    if (targetError) {
      return res.status(500).json({
        error: "Errore lettura utente",
        details: targetError.message,
      });
    }

    if (!targetUser) {
      return res.status(404).json({ error: "Utente non trovato" });
    }

    if (!adminRow.studio_id || targetUser.studio_id !== adminRow.studio_id) {
      return res.status(403).json({
        error: "Non puoi modificare utenti appartenenti a un altro studio",
      });
    }

    const payload: Record<string, unknown> = {};

    for (const field of ALLOWED_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(updates, field)) {
        payload[field] = updates[field];
      }
    }

    if (typeof payload.nome === "string") {
      payload.nome = payload.nome.trim();
    }
    if (typeof payload.cognome === "string") {
      payload.cognome = payload.cognome.trim();
    }

    if (!payload.nome || !payload.cognome) {
      return res.status(400).json({ error: "Nome e cognome sono obbligatori" });
    }

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("tbutenti")
      .update(payload)
      .eq("id", userId)
      .eq("studio_id", adminRow.studio_id)
      .select()
      .single();

    if (updateError) {
      console.error("Errore aggiornamento utente:", updateError);
      return res.status(500).json({
        error: "Impossibile aggiornare l'utente",
        details: updateError.message,
      });
    }

    return res.status(200).json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error("Errore API update-user:", error);
    return res.status(500).json({
      error: "Errore interno del server",
      details: error?.message || "Errore sconosciuto",
    });
  }
}
