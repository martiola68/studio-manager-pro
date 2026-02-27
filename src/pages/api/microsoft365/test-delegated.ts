export const config = { runtime: "nodejs" };

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@/lib/supabase/server";

type ApiOk = {
  success: true;
  message: string;
  user: { displayName?: string; mail?: string; userPrincipalName?: string };
};

type ApiErr = { success: false; error: string; details?: any };

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiOk | ApiErr>) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    // 1) utente loggato (cookie)
    const supabase = createClient(req, res);
    const { data: s, error: sErr } = await supabase.auth.getSession();
    if (sErr || !s?.session?.user) {
      return res.status(401).json({ success: false, error: "Non autenticato" });
    }
    const userId = s.session.user.id;

    // 2) carica token Delegated salvato dal callback
    const { data: tok, error: tokErr } = await supabase
      .from("tbmicrosoft_tokens")
      .select("access_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (tokErr) {
      return res.status(500).json({ success: false, error: "DB error", details: tokErr.message });
    }

    if (!tok?.access_token) {
      return res.status(400).json({
        success: false,
        error: "Account Microsoft non connesso. Clicca prima “Connetti Microsoft 365”.",
      });
    }

    // 3) chiamata Graph Delegated
    const r = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });

    const j = await r.json().catch(() => null);

    if (!r.ok) {
      return res.status(400).json({
        success: false,
        error: "Graph API call failed (delegated)",
        details: j?.error?.message || j,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Delegated OK",
      user: {
        displayName: j?.displayName,
        mail: j?.mail,
        userPrincipalName: j?.userPrincipalName,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: "Internal error", details: e?.message });
  }
}
