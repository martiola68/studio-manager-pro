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

/* 🔴 AGGIUNTA MINIMA: estrazione CF */
function extractCodiceFiscale(text: string): string | null {
  if (!text) return null;

  const normalized = text.toUpperCase();

  const match = normalized.match(
    /\b[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]\b/
  );

  return match ? normalizeCF(match[0]) : null;
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

      /* 🔴 CONTROLLO CF */
      const cf = extractCodiceFiscale(text);
      if (cf) {
        const supabase = getServerSupabase();

        const { data } = await supabase
          .from("tbclienti")
          .select("id")
          .eq("codice_fiscale", cf)
          .maybeSingle();

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

      /* 🔴 CONTROLLO CF */
      const cf = extractCodiceFiscale(text);
      if (cf) {
        const supabase = getServerSupabase();

        const { data } = await supabase
          .from("tbclienti")
          .select("id")
          .eq("codice_fiscale", cf)
          .maybeSingle();

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
