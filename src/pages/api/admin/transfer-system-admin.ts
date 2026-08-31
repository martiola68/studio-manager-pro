import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
    if (!token) return res.status(401).json({ error: "Non autenticato" });

    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authUser) return res.status(401).json({ error: "Sessione non valida" });

    const { data: caller, error: callerError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, user_id, email, tipo_utente, attivo, amministratore_sistema_generale")
      .or(`user_id.eq.${authUser.id},email.eq.${authUser.email || ""}`)
      .limit(1)
      .maybeSingle();

    if (callerError || !caller) return res.status(403).json({ error: "Utente applicativo non trovato" });
    if (caller.attivo === false || caller.tipo_utente !== "Admin" || !caller.amministratore_sistema_generale) {
      return res.status(403).json({ error: "Operazione riservata all'Amministratore di sistema generale" });
    }

    const targetUserId = String(req.body?.targetUserId || "").trim();
    const confirmation = String(req.body?.confirmation || "").trim();
    if (!targetUserId) return res.status(400).json({ error: "Nuovo amministratore non indicato" });
    if (targetUserId === caller.id) return res.status(400).json({ error: "Seleziona un utente diverso" });

    const { data: target, error: targetError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, nome, cognome, email, tipo_utente, attivo, amministratore_sistema_generale")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetError || !target) return res.status(404).json({ error: "Nuovo amministratore non trovato" });
    if (target.attivo === false) return res.status(400).json({ error: "Il nuovo amministratore deve essere attivo" });
    if (target.tipo_utente !== "Admin") return res.status(400).json({ error: "Il nuovo amministratore deve essere di tipo Amministratore" });

    const expectedConfirmation = `TRASFERISCI A ${String(target.email || "").toLowerCase()}`;
    if (confirmation.toLowerCase() !== expectedConfirmation.toLowerCase()) {
      return res.status(400).json({ error: "Conferma di sicurezza non valida", expectedConfirmation });
    }

    const { data, error } = await supabaseAdmin.rpc("trasferisci_amministratore_sistema_generale", {
      p_da_utente_id: caller.id,
      p_a_utente_id: target.id,
    });

    if (error) {
      console.error("Errore trasferimento amministratore generale:", error);
      return res.status(500).json({ error: "Trasferimento non riuscito", details: error.message });
    }

    return res.status(200).json({
      success: true,
      message: "Amministratore di sistema generale trasferito correttamente",
      precedenteUtenteId: caller.id,
      nuovoUtente: { id: target.id, nome: target.nome, cognome: target.cognome, email: target.email },
      result: data,
    });
  } catch (error: any) {
    console.error("Errore API transfer-system-admin:", error);
    return res.status(500).json({ error: "Errore interno del server", details: error?.message || "Errore sconosciuto" });
  }
}
