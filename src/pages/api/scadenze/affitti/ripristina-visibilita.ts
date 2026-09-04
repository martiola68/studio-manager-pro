import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return res.status(401).json({ error: "Token mancante" });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Sessione non valida" });
    }

    let { data: utente, error: utenteError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id, email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!utente && user.email) {
      const fallback = await supabaseAdmin
        .from("tbutenti")
        .select("id, studio_id, email")
        .ilike("email", user.email)
        .maybeSingle();
      utente = fallback.data;
      utenteError = fallback.error;
    }

    if (utenteError || !utente?.studio_id) {
      return res.status(403).json({ error: "Studio utente non disponibile" });
    }

    const studioId = String(utente.studio_id);

    const { data: clienti, error: clientiError } = await supabaseAdmin
      .from("tbclienti")
      .select("id")
      .eq("studio_id", studioId);

    if (clientiError) throw clientiError;

    const clienteIds = (clienti || []).map((c: any) => String(c.id));
    if (clienteIds.length === 0) {
      return res.status(200).json({ repaired: 0, studio_id: studioId });
    }

    const { data: contratti, error: contrattiError } = await supabaseAdmin
      .from("tbscadaffitti")
      .select("id, cliente_id, studio_id")
      .in("cliente_id", clienteIds);

    if (contrattiError) throw contrattiError;

    const daRiparare = (contratti || []).filter(
      (r: any) => String(r.studio_id || "") !== studioId
    );

    if (daRiparare.length === 0) {
      return res.status(200).json({ repaired: 0, studio_id: studioId });
    }

    const ids = daRiparare.map((r: any) => String(r.id));
    const { error: updateError } = await supabaseAdmin
      .from("tbscadaffitti")
      .update({ studio_id: studioId })
      .in("id", ids);

    if (updateError) throw updateError;

    return res.status(200).json({ repaired: ids.length, studio_id: studioId });
  } catch (error: any) {
    console.error("Errore ripristino visibilità contratti affitto:", error);
    return res.status(500).json({
      error: error?.message || "Errore durante il ripristino dei contratti",
    });
  }
}
