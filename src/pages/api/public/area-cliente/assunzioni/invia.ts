import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import PDFDocument from "pdfkit";
import formidable, { File } from "formidable";
import fs from "fs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmailServer } from "@/services/sendEmailServer";

export const config = {
  api: {
    bodyParser: false,
  },
};

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

  if (!payload.exp || Date.now() > payload.exp) {
    throw new Error("Sessione scaduta");
  }

  return payload;
}

function richiestiPer(richiesta: any) {
  const tutti = [
    {
      tipo: "documento_fronte",
      confermato: richiesta.doc_fronte_confermato,
    },
    {
      tipo: "documento_retro",
      confermato: richiesta.doc_retro_confermato,
    },
    {
      tipo: "codice_fiscale",
      confermato: richiesta.doc_codice_fiscale_confermato,
    },
  ];

  if (richiesta.extra_ue) {
    tutti.push({
      tipo: "permesso_soggiorno",
      confermato: richiesta.doc_permesso_soggiorno_confermato,
    });
  }

  if (
    richiesta.tipologia_contratto === "stage" ||
    richiesta.tipologia_contratto === "apprendistato"
  ) {
    tutti.push({
      tipo: "curriculum",
      confermato: richiesta.doc_curriculum_confermato,
    });
  }

  if (richiesta.stato === "integrazione_documenti") {
    return tutti
      .filter((doc) => !doc.confermato)
      .map((doc) => doc.tipo);
  }

  return tutti.map((doc) => doc.tipo);
}

function labelDocumento(tipo: string) {
  const labels: Record<string, string> = {
    documento_fronte: "Documento identità - fronte",
    documento_retro: "Documento identità - retro",
    codice_fiscale: "Codice fiscale / tessera sanitaria",
    permesso_soggiorno: "Permesso di soggiorno",
    curriculum: "Curriculum vitae",
  };

  return labels[tipo] || tipo;
}

function toSingleFile(value: File | File[] | undefined): File | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function parseForm(req: NextApiRequest): Promise<{
  fields: formidable.Fields;
  files: formidable.Files;
}> {
  const form = formidable({
    multiples: true,
    keepExtensions: true,
    maxFileSize: 20 * 1024 * 1024,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("it-IT");
}

function generaPdfRichiestaAssunzione(richiesta: any, cliente: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Richiesta di assunzione", { align: "center" });
    doc.moveDown();

    doc.fontSize(11);
    doc.text(`Numero richiesta: ${richiesta.numero_richiesta || "-"}`);
    doc.text(`Cliente: ${cliente?.ragione_sociale || "-"}`);
    doc.text(`Data richiesta: ${formatDate(richiesta.created_at)}`);
    doc.moveDown();

    doc.fontSize(14).text("Dati lavoratore");
    doc.moveDown(0.5);

    doc.fontSize(11);
    doc.text(`Lavoratore: ${richiesta.cognome_nome || "-"}`);
    doc.text(`Codice fiscale: ${richiesta.codice_fiscale || "-"}`);
    doc.text(`Data nascita: ${formatDate(richiesta.data_nascita)}`);
    doc.text(`Luogo nascita: ${richiesta.luogo_nascita || "-"}`);
    doc.text(`Residenza: ${richiesta.indirizzo_residenza || "-"}`);
    doc.moveDown();

    doc.fontSize(14).text("Dati assunzione");
    doc.moveDown(0.5);

    doc.fontSize(11);
    doc.text(`Decorrenza: ${formatDate(richiesta.decorrenza_assunzione)}`);
    doc.text(`Tipologia contratto: ${richiesta.tipologia_contratto || "-"}`);
    doc.text(`Mansione: ${richiesta.mansione || "-"}`);
    doc.text(`Qualifica: ${richiesta.qualifica || "-"}`);
    doc.text(`Livello: ${richiesta.livello || "-"}`);
    doc.text(`Orario settimanale: ${richiesta.orario_settimanale || "-"}`);
    doc.text(`Sede lavoro: ${richiesta.sede_lavoro || "-"}`);
    doc.moveDown();

    doc.fontSize(14).text("Note");
    doc.moveDown(0.5);
    doc.fontSize(11).text(richiesta.note || "-");

    doc.end();
  });
}

