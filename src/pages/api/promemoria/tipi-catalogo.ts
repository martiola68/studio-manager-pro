import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * Catalogo dei tipi promemoria (condiviso fra gli studi).
 * Tutte le scritture sono server-side e riservate all'amministratore
 * del catalogo; nessuna scrittura con service role dal browser.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito" });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    return res.status(500).json({ error: "Configurazione Supabase del server incompleta" });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const authHeader = String(req.headers.authorization || "");
    if (!/^Bearer\s+\S+$/i.test(authHeader)) return res.status(401).json({ error: "Accesso richiesto" });
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Sessione scaduta: esegui nuovamente l'accesso" });

    const { data: byId, error: byIdError } = await admin.from("tbutenti")
      .select("id, user_id, email, studio_id, nome, cognome, tipo_utente, attivo, amministratore_sistema_generale")
      .eq("user_id", user.id).maybeSingle();
    if (byIdError) throw new Error("Impossibile verificare l'account utente: " + byIdError.message);

    let profile = byId;
    if (!profile && user.email) {
      const { data: byEmail, error: byEmailError } = await admin.from("tbutenti")
        .select("id, user_id, email, studio_id, nome, cognome, tipo_utente, attivo, amministratore_sistema_generale")
        .ilike("email", user.email).maybeSingle();
      if (byEmailError) throw new Error("Impossibile verificare l'account email: " + byEmailError.message);
      profile = byEmail;
    }

    const normalize = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
    if (!profile || profile.attivo === false || normalize(profile.tipo_utente) !== "ADMIN" || !profile.studio_id) {
      return res.status(403).json({ error: "Operazione riservata all'amministratore attivo" });
    }

    // Prima verifica l'autorizzazione reale della funzione SQL con il token utente.
    const caller = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: "Bearer " + token } },
    });
    const { data: catalogAdmin, error: catalogError } = await caller.rpc("is_system_catalog_admin");

    // Compatibilità con il controllo admin originale del frontend SMP:
    // verifica gli stessi attributi usando valori letti dal server, mai dal client.
    let allowed = !catalogError && catalogAdmin === true;
    if (!allowed) {
      const { data: studio, error: studioError } = await admin.from("tbstudio")
        .select("ragione_sociale").eq("id", profile.studio_id).maybeSingle();
      if (studioError) throw new Error("Impossibile verificare lo studio");
      allowed = normalize(profile.nome) === "MARIO" &&
        normalize(profile.cognome) === "ARTIOLA" &&
        normalize(studio?.ragione_sociale).startsWith("REVISIONI COMMERCIALI");
    }
    if (!allowed) {
      return res.status(403).json({ error: "Solo l'amministratore generale può modificare il catalogo dei tipi promemoria" });
    }

    const { operazione, id, nome, colore } = req.body || {};
    if (!["crea", "modifica", "elimina"].includes(operazione)) {
      return res.status(400).json({ error: "Operazione non valida" });
    }
    if (operazione !== "crea" && (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) {
      return res.status(400).json({ error: "Identificativo del tipo non valido" });
    }
    const normalizedName = typeof nome === "string" ? nome.trim().replace(/\s+/g, " ") : "";
    if (operazione !== "elimina") {
      if (!normalizedName || normalizedName.length > 120) {
        return res.status(400).json({ error: "Inserisci un nome di massimo 120 caratteri" });
      }
      if (typeof colore !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(colore)) {
        return res.status(400).json({ error: "Seleziona un colore valido" });
      }
    }

    let action: any;
    if (operazione === "crea") {
      const { data: existing, error: duplicateError } = await admin.from("tbtipopromemoria")
        .select("id").ilike("nome", normalizedName).limit(1);
      if (duplicateError) throw duplicateError;
      if (existing?.length) return res.status(409).json({ error: "Esiste già un tipo promemoria con questo nome" });
      action = admin.from("tbtipopromemoria")
        .insert({ nome: normalizedName, colore, origine: "S", studio_id: null, descrizione: null }).select("id").single();
    } else if (operazione === "modifica") {
      action = admin.from("tbtipopromemoria")
        .update({ nome: normalizedName, colore, descrizione: null })
        .eq("id", id).eq("origine", "S").select("id").single();
    } else {
      action = admin.from("tbtipopromemoria")
        .delete().eq("id", id).eq("origine", "S").select("id").single();
    }

    const { data, error } = await action;
    if (error) {
      const message = String(error.message || "");
      if (error.code === "23505") return res.status(409).json({ error: "Tipo promemoria già esistente" });
      if (error.code === "23503") return res.status(409).json({ error: "Tipo collegato a promemoria esistenti: non può essere eliminato" });
      console.error("[Tipi Promemoria] Errore DB:", error.code, message);
      return res.status(409).json({ error: "Salvataggio non riuscito: " + message });
    }
    if (!data) return res.status(404).json({ error: "Tipo promemoria non trovato" });
    return res.status(200).json({ ok: true, id: data.id });
  } catch (error) {
    console.error("[Tipi Promemoria] Errore:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Errore durante il salvataggio" });
  }
}
