import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const BUCKET_NAME = "allegati";

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

function parseForm(req: NextApiRequest): Promise<any> {
  return new Promise((resolve, reject) => {
    const formidable = require("formidable");
    const form = formidable({ multiples: false });

    form.parse(req, (err: any, fields: any, files: any) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  }

  try {
    const fs = require("fs");

    const { fields, files } = await parseForm(req);

    const token = Array.isArray(fields.token) ? String(fields.token[0] || "") : String(fields.token || "");
    const tipo_doc = Array.isArray(fields.tipo_doc) ? String(fields.tipo_doc[0] || "") : String(fields.tipo_doc || "");
    const num_doc = Array.isArray(fields.num_doc) ? String(fields.num_doc[0] || "") : String(fields.num_doc || "");
    const scadenza_doc = Array.isArray(fields.scadenza_doc)
      ? String(fields.scadenza_doc[0] || "")
      : String(fields.scadenza_doc || "");

    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!token) {
      return res.status(400).json({ ok: false, error: "Token mancante" });
    }

    if (!tipo_doc || !num_doc || !scadenza_doc) {
      return res.status(400).json({ ok: false, error: "Campi obbligatori mancanti" });
    }

    if (!uploadedFile) {
      return res.status(400).json({ ok: false, error: "File mancante" });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: rapp, error: rappError } = await supabase
      .from("rapp_legali")
      .select("id, public_doc_enabled, public_doc_token")
      .eq("public_doc_token", token)
      .maybeSingle();

    if (rappError) {
      return res.status(500).json({ ok: false, error: rappError.message });
    }

    if (!rapp) {
      return res.status(404).json({ ok: false, error: "Link non valido" });
    }

    if (!rapp.public_doc_enabled) {
      return res.status(400).json({ ok: false, error: "Link non più attivo" });
    }

    const tempPath = uploadedFile.filepath;
    const fileBuffer = fs.readFileSync(tempPath);

    const safeName = sanitizeFileName(uploadedFile.originalFilename || "documento");
    const filePath = `documenti_pubblici/${rapp.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType: uploadedFile.mimetype || undefined,
        upsert: true,
      });

    if (uploadError) {
      return res.status(500).json({ ok: false, error: uploadError.message });
    }

    const { error: updateError } = await supabase
      .from("rapp_legali")
      .update({
        tipo_doc,
        NumDoc: num_doc,
        scadenza_doc,
        allegato_doc: filePath,
        public_doc_submitted_at: new Date().toISOString(),
        public_doc_enabled: false,
        public_doc_token: null,
      })
      .eq("id", rapp.id)
      .eq("public_doc_token", token);

    if (updateError) {
      return res.status(500).json({ ok: false, error: updateError.message });
    }

    return res.status(200).json({
      ok: true,
      path: filePath,
      message: "Documento salvato correttamente",
    });
  } catch (error: any) {
    console.error("API public documento submit error:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Errore interno server",
    });
  }
}
