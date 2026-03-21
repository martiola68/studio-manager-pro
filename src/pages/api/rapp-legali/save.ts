import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type ResponseData =
  | { ok: true; data: any }
  | { ok: false; error: string };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  }

  try {
    const {
      studio_id,
      nome_cognome,
      codice_fiscale,
      luogo_nascita,
      data_nascita,
      citta_residenza,
      indirizzo_residenza,
      CAP,
      nazionalita,
      email,
      tipo_doc,
      NumDoc,
      scadenza_doc,
      allegato_doc,
    } = req.body ?? {};

    if (!studio_id) {
      return res.status(400).json({ ok: false, error: "studio_id obbligatorio" });
    }

    if (!nome_cognome || !String(nome_cognome).trim()) {
      return res.status(400).json({ ok: false, error: "nome_cognome obbligatorio" });
    }

    const payload = {
      studio_id,
      nome_cognome: String(nome_cognome).trim(),
      codice_fiscale: codice_fiscale
        ? String(codice_fiscale).trim().toUpperCase()
        : null,
      luogo_nascita: luogo_nascita ? String(luogo_nascita).trim() : null,
      data_nascita: data_nascita || null,
      citta_residenza: citta_residenza ? String(citta_residenza).trim() : null,
      indirizzo_residenza: indirizzo_residenza
        ? String(indirizzo_residenza).trim()
        : null,
      CAP: CAP ? String(CAP).trim() : null,
      nazionalita: nazionalita ? String(nazionalita).trim() : null,
      email: email ? String(email).trim() : null,
      tipo_doc: tipo_doc ? String(tipo_doc).trim() : null,
      NumDoc: NumDoc ? String(NumDoc).trim() : null,
      scadenza_doc: scadenza_doc || null,
      allegato_doc: allegato_doc ? String(allegato_doc).trim() : null,
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
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "Errore salvataggio rappresentante",
    });
  }
}
