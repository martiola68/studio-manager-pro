import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Metodo non consentito",
    });
  }

  try {
    const {
      id,
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
      num_doc,
      scadenza_doc,
      allegato_doc,
      rappresentante_legale,
    } = req.body || {};

    if (!id) {
      return res.status(400).json({
        ok: false,
        error: "ID rappresentante mancante",
      });
    }

    const payload = {
      nome_cognome: nome_cognome ? String(nome_cognome).trim() : null,
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
      num_doc: num_doc ? String(num_doc).trim() : null,
      scadenza_doc: scadenza_doc || null,
      allegato_doc: allegato_doc ? String(allegato_doc).trim() : null,
      rappresentante_legale: rappresentante_legale ?? null,
    };

    const { data, error } = await supabase
      .from("rapp_legali")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }

    return res.status(200).json({
      ok: true,
      data,
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Errore interno server",
    });
  }
}
