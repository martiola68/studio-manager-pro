import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: { bodyParser: { sizeLimit: "15mb" } },
};

// ✅ IMPORTANTISSIMO: assicura runtime Node (no Edge)
export const runtime = "nodejs";

// ✅ env robuste
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE;

// ✅ bucket coerente con la UI
const BUCKET = "allegati";

function getExtFromName(name: string) {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

function sanitizeFileName(name: string) {
  return String(name || "file")
    .trim()
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 180);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({
        ok: false,
        error: "Missing env vars: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
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

    // ✅ check bucket (senza autocreazione: più sicuro)
    const { data: buckets, error: bErr } = await supabaseAdmin.storage.listBuckets();
    if (bErr) return res.status(500).json({ ok: false, error: bErr.message });

    const exists = (buckets || []).some((b) => b.name === BUCKET);
    if (!exists) {
      return res.status(500).json({
        ok: false,
        error: `Bucket "${BUCKET}" non trovato. Crealo in Supabase > Storage (case-sensitive).`,
      });
    }

    // base64 -> bytes
    const clean = String(base64).replace(/^data:.*;base64,/, "");
    const bytes = Buffer.from(clean, "base64");

    // ✅ hard limit ~ 15MB (bytes)
    const MAX_BYTES = 15 * 1024 * 1024;
    if (bytes.length > MAX_BYTES) {
      return res.status(413).json({ ok: false, error: "File troppo grande. Max 15MB." });
    }

    const safeName = sanitizeFileName(String(fileName));
    const path = `rapp_legali/${String(studioId)}/${Date.now()}_${safeName}`;

    // content-type minimo
    const ct = String(contentType || "application/octet-stream");

    const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
      contentType: ct,
      upsert: true,
      cacheControl: "3600",
    });

    if (upErr) return res.status(500).json({ ok: false, error: upErr.message });

    return res.status(200).json({ ok: true, bucket: BUCKET, path });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? "Server error" });
  }
}
