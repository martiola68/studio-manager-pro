import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ESITI = new Set([
  "nessuna_variazione", "variazione_titolare_ppe", "variazione_rischio",
  "variazione_entrambi", "aggiornamento_dati", "approfondimento",
]);

const isDate = (value: unknown): value is string =>
  typeof value === "string" && /^\\d{4}-\\d{2}-\\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value + "T12:00:00Z"));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return res.status(401).json({ error: "Autenticazione richiesta" });

    const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !auth.user) return res.status(401).json({ error: "Sessione non valida" });

    const { data: user, error: userError } = await supabaseAdmin
      .from("tbutenti")
      .select("id, studio_id")
      .or(`user_id.eq.${auth.user.id},email.eq.${auth.user.email || ""}`)
      .limit(1)
      .maybeSingle();
    if (userError || !user?.studio_id) return res.status(403).json({ error: "Studio non autorizzato" });

    const praticaId = String((req.method === "GET" ? req.query.pratica_id : req.body?.pratica_id) || "").trim();
    if (!praticaId) return res.status(400).json({ error: "Pratica obbligatoria" });

    const { data: pratica, error: praticaError } = await supabaseAdmin
      .from("tbPraticheAML")
      .select("id, studio_id, cliente_id, data_prossimo_rinnovo")
      .eq("id", praticaId)
      .eq("studio_id", user.studio_id)
      .maybeSingle();
    if (praticaError) throw praticaError;
    if (!pratica?.cliente_id) return res.status(404).json({ error: "Pratica non trovata nello studio" });

    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("tbAMLControlliCostanti")
        .select("id, data_controllo, esito, verifiche, fonti, note, adeguata_verifica, prossima_scadenza, created_at")
        .eq("studio_id", user.studio_id)
        .eq("pratica_id", praticaId)
        .order("data_controllo", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return res.status(200).json({ ok: true, controlli: data || [], pratica });
    }

    const payload = req.body || {};
    if (!isDate(payload.data_controllo) || payload.data_controllo > new Date().toISOString().slice(0, 10)) {
      return res.status(400).json({ error: "Data del controllo non valida" });
    }
    if (!ESITI.has(payload.esito)) return res.status(400).json({ error: "Esito non valido" });

    const verifiche = payload.verifiche && typeof payload.verifiche === "object" && !Array.isArray(payload.verifiche)
      ? payload.verifiche : {};
    const checks = ["anagrafica", "titolare_effettivo", "ppe", "prestazione", "operativita", "rischio", "documenti"];
    if (!checks.every(k => verifiche[k] === true)) return res.status(400).json({ error: "Completa tutti i controlli prima della conferma" });

    const fonti = String(payload.fonti || "").trim().slice(0, 8000);
    const note = String(payload.note || "").trim().slice(0, 12000);
    if (!fonti) return res.status(400).json({ error: "Indicare le fonti delle verifiche effettuate" });
    if (!note) return res.status(400).json({ error: "Descrivere l'esito del controllo" });

    const scadenza = payload.esito === "nessuna_variazione" ? payload.prossima_scadenza : null;
    if (payload.esito === "nessuna_variazione" && (!isDate(scadenza) || scadenza <= payload.data_controllo)) {
      return res.status(400).json({ error: "La prossima scadenza deve essere successiva alla data del controllo" });
    }

    const { data: record, error } = await supabaseAdmin
      .from("tbAMLControlliCostanti")
      .insert({
        studio_id: user.studio_id,
        cliente_id: pratica.cliente_id,
        pratica_id: praticaId,
        data_controllo: payload.data_controllo,
        esito: payload.esito,
        verifiche,
        fonti,
        note,
        adeguata_verifica: String(payload.adeguata_verifica || "").slice(0, 160) || null,
        prossima_scadenza: scadenza,
        created_by: auth.user.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    return res.status(201).json({ ok: true, id: record.id });
  } catch (error: any) {
    console.error("[AML AV7]", error);
    return res.status(500).json({ error: error?.message || "Errore controllo costante" });
  }
}
