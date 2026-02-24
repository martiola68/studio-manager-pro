import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: { bodyParser: { sizeLimit: "15mb" } },
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "documenti";

function getExtFromName(name: string) {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { studioId, fileName, contentType, base64 } = req.body || {};
    if (!studioId || !fileName || !contentType || !base64) {
      return res.status(400).json({ error: "Missing fields: studioId, fileName, contentType, base64" });
    }

    const ext = getExtFromName(String(fileName));
    if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) {
      return res.status(400).json({ error: "Formato non supportato. Usa PDF/JPG/PNG." });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: buckets, error: bErr } = await supabaseAdmin.storage.listBuckets();
    if (bErr) return res.status(500).json({ error: bErr.message });

    const exists = (buckets || []).some((b) => b.name === BUCKET);
    if (!exists) {
      const { error: cErr } = await supabaseAdmin.storage.createBucket(BUCKET, { public: false });
      if (cErr) return res.status(500).json({ error: `Impossibile creare bucket "${BUCKET}": ${cErr.message}` });
    }

    const clean = String(base64).replace(/^data:.*;base64,/, "");
    const bytes = Buffer.from(clean, "base64");

    const safeName = String(fileName).replace(/\s+/g, "_");
    const path = `rapp_legali/${studioId}/${Date.now()}_${safeName}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: String(contentType), upsert: true });

    if (upErr) return res.status(500).json({ error: upErr.message });

    return res.status(200).json({ ok: true, bucket: BUCKET, path });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Server error" });
  }
}
