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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { path } = req.body ?? {};

    if (!path) {
      return res.status(400).json({ ok: false, error: "Path documento mancante" });
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
