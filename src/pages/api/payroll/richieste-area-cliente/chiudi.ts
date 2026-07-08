import type { NextApiRequest, NextApiResponse } from "next";
import formidable, { File } from "formidable";
import fs from "fs";
import PDFDocument from "pdfkit";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmailServer } from "@/services/sendEmailServer";

export const config = {
  api: {
    bodyParser: false,
  },
};

function toSingleFile(value: File | File[] | undefined): File | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function parseForm(req: NextApiRequest): Promise<{
  fields: formidable.Fields;
  files: formidable.Files;
}> {
  const form = formidable({
    multiples: false,
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

function generaPdfRichiestaAssunzione(
  richiesta: any,
  cliente: any
): Promise<Buffer> {
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
    doc.text(`Orario: ${richiesta.orario_lavoro || "-"}`);
    doc.text(`Sede lavoro: ${richiesta.sede_lavoro || "-"}`);
    doc.moveDown();

    doc.fontSize(14).text("Note cliente");
    doc.moveDown(0.5);
    doc.fontSize(11).text(richiesta.note_cliente || "-");

    doc.end();
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  }

  try {
    const supabase = getSupabaseAdmin();

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

    const ricevuta = toSingleFile(files.ricevuta as File | File[] | undefined);

    if (!ricevuta) {
      return res.status(400).json({
        success: false,
        error: "Ricevuta o documento finale mancante",
      });
    }

    const { data: richiesta, error: richiestaError } = await supabase
      .from("tbassunzioni_richieste")
      .select("*")
      .eq("id", String(richiestaId))
      .single();

    if (richiestaError || !richiesta) {
      return res.status(404).json({
        success: false,
        error: "Richiesta non trovata",
      });
    }

    if (richiesta.stato === "conclusa") {
      return res.status(400).json({
        success: false,
        error: "La pratica risulta già conclusa",
      });
    }

    const { data: cliente, error: clienteError } = await supabase
      .from("tbclienti")
      .select("id, ragione_sociale, email, pec, utente_payroll_id, studio_id")
      .eq("id", richiesta.cliente_id)
      .single();

    if (clienteError || !cliente) {
      return res.status(404).json({
        success: false,
        error: "Cliente non trovato",
      });
    }

    const emailCliente = cliente.email || cliente.pec;

    if (!emailCliente) {
      return res.status(400).json({
        success: false,
        error: "Cliente senza email o PEC",
      });
    }

    if (!cliente.utente_payroll_id) {
      return res.status(400).json({
        success: false,
        error: "Operatore payroll non associato al cliente",
      });
    }

    const { data: operatore, error: operatoreError } = await supabase
      .from("tbutenti")
      .select("id, nome, cognome, email, microsoft_connection_id")
      .eq("id", cliente.utente_payroll_id)
      .single();

    if (operatoreError || !operatore) {
      return res.status(404).json({
        success: false,
        error: "Operatore payroll non trovato",
      });
    }

    if (!operatore.microsoft_connection_id) {
      return res.status(400).json({
        success: false,
        error: "Connessione Microsoft operatore non configurata",
      });
    }

    const pdfBuffer = await generaPdfRichiestaAssunzione(richiesta, cliente);
    const ricevutaBuffer = fs.readFileSync(ricevuta.filepath);

    const attachments = [
      {
        filename: `richiesta-assunzione-${
          richiesta.numero_richiesta || richiesta.id
        }.pdf`,
        contentType: "application/pdf",
        contentBytes: pdfBuffer.toString("base64"),
      },
      {
        filename: ricevuta.originalFilename || "documento-finale.pdf",
        contentType: ricevuta.mimetype || "application/octet-stream",
        contentBytes: ricevutaBuffer.toString("base64"),
      },
    ];

    const firma = [operatore.nome, operatore.cognome]
      .filter(Boolean)
      .join(" ");

    const emailResult = await sendEmailServer({
      senderUserId: operatore.id,
      microsoftConnectionId: operatore.microsoft_connection_id,
      to: emailCliente,
      subject: `Pratica assunzione conclusa ${
        richiesta.numero_richiesta || ""
      }`,
      html: `
        <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #111827;">
          <p>Gentile Cliente,</p>

          <p>
            la pratica di assunzione relativa a
            <strong>${richiesta.cognome_nome || "-"}</strong>
            è stata completata.
          </p>

          <p>
            In allegato trova il riepilogo della richiesta e la documentazione finale.
          </p>

          <p>
            <strong>Numero richiesta:</strong> ${
              richiesta.numero_richiesta || "-"
            }<br />
            <strong>Lavoratore:</strong> ${richiesta.cognome_nome || "-"}<br />
            <strong>Decorrenza:</strong> ${
              richiesta.decorrenza_assunzione
                ? formatDate(richiesta.decorrenza_assunzione)
                : "-"
            }
          </p>

          <p>Cordiali saluti</p>
          ${firma ? `<p>${firma}</p>` : ""}
        </div>
      `,
      attachments,
    } as any);

    if (!emailResult?.success) {
      return res.status(500).json({
        success: false,
        error: emailResult?.error || "Invio email al cliente non riuscito",
      });
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("tbassunzioni_richieste")
.update({
  stato: "conclusa",
  updated_at: now,
})
      .eq("id", richiesta.id);

    if (updateError) {
      return res.status(500).json({
        success: false,
        error: updateError.message,
      });
    }

    return res.status(200).json({
      success: true,
      stato: "conclusa",
      message: "Pratica chiusa e email inviata al cliente",
    });
  } catch (error: any) {
    console.error("Errore chiusura pratica assunzione:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore chiusura pratica",
    });
  }
}
