import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function generaPassword() {
  return crypto.randomBytes(6).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { cliente_id, email_accesso } = req.body;

    if (!cliente_id) {
      return res.status(400).json({ error: "Cliente mancante" });
    }

    if (!email_accesso) {
      return res.status(400).json({ error: "Email accesso mancante" });
    }

    const supabase = getSupabaseAdmin();

    const { data: cliente, error: clienteError } = await supabase
      .from("tbclienti")
      .select("id, studio_id, ragione_sociale")
      .eq("id", cliente_id)
      .single();

    if (clienteError || !cliente) {
      return res.status(404).json({ error: "Cliente non trovato" });
    }

    const password = generaPassword();
    const password_hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from("tbclienti_accessi_pubblici")
      .upsert(
        {
          studio_id: cliente.studio_id,
          cliente_id,
          email_accesso,
          password_hash,
          attivo: true,
          data_attivazione: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "cliente_id" }
      )
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      accesso: data,
      password_generata: password,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Errore durante abilitazione accesso",
    });
  }
}
