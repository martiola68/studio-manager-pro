import type { NextApiRequest, NextApiResponse } from "next";
import formidable, { File } from "formidable";
import fs from "fs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmailServer } from "@/services/sendEmailServer";

export const config = {
  api: {
    bodyParser: false,
  },
};

function toFileArray(value: File | File[] | undefined): File[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function parseForm(req: NextApiRequest): Promise<{
  fields: formidable.Fields;
  files: formidable.Files;
}> {
  const form = formidable({
    multiples: true,
    keepExtensions: true,
    maxFileSize: 25 * 1024 * 1024,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function fieldToString(value: any) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("it-IT");
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

    const richiestaId = fieldToString(fields.richiesta_id);
    const noteIntegrazione = fieldToString(fields.note_integrazione).trim();

    if (!richiestaId) {
      return res.status(400).json({
        success: false,
        error: "ID richiesta mancante",
      });
    }

    if (!noteIntegrazione) {
      return res.status(400).json({
        success: false,
        error: "Note integrazione obbligatorie",
      });
    }

    const { data: richiesta, error: richiestaError } = await supabase
      .from("tbassunzioni_richieste")
      .select(`
        id,
        numero_richiesta,
        cliente_id,
        cognome_nome,
        decorrenza_assunzione
      `)
      .eq("id", richiestaId)
      .single();

    if (richiestaError || !richiesta) {
      return res.status(404).json({
        success: false,
        error: "Richiesta non trovata",
      });
    }

    const { data: cliente, error: clienteError } = await supabase
      .from("tbclienti")
      .select("id, ragione_sociale, utente_payroll_id")
      .eq("id", richiesta.cliente_id)
      .single();

    if (clienteError || !cliente) {
      return res.status(404).json({
        success: false,
        error: "Cliente non trovato",
      });
    }

    const { data: accessoCliente, error: accessoError } = await supabase
      .from("tbclienti_accessi_pubblici")
      .select("email_accesso")
      .eq("cliente_id", richiesta.cliente_id)
      .eq("attivo", true)
      .maybeSingle();

    if (accessoError || !accessoCliente?.email_accesso) {
      return res.status(400).json({
        success: false,
        error: "Email accesso Area Cliente non trovata.",
      });
    }

    if (!cliente.utente_payroll_id) {
      return res.status(400).json({
        success: false,
        error: "Operatore payroll non associato al cliente.",
      });
    }

    const { data: operatore, error: operatoreError } = await supabase
      .from("tbutenti")
      .select("id, nome, cognome, microsoft_connection_id")
      .eq("id", cliente.utente_payroll_id)
      .single();

    if (operatoreError || !operatore) {
      return res.status(404).json({
        success: false,
        error: "Operatore payroll non trovato.",
      });
    }

    if (!operatore.microsoft_connection_id) {
      return res.status(400).json({
        success: false,
        error: "Connessione Microsoft operatore non configurata.",
      });
    }

    const allegatiFiles = toFileArray(files.allegati as File | File[] | undefined);

    const attachments = allegatiFiles.map((file) => {
      const buffer = fs.readFileSync(file.filepath);

      return {
        filename: file.originalFilename || "allegato.pdf",
        contentType: file.mimetype || "application/octet-stream",
        contentBytes: buffer.toString("base64"),
      };
    });

    const firma = [operatore.nome, operatore.cognome]
      .filter(Boolean)
      .join(" ");

    const emailResult = await sendEmailServer({
      senderUserId: operatore.id,
      microsoftConnectionId: operatore.microsoft_connection_id,
      to: accessoCliente.email_accesso,
      subject: `Integrazione documenti richiesta ${
        richiesta.numero_richiesta || ""
      }`,
      html: `
        <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #111827;">
          <p>Gentile Cliente,</p>

          <p>
            per completare la pratica di assunzione relativa a
            <strong>${richiesta.cognome_nome || "-"}</strong>
            è necessario integrare o reinviare la documentazione.
          </p>

          <div style="margin: 16px 0; padding: 12px; border-left: 4px solid #f97316; background: #fff7ed;">
            <strong>Documentazione richiesta / Note dello Studio:</strong><br />
            ${noteIntegrazione.replace(/\n/g, "<br />")}
          </div>

          <p>
            La invitiamo ad accedere all'Area Cliente e utilizzare il pulsante
            <strong>Rinvia documenti</strong> presente sulla pratica.
          </p>

          <p>
            <strong>Numero richiesta:</strong> ${richiesta.numero_richiesta || "-"}<br />
            <strong>Lavoratore:</strong> ${richiesta.cognome_nome || "-"}<br />
            <strong>Decorrenza:</strong> ${formatDate(richiesta.decorrenza_assunzione)}
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
        error:
          emailResult?.error ||
          "Invio email richiesta integrazione non riuscito.",
      });
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("tbassunzioni_richieste")
      .update({
        stato: "integrazione_documenti",
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
      stato: "integrazione_documenti",
      message: "Richiesta integrazione inviata correttamente.",
    });
  } catch (error: any) {
    console.error("Errore richiesta integrazione documenti:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore richiesta integrazione documenti",
    });
  }
}
