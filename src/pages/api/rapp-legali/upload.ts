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

type ResponseData =
  | { ok: true; path: string }
  | { ok: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Metodo non consentito",
    });
  }

  try {
    const form = formidable({
      multiples: false,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10 MB
    });

    const [fields, files] = await form.parse(req);

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    const studioId = Array.isArray(fields.studio_id)
      ? fields.studio_id[0]
      : fields.studio_id;

    if (!file || !studioId) {
      return res.status(400).json({
        ok: false,
        error: "File o studio_id mancanti",
      });
    }

    const buffer = fs.readFileSync(file.filepath);
    const safeName = (file.originalFilename || `file_${Date.now()}`)
      .replace(/\s+/g, "_")
      .replace(/[^\w.\-]/g, "");
    const fileName = `${Date.now()}_${safeName}`;
    const path = `${studioId}/${fileName}`;

    const { error } = await supabase.storage
      .from("allegati")
      .upload(path, buffer, {
        contentType: file.mimetype || "application/octet-stream",
        upsert: false,
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
