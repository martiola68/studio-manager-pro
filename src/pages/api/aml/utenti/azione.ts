import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * Azioni amministrative AML isolate dai vecchi endpoint SMP.
 * Ogni richiesta valida il token, lo studio del chiamante e quello del target.
 * Il client non può indicare arbitrariamente email, studio o stato.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito" });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) return res.status(500).json({ error: "Configurazione del server incompleta" });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const authorization = String(req.headers.authorization || "");
    if (!authorization.startsWith("Bearer ")) return res.status(401).json({ error: "Accesso richiesto" });
    const token = authorization.slice("Bearer ".length).trim();
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return res.status(401).json({ error: "Sessione scaduta" });

    const { data: manager, error: managerError } = await admin.from("tbutenti")
      .select("id, user_id, studio_id, tipo_utente, attivo, amministratore_sistema_generale")
      .eq("user_id", auth.user.id).maybeSingle();
    if (managerError || !manager || manager.attivo === false || manager.tipo_utente !== "Admin" || !manager.studio_id) {
      return res.status(403).json({ error: "Operazione riservata all'amministratore attivo dello studio" });
    }
    const { azione, userId } = req.body || {};
    if (!["reset", "toggle", "delete"].includes(String(azione)) || typeof userId !== "string") {
      return res.status(400).json({ error: "Azione o utente non valido" });
    }
    const { data: target, error: targetError } = await admin.from("tbutenti")
      .select("id,user_id,studio_id,email,nome,cognome,tipo_utente,attivo,amministratore_sistema_generale")
      .eq("id", userId).eq("studio_id", manager.studio_id).maybeSingle();
    if (targetError) throw targetError;
    if (!target) return res.status(404).json({ error: "Utente non appartenente allo studio" });

    const self = target.id === manager.id || target.user_id === auth.user.id;
    const privileged = Boolean(target.amministratore_sistema_generale);
    if (azione !== "reset" && (self || privileged)) {
      return res.status(403).json({ error: self
        ? "Non puoi disattivare o eliminare il tuo stesso account."
        : "L'Amministratore generale di sistema non può essere disattivato o eliminato." });
    }

    if (azione === "reset") {
      if (!target.email) return res.status(400).json({ error: "Email dell'utente mancante" });
      const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const trustedBase = (process.env.NEXT_PUBLIC_AML_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.studiomanagerpro.it").replace(/\/$/, "");
      const { error } = await authClient.auth.resetPasswordForEmail(target.email, {
        redirectTo: trustedBase + "/auth/callback?type=recovery",
      });
      if (error) return res.status(502).json({ error: "Impossibile inviare il link di reset", details: error.message });
      return res.status(200).json({ success: true, message: "Richiesta di ripristino password inviata all'indirizzo dell'utente." });
    }

    if (azione === "toggle") {
      const next = target.attivo === false;
      if (!next && target.tipo_utente === "Admin") {
        const { count, error } = await admin.from("tbutenti").select("id", { count: "exact", head: true })
          .eq("studio_id", manager.studio_id).eq("tipo_utente", "Admin").eq("attivo", true);
        if (error) throw error;
        if (Number(count || 0) <= 1) return res.status(409).json({ error: "Lo studio deve conservare almeno un amministratore attivo." });
      }
      const { error: updateError } = await admin.from("tbutenti").update({ attivo: next })
        .eq("id", target.id).eq("studio_id", manager.studio_id);
      if (updateError) throw updateError;

      // Allinea anche l'accesso Supabase Auth. In caso d'errore ripristina
      // il flag in anagrafica evitando uno stato apparentemente riuscito.
      if (target.user_id) {
        const { error: banError } = await admin.auth.admin.updateUserById(target.user_id, {
          ban_duration: next ? "none" : "876000h",
        });
        if (banError) {
          await admin.from("tbutenti").update({ attivo: target.attivo !== false })
            .eq("id", target.id).eq("studio_id", manager.studio_id);
          return res.status(502).json({ error: "Cambio accesso Auth non riuscito; stato utente ripristinato.", details: banError.message });
        }
      }
      return res.status(200).json({ success: true, message: next ? "Utente riattivato." : "Utente disattivato." });
    }

    // La cancellazione non deve mai distruggere riferimenti operativi:
    // un utente collegato va disattivato e rimane nello storico.
    if (target.attivo !== false) return res.status(409).json({ error: "Disattiva prima l'utente, poi potrai richiederne l'eliminazione." });
    if (target.tipo_utente === "Admin") return res.status(409).json({ error: "Un amministratore non può essere eliminato direttamente. Occorre prima riassegnare il ruolo." });

    const references: Array<{ table: string; column: string }> = [
      { table: "tbclienti", column: "utente_operatore_id" },
      { table: "tbclienti", column: "utente_professionista_id" },
      { table: "tbclienti", column: "utente_payroll_id" },
      { table: "tbPraticheAML", column: "operatore_responsabile_id" },
      { table: "tbscadenze_centrale", column: "operatore_responsabile_id" },
    ];
    for (const ref of references) {
      const { count, error } = await admin.from(ref.table).select("*", { count: "exact", head: true })
        .eq("studio_id", manager.studio_id).eq(ref.column, target.id);
      // Un errore di schema non autorizza a saltare un controllo.
      if (error) return res.status(409).json({ error: "Verifica dei collegamenti non completata: eliminazione bloccata.", details: ref.table + ": " + error.message });
      if (Number(count || 0) > 0) return res.status(409).json({ error: "Utente collegato a dati professionali (" + ref.table + "). Mantienilo disattivato per preservare lo storico." });
    }

    // Il DB può avere altri vincoli FK: in tal caso la cancellazione
    // fallirà e l'account Auth non verrà rimosso.
    const { data: deleted, error: deleteError } = await admin.from("tbutenti").delete()
      .eq("id", target.id).eq("studio_id", manager.studio_id).select("id").maybeSingle();
    if (deleteError) return res.status(409).json({ error: "Utente collegato ad altri dati: eliminazione non consentita.", details: deleteError.message });
    if (!deleted) return res.status(409).json({ error: "Eliminazione non eseguita: riprova dopo aver verificato le dipendenze." });

    if (target.user_id) {
      const { error: authDeleteError } = await admin.auth.admin.deleteUser(target.user_id);
      if (authDeleteError) {
        console.error("[AML users] profilo eliminato, account Auth da pulire:", target.user_id, authDeleteError);
        return res.status(502).json({ error: "Profilo eliminato, ma cancellazione delle credenziali non completata. Contatta l'amministratore del servizio." });
      }
    }
    return res.status(200).json({ success: true, message: "Utente eliminato definitivamente." });
  } catch (error) {
    console.error("[AML users] gestione account non riuscita", error);
    return res.status(500).json({ error: "Operazione non riuscita" });
  }
}
