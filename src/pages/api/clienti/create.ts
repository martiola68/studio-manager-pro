import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST
  if (req.method !== "POST") {
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

    // 4) Get studio_id from logged user (SERVER-SIDE GUARANTEE)
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
        error: "User has no studio assigned. Cannot create cliente.",
      });
    }

    // 5) Body (safe parse)
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // 6) Codice fiscale: obbligatorio + normalizzazione
    const rawCF: string = (body?.codice_fiscale ?? "").toString().trim();
    const codiceFiscale = rawCF.toUpperCase();

    if (!codiceFiscale) {
      return res.status(400).json({
        error: "Codice Fiscale obbligatorio",
      });
    }

    // 7) Controllo duplicati (stesso studio)
    // Se esiste già un cliente con stesso CF nello stesso studio -> blocca
    const { data: existing, error: existingError } = await supabase
      .from("tbclienti")
      .select("id, ragione_sociale, codice_fiscale")
      .eq("studio_id", userData.studio_id)
      .eq("codice_fiscale", codiceFiscale)
      .limit(1);

    if (existingError) {
      console.error("Duplicate check error:", existingError);
      return res.status(500).json({ error: "Failed to check duplicate cliente" });
    }

    if (existing && existing.length > 0) {
      return res.status(409).json({
        error: "Cliente già esistente: Codice Fiscale duplicato",
        existingClienteId: existing[0].id,
      });
    }

    // 8) FORCE studio_id on insert (CRITICAL: not from frontend!)
    const clienteData = {
      ...body,
      codice_fiscale: codiceFiscale, // normalized
      studio_id: userData.studio_id, // SERVER-SIDE FORCED
    };

    // 9) Insert cliente
    const { data: inserted, error: insertError } = await supabase
      .from("tbclienti")
      .insert(clienteData)
      .select("*");

    if (insertError) {
      console.error("Insert error:", insertError);
      return res.status(500).json({
        error: "Failed to create cliente",
        details: insertError.message,
      });
    }

    if (!inserted || inserted.length === 0) {
      return res.status(500).json({
        error: "Insert failed: no rows returned",
      });
    }

    // 10) Return created cliente
    return res.status(201).json(inserted[0]);
  } catch (error) {
    console.error("Unexpected error in /api/clienti/create:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
