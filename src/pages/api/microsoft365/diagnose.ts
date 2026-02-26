export const config = { runtime: "nodejs" };

import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const studioId = req.query.studioId;

    if (!studioId || typeof studioId !== "string") {
      return res.status(400).json({
        ok: false,
        phase: "input",
        error: "Missing studioId in query string",
        example: "/api/microsoft365/diagnose?studioId=UUID",
      });
    }

    // Phase 1: ENV
    const env = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      ENCRYPTION_KEY_M365: !!process.env.ENCRYPTION_KEY_M365,
      node: process.version,
    };

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        ok: false,
        phase: "env",
        env,
      });
    }

    // Phase 2: Supabase
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("microsoft365_config")
      .select("studio_id, enabled, client_id, tenant_id, client_secret")
      .eq("studio_id", studioId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        ok: false,
        phase: "supabase",
        error: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        ok: false,
        phase: "supabase",
        error: "CONFIG_NOT_FOUND",
      });
    }

    // Phase 3: Done
    return res.status(200).json({
      ok: true,
      phase: "done",
      env,
      config: {
        enabled: data.enabled,
        has_client_id: !!data.client_id,
        has_tenant_id: !!data.tenant_id,
        client_secret_length: data.client_secret?.length ?? 0,
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      phase: "fatal",
      error: e?.message ?? String(e),
    });
  }
}