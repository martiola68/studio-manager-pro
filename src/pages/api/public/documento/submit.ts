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

  const {
  data: documentoAml,
  error: documentoAmlError,
} = await supabase
  .from("tbclienti_documenti_aml")
  .select(`
    id,
    studio_id,
    soggetto_cliente_id,
    legacy_rapp_legale_id,
    public_doc_enabled,
    public_doc_token
  `)
  .eq("public_doc_token", token)
  .eq("attivo", true)
  .maybeSingle();

if (documentoAmlError) {
  return res.status(500).json({
    ok: false,
    error: documentoAmlError.message,
  });
}

if (!documentoAml) {
  return res.status(404).json({
    ok: false,
    error: "Link non valido",
  });
}

if (!documentoAml.public_doc_enabled) {
  return res.status(400).json({
    ok: false,
    error: "Link non più attivo",
  });
}

    const safeName = sanitizeFileName(String(fileName || "documento"));
    const filePath =
  `documenti_pubblici/${documentoAml.soggetto_cliente_id}/${Date.now()}-${safeName}`;

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

 /*
 * 1. Aggiorniamo l'anagrafica unica della persona.
 */
const { error: soggettoUpdateError } = await supabase
  .from("tbclienti")
  .update({
    citta: citta_residenza,
    indirizzo: indirizzo_residenza,
    cap: CAP,
    updated_at: submittedAt,
  })
  .eq("id", documentoAml.soggetto_cliente_id)
  .eq("studio_id", documentoAml.studio_id);

if (soggettoUpdateError) {
  return res.status(500).json({
    ok: false,
    error: soggettoUpdateError.message,
  });
}

/*
 * 2. Aggiorniamo il documento AML.
 *
 * La nuova scadenza sostituisce definitivamente
 * quella precedente.
 */
const {
  data: documentoAggiornato,
  error: documentoUpdateError,
} = await supabase
  .from("tbclienti_documenti_aml")
  .update({
    tipo_documento: tipo_doc,
    numero_documento: String(num_doc).trim(),
    scadenza_documento: scadenza_doc,
    allegato_documento: filePath,

    public_doc_submitted_at: submittedAt,
    public_doc_enabled: false,
    public_doc_token: null,

    updated_at: submittedAt,
  })
  .eq("id", documentoAml.id)
  .eq("studio_id", documentoAml.studio_id)
  .eq("public_doc_token", token)
  .select(`
    id,
    studio_id,
    soggetto_cliente_id,
    scadenza_documento
  `)
  .single();

if (
  documentoUpdateError ||
  !documentoAggiornato
) {
  return res.status(500).json({
    ok: false,
    error:
      documentoUpdateError?.message ||
      "Errore aggiornamento documento AML",
  });
}

/*
 * 3. Sincronizzazione scadenza unificata.
 *
 * La nuova scadenza del documento sostituisce
 * quella precedente e azzera il vecchio ciclo alert.
 */
const nuovaDataScadenza =
  documentoAggiornato.scadenza_documento;

const dataPrimoAlert = new Date(
  `${nuovaDataScadenza}T08:00:00.000Z`
);

dataPrimoAlert.setUTCDate(
  dataPrimoAlert.getUTCDate() - 30
);

const oggi = new Date();

const prossimoAlertAt =
  dataPrimoAlert.getTime() > oggi.getTime()
    ? dataPrimoAlert.toISOString()
    : oggi.toISOString();

const {
  data: scadenzaEsistente,
  error: scadenzaLookupError,
} = await supabase
  .from("tbscadenze_centrale")
  .select("id")
  .eq(
    "studio_id",
    documentoAggiornato.studio_id
  )
  .eq(
    "origine_tabella",
    "tbclienti_documenti_aml"
  )
  .eq(
    "origine_record_id",
    documentoAggiornato.id
  )
  .maybeSingle();

if (scadenzaLookupError) {
  return res.status(500).json({
    ok: false,
    error: scadenzaLookupError.message,
  });
}

const payloadScadenza = {
  studio_id:
    documentoAggiornato.studio_id,

  cliente_id:
    null,

  operatore_responsabile_id:
    null,

  origine_modulo:
    "Antiriciclaggio",

  origine_tabella:
    "tbclienti_documenti_aml",

  origine_record_id:
    documentoAggiornato.id,

  tipo_scadenza:
    "documento_aml",

  titolo:
    "Scadenza documento di riconoscimento",

  descrizione:
    `${tipo_doc}${
      num_doc
        ? ` - ${String(num_doc).trim()}`
        : ""
    }`,

  data_scadenza:
    nuovaDataScadenza,

  stato:
    "attiva",

  priorita:
    "normale",

  giorni_preavviso_1:
    30,

  giorni_preavviso_2:
    10,

  giorni_preavviso_3:
    5,

  intervalli_alert:
    [30, 20, 10, 5, 2, 1, 0],

  prossimo_alert_at:
    prossimoAlertAt,

  ultimo_alert_inviato_at:
    null,

  numero_alert_inviati:
    0,

  completata_at:
    null,

  annullata_at:
    null,

  link_dettaglio:
    "/antiriciclaggio/rappresentanti",

  metadati: {
    soggetto_cliente_id:
      documentoAggiornato.soggetto_cliente_id,

    documento_aml_id:
      documentoAggiornato.id,

    tipo_documento:
      tipo_doc,

    numero_documento:
      String(num_doc).trim(),
  },

  updated_at:
    submittedAt,
};

if (scadenzaEsistente?.id) {
  const {
    error: scadenzaUpdateError,
  } = await supabase
    .from("tbscadenze_centrale")
    .update(payloadScadenza)
    .eq(
      "id",
      scadenzaEsistente.id
    )
    .eq(
      "studio_id",
      documentoAggiornato.studio_id
    );

  if (scadenzaUpdateError) {
    return res.status(500).json({
      ok: false,
      error:
        scadenzaUpdateError.message,
    });
  }
} else {
  const {
    error: scadenzaInsertError,
  } = await supabase
    .from("tbscadenze_centrale")
    .insert(payloadScadenza);

  if (scadenzaInsertError) {
    return res.status(500).json({
      ok: false,
      error:
        scadenzaInsertError.message,
    });
  }
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
