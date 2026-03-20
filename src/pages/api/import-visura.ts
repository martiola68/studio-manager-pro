import type { NextApiRequest, NextApiResponse } from "next";
import { IncomingForm, type File as FormidableFile } from "formidable";
import fs from "fs/promises";


export const config = {
  api: {
    bodyParser: false,
  },
};

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
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const uint8Array = new Uint8Array(buffer);

  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;

  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) =>
      "str" in item ? item.str : ""
    );
    fullText += strings.join(" ") + "\n";
  }

  return fullText;
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
      return res.status(200).json({ text });
    }

    if (mimetype === "application/pdf" || originalFilename.endsWith(".pdf")) {
      const text = await extractTextFromPDF(buffer);
      return res.status(200).json({ text });
    }

    return res.status(400).json({ error: "Formato non supportato. Usa PDF o TXT." });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Errore import visura" });
  }
}
