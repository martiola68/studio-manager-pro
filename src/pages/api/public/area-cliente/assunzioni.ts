import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function setCors(res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function verificaToken(token: string) {
  const secret = process.env.ACCESSI_CLIENTI_SECRET;

  if (!secret) {
    throw new Error("ACCESSI_CLIENTI_SECRET mancante");
  }

  const [body, signature] = token.split(".");

  if (!body || !signature) {
    throw new Error("Token non valido");
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64url");

  if (signature !== expected) {
    throw new Error("Token non valido");
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));

  if (!payload.exp || Date.now() > payload.exp) {
    throw new Error("Sessione scaduta");
  }

  return payload;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  }

  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Sessione cliente mancante",
      });
    }

    const sessione = verificaToken(token);
    const supabase = getSupabaseAdmin();

    const body = req.body || {};

    const insertPayload = {
      studio_id: sessione.studio_id,
      cliente_id: sessione.cliente_id,
      stato: "inviata",

      azienda: sessione.ragione_sociale || body.azienda || null,
      cognome_nome: body.cognome_nome,
      luogo_nascita: body.luogo_nascita,
      data_nascita: body.data_nascita,
      cittadinanza: body.cittadinanza,
      extra_ue: !!body.extra_ue,
      codice_fiscale: body.codice_fiscale,
      indirizzo_residenza: body.indirizzo_residenza,
      indirizzo_domicilio: body.indirizzo_domicilio || null,
      telefono: body.telefono,
      email: body.email,
      stato_civile: body.stato_civile,
      iban: body.iban || null,

      percettore_naspi: !!body.percettore_naspi,
      data_iscrizione_naspi: body.data_iscrizione_naspi || null,

      decorrenza_assunzione: body.decorrenza_assunzione,
      sede_lavoro: body.sede_lavoro,
      tipologia_contratto: body.tipologia_contratto,
      durata: body.durata || null,
      mansione: body.mansione,
      livello: body.livello,
      orario_lavoro: body.orario_lavoro,
      distribuzione_oraria: body.distribuzione_oraria || null,
      retribuzione: body.retribuzione || null,
      centro_costo: body.centro_costo || null,

      note_cliente: body.note_cliente || null,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("tbassunzioni_richieste")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      richiesta_id: data.id,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore salvataggio richiesta assunzione",
    });
  }
}
