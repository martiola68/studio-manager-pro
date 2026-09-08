import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SCADENZARI_FISCALI = [
  "tbscadiva",
  "tbscadccgg",
  "tbscadcu",
  "tbscadfiscali",
  "tbscadbilanci",
  "tbscad770",
  "tbscadlipe",
  "tbscadestero",
  "tbscadimu",
] as const;

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
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
      return res.status(403).json({ error: "User has no studio assigned. Cannot update cliente." });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { id, ...updateData } = body || {};

    Object.keys(updateData).forEach((k) => {
      if (updateData[k] === undefined) delete updateData[k];
    });

    const scadenzariKeys = [
      "flag_iva",
      "flag_cu",
      "flag_bilancio",
      "flag_lipe",
      "flag_esterometro",
      "flag_fiscali",
      "flag_770",
      "flag_ccgg",
      "flag_imu",
    ];

    for (const key of scadenzariKeys) {
      if (key in updateData) delete updateData[key];
    }

    const flagKeys = [
      "flag_mail_attivo",
      "flag_mail_scadenze",
      "flag_mail_newsletter",
    ];

    for (const key of flagKeys) {
      if (key in updateData) {
        const v = updateData[key];
        updateData[key] =
          v === true || v === "true" || v === 1 || v === "1"
            ? true
            : v === false || v === "false" || v === 0 || v === "0"
            ? false
            : Boolean(v);
      }
    }

    if (!id) return res.status(400).json({ error: "Cliente ID is required" });

    if ("studio_id" in updateData) {
      delete updateData.studio_id;
      console.warn(`⚠️ Attempt to modify studio_id blocked for cliente ${id}`);
    }

    const { data: existing, error: fetchError } = await supabase
      .from("tbclienti")
      .select("id, studio_id, utente_operatore_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      console.error("Fetch cliente error:", fetchError);
      return res.status(500).json({ error: "Failed to fetch cliente" });
    }

    if (!existing) return res.status(404).json({ error: "Cliente not found or access denied" });
    if (existing.studio_id !== userData.studio_id) {
      return res.status(403).json({ error: "Cannot update cliente from different studio" });
    }

    const nuovoUtenteFiscale = Object.prototype.hasOwnProperty.call(updateData, "utente_operatore_id")
      ? updateData.utente_operatore_id ?? null
      : existing.utente_operatore_id;
    const utenteFiscaleCambiato =
      Object.prototype.hasOwnProperty.call(updateData, "utente_operatore_id") &&
      nuovoUtenteFiscale !== existing.utente_operatore_id;

    const { data: updated, error: updateError } = await supabase
      .from("tbclienti")
      .update(updateData)
      .eq("id", id)
      .select("*");

    if (updateError) {
      console.error("Update error:", updateError);
      return res.status(500).json({ error: "Failed to update cliente", details: updateError.message });
    }

    if (!updated || updated.length === 0) {
      return res.status(404).json({ error: "Nessun cliente aggiornato (id non trovato o permessi insufficienti)" });
    }

    if (utenteFiscaleCambiato) {
      for (const table of SCADENZARI_FISCALI) {
        const { error: syncError } = await (supabase as any)
          .from(table)
          .update({ utente_operatore_id: nuovoUtenteFiscale })
          .eq("cliente_id", id);

        if (syncError) {
          console.error(`Sync utente fiscale fallita su ${table}:`, syncError);
          return res.status(500).json({
            error: "Cliente aggiornato, ma sincronizzazione scadenzari fiscali non completata",
            details: `${table}: ${syncError.message}`,
          });
        }
      }

      const { error: centraleError } = await (supabase as any)
        .from("tbscadenze_centrale")
        .update({ operatore_responsabile_id: nuovoUtenteFiscale })
        .eq("cliente_id", id)
        .eq("studio_id", userData.studio_id)
        .in("origine_tabella", [...SCADENZARI_FISCALI]);

      if (centraleError) {
        console.error("Sync utente fiscale fallita su tbscadenze_centrale:", centraleError);
        return res.status(500).json({
          error: "Cliente e scadenzari aggiornati, ma sincronizzazione scadenze centrali non completata",
          details: centraleError.message,
        });
      }
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
