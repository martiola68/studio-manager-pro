import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { createAV7AccessProof } from "@/lib/aml/av7AccessProof";

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

    // La sessione del soggetto responsabile viene comprovata con un token
    // firmato e riferito all'utente/studio, non con il solo sessionStorage.
    const bearer = String(req.headers.authorization || "");
    const accessToken = bearer.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : "";
    let authUserId = "";
    let authStudioId = "";
    if (accessToken) {
      const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
      if (authError || !auth.user) return res.status(401).json({ ok: false, error: "Sessione non valida" });
      authUserId = auth.user.id;
      const { data: operator, error: operatorError } = await supabaseAdmin
        .from("tbutenti")
        .select("studio_id")
        .eq("user_id", auth.user.id)
        .eq("attivo", true)
        .limit(1)
        .maybeSingle();
      let studio = operator;
      if (!studio && !operatorError && auth.user.email) {
        const fallback = await supabaseAdmin.from("tbutenti")
          .select("studio_id").ilike("email", auth.user.email)
          .eq("attivo", true).limit(1).maybeSingle();
        studio = fallback.data;
        if (fallback.error) return res.status(403).json({ ok: false, error: "Utente studio non valido" });
      }
      if (operatorError || !studio?.studio_id) return res.status(403).json({ ok: false, error: "Utente studio non valido" });
      authStudioId = studio.studio_id;
    }

    const { data, error } = await supabaseAdmin
      .from("tbRespAVSocieta")
      .select("id, studio_id, antiriciclaggio_enabled, antiriciclaggio_password_hash")
      .eq("id", societaId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    if (!data) {
      return res.status(404).json({ ok: false, error: "Società non trovata" });
    }

    if (authUserId && data.studio_id !== authStudioId) {
      return res.status(403).json({ ok: false, error: "Soggetto non associato allo studio" });
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

    return res.status(200).json({
      ok: true,
      ...(authUserId ? {
        av7AccessProof: createAV7AccessProof({
          uid: authUserId, studio: authStudioId, societa: data.id,
        }),
      } : {}),
    });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.message ?? "Server error",
    });
  }
}
