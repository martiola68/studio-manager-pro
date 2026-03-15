import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type ResponseData =
  | { ok: true; data: any }
  | { ok: false; error: string };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ ok: false, error: "ID mancante" });
    }

    const { data, error } = await supabaseAdmin
      .from("rapp_legali")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return res.status(400).json({ ok: false, error: error.message });
    }

    return res.status(200).json({ ok: true, data });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "Errore caricamento rappresentante",
    });
  }
}
