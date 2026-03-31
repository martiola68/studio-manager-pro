import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const BUCKET_NAME = "promemoria-allegati";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "15mb",
    },
  },
};

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo non consentito" });
  }

  try {
    const rawBody =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const token =
      typeof rawBody.token === "string" ? rawBody.token.trim() : "";

    const av4_id =
      typeof rawBody.av4_id === "string" ? rawBody.av4_id.trim() : "";

    const fileName =
      typeof rawBody.fileName === "string" ? rawBody.fileName.trim() : "";

    const fileType =
      typeof rawBody.fileType === "string" ? rawBody.fileType.trim() : "";

    const fileBase64 =
      typeof rawBody.fileBase64 === "string" ? rawBody.fileBase64 : "";

    if (!token) {
      return res.status(400).json({ ok: false, error: "Token mancante" });
    }

    if (!av4_id) {
      return res.status(400).json({ ok: false, error: "AV4 non valido" });
    }

    if (!fileName || !fileBase64) {
      return res.status(400).json({ ok: false, error: "File mancante" });
    }

    if (fileType !== "application/pdf") {
      return res
        .status(400)
        .json({ ok: false, error: "È consentito solo il formato PDF" });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log("UPLOAD API BODY:", {
  token,
  av4_id,
  fileName,
  fileType,
});

    const { data: av4, error: av4Error } = await supabase
      .from("tbAV4")
      .select("id, public_token, public_enabled, pdf_firmato_cliente")
      .eq("id", av4_id)
     // .eq("public_token", token)
      .maybeSingle();

    console.log("UPLOAD API AV4 RESULT:", av4, av4Error);

    if (av4Error) {
      return res.status(500).json({ ok: false, error: av4Error.message });
    }

    if (!av4) {
      return res.status(404).json({ ok: false, error: "Link non valido" });
    }

    if (!av4.public_enabled) {
      return res.status(400).json({ ok: false, error: "Link non più attivo" });
    }

    const safeName = sanitizeFileName(fileName || "av4_firmato.pdf");
    const filePath = `av4-firmati/${av4.id}/${Date.now()}-${safeName}`;

    const cleanBase64 = String(fileBase64).includes(",")
      ? String(fileBase64).split(",")[1]
      : String(fileBase64);

    const fileBuffer = Buffer.from(cleanBase64, "base64");

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ ok: false, error: "Contenuto file non valido" });
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return res.status(500).json({ ok: false, error: uploadError.message });
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData?.publicUrl || "";

   const { error: updateError } = await supabase
  .from("tbAV4")
  .update({
    pdf_firmato_cliente: filePath,
    public_submitted_at: new Date().toISOString(),
    public_enabled: false,
    compilato_da_cliente: true,
  })
  .eq("id", av4.id)
  .eq("public_token", token);

    if (updateError) {
      return res.status(500).json({ ok: false, error: updateError.message });
    }

    return res.status(200).json({
      ok: true,
      path: filePath,
      publicUrl,
      message: "PDF firmato caricato correttamente",
    });
  } catch (error: any) {
    console.error("API public AV4 upload PDF error:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Errore interno server",
    });
  }
}
