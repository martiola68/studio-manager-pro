import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: { bodyParser: { sizeLimit: "15mb" } },
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ✅ bucket coerente con la UI
const BUCKET = "allegati";

function getExtFromName(name: string) {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({
        ok: false,
        error: "Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    const { studioId, fileName, contentType, base64 } = req.body || {};
    if (!studioId || !fileName || !contentType || !base64) {
      return res.status(400).json({
        ok: false,
        error: "Missing fields: studioId, fileName, contentType, base64",
      });
    }

    const ext = getExtFromName(String(fileName));
    if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) {
      return res.status(400).json({ ok: false, error: "Formato non supportato. Usa PDF/JPG/PNG." });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // (opzionale) crea bucket se non esiste
    const { data: buckets, error: bErr } = await supabaseAdmin.storage.listBuckets();
    if (bErr) return res.status(500).json({ ok: false, error: bErr.message });

    const exists = (buckets || []).some((b) => b.name === BUCKET);
    if (!exists) {
      const { error: cErr } = await supabaseAdmin.storage.createBucket(BUCKET, { public: false });
      if (cErr) {
        return res.status(500).json({
          ok: false,
          error: `Impossibile creare bucket "${BUCKET}": ${cErr.message}`,
        });
      }
    }

    const clean = String(base64).replace(/^data:.*;base64,/, "");
    const bytes = Buffer.from(clean, "base64");

    const safeName = String(fileName).replace(/[^\w.\-]+/g, "_");
    const path = `rapp_legali/${studioId}/${Date.now()}_${safeName}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: String(contentType),
        upsert: true, // se preferisci non sovrascrivere: metti false
        cacheControl: "3600",
      });

    if (upErr) return res.status(500).json({ ok: false, error: upErr.message });

    return res.status(200).json({ ok: true, bucket: BUCKET, path });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? "Server error" });
  }
}
