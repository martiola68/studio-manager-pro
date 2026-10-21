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
  const { token, av4_id, payload } = req.body ?? {};
  if (typeof token !== "string" || !token || !av4_id || !payload || typeof payload !== "object" || Array.isArray(payload)) {
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
    const { data: updated, error: updateError } = await db.from("tbAV4")
      .update({ ...answers, ...values })
      .eq("id", av4_id).eq("public_token", token).eq("public_enabled", true)
      .select(FIELDS.join(","));
    if (updateError) throw updateError;
    if (!updated || updated.length !== 1) return res.status(409).json({ ok: false, error: "Salvataggio non confermato." });
    const check = (row: Record<string, unknown>) => FIELDS.every(field =>
      String(row[field] ?? "").trim() === String(values[field] ?? "").trim()
    );
    if (!check(updated[0] as unknown as Record<string, unknown>)) return res.status(409).json({ ok: false, error: "Anagrafica non salvata. Link ancora attivo." });
    const { data: completed, error: completeError } = await db.from("tbAV4")
      .update({ compilato_da_cliente: true, public_submitted_at: new Date().toISOString(), public_enabled: false })
      .eq("id", av4_id).eq("public_token", token).eq("public_enabled", true)
      .select("id");
    if (completeError) throw completeError;
    if (!completed || completed.length !== 1) return res.status(409).json({ ok: false, error: "Dati salvati, chiusura non confermata." });
    const { data: final, error: finalError } = await db.from("tbAV4")
      .select(FIELDS.join(",")).eq("id", av4_id).eq("public_token", token).maybeSingle();
    if (finalError) throw finalError;
    if (!final || !check(final as unknown as Record<string, unknown>)) {
      await db.from("tbAV4").update({ public_enabled: true, compilato_da_cliente: false, public_submitted_at: null })
        .eq("id", av4_id).eq("public_token", token);
      return res.status(409).json({ ok: false, error: "Verifica finale anagrafica fallita. Contattare lo studio." });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("AV4 public submit failed:", err);
    return res.status(500).json({ ok: false, error: "Errore server nel salvataggio AV4. Link non confermato." });
  }
}
