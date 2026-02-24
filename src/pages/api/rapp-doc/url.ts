import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "documenti";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const path = String(req.query.path || "");
    if (!path) return res.status(400).json({ error: "Missing query param: path" });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 10);

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true, signedUrl: data.signedUrl });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Server error" });
  }
}
