import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow PUT/PATCH only
  if (req.method !== "PUT" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1) Token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }
    const token = authHeader.slice("Bearer ".length).trim();

    // 2) Supabase with USER CONTEXT (RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    // 3) Validate token -> user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // 4) studio_id from user (server-side)
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

    const { id, ...updateData } = body || {};
    if (!id) {
      return res.status(400).json({ error: "Cassetto ID is required" });
    }

    // 6) Block studio_id changes from client
    if ("studio_id" in updateData) {
      delete updateData.studio_id;
      console.warn(`⚠️ Blocked attempt to change studio_id on cassetto ${id}`);
    }

    // 7) Verify cassetto exists (and RLS should already filter)
    const { data: existing, error: fetchError } = await supabase
      .from("tbcassetti_fiscali") // <-- CAMBIA QUI se serve
      .select("id, studio_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existing) {
      return res.status(404).json({ error: "Cassetto not found or access denied" });
    }

    // 8) Extra security: studio match
    if (existing.studio_id !== userData.studio_id) {
      return res.status(403).json({ error: "Cannot update cassetto from different studio" });
    }

    // 9) Update
    const { data: updated, error: updateError } = await supabase
      .from("tbcassetti_fiscali") // <-- CAMBIA QUI se serve
      .update(updateData)
      .eq("id", id)
      .select("*");

    if (updateError) {
      console.error("Update error:", updateError);
      return res.status(500).json({ error: "Failed to update cassetto", details: updateError.message });
    }

    if (!updated || updated.length === 0) {
      return res.status(500).json({ error: "Update failed: no rows returned" });
    }

    return res.status(200).json(updated[0]);
  } catch (e: any) {
    console.error("Unexpected error in /api/cassetti-fiscali/update:", e);
    return res.status(500).json({ error: "Internal server error", details: e?.message });
  }
}

