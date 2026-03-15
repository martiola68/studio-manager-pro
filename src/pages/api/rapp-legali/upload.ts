import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Metodo non consentito",
    });
  }

  try {
    const form = formidable();

    const [fields, files] = await form.parse(req);

    const file = files.file?.[0];
    const studioId = fields.studio_id?.[0];

    if (!file || !studioId) {
      return res.status(400).json({
        ok: false,
        error: "File o studio_id mancanti",
      });
    }

    const buffer = fs.readFileSync(file.filepath);

    const fileName = `${Date.now()}_${file.originalFilename}`;
    const path = `${studioId}/${fileName}`;

    const { error } = await supabase.storage
      .from("allegati")
      .upload(path, buffer, {
        contentType: file.mimetype || "application/octet-stream",
      });

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }

    return res.status(200).json({
      ok: true,
      path,
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Errore upload file",
    });
  }
}
