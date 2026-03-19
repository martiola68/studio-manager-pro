import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type ResponseData =
  | { ok: true; signedUrl: string }
  | { ok: false; error: string };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET_NAME = "allegati";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function normalizeStoragePath(input: string) {
  const value = String(input || "").trim();
  if (!value) return "";

  if (value.startsWith("http://") || value.startsWith("https://")) {
    const markerPublic = `/storage/v1/object/public/${BUCKET_NAME}/`;
    const markerSign = `/storage/v1/object/sign/${BUCKET_NAME}/`;

    const publicIdx = value.indexOf(markerPublic);
    if (publicIdx !== -1) {
      return value.substring(publicIdx + markerPublic.length).split("?")[0];
    }

    const signIdx = value.indexOf(markerSign);
    if (signIdx !== -1) {
      return value.substring(signIdx + markerSign.length).split("?")[0];
    }
  }

  return value.replace(/^\/+/, "").replace(new RegExp(`^${BUCKET_NAME}/`), "");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const rawPath = req.body?.path;

    if (!rawPath) {
      return res.status(400).json({ ok: false, error: "Path documento mancante" });
    }

    const path = normalizeStoragePath(rawPath);

    if (!path) {
      return res.status(400).json({ ok: false, error: "Path documento non valido" });
    }

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 60);

    if (error || !data?.signedUrl) {
      return res.status(400).json({
        ok: false,
        error: error?.message || "Errore generazione link temporaneo",
      });
    }

    return res.status(200).json({
      ok: true,
      signedUrl: data.signedUrl,
    });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "Errore apertura documento",
    });
  }
}
