import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }
    const token = authHeader.slice("Bearer ".length).trim();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

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

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { id, ...updateData } = body || {};

    if (!id) {
      return res.status(400).json({ error: "Cassetto ID is required" });
    }

    if ("studio_id" in updateData) {
      delete updateData.studio_id;
      console.warn(`⚠️ Blocked attempt to change studio_id on cassetto ${id}`);
    }

    const { data: existing, error: fetchError } = await supabase
      .from("tbcassetti_fiscali")
      .select("id, studio_id, nominativo")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existing) {
      return res.status(404).json({ error: "Cassetto not found or access denied" });
    }

    if (existing.studio_id !== userData.studio_id) {
      return res.status(403).json({ error: "Cannot update cassetto from different studio" });
    }

    /*
     * Protezione fondamentale per la vista "Società collegate".
     * In quella vista la riga visualizza come nominativo la ragione sociale
     * del cliente collegato, ma l'ID aggiornato è quello del cassetto del gestore.
     * Se il client invia per errore quella ragione sociale come nominativo,
     * non deve mai sovrascrivere il nominativo reale del gestore del cassetto.
     */
    if (
      typeof updateData.nominativo === "string" &&
      updateData.nominativo.trim() &&
      updateData.nominativo.trim() !== String(existing.nominativo || "").trim()
    ) {
      const nominativoProposto = updateData.nominativo.trim();

      const { data: clienteCollegato, error: clienteCollegatoError } = await supabase
        .from("tbclienti")
        .select("id, ragione_sociale")
        .eq("studio_id", userData.studio_id)
        .eq("cassetto_fiscale_id", id)
        .eq("ragione_sociale", nominativoProposto)
        .limit(1)
        .maybeSingle();

      if (clienteCollegatoError) {
        console.error("Errore verifica società collegata al cassetto:", clienteCollegatoError);
        return res.status(500).json({ error: "Failed to validate linked company" });
      }

      if (clienteCollegato?.id) {
        console.warn(
          `⚠️ Bloccata sovrascrittura nominativo gestore cassetto ${id}: ` +
            `la società collegata '${nominativoProposto}' non può sostituire '${existing.nominativo}'`
        );
        delete updateData.nominativo;
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("tbcassetti_fiscali")
      .update(updateData)
      .eq("id", id)
      .select("*");

    if (updateError) {
      console.error("Update error:", updateError);
      return res.status(500).json({
        error: "Failed to update cassetto",
        details: updateError.message,
      });
    }

    if (!updated || updated.length === 0) {
      return res.status(500).json({ error: "Update failed: no rows returned" });
    }

    return res.status(200).json(updated[0]);
  } catch (e: any) {
    console.error("Unexpected error in /api/cassetti-fiscali/update:", e);
    return res.status(500).json({
      error: "Internal server error",
      details: e?.message,
    });
  }
}
