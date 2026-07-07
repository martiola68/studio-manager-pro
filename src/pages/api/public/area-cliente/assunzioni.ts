import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmailServer } from "@/services/sendEmailServer";

function setCors(res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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

 if (req.method !== "GET" && req.method !== "POST") {
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

    if (req.method === "GET") {
  const { data, error } = await supabase
    .from("tbassunzioni_richieste")
    .select(`
      id,
      numero_richiesta,
      submitted_at,
      created_at,
      cognome_nome,
      codice_fiscale,
      decorrenza_assunzione,
      tipologia_contratto,
      stato
    `)
    .eq("cliente_id", sessione.cliente_id)
    .order("submitted_at", { ascending: false });

  if (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }

return res.status(200).json({
  success: true,
  cliente: {
    id: sessione.cliente_id,
    ragione_sociale: sessione.ragione_sociale || null,
  },
  richieste: data || [],
});
}

const body = req.body || {};

      const anno = new Date().getFullYear();

const { count, error: countError } = await supabase
  .from("tbassunzioni_richieste")
  .select("id", { count: "exact", head: true })
  .gte("submitted_at", `${anno}-01-01`)
  .lt("submitted_at", `${anno + 1}-01-01`);

if (countError) {
  return res.status(500).json({
    success: false,
    error: countError.message,
  });
}

const numeroRichiesta = `ASS-${anno}-${String((count || 0) + 1).padStart(5, "0")}`;

    const insertPayload = {
      studio_id: sessione.studio_id,
      cliente_id: sessione.cliente_id,
      stato: "inviata",
      numero_richiesta: numeroRichiesta,
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
      .select("id, numero_richiesta")
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    try {
  const { data: cliente } = await supabase
    .from("tbclienti")
    .select("id, ragione_sociale, utente_payroll_id")
    .eq("id", sessione.cliente_id)
    .single();

  if (cliente?.utente_payroll_id) {
    const { data: operatore } = await supabase
      .from("tbutenti")
      .select("id, nome, cognome, email, microsoft_connection_id")
      .eq("id", cliente.utente_payroll_id)
      .single();

    if (operatore?.email && operatore?.microsoft_connection_id) {
      await sendEmailServer({
        senderUserId: operatore.id,
        microsoftConnectionId: operatore.microsoft_connection_id,
        to: operatore.email,
        subject: `Nuova richiesta assunzione ${data.numero_richiesta}`,
        html: `
          <div style="font-family: Arial, sans-serif; font-size: 14px; color: #111827;">
            <h2>Nuova richiesta assunzione</h2>

            <p><strong>Numero richiesta:</strong> ${data.numero_richiesta || "-"}</p>

            <p>È stata inviata una nuova richiesta di assunzione dall'area cliente.</p>

            <p><strong>Cliente:</strong> ${cliente.ragione_sociale || "-"}</p>
            <p><strong>Lavoratore:</strong> ${body.cognome_nome || "-"}</p>
            <p><strong>Codice fiscale:</strong> ${body.codice_fiscale || "-"}</p>
            <p><strong>Decorrenza:</strong> ${body.decorrenza_assunzione || "-"}</p>
            <p><strong>Tipologia contratto:</strong> ${body.tipologia_contratto || "-"}</p>
            <p><strong>Mansione:</strong> ${body.mansione || "-"}</p>

            <hr />

            <p>
              Accedi a Studio Manager Pro per visualizzare e prendere in carico la richiesta.
            </p>
          </div>
        `,
      });
    } else {
      console.warn("Email operatore Payroll non inviata: email o microsoft_connection_id mancanti");
    }
  } else {
    console.warn("Email operatore Payroll non inviata: utente_payroll_id mancante sul cliente");
  }
} catch (emailError) {
  console.error("Errore invio email nuova richiesta assunzione:", emailError);
}

  return res.status(200).json({
  success: true,
  richiesta_id: data.id,
  numero_richiesta: data.numero_richiesta,
});
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore salvataggio richiesta assunzione",
    });
  }
}
