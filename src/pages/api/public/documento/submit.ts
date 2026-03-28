import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET_NAME = "allegati";

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const MIN_IMAGE_WIDTH = 1200;
const MIN_IMAGE_HEIGHT = 800;

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

async function validateUploadedFile(
  fileBuffer: Buffer,
  fileType: string
): Promise<string | null> {
  if (!fileBuffer || fileBuffer.length === 0) {
    return "Il file caricato è vuoto o non valido.";
  }

  if (fileType === "application/pdf") {
    const header = fileBuffer.slice(0, 4).toString("utf8");

    if (header !== "%PDF") {
      return "Il file PDF non è valido o risulta corrotto.";
    }

    return null;
  }

  if (
    fileType === "image/jpeg" ||
    fileType === "image/jpg" ||
    fileType === "image/png"
  ) {
    try {
      const metadata = await sharp(fileBuffer).metadata();

      const width = metadata.width || 0;
      const height = metadata.height || 0;

      if (!width || !height) {
        return "Impossibile leggere le dimensioni dell'immagine caricata.";
      }

      if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) {
        return `L'immagine è troppo piccola. Dimensioni minime richieste: ${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT} pixel.`;
      }

      return null;
    } catch {
      return "Il file immagine non è valido o risulta corrotto.";
    }
  }

  return "Formato file non supportato.";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  }

  try {
    const rawBody =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const token =
      typeof rawBody.token === "string" ? rawBody.token.trim() : "";

     const citta_residenza =
      typeof rawBody.citta_residenza === "string"
        ? rawBody.citta_residenza.trim()
        : "";

    const indirizzo_residenza =
      typeof rawBody.indirizzo_residenza === "string"
        ? rawBody.indirizzo_residenza.trim()
        : "";

    const CAP =
      typeof rawBody.CAP === "string"
        ? rawBody.CAP.trim()
        : "";

    const tipo_doc =
      typeof rawBody.tipo_doc === "string" ? rawBody.tipo_doc.trim() : "";

    const num_doc =
      typeof rawBody.num_doc === "string" ? rawBody.num_doc.trim() : "";

    const scadenza_doc =
      typeof rawBody.scadenza_doc === "string"
        ? rawBody.scadenza_doc.trim()
        : "";

    const fileName =
      typeof rawBody.fileName === "string" ? rawBody.fileName.trim() : "";

    const fileType =
      typeof rawBody.fileType === "string" ? rawBody.fileType.trim() : "";

    const fileBase64 =
      typeof rawBody.fileBase64 === "string" ? rawBody.fileBase64 : "";

    if (fileType && !ALLOWED_FILE_TYPES.includes(fileType)) {
      return res.status(400).json({
        ok: false,
        error: "Formato file non ammesso. Caricare solo PDF, JPG, JPEG o PNG.",
      });
    }

    console.log("PUBLIC DOCUMENT SUBMIT BODY", {
      hasBody: !!rawBody,
      keys: Object.keys(rawBody || {}),
      tokenPreview: token ? token.slice(0, 8) : "",
    });

    if (!token) {
      return res.status(400).json({ ok: false, error: "Token mancante" });
    }

    if (
      !citta_residenza ||
      !indirizzo_residenza ||
      !CAP ||
      !tipo_doc ||
      !num_doc ||
      !scadenza_doc
    ) {
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

    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({
        ok: false,
        error: `Il file supera la dimensione massima consentita di ${MAX_FILE_SIZE_MB} MB.`,
      });
    }

    const validationError = await validateUploadedFile(fileBuffer, fileType);

    if (validationError) {
      return res.status(400).json({
        ok: false,
        error: validationError,
      });
    }

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
        citta_residenza,
        indirizzo_residenza,
        CAP,
        tipo_doc,
        num_doc: String(num_doc).trim(),
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
