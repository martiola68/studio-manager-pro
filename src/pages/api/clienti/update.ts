import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow PUT/PATCH
  if (req.method !== "PUT" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Initialize Supabase client with user context (RLS active)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // 2. Validate JWT and get user
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // 3. Get studio_id from logged user (SERVER-SIDE GUARANTEE)
    const { data: userData, error: userError } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    if (userError) {
      console.error("User fetch error:", userError);
      return res.status(500).json({ error: "Failed to fetch user data" });
    }

    if (!userData?.studio_id) {
      return res.status(403).json({ 
        error: "User has no studio assigned. Cannot update cliente." 
      });
    }

    // 4. Extract cliente ID from body
    const { id, ...updateData } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Cliente ID is required" });
    }

    // 5. CRITICAL: Remove studio_id from update data (IMMUTABLE)
    // Frontend should not be able to change studio_id
    if ("studio_id" in updateData) {
      delete updateData.studio_id;
      console.warn(`⚠️ Attempt to modify studio_id blocked for cliente ${id}`);
    }

    // 6. Verify cliente exists and belongs to user's studio (via RLS)
    const { data: existingCliente, error: fetchError } = await supabase
      .from("tbclienti")
      .select("id, studio_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingCliente) {
      return res.status(404).json({ 
        error: "Cliente not found or access denied" 
      });
    }

    // 7. Double-check studio_id match (extra security)
    if (existingCliente.studio_id !== userData.studio_id) {
      return res.status(403).json({ 
        error: "Cannot update cliente from different studio" 
      });
    }

    // 8. Update cliente (studio_id remains unchanged)
    // RLS ensures user can only update their studio's clienti
    const { data: cliente, error: updateError } = await supabase
      .from("tbclienti")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      return res.status(500).json({ 
        error: "Failed to update cliente",
        details: updateError.message 
      });
    }

    // 9. Return updated cliente
    return res.status(200).json(cliente);

  } catch (error) {
    console.error("Unexpected error in /api/clienti/update:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}