import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import { PDFParse } from "pdf-parse";
import { createClient } from "@supabase/supabase-js";
import {
  parseVisuraRappresentanti,
  dedupeByCodiceFiscale,
} from "@/utils/visuraRappresentantiMapper";
import {
  normalizeCF,
  isValidCF,
  extractDataNascitaFromCF,
  extractCodiceCatastaleFromCF,
} from "@/utils/codiceFiscale";

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

  const trimmed = String(date).trim();

  const itaMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (itaMatch) {
    const [, day, month, year] = itaMatch;
    return `${year}-${month}-${day}`;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;

  return null;
}

function normalizeRole(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getSubjectRole(subject: any): string | null {
  return (
    subject?.qualifica ||
    subject?.carica ||
    subject?.ruolo ||
    subject?.tipo_carica ||
    subject?.funzione ||
    null
  );
}

function isAmministratoreRole(value: string | null | undefined): boolean {
  const role = normalizeRole(value);
  if (!role) return false;

  const labels = [
    "amministratore unico",
    "amministratrice unica",
    "amministratore delegato",
    "amministratrice delegata",
    "presidente del consiglio di amministrazione",
    "presidente",
    "amministratore",
    "amministratrice",
    "liquidatore",
    "rappresentante dell'impresa",
    "rappresentante dell impresa",
  ];

  return labels.some((label) => role.includes(label));
}

async function getComuneFromCFServer(
  supabase: any,
  codiceFiscale: string
): Promise<{ comune: string; nazionalita: string } | null> {
  const cf = normalizeCF(codiceFiscale);

  if (!cf || cf.length !== 16 || !isValidCF(cf)) return null;

  const codiceCatastale = extractCodiceCatastaleFromCF(cf);
  if (!codiceCatastale) return null;

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("tb_comuni_catastali")
    .select(
      "codice_catastale, comune, sigla_provincia, data_inizio_validita, data_fine_validita"
    )
    .eq("codice_catastale", codiceCatastale)
    .or(`data_fine_validita.is.null,data_fine_validita.gte.${today}`)
    .order("data_inizio_validita", { ascending: false });

  if (error) {
    console.error("Errore ricerca comune catastale server:", error);
    return null;
  }

  const row = data?.[0];
  if (!row?.comune) return null;

  return {
    comune: String(row.comune).trim(),
    nazionalita: "Italiana",
  };
}

async function enrichSubjectFromCF(supabase: any, subject: any) {
  const cf = normalizeCF(subject?.codice_fiscale || "");

  const baseDataNascita = toIsoDate(subject?.data_nascita);
  const baseLuogoNascita = String(subject?.luogo_nascita || "").trim();
  const baseNazionalita = String(subject?.nazionalita || "").trim();

  if (!cf || cf.length !== 16 || !isValidCF(cf)) {
    return {
      codice_fiscale: cf || null,
      luogo_nascita: baseLuogoNascita || null,
      data_nascita: baseDataNascita || null,
      nazionalita: baseNazionalita || null,
    };
  }

  const comuneData = await getComuneFromCFServer(supabase, cf);
  const dataNascitaDaCf = extractDataNascitaFromCF(cf);

  return {
    codice_fiscale: cf,
    luogo_nascita: baseLuogoNascita || comuneData?.comune || null,
    data_nascita: baseDataNascita || dataNascitaDaCf || null,
    nazionalita: baseNazionalita || comuneData?.nazionalita || null,
  };
}

async function readJsonBody(req: NextApiRequest): Promise<any> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return null;

  return JSON.parse(raw);
}

async function buildRowsToInsert(
  supabase: any,
  studioId: string,
  subjects: any[]
) {
  return Promise.all(
    subjects.map(async (subject: any) => {
      const enriched = await enrichSubjectFromCF(supabase, subject);

      return {
        studio_id: studioId,
        nome_cognome: subject.nome_cognome || null,
        codice_fiscale: enriched.codice_fiscale,
        luogo_nascita: enriched.luogo_nascita,
        data_nascita: enriched.data_nascita,
        citta_residenza: subject.citta_residenza || null,
        indirizzo_residenza: subject.indirizzo_residenza || null,
        nazionalita: enriched.nazionalita,
        CAP: subject.CAP || subject.cap || null,
        rappresentante_legale: true,
      };
    })
  );
}

