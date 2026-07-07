import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import formidable from "formidable";
import fs from "fs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmailServer } from "@/services/sendEmailServer";

export const config = {
  api: {
    bodyParser: false,
  },
};

const BUCKET = "assunzioni-allegati";

function setCors(res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function verificaToken(token: string) {
  const secret = process.env.ACCESSI_CLIENTI_SECRET;
  if (!secret) throw new Error("ACCESSI_CLIENTI_SECRET mancante");

  const [body, signature] = token.split(".");
  if (!body || !signature) throw new Error("Token non valido");

  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64url");

  if (signature !== expected) throw new Error("Token non valido");

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (!payload.exp || Date.now() > payload.exp) throw new Error("Sessione scaduta");

  return payload;
}

function parseForm(req: NextApiRequest): Promise<{ fields: formidable.Fields; files: formidable.Files }> {
  const form = formidable({ multiples: false, keepExtensions: true });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function fieldValue(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function richiestiPer(richiesta: any) {
  const richiesti = ["documento_fronte", "documento_retro", "codice_fiscale"];

  if (richiesta.extra_ue) richiesti.push("permesso_soggiorno");

  if (
    richiesta.tipologia_contratto === "stage" ||
    richiesta.tipologia_contratto === "apprendistato"
  ) {
    richiesti.push("curriculum");
  }

  return richiesti;
}

async function inviaEmailOperatore(supabase: any, richiesta: any) {
  const { data: cliente } = await supabase
    .from("tbclienti")
    .select("id, ragione_sociale, utente_payroll_id")
    .eq("id", richiesta.cliente_id)
    .single();

  if (!cliente?.utente_payroll_id) return;

  const { data: operatore } = await supabase
    .from("tbutenti")
    .select("id, email, microsoft_connection_id")
    .eq("id", cliente.utente_payroll_id)
    .single();

  if (!operatore?.email || !operatore?.microsoft_connection_id) return;

  await sendEmailServer({
    senderUserId: operatore.id,
    microsoftConnectionId: operatore.microsoft_connection_id,
    to: operatore.email,
    subject: `Nuova richiesta assunzione ${richiesta.numero_richiesta}`,
    html: `
      <div style="font-family: Arial, sans-serif; font-size: 14px;">
        <h2>Nuova richiesta assunzione</h2>
        <p><strong>Numero richiesta:</strong> ${richiesta.numero_richiesta || "-"}</p>
        <p><strong>Cliente:</strong> ${cliente.ragione_sociale || "-"}</p>
        <p><strong>Lavoratore:</strong> ${richiesta.cognome_nome || "-"}</p>
        <p><strong>Codice fiscale:</strong> ${richiesta.codice_fiscale || "-"}</p>
        <p><strong>Decorrenza:</strong> ${richiesta.decorrenza_assunzione || "-"}</p>
        <p>Accedi a Studio Manager Pro per prenderla in carico.</p>
      </div>
    `,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Metodo non consentito" });
  }

  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return res.status(401).json({ success: false, error: "Sessione cliente mancante" });
    }

    const sessione = verificaToken(token);
    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const richiestaId = typeof req.query.richiesta_id === "string" ? req.query.richiesta_id : "";

      const { data: richiesta, error: richiestaError } = await supabase
        .from("tbassunzioni_richieste")
        .select("*")
        .eq("id", richiestaId)
        .eq("cliente_id", sessione.cliente_id)
        .single();

      if (richiestaError || !richiesta) {
        return res.status(404).json({ success: false, error: "Richiesta non trovata" });
      }

      const { data: allegati, error } = await supabase
        .from("tbassunzioni_allegati")
        .select("*")
        .eq("richiesta_id", richiestaId)
        .order("uploaded_at", { ascending: false });

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      const richiesti = richiestiPer(richiesta);
      const caricati = (allegati || []).map((a: any) => a.tipo_documento);
      const mancanti = richiesti.filter((tipo) => !caricati.includes(tipo));

      return res.status(200).json({
        success: true,
        richiesta,
        allegati: allegati || [],
        richiesti,
        mancanti,
        completa: mancanti.length === 0,
      });
    }

    const { fields, files } = await parseForm(req);

    const richiestaId = fieldValue(fields.richiesta_id);
    const tipoDocumento = fieldValue(fields.tipo_documento);
    const file = fieldValue(files.file) as formidable.File | undefined;

    if (!richiestaId || !tipoDocumento || !file) {
      return res.status(400).json({
        success: false,
        error: "Richiesta, tipo documento e file sono obbligatori",
      });
    }

    const { data: richiesta, error: richiestaError } = await supabase
      .from("tbassunzioni_richieste")
      .select("*")
      .eq("id", richiestaId)
      .eq("cliente_id", sessione.cliente_id)
      .single();

    if (richiestaError || !richiesta) {
      return res.status(404).json({ success: false, error: "Richiesta non trovata" });
    }

    const buffer = fs.readFileSync(file.filepath);
    const safeName = file.originalFilename || "documento";
    const filePath = `${sessione.studio_id}/${sessione.cliente_id}/${richiestaId}/${tipoDocumento}-${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: file.mimetype || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      return res.status(500).json({ success: false, error: uploadError.message });
    }

    await supabase
      .from("tbassunzioni_allegati")
      .delete()
      .eq("richiesta_id", richiestaId)
      .eq("tipo_documento", tipoDocumento);

    const { error: insertError } = await supabase.from("tbassunzioni_allegati").insert({
      richiesta_id: richiestaId,
      studio_id: sessione.studio_id,
      cliente_id: sessione.cliente_id,
      tipo_documento: tipoDocumento,
      file_name: safeName,
      file_path: filePath,
      storage_bucket: BUCKET,
      mime_type: file.mimetype || null,
      size_bytes: file.size || null,
    });

    if (insertError) {
      return res.status(500).json({ success: false, error: insertError.message });
    }

    const { data: allegati } = await supabase
      .from("tbassunzioni_allegati")
      .select("tipo_documento")
      .eq("richiesta_id", richiestaId);

    const richiesti = richiestiPer(richiesta);
    const caricati = (allegati || []).map((a: any) => a.tipo_documento);
    const mancanti = richiesti.filter((tipo) => !caricati.includes(tipo));
    const completa = mancanti.length === 0;

    if (completa && richiesta.stato === "bozza_documenti") {
      await supabase
        .from("tbassunzioni_richieste")
        .update({
          stato: "inviata",
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", richiestaId);

      try {
        await inviaEmailOperatore(supabase, richiesta);
      } catch (emailError) {
        console.error("Errore invio email operatore:", emailError);
      }
    }

    return res.status(200).json({
      success: true,
      completa,
      mancanti,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore gestione allegati assunzione",
    });
  }
}
