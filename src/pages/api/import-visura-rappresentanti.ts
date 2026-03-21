import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import { PDFParse } from "pdf-parse";
import { createClient } from "@supabase/supabase-js";
import {
  parseVisuraRappresentanti,
  dedupeByCodiceFiscale,
} from "@/utils/visuraRappresentantiMapper";

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

function toIsoDate(date: string | null | undefined): string | null {
  if (!date) return null;

  const trimmed = date.trim();

  const itaMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (itaMatch) {
    const [, day, month, year] = itaMatch;
    return `${year}-${month}-${day}`;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return trimmed;
  }

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("API import-visura-rappresentanti chiamata:", req.method);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { fields, files } = await new Promise<{
      fields: formidable.Fields;
      files: formidable.Files;
    }>((resolve, reject) => {
      const form = formidable({ multiples: false });

      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const studioId = Array.isArray(fields.studioId) ? fields.studioId[0] : fields.studioId;
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!studioId || typeof studioId !== "string") {
      return res.status(400).json({ error: "studioId mancante" });
    }

    if (!uploadedFile?.filepath) {
      return res.status(400).json({ error: "File PDF mancante" });
    }

    const buffer = fs.readFileSync(uploadedFile.filepath);
    const text = await extractTextFromPdfBuffer(buffer);

    console.log("=== TESTO ESTRATTO INIZIO ===");
    console.log(text?.slice(0, 12000));
    console.log("=== TESTO ESTRATTO FINE ===");

    const parsed = parseVisuraRappresentanti(text);

    console.log("=== SOGGETTI PARSATI RAW ===");
    console.log(JSON.stringify(parsed, null, 2));

    const supabase = getServerSupabase() as any;

    const scartatiSenzaCf = parsed.filter(
      (item) => !item.codice_fiscale || !item.codice_fiscale.trim()
    );

    const validi = parsed.filter(
      (item) => !!item.codice_fiscale && !!item.codice_fiscale.trim()
    );

    const unici = dedupeByCodiceFiscale(validi);
    const duplicatiInterniPdf = validi.length - unici.length;

    console.log("=== SOGGETTI VALIDI ===");
    console.log(JSON.stringify(validi, null, 2));

    console.log("=== SOGGETTI UNICI PER CF ===");
    console.log(JSON.stringify(unici, null, 2));

    const cfList = unici
      .map((item) => item.codice_fiscale?.toUpperCase().trim())
      .filter((cf): cf is string => !!cf);

    let existingSet = new Set<string>();

    if (cfList.length > 0) {
      const { data: existingRows, error: existingError } = await supabase
        .from("rapp_legali")
        .select("codice_fiscale")
        .in("codice_fiscale", cfList);

      if (existingError) {
        throw existingError;
      }

      existingSet = new Set(
        (existingRows || [])
          .map((row: { codice_fiscale?: string | null }) =>
            (row.codice_fiscale || "").toUpperCase().trim()
          )
          .filter(Boolean)
      );
    }

    const giaPresenti = unici.filter((item) =>
      existingSet.has(item.codice_fiscale!.toUpperCase().trim())
    );

    const daInserire = unici.filter(
      (item) => !existingSet.has(item.codice_fiscale!.toUpperCase().trim())
    );

    console.log("=== GIA PRESENTI ===");
    console.log(JSON.stringify(giaPresenti, null, 2));

    console.log("=== DA INSERIRE ===");
    console.log(JSON.stringify(daInserire, null, 2));

    console.log(
      "=== DATE DEBUG ===",
      daInserire.map((x) => ({
        nome: x.nome_cognome,
        originale: x.data_nascita,
        convertita: toIsoDate(x.data_nascita),
      }))
    );

    const rowsToInsert = daInserire.map((subject) => ({
      studio_id: studioId,
      nome_cognome: subject.nome_cognome || null,
      codice_fiscale: subject.codice_fiscale || null,
      luogo_nascita: subject.luogo_nascita || null,
      data_nascita: toIsoDate(subject.data_nascita),
      citta_residenza: subject.citta_residenza || null,
      indirizzo_residenza: subject.indirizzo_residenza || null,
      nazionalita: subject.nazionalita || null,
      CAP: subject.CAP || null,
    }));

    let inserted = 0;

    if (rowsToInsert.length > 0) {
      const { data: insertedRows, error: insertError } = await supabase
        .from("rapp_legali")
        .insert(rowsToInsert)
        .select("id");

      if (insertError) {
        throw insertError;
      }

      inserted = insertedRows?.length || rowsToInsert.length;
    }

    return res.status(200).json({
      ok: true,
      message: "Import completato",
      inserted,
      duplicates: giaPresenti.length,
      skipped: scartatiSenzaCf.length,
      totalFound: parsed.length,
      stats: {
        trovatiNelPdf: parsed.length,
        validiConCodiceFiscale: validi.length,
        uniciPerCodiceFiscale: unici.length,
        duplicatiInterniPdf,
        giaPresentiInArchivio: giaPresenti.length,
        inseriti: inserted,
        scartatiSenzaCodiceFiscale: scartatiSenzaCf.length,
      },
      debug: {
        parsed,
        validi,
        unici,
        giaPresenti,
        daInserire,
        scartatiSenzaCf,
      },
    });
  } catch (error: any) {
    console.error("Errore import visura rappresentanti:", error);

    return res.status(500).json({
      error: error?.message || "Errore durante importazione visura rappresentanti",
    });
  }
}
