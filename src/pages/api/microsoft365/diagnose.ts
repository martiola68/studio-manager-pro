export const config = { runtime: "nodejs" };

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const ReqSchema = z.object({
  studioId: z.string().uuid(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, phase: "method", error: "Method not allowed" });
  }

  try {
    // Phase 0: input
    const parsed = ReqSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        phase: "input",
        code: "INVALID_BODY",
        details: "Body must be { studioId: <uuid> }",
      });
    }
    const { studioId } = parsed.data;

    // Phase 1: env (SERVER-SIDE)
    const env = {
      has_SUPABASE_URL: !!process.env.SUPABASE_URL,
      has_SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      has_ENCRYPTION_KEY_M365: !!process.env.ENCRYPTION_KEY_M365,
      node: process.version,
    };

    if (!env.has_SUPABASE_URL || !env.has_SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        ok: false,
        phase: "env",
        code: "MISSING_SUPABASE_ENV",
        env,
      });
    }

    // Phase 2: supabase query (ADMIN)
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
        code: "SUPABASE_QUERY_ERROR",
        details: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        ok: false,
        phase: "supabase",
        code: "CONFIG_NOT_FOUND",
      });
    }

    // Phase 3: config sanity (NO decrypt)
    return res.status(200).json({
      ok: true,
      phase: "done",
      env,
      config: {
        enabled: data.enabled,
        has_client_id: !!data.client_id,
        has_tenant_id: !!data.tenant_id,
        client_secret_len: data.client_secret?.length ?? 0,
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      phase: "fatal",
      code: "UNCAUGHT",
      details: e?.message ?? String(e),
    });
  }
}