async function insertSelectedAmministratori(
  supabase: any,
  studioId: string,
  subjects: any[]
) {
  const validi = subjects.filter(
    (item: any) => !!item.codice_fiscale && !!String(item.codice_fiscale).trim()
  );

  const unici = dedupeByCodiceFiscale(
    validi.map((item: any) => ({
      ...item,
      codice_fiscale: normalizeCF(item.codice_fiscale || ""),
    }))
  );

  const cfList = unici
    .map((item: any) => normalizeCF(item.codice_fiscale || ""))
    .filter(Boolean);

  let existingSet = new Set<string>();

  if (cfList.length > 0) {
    const { data: existingRows, error: existingError } = await supabase
      .from("rapp_legali")
      .select("codice_fiscale")
      .eq("studio_id", studioId)
      .in("codice_fiscale", cfList);

    if (existingError) throw existingError;

    existingSet = new Set(
      (existingRows || [])
        .map((row: any) => normalizeCF(row.codice_fiscale || ""))
        .filter(Boolean)
    );
  }

  const daInserire = unici.filter(
    (item: any) => !existingSet.has(normalizeCF(item.codice_fiscale || ""))
  );

  const rowsToInsert = await buildRowsToInsert(supabase, studioId, daInserire);

  let inserted = 0;

  if (rowsToInsert.length > 0) {
    const { data: insertedRows, error: insertError } = await supabase
      .from("rapp_legali")
      .insert(rowsToInsert)
      .select("id");

    if (insertError) throw insertError;

    inserted = insertedRows?.length || rowsToInsert.length;
  }

  return {
    inserted,
    duplicates: unici.length - daInserire.length,
    skipped: subjects.length - validi.length,
    validi: validi.length,
    unici: unici.length,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("API import-visura-rappresentanti chiamata:", req.method);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const contentType = req.headers["content-type"] || "";
    const supabase = getServerSupabase() as any;

    if (contentType.includes("application/json")) {
      const body = await readJsonBody(req);

      const studioId = body?.studioId;
      const conferma = body?.conferma === true;
      const rappresentanti = Array.isArray(body?.rappresentanti)
        ? body.rappresentanti
        : [];

      if (!conferma) {
        return res.status(400).json({ error: "conferma mancante" });
      }

      if (!studioId || typeof studioId !== "string") {
        return res.status(400).json({ error: "studioId mancante" });
      }

      if (rappresentanti.length === 0) {
        return res
          .status(400)
          .json({ error: "Nessun amministratore selezionato" });
      }

      const result = await insertSelectedAmministratori(
        supabase,
        studioId,
        rappresentanti
      );

      return res.status(200).json({
        ok: true,
        inserted: result.inserted,
        duplicates: result.duplicates,
        skipped: result.skipped,
        stats: {
          selezionati: rappresentanti.length,
          validiConCodiceFiscale: result.validi,
          uniciPerCodiceFiscale: result.unici,
          giaPresentiInArchivio: result.duplicates,
          inseriti: result.inserted,
          scartatiSenzaCodiceFiscale: result.skipped,
        },
      });
    }

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

    const studioId = Array.isArray(fields.studioId)
      ? fields.studioId[0]
      : fields.studioId;

    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!studioId || typeof studioId !== "string") {
      return res.status(400).json({ error: "studioId mancante" });
    }

    if (!uploadedFile?.filepath) {
      return res.status(400).json({ error: "File PDF mancante" });
    }

    const previewMode =
      (Array.isArray(fields.preview) ? fields.preview[0] : fields.preview) ===
      "true";

    const buffer = fs.readFileSync(uploadedFile.filepath);
    const text = await extractTextFromPdfBuffer(buffer);

    const parsed = parseVisuraRappresentanti(text);

    const amministratori = parsed.filter((item: any) =>
      isAmministratoreRole(getSubjectRole(item))
    );

    const scartatiSenzaCf = amministratori.filter(
      (item: any) => !item.codice_fiscale || !String(item.codice_fiscale).trim()
    );

    const validi = amministratori.filter(
      (item: any) => !!item.codice_fiscale && !!String(item.codice_fiscale).trim()
    );

    const unici = dedupeByCodiceFiscale(
      validi.map((item: any) => ({
        ...item,
        codice_fiscale: normalizeCF(item.codice_fiscale || ""),
      }))
    );

    const duplicatiInterniPdf = validi.length - unici.length;

    const cfList = unici
      .map((item: any) => normalizeCF(item.codice_fiscale || ""))
      .filter((cf: unknown): cf is string => !!cf && typeof cf === "string");

    let existingSet = new Set<string>();

    if (cfList.length > 0) {
      const { data: existingRows, error: existingError } = await supabase
        .from("rapp_legali")
        .select("codice_fiscale")
        .eq("studio_id", studioId)
        .in("codice_fiscale", cfList);

      if (existingError) throw existingError;

      existingSet = new Set(
        (existingRows || [])
          .map((row: any) => normalizeCF(row.codice_fiscale || ""))
          .filter(Boolean)
      );
    }

    const giaPresenti = unici.filter((item: any) =>
      existingSet.has(normalizeCF(item.codice_fiscale || ""))
    );

    const daInserire = unici.filter(
      (item: any) => !existingSet.has(normalizeCF(item.codice_fiscale || ""))
    );

    if (previewMode) {
      return res.status(200).json({
        ok: true,
        preview: true,
        rappresentanti: unici.map((item: any) => {
          const cf = normalizeCF(item.codice_fiscale || "");
          const giaPresente = existingSet.has(cf);

          return {
            ...item,
            codice_fiscale: cf,
            tipo_soggetto: "amministratore",
            selected: !giaPresente,
            gia_presente: giaPresente,
            rappresentante_legale: true,
          };
        }),
        duplicates: giaPresenti.length,
        skipped: scartatiSenzaCf.length,
        totalFound: amministratori.length,
        stats: {
          trovatiNelPdf: amministratori.length,
          validiConCodiceFiscale: validi.length,
          uniciPerCodiceFiscale: unici.length,
          duplicatiInterniPdf,
          giaPresentiInArchivio: giaPresenti.length,
          daImportare: daInserire.length,
          scartatiSenzaCodiceFiscale: scartatiSenzaCf.length,
        },
      });
    }

    const result = await insertSelectedAmministratori(
      supabase,
      studioId,
      daInserire
    );

    return res.status(200).json({
      ok: true,
      message: "Import completato",
      inserted: result.inserted,
      duplicates: result.duplicates,
      skipped: result.skipped,
      totalFound: amministratori.length,
      stats: {
        trovatiNelPdf: amministratori.length,
        validiConCodiceFiscale: result.validi,
        uniciPerCodiceFiscale: result.unici,
        duplicatiInterniPdf,
        giaPresentiInArchivio: result.duplicates,
        inseriti: result.inserted,
        scartatiSenzaCodiceFiscale: result.skipped,
      },
    });
  } catch (error: any) {
    console.error("Errore import visura rappresentanti:", error);

    return res.status(500).json({
      error:
        error?.message || "Errore durante importazione visura rappresentanti",
    });
  }
}
