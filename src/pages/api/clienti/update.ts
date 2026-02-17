import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1) Read token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Missing or invalid authorization header" });
    }
    const token = authHeader.slice("Bearer ".length).trim();

    // 2) Supabase client WITH USER CONTEXT (RLS works)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false },
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // 3) Validate JWT -> user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // 4) Get studio_id for logged user
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
      return res.status(403).json({
        error: "User has no studio assigned. Cannot update cliente.",
      });
    }

    // 5) Body
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { id, ...updateData } = body || {};

    if (!id) {
      return res.status(400).json({ error: "Cliente ID is required" });
    }

    // 6) Block studio_id changes
    if ("studio_id" in updateData) {
      delete updateData.studio_id;
      console.warn(`⚠️ Attempt to modify studio_id blocked for cliente ${id}`);
    }

    // 7) Check cliente exists (and visible under RLS)
    const { data: existing, error: fetchError } = await supabase
      .from("tbclienti")
      .select("id, studio_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      console.error("Fetch cliente error:", fetchError);
      return res.status(500).json({ error: "Failed to fetch cliente" });
    }

    if (!existing) {
      return res.status(404).json({ error: "Cliente not found or access denied" });
    }

    if (existing.studio_id !== userData.studio_id) {
      return res
        .status(403)
        .json({ error: "Cannot update cliente from different studio" });
    }

    // 8) Update (NO .single() → handle 0 rows cleanly)
    const { data: updated, error: updateError } = await supabase
      .from("tbclienti")
      .update(updateData)
      .eq("id", id)
      .select("*");

    if (updateError) {
      console.error("Update error:", updateError);
      return res.status(500).json({
        error: "Failed to update cliente",
        details: updateError.message,
      });
    }

    if (!updated || updated.length === 0) {
      // This is the key fix for your PGRST116
      return res.status(404).json({
        error:
          "Nessun cliente aggiornato (id non trovato o permessi insufficienti)",
      });
    }

    return res.status(200).json(updated[0]);
  } catch (error) {
    console.error("Unexpected error in /api/clienti/update:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
