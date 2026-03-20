import type { NextApiRequest, NextApiResponse } from "next";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    req.on("data", (chunk: any) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function extractTextFromPDF(buffer: Buffer) {
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;

  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const strings = content.items.map((item: any) => item.str);
    fullText += strings.join(" ") + "\n";
  }

  return fullText;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Metodo non consentito" });
    }

    const buffer = await getRawBody(req);

    try {
      const text = await extractTextFromPDF(buffer);
      return res.status(200).json({ text });
    } catch {
      const text = buffer.toString("utf-8");
      return res.status(200).json({ text });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