function buildAttachments(files: formidable.Files, richiesti: string[]) {
  const attachments: any[] = [];

  // Allegati obbligatori
  for (const tipo of richiesti) {
    const file = toSingleFile(files[tipo] as File | File[] | undefined);

    if (!file) {
      throw new Error(
        `Documento obbligatorio mancante: ${labelDocumento(tipo)}`
      );
    }

    const buffer = fs.readFileSync(file.filepath);

    attachments.push({
      filename: file.originalFilename || `${tipo}.pdf`,
      contentType: file.mimetype || "application/octet-stream",
      contentBytes: buffer.toString("base64"),
    });
  }

  // Allegati aggiuntivi (0, 1 o molti)
  const extra = files.allegati_extra;

  if (extra) {
    const lista = Array.isArray(extra) ? extra : [extra];

    for (const file of lista) {
      const buffer = fs.readFileSync(file.filepath);

      attachments.push({
        filename: file.originalFilename || "allegato",
        contentType: file.mimetype || "application/octet-stream",
        contentBytes: buffer.toString("base64"),
      });
    }
  }

  return attachments;
}

async function trovaOperatorePayroll(supabase: any, clienteId: string) {
  const { data: cliente, error: clienteError } = await supabase
    .from("tbclienti")
    .select("id, ragione_sociale, utente_payroll_id")
    .eq("id", clienteId)
    .single();

  if (clienteError || !cliente) {
    throw new Error("Cliente non trovato");
  }

  if (!cliente.utente_payroll_id) {
    throw new Error("Operatore Payroll non assegnato al cliente");
  }

  const { data: operatore, error: operatoreError } = await supabase
    .from("tbutenti")
    .select("id, nome, email, microsoft_connection_id")
    .eq("id", cliente.utente_payroll_id)
    .single();

  if (operatoreError || !operatore) {
    throw new Error("Operatore Payroll non trovato");
  }

  if (!operatore.email || !operatore.microsoft_connection_id) {
    throw new Error("Operatore Payroll senza email o connessione Microsoft");
  }

  return { cliente, operatore };
}

async function caricaRichiesta(supabase: any, richiestaId: string, clienteId: string) {
  const { data: richiesta, error } = await supabase
    .from("tbassunzioni_richieste")
    .select("*")
    .eq("id", richiestaId)
    .eq("cliente_id", clienteId)
    .single();

  if (error || !richiesta) {
    throw new Error("Richiesta non trovata");
  }

  return richiesta;
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
      const richiestaId =
        typeof req.query.richiesta_id === "string"
          ? req.query.richiesta_id
          : "";

      if (!richiestaId) {
        return res.status(400).json({
          success: false,
          error: "ID richiesta mancante",
        });
      }

      const richiesta = await caricaRichiesta(
        supabase,
        richiestaId,
        sessione.cliente_id
      );

      return res.status(200).json({
        success: true,
        richiesta,
        richiesti: richiestiPer(richiesta),
      });
    }

    const { fields, files } = await parseForm(req);

    const richiestaIdRaw = fields.richiesta_id;
    const richiestaId = Array.isArray(richiestaIdRaw)
      ? richiestaIdRaw[0]
      : richiestaIdRaw;

    if (!richiestaId) {
      return res.status(400).json({
        success: false,
        error: "ID richiesta mancante",
      });
    }

    const richiesta = await caricaRichiesta(
      supabase,
      String(richiestaId),
      sessione.cliente_id
    );

   if (
  richiesta.stato !== "bozza" &&
  richiesta.stato !== "integrazione_documenti"
) {
  return res.status(400).json({
    success: false,
    error: "La richiesta non può essere inviata in questo stato",
  });
}
  const richiesti = richiestiPer(richiesta);
const attachments = buildAttachments(files, richiesti);

const { cliente, operatore } = await trovaOperatorePayroll(
  supabase,
  richiesta.cliente_id
);

const pdfBuffer = await generaPdfRichiestaAssunzione(richiesta, cliente);

attachments.unshift({
  filename: `richiesta-assunzione-${richiesta.numero_richiesta || richiesta.id}.pdf`,
  contentType: "application/pdf",
  contentBytes: pdfBuffer.toString("base64"),
});
    
   const emailResult = await sendEmailServer({
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

      <p>In allegato trovi i documenti caricati dal cliente.</p>
      <p>Accedi a Studio Manager Pro per prendere in carico la pratica.</p>
    </div>
  `,
  attachments,
} as any);

if (!emailResult?.success) {
  throw new Error(emailResult?.error || "Invio email non riuscito");
}

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("tbassunzioni_richieste")
      .update({
        stato: "da_prendere_in_carico",
        submitted_at: now,
        updated_at: now,
      })
      .eq("id", richiesta.id)
      .eq("cliente_id", sessione.cliente_id);

    if (updateError) {
      return res.status(500).json({
        success: false,
        error: updateError.message,
      });
    }

    return res.status(200).json({
      success: true,
      stato: "da_prendere_in_carico",
      message: "Richiesta inviata correttamente allo Studio",
    });
  } catch (error: any) {
    console.error("Errore invio richiesta assunzione:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore invio richiesta assunzione",
    });
  }
}
