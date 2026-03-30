import type { NextApiRequest, NextApiResponse } from "next";
import { IncomingForm, type File as FormidableFile } from "formidable";
import fs from "fs/promises";
import "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false,
  },
};

function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Variabili Supabase server mancanti");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function parseForm(
  req: NextApiRequest
): Promise<{
  fields: Record<string, any>;
  files: Record<string, FormidableFile | FormidableFile[] | undefined>;
}> {
  const form = new IncomingForm({
    multiples: false,
    keepExtensions: true,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result?.text || "";
}

function normalizeCF(value: string | null | undefined): string {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

function extractCodiceFiscaleFromText(text: string): string | null {
  if (!text) return null;

  const normalizedText = text
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();

  const patterns = [
    /codice\s+fiscale\s*[:\-]?\s*([A-Z0-9]{11,16})/i,
    /c\.?\s*f\.?\s*[:\-]?\s*([A-Z0-9]{11,16})/i,
    /\b([A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z])\b/i,
    /\b([0-9]{11})\b/,
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    if (match?.[1]) {
      const cf = normalizeCF(match[1]);
      if (cf.length === 16 || cf.length === 11) {
        return cf;
      }
    }
  }

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Metodo non consentito" });
    }

    const { fields, files } = await parseForm(req);

    const studioId = Array.isArray(fields.studioId) ? fields.studioId[0] : fields.studioId;
    const uploaded = files.file;
    const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;

    if (!file) {
      return res.status(400).json({ error: "File mancante" });
    }

    if (!studioId || typeof studioId !== "string") {
      return res.status(400).json({ error: "studioId mancante" });
    }

    const filepath = (file as any).filepath;
    const originalFilename = String((file as any).originalFilename || "").toLowerCase();
    const mimetype = String((file as any).mimetype || "");
    const buffer = await fs.readFile(filepath);

    let text = "";

    if (mimetype === "text/plain" || originalFilename.endsWith(".txt")) {
      text = buffer.toString("utf-8");
    } else if (mimetype === "application/pdf" || originalFilename.endsWith(".pdf")) {
      text = await extractTextFromPDF(buffer);
    } else {
      return res.status(400).json({ error: "Formato non supportato. Usa PDF o TXT." });
    }

    const codiceFiscale = extractCodiceFiscaleFromText(text);

    if (!codiceFiscale) {
      return res.status(200).json({
        text,
        codiceFiscale: null,
        alreadyExists: false,
      });
    }

    const supabase = getServerSupabase();

    const { data: existingRows, error: existingError } = await supabase
      .from("tbclienti")
      .select("id, codice_fiscale")
      .eq("studio_id", studioId)
      .eq("codice_fiscale", codiceFiscale)
      .limit(1);

    if (existingError) {
      throw existingError;
    }

    const alreadyExists = !!existingRows?.length;

    if (alreadyExists) {
      return res.status(200).json({
        error: "Soggetto già presente in anagrafica generale",
        alreadyExists: true,
        codiceFiscale,
        text: null,
      });
    }

    return res.status(200).json({
      text,
      codiceFiscale,
      alreadyExists: false,
    });
  } catch (err: any) {
    console.error("Errore import visura anagrafiche:", err);

    return res.status(500).json({
      error: err?.message || "Errore import visura",
    });
  }
}
