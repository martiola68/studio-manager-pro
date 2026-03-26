import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({
        ok: false,
        error: "Missing env vars",
      });
    }

    const { societaId, password, enabled } = req.body || {};

    if (!societaId) {
      return res.status(400).json({
        ok: false,
        error: "societaId obbligatorio",
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const payload: Record<string, any> = {
      antiriciclaggio_enabled: !!enabled,
      antiriciclaggio_password_updated_at: new Date().toISOString(),
    };

    if (password && String(password).trim()) {
      const hash = await bcrypt.hash(String(password).trim(), 10);
      payload.antiriciclaggio_password_hash = hash;
    }

    const { error } = await supabaseAdmin
      .from("tbRespAVSocieta")
      .update(payload)
      .eq("id", societaId);

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "Server error",
    });
  }
}
