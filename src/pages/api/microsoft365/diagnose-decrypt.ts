export const config = { runtime: "nodejs" };

import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { decrypt } from "@/lib/encryption365";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const studioId = req.query.studioId;

    if (!studioId || typeof studioId !== "string") {
      return res.status(400).json({
        ok: false,
        phase: "input",
        error: "Missing studioId",
        example: "/api/microsoft365/diagnose-decrypt?studioId=UUID",
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("microsoft365_config")
      .select("client_secret")
      .eq("studio_id", studioId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ ok: false, phase: "supabase", error: error.message });
    }
    if (!data?.client_secret) {
      return res.status(404).json({ ok: false, phase: "supabase", error: "CONFIG_NOT_FOUND_OR_EMPTY_SECRET" });
    }

    try {
      const secret = decrypt(data.client_secret);
      return res.status(200).json({
        ok: true,
        phase: "decrypt",
        result: "DECRYPT_OK",
        secret_length: secret.length,
      });
    } catch (e: any) {
      return res.status(200).json({
        ok: false,
        phase: "decrypt",
        result: "DECRYPT_FAIL",
        details: e?.message ?? String(e),
      });
    }
  } catch (e: any) {
    return res.status(500).json({ ok: false, phase: "fatal", error: e?.message ?? String(e) });
  }
}
