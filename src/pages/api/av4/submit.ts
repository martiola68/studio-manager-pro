import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const FIELDS = [
  "dichiarante_nome_cognome", "dichiarante_codice_fiscale",
  "dichiarante_luogo_nascita", "dichiarante_data_nascita",
  "dichiarante_indirizzo_residenza", "dichiarante_citta_residenza",
  "dichiarante_cap_residenza", "dichiarante_nazionalita",
] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Metodo non consentito." });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ ok: false, error: "Configurazione server AV4 mancante." });
  const { token, av4_id, payload, action } = req.body ?? {};
  if (!["save", "close"].includes(action) || typeof token !== "string" || !token || !av4_id || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return res.status(400).json({ ok: false, error: "Richiesta AV4 non valida." });
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: current, error: lookupError } = await db.from("tbAV4")
      .select("id").eq("id", av4_id).eq("public_token", token).eq("public_enabled", true).maybeSingle();
    if (lookupError) throw lookupError;
    if (!current) return res.status(403).json({ ok: false, error: "Link scaduto o non valido." });

    const missing = FIELDS.filter(field => !Object.prototype.hasOwnProperty.call(payload, field));
    if (missing.length) return res.status(400).json({ ok: false, error: "Campi anagrafici mancanti nel modulo." });
    const values: Record<string, string | null> = {};
    for (const field of FIELDS) {
      const value = payload[field];
      if (value !== null && typeof value !== "string") return res.status(400).json({ ok: false, error: "Valore anagrafico non valido." });
      values[field] = value?.trim() || null;
    }
    const {
      id: _id, public_token: _token, public_enabled: _enabled,
      compilato_da_cliente: _completed, public_submitted_at: _submitted,
      public_sent_at: _sent, public_opened_at: _opened,
      amm_no_associato: _nonAssociato, rapp_legale_id: _representative,
      studio_id: _studio, cliente_id: _client, pratica_id: _practice,
      ...answers
    } = payload;
    // Fase 1: scrivi soltanto, senza chiudere il collegamento.
    if (action === "save") {
      const { data: updated, error: updateError } = await db.from("tbAV4")
        .update({ ...answers, ...values, amm_no_associato: false })
        .eq("id", av4_id).eq("public_token", token).eq("public_enabled", true)
        .select("id");
      if (updateError) throw updateError;
      if (updated?.length !== 1) return res.status(409).json({ ok: false, error: "Salvataggio non confermato." });
    }
    // Fase 2: una lettura autonoma dal database verifica i dati reali.
    const { data: stored, error: readError } = await db.from("tbAV4")
      .select(FIELDS.join(",")).eq("id", av4_id).eq("public_token", token)
      .eq("public_enabled", true).maybeSingle();
    if (readError) throw readError;
    const check = (row: Record<string, unknown>) => FIELDS.every(field =>
      String(row[field] ?? "").trim().slice(0, field === "dichiarante_data_nascita" ? 10 : undefined) ===
      String(values[field] ?? "").trim().slice(0, field === "dichiarante_data_nascita" ? 10 : undefined)
    );
    if (!stored || !check(stored as unknown as Record<string, unknown>)) {
      return res.status(409).json({ ok: false, error: "Verifica dei dati salvati fallita. Il link resta aperto." });
    }
    if (action === "save") {
      return res.status(200).json({ ok: true, verified: true, linkClosed: false, av4_id });
    }
    // Fase 3: chiudi solo dopo una richiesta distinta e una verifica positiva.
    const { data: closed, error: closeError } = await db.from("tbAV4")
      .update({ compilato_da_cliente: true, public_submitted_at: new Date().toISOString(), public_enabled: false })
      .eq("id", av4_id).eq("public_token", token).eq("public_enabled", true).select("id");
    if (closeError) throw closeError;
    if (closed?.length !== 1) return res.status(409).json({ ok: false, error: "Chiusura non confermata." });
    const { data: final, error: finalError } = await db.from("tbAV4")
      .select(["public_enabled", "compilato_da_cliente", ...FIELDS].join(","))
      .eq("id", av4_id).eq("public_token", token).maybeSingle();
    if (finalError) throw finalError;
    const finalRow = final as unknown as Record<string, unknown> | null;
    if (!finalRow || finalRow.public_enabled !== false || finalRow.compilato_da_cliente !== true || !check(finalRow)) {
      return res.status(409).json({ ok: false, error: "Chiusura non verificata. Contattare lo studio." });
    }
    return res.status(200).json({ ok: true, verified: true, linkClosed: true, av4_id });
  } catch (err) {
    console.error("AV4 public submit failed:", err);
    return res.status(500).json({ ok: false, error: "Errore server nel salvataggio AV4. Link non confermato." });
  }
}
