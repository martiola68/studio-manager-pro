import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Metodo non consentito",
    });
  }

  const studio_id =
    typeof req.query.studio_id === "string"
      ? req.query.studio_id
      : null;

  if (!studio_id) {
    return res.status(400).json({
      ok: false,
      error: "studio_id obbligatorio",
    });
  }

  const { data, error } = await supabaseAdmin
    .from("rapp_legali")
    .select(`
      id,
      studio_id,
      nome_cognome,
      codice_fiscale,
      luogo_nascita,
      data_nascita,
      indirizzo_residenza,
      citta_residenza,
      indirizzo,
      citta,
      provincia,
      cap,
      "CAP",
      email,
      rappresentante_legale,
      amministratore_principale
    `)
    .eq("studio_id", studio_id)
    .order("nome_cognome", { ascending: true });

  if (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }

  return res.status(200).json({
    ok: true,
    data: data || [],
  });
}
