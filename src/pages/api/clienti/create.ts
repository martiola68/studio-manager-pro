import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST
  if (req.method !== "POST") {
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
        error: "User has no studio assigned. Cannot create cliente." 
      });
    }

    // 4. FORCE studio_id on insert (CRITICAL: not from frontend!)
    const clienteData = {
      ...req.body,
      studio_id: userData.studio_id, // SERVER-SIDE FORCED
    };

    // 5. Insert cliente with guaranteed studio_id
    // Use same client (RLS active) to ensure user can only create in their studio
    const { data: cliente, error: insertError } = await supabase
      .from("tbclienti")
      .insert(clienteData)
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return res.status(500).json({ 
        error: "Failed to create cliente",
        details: insertError.message 
      });
    }

    // 6. Return created cliente
    return res.status(201).json(cliente);

  } catch (error) {
    console.error("Unexpected error in /api/clienti/create:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}