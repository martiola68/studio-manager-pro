import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  }

  const praticaId = req.query.id as string;

 const {
  nome_cognome,
  codice_fiscale,
  luogo_nascita,
  data_nascita,
  indirizzo,
  indirizzo_residenza,
  cap,
  citta,
  citta_residenza,
  provincia,
  amministratore_principale,
} = req.body ?? {};

  if (!praticaId) {
    return res.status(400).json({ ok: false, error: "pratica_id mancante" });
  }

  if (!nome_cognome || !String(nome_cognome).trim()) {
    return res.status(400).json({ ok: false, error: "Nome e cognome obbligatorio" });
  }

  if (!codice_fiscale || !String(codice_fiscale).trim()) {
    return res.status(400).json({ ok: false, error: "Codice fiscale obbligatorio" });
  }

  const { data: pratica, error: praticaError } = await supabaseAdmin
    .from("tbpratiche")
    .select("studio_id")
    .eq("id", praticaId)
    .single();

  if (praticaError || !pratica?.studio_id) {
    return res.status(400).json({
      ok: false,
      error: praticaError?.message || "studio_id pratica non trovato",
    });
  }

const indirizzoFinale =
  indirizzo_residenza || indirizzo || null;

const cittaFinale =
  citta_residenza || citta || null;

const payload = {
  studio_id: pratica.studio_id,
  nome_cognome: String(nome_cognome).trim(),
  codice_fiscale: String(codice_fiscale).trim().toUpperCase(),

  luogo_nascita: luogo_nascita ? String(luogo_nascita).trim() : null,
  data_nascita: data_nascita || null,

  indirizzo: indirizzoFinale ? String(indirizzoFinale).trim() : null,
  indirizzo_residenza: indirizzoFinale ? String(indirizzoFinale).trim() : null,

  citta: cittaFinale ? String(cittaFinale).trim() : null,
  citta_residenza: cittaFinale ? String(cittaFinale).trim() : null,

  provincia: provincia ? String(provincia).trim().toUpperCase() : null,
  cap: cap ? String(cap).trim() : null,

  rappresentante_legale: true,
  amministratore_principale: amministratore_principale === true,
};

  const { data, error } = await supabaseAdmin
    .from("rapp_legali")
    .insert([payload])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }

  return res.status(200).json({ ok: true, data });
}
