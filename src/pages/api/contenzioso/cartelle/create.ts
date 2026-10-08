import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

function getBearerToken(req: NextApiRequest): string | null {
  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "Non autenticato" });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    const authUser = authData.user;

    if (authError || !authUser) {
      return res.status(401).json({ ok: false, error: "Sessione non valida" });
    }

    const { data: utente, error: utenteError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id")
      .or(`user_id.eq.${authUser.id},email.eq.${authUser.email || ""}`)
      .limit(1)
      .maybeSingle();

    if (utenteError || !utente?.studio_id) {
      return res.status(403).json({ ok: false, error: "Studio utente non disponibile" });
    }

    const payload = req.body || {};

    if (!payload.cliente_id) {
      return res.status(400).json({ ok: false, error: "Cliente non indicato" });
    }

    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from("tbclienti")
      .select("id")
      .eq("id", payload.cliente_id)
      .eq("studio_id", utente.studio_id)
      .maybeSingle();

    if (clienteError || !cliente?.id) {
      return res.status(403).json({ ok: false, error: "Cliente non appartenente allo studio" });
    }

    const { data, error } = await supabaseAdmin
      .from("tbcontenzioso_cartelle")
      .insert({
        ...payload,
        studio_id: utente.studio_id,
        avviso_bonario_id: payload.avviso_bonario_id || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    return res.status(200).json({ ok: true, id: data.id });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Errore salvataggio cartella",
    });
  }
}
