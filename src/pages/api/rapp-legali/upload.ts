import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import formidable, { type Fields, type Files } from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

type ResponseData =
  | { ok: true; publicUrl: string; path: string }
  | { ok: false; error: string };

const BUCKET_NAME = "allegati";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function getSafeFileName(originalName: string) {
  const ext = originalName.includes(".")
    ? originalName.split(".").pop()?.toLowerCase() || "bin"
    : "bin";

  const cleanBase = originalName
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 50);

  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `${cleanBase || "documento"}_${unique}.${ext}`;
}

function getSingleFieldValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    if (!supabaseUrl) {
      return res
        .status(500)
        .json({ ok: false, error: "NEXT_PUBLIC_SUPABASE_URL mancante" });
    }

    if (!serviceRoleKey) {
      return res
        .status(500)
        .json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY mancante" });
    }

    const form = formidable({ multiples: false });

    const { fields, files }: { fields: Fields; files: Files } = await new Promise(
      (resolve, reject) => {
        form.parse(req, (err, parsedFields, parsedFiles) => {
          if (err) reject(err);
          else resolve({ fields: parsedFields, files: parsedFiles });
        });
      }
    );

    const studioId = getSingleFieldValue(fields.studio_id);

    if (!studioId) {
      return res.status(400).json({ ok: false, error: "studio_id mancante" });
    }

    const uploadedFile = files.file;
    const file = Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile;

    if (!file) {
      return res.status(400).json({ ok: false, error: "File mancante" });
    }

    const originalFilename = file.originalFilename || "documento.bin";
    const safeName = getSafeFileName(originalFilename);
    const filePath = `rapp-legali/${studioId}/${safeName}`;
    const fileBuffer = fs.readFileSync(file.filepath);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        upsert: true,
        contentType: file.mimetype || "application/octet-stream",
      });

    if (uploadError) {
      return res.status(400).json({ ok: false, error: uploadError.message });
    }

    const { data } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(filePath);

    return res.status(200).json({
      ok: true,
      publicUrl: data.publicUrl,
      path: filePath,
    });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "Errore upload documento",
    });
  }
}
