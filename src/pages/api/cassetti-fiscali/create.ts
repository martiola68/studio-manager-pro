import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1) Token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }
    const token = authHeader.slice("Bearer ".length).trim();

    // 2) Supabase con contesto utente (RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    // 3) User
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // 4) studio_id dell’utente
    const { data: userData, error: userError } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", user.id)
      .maybeSingle();

    if (userError) {
      console.error("User fetch error:", userError);
      return res.status(500).json({ error: "Failed to fetch user data" });
    }

    if (!userData?.studio_id) {
      return res.status(403).json({ error: "User has no studio assigned" });
    }

    // 5) Body
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // 6) Blocca eventuale studio_id dal client
    const { studio_id: _blocked, ...safeData } = body || {};

    // 7) Forza studio_id server-side
    const payload = { ...safeData, studio_id: userData.studio_id };

    // 8) Insert
    const { data, error } = await supabase
      .from("tbcassetti_fiscali") // <-- CAMBIA QUI
      .insert(payload)
      .select("*");

    if (error) {
      console.error("Insert error:", error);
      return res.status(500).json({ error: "Failed to create cassetto", details: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(500).json({ error: "Insert failed: no rows returned" });
    }

    return res.status(201).json(data[0]);
  } catch (e: any) {
    console.error("Unexpected error in /api/cassetti-fiscali/create:", e);
    return res.status(500).json({ error: "Internal server error", details: e?.message });
  }
}

