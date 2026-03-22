import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const BUCKET_NAME = "allegati";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "15mb",
    },
  },
};

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  }

  try {
  const body = req.body || {};

const token =
  typeof body.token === "string"
    ? body.token.trim()
    : "";

const tipo_doc =
  typeof body.tipo_doc === "string"
    ? body.tipo_doc.trim()
    : "";

const num_doc =
  typeof body.num_doc === "string"
    ? body.num_doc.trim()
    : "";

const scadenza_doc =
  typeof body.scadenza_doc === "string"
    ? body.scadenza_doc.trim()
    : "";

const fileName =
  typeof body.fileName === "string"
    ? body.fileName.trim()
    : "";

const fileType =
  typeof body.fileType === "string"
    ? body.fileType.trim()
    : "";

const fileBase64 =
  typeof body.fileBase64 === "string"
    ? body.fileBase64
    : "";
    
    if (!token) {
      return res.status(400).json({ ok: false, error: "Token mancante" });
    }

    if (!tipo_doc || !num_doc || !scadenza_doc) {
      return res
        .status(400)
        .json({ ok: false, error: "Campi obbligatori mancanti" });
    }

    if (!fileName || !fileBase64) {
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

    const safeName = sanitizeFileName(String(fileName || "documento"));
    const filePath = `documenti_pubblici/${rapp.id}/${Date.now()}-${safeName}`;

    const cleanBase64 = String(fileBase64).includes(",")
      ? String(fileBase64).split(",")[1]
      : String(fileBase64);

    const fileBuffer = Buffer.from(cleanBase64, "base64");

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType: fileType || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      return res.status(500).json({ ok: false, error: uploadError.message });
    }

    const submittedAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("rapp_legali")
      .update({
        tipo_doc,
        NumDoc: String(num_doc).trim(),
        scadenza_doc,
        allegato_doc: filePath,
        public_doc_submitted_at: submittedAt,
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
      submittedAt,
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
