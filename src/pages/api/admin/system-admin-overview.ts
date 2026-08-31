import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
    if (!token) return res.status(401).json({ error: "Non autenticato" });

    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authUser) return res.status(401).json({ error: "Sessione non valida" });

    const { data: caller, error: callerError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, nome, cognome, email, tipo_utente, attivo, amministratore_sistema_generale")
      .or(`user_id.eq.${authUser.id},email.eq.${authUser.email || ""}`)
      .limit(1)
      .maybeSingle();

    if (callerError || !caller) return res.status(403).json({ error: "Utente applicativo non trovato" });
    if (caller.attivo === false || caller.tipo_utente !== "Admin" || !caller.amministratore_sistema_generale) {
      return res.status(403).json({ error: "Accesso riservato all'Amministratore di sistema generale" });
    }

    const { data: currentAdmin, error: currentError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, nome, cognome, email, studio_id, tipo_utente, attivo")
      .eq("amministratore_sistema_generale", true)
      .limit(1)
      .maybeSingle();

    if (currentError) {
      return res.status(500).json({ error: "Errore lettura amministratore generale", details: currentError.message });
    }

    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, nome, cognome, email, studio_id, tipo_utente, attivo")
      .eq("tipo_utente", "Admin")
      .eq("attivo", true)
      .order("cognome", { ascending: true })
      .order("nome", { ascending: true });

    if (candidatesError) {
      return res.status(500).json({ error: "Errore lettura amministratori", details: candidatesError.message });
    }

    const { data: studi, error: studiError } = await supabaseAdmin
      .from("tbstudio")
      .select("id, ragione_sociale, denominazione_breve, email")
      .order("ragione_sociale", { ascending: true });

    if (studiError) {
      return res.status(500).json({ error: "Errore lettura studi", details: studiError.message });
    }

    const { data: utenti, error: utentiError } = await supabaseAdmin
      .from("tbutenti")
      .select("studio_id, tipo_utente, attivo");

    if (utentiError) {
      return res.status(500).json({ error: "Errore lettura utenti studi", details: utentiError.message });
    }

    const studioStats = (studi || []).map((studio) => {
      const utentiStudio = (utenti || []).filter((utente) => utente.studio_id === studio.id);
      return {
        ...studio,
        utenti_totali: utentiStudio.length,
        utenti_attivi: utentiStudio.filter((utente) => utente.attivo !== false).length,
        amministratori_attivi: utentiStudio.filter(
          (utente) => utente.tipo_utente === "Admin" && utente.attivo !== false
        ).length,
      };
    });

    return res.status(200).json({
      currentAdmin,
      candidates: (candidates || []).filter((u) => u.id !== currentAdmin?.id),
      studi: studioStats,
    });
  } catch (error: any) {
    console.error("Errore API system-admin-overview:", error);
    return res.status(500).json({ error: "Errore interno del server", details: error?.message || "Errore sconosciuto" });
  }
}
