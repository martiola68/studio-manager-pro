import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import { PDFParse } from "pdf-parse";
import { createClient } from "@supabase/supabase-js";
import { mapVisuraRappresentanti } from "@/utils/visuraRappresentantiMapper";

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

async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text || "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("API import-visura-rappresentanti chiamata:", req.method);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { fields, files } = await new Promise<any>((resolve, reject) => {
      const form = formidable({ multiples: false });

      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const studioId = Array.isArray(fields.studioId) ? fields.studioId[0] : fields.studioId;
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!studioId) {
      return res.status(400).json({ error: "studioId mancante" });
    }

    if (!uploadedFile?.filepath) {
      return res.status(400).json({ error: "File PDF mancante" });
    }

    const buffer = fs.readFileSync(uploadedFile.filepath);
    const text = await extractTextFromPdfBuffer(buffer);

    console.log("=== TESTO ESTRATTO INIZIO ===");
    console.log(text?.slice(0, 4000));
    console.log("=== TESTO ESTRATTO FINE ===");

    const subjects = mapVisuraRappresentanti(text);

    console.log("=== SOGGETTI ESTRATTI ===");
    console.log(JSON.stringify(subjects, null, 2));

    const supabase = getServerSupabase() as any;

    let inserted = 0;
    let duplicates = 0;
    let skipped = 0;

    for (const subject of subjects) {
      if (!subject.nome_cognome || !subject.codice_fiscale) {
        skipped++;
        continue;
      }

      const { data: existing, error: existingError } = await supabase
        .from("rapp_legali")
        .select("id")
        .eq("codice_fiscale", subject.codice_fiscale)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        duplicates++;
        continue;
      }

      const { error: insertError } = await supabase.from("rapp_legali").insert({
        studio_id: studioId,
        nome_cognome: subject.nome_cognome,
        codice_fiscale: subject.codice_fiscale,
        luogo_nascita: subject.luogo_nascita,
        data_nascita: subject.data_nascita,
        citta_residenza: subject.citta_residenza,
        indirizzo_residenza: subject.indirizzo_residenza,
        nazionalita: subject.nazionalita,
        CAP: subject.CAP,
      });

      if (insertError) throw insertError;

      inserted++;
    }

    return res.status(200).json({
      inserted,
      duplicates,
      skipped,
      totalFound: subjects.length,
    });
  } catch (error: any) {
    console.error("Errore import visura rappresentanti:", error);

    return res.status(500).json({
      error: error?.message || "Errore durante importazione visura rappresentanti",
    });
  }
}
