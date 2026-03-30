import type { NextApiRequest, NextApiResponse } from "next";
import { IncomingForm, type File as FormidableFile } from "formidable";
import fs from "fs/promises";
import "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import { createClient } from "@supabase/supabase-js";
import { normalizeCF } from "@/utils/codiceFiscale";

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

async function extractTextFromPDF(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result?.text || "";
}

function extractCodiceFiscaleFromText(text: string): string | null {
  if (!text) return null;

  const normalizedText = text.toUpperCase().replace(/\s+/g, " ");

  // Cerca prima diciture tipiche di visura
  const labeledPatterns = [
    /CODICE\s+FISCALE[:\s]+([A-Z0-9]{11,16})/i,
    /C\.?F\.?[:\s]+([A-Z0-9]{11,16})/i,
  ];

  for (const pattern of labeledPatterns) {
    const match = normalizedText.match(pattern);
    if (match?.[1]) {
      return normalizeCF(match[1]);
    }
  }

  // Fallback: primo possibile CF italiano 16 caratteri
  const genericMatch = normalizedText.match(/\b[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]\b/);
  if (genericMatch?.[0]) {
    return normalizeCF(genericMatch[0]);
  }

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Metodo non consentito" });
    }

    const { files } = await parseForm(req);
    const uploaded = files.file;
    const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;

    if (!file) {
      return res.status(400).json({ error: "File mancante" });
    }

    const filepath = (file as any).filepath;
    const originalFilename = ((file as any).originalFilename || "").toLowerCase();
    const mimetype = (file as any).mimetype || "";
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

    if (codiceFiscale) {
      const supabase = getServerSupabase();

      const { data: existingCliente, error: existingError } = await supabase
        .from("tbclienti")
        .select("id, codice_fiscale")
        .eq("codice_fiscale", codiceFiscale)
        .limit(1)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingCliente) {
        return res.status(200).json({
          ok: false,
          alreadyExists: true,
          codiceFiscale,
          message: "Soggetto già presente in anagrafica generale",
        });
      }
    }

    return res.status(200).json({
      ok: true,
      alreadyExists: false,
      codiceFiscale: codiceFiscale || null,
      text,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || "Errore import visura",
    });
  }
}
