import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type AdminRow = {
  id: string;
  studio_id: string | null;
  tipo_utente: string | null;
  amministratore_sistema_generale?: boolean | null;
};

async function resolveAdmin(req: NextApiRequest): Promise<AdminRow> {
  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.startsWith("Bearer ")) throw Object.assign(new Error("Non autenticato"), { status: 401 });
  const token = authHeader.slice(7).trim();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) throw Object.assign(new Error("Sessione non valida"), { status: 401 });

  const authUser = authData.user;
  let query = supabaseAdmin
    .from("tbutenti")
    .select("id,studio_id,tipo_utente,amministratore_sistema_generale")
    .eq("user_id", authUser.id)
    .maybeSingle();
  let result = await query;

  if ((!result.data || result.error) && authUser.email) {
    result = await supabaseAdmin
      .from("tbutenti")
      .select("id,studio_id,tipo_utente,amministratore_sistema_generale")
      .eq("email", authUser.email.toLowerCase())
      .maybeSingle();
  }
  if (result.error || !result.data) throw Object.assign(new Error("Utente applicativo non trovato"), { status: 403 });
  if (result.data.tipo_utente !== "Admin" && result.data.amministratore_sistema_generale !== true) {
    throw Object.assign(new Error("Operazione riservata agli amministratori"), { status: 403 });
  }
  if (!result.data.studio_id) throw Object.assign(new Error("Studio non associato all'amministratore"), { status: 400 });
  return result.data as AdminRow;
}

function normalizzaRuolo(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const admin = await resolveAdmin(req);
    const studioId = String(admin.studio_id);

    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("tbroperatore")
        .select("id,ruolo,studio_id,created_at,updated_at")
        .eq("studio_id", studioId)
        .order("ruolo", { ascending: true });
      if (error) throw error;
      return res.status(200).json({ success: true, data: data || [] });
    }

    if (req.method === "POST") {
      const ruolo = normalizzaRuolo(req.body?.ruolo);
      if (!ruolo) return res.status(400).json({ success: false, error: "Ruolo obbligatorio" });

      const { data: duplicate, error: duplicateError } = await supabaseAdmin
        .from("tbroperatore")
        .select("id")
        .eq("studio_id", studioId)
        .ilike("ruolo", ruolo)
        .limit(1);
      if (duplicateError) throw duplicateError;
      if ((duplicate || []).length) return res.status(409).json({ success: false, error: "Questo ruolo esiste già nello studio" });

      const { data, error } = await supabaseAdmin
        .from("tbroperatore")
        .insert({ studio_id: studioId, ruolo })
        .select("id,ruolo,studio_id,created_at,updated_at")
        .single();
      if (error) throw error;
      return res.status(201).json({ success: true, data });
    }

    if (req.method === "PATCH") {
      const id = String(req.body?.id || "").trim();
      const ruolo = normalizzaRuolo(req.body?.ruolo);
      if (!id || !ruolo) return res.status(400).json({ success: false, error: "ID e ruolo obbligatori" });

      const { data: duplicate, error: duplicateError } = await supabaseAdmin
        .from("tbroperatore")
        .select("id")
        .eq("studio_id", studioId)
        .ilike("ruolo", ruolo)
        .neq("id", id)
        .limit(1);
      if (duplicateError) throw duplicateError;
      if ((duplicate || []).length) return res.status(409).json({ success: false, error: "Questo ruolo esiste già nello studio" });

      const { data, error } = await supabaseAdmin
        .from("tbroperatore")
        .update({ ruolo, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("studio_id", studioId)
        .select("id,ruolo,studio_id,created_at,updated_at")
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: "Ruolo non trovato" });
      return res.status(200).json({ success: true, data });
    }

    if (req.method === "DELETE") {
      const id = String(req.query.id || "").trim();
      if (!id) return res.status(400).json({ success: false, error: "ID ruolo obbligatorio" });

      const { count, error: countError } = await supabaseAdmin
        .from("tbutenti")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .eq("ruolo_operatore_id", id);
      if (countError) throw countError;
      if ((count || 0) > 0) {
        return res.status(409).json({
          success: false,
          error: `Ruolo assegnato a ${count} utent${count === 1 ? "e" : "i"}. Riassegna prima gli utenti.`
        });
      }

      const { error } = await supabaseAdmin.from("tbroperatore").delete().eq("id", id).eq("studio_id", studioId);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    res.setHeader("Allow", "GET,POST,PATCH,DELETE");
    return res.status(405).json({ success: false, error: "Metodo non consentito" });
  } catch (error: any) {
    console.error("API ruoli:", error);
    return res.status(Number(error?.status) || 500).json({ success: false, error: error?.message || "Errore interno server" });
  }
}
