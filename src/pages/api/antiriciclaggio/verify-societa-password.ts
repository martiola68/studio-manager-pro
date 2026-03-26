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
        error:
          "Missing env vars: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    const { societaId, password } = req.body || {};

    if (!societaId || !password) {
      return res.status(400).json({
        ok: false,
        error: "Missing fields: societaId, password",
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabaseAdmin
      .from("tbRespAVSocieta")
      .select("id, antiriciclaggio_enabled, antiriciclaggio_password_hash")
      .eq("id", societaId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    if (!data) {
      return res.status(404).json({ ok: false, error: "Società non trovata" });
    }

    if (!data.antiriciclaggio_enabled) {
      return res.status(200).json({ ok: true });
    }

    if (!data.antiriciclaggio_password_hash) {
      return res.status(400).json({
        ok: false,
        error: "Password antiriciclaggio non configurata per la società",
      });
    }

    const isValid = await bcrypt.compare(
      String(password),
      String(data.antiriciclaggio_password_hash)
    );

    if (!isValid) {
      return res.status(401).json({
        ok: false,
        error: "Password non corretta per la società selezionata",
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.message ?? "Server error",
    });
  }
}
