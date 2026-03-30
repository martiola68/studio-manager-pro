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

/* FIX MIRATO: estrazione CF/P.IVA dal testo */
function extractCodiceFiscale(text: string): string | null {
  if (!text) return null;

  const normalized = text.toUpperCase().replace(/\s+/g, " ");

  // 1) prima prova a cercare una dicitura esplicita
  const labeledMatch = normalized.match(
    /CODICE\s+FISCALE[:\s]*([A-Z0-9]{11,16})/
  );
  if (labeledMatch?.[1]) {
    return normalizeCF(labeledMatch[1]);
  }

  // 2) fallback CF persona fisica (16 caratteri)
  const cf16Match = normalized.match(
    /\b[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]\b/
  );
  if (cf16Match?.[0]) {
    return normalizeCF(cf16Match[0]);
  }

  // 3) fallback società / P.IVA / CF numerico 11 cifre
  const cf11Match = normalized.match(/\b\d{11}\b/);
  if (cf11Match?.[0]) {
    return cf11Match[0];
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

    if (mimetype === "text/plain" || originalFilename.endsWith(".txt")) {
      const text = buffer.toString("utf-8");

      const codiceFiscale = extractCodiceFiscale(text);
      if (codiceFiscale) {
        const supabase = getServerSupabase();

        const { data, error } = await supabase
          .from("tbclienti")
          .select("id")
          .eq("codice_fiscale", codiceFiscale)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          return res.status(200).json({
            alreadyExists: true,
            message: "Soggetto già presente in anagrafica generale",
          });
        }
      }

      return res.status(200).json({ text });
    }

    if (mimetype === "application/pdf" || originalFilename.endsWith(".pdf")) {
      const text = await extractTextFromPDF(buffer);

      const codiceFiscale = extractCodiceFiscale(text);
      if (codiceFiscale) {
        const supabase = getServerSupabase();

        const { data, error } = await supabase
          .from("tbclienti")
          .select("id")
          .eq("codice_fiscale", codiceFiscale)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          return res.status(200).json({
            alreadyExists: true,
            message: "Soggetto già presente in anagrafica generale",
          });
        }
      }

      return res.status(200).json({ text });
    }

    return res.status(400).json({ error: "Formato non supportato. Usa PDF o TXT." });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Errore import visura" });
  }
}
