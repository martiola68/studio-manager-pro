import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SCADENZARI_TABLES = [
  "tbscadiva",
  "tbscad770",
  "tbscadlipe",
  "tbscadestero",
  "tbscadproforma",
  "tbscadimu",
  "tbscadcu",
  "tbscadbilanci",
  "tbscadccgg",
  "tbscadfiscali",
] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return res.status(500).json({ error: "Configurazione Supabase incompleta" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Autenticazione mancante" });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabaseUser.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: "Sessione non valida" });
  }

  const { data: utente, error: utenteError } = await supabaseUser
    .from("tbutenti")
    .select("studio_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (utenteError || !utente?.studio_id) {
    return res.status(403).json({ error: "Studio non disponibile" });
  }

  const studioId = String(utente.studio_id);
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: inattivi, error: inattiviError } = await admin
    .from("tbclienti")
    .select("id")
    .eq("studio_id", studioId)
    .eq("cliente", true)
    .neq("attivo", true);

  if (inattiviError) {
    return res.status(500).json({ error: inattiviError.message });
  }

  const clienteIds = (inattivi ?? []).map((row: any) => String(row.id)).filter(Boolean);

  if (clienteIds.length === 0) {
    return res.status(200).json({ ok: true, clienti_inattivi: 0, record_eliminati: 0 });
  }

  const { error: serviziError } = await admin
    .from("tbclienti_servizi")
    .update({
      flag_iva: false,
      flag_cu: false,
      flag_bilancio: false,
      flag_fiscali: false,
      flag_lipe: false,
      flag_770: false,
      flag_esterometro: false,
      flag_ccgg: false,
      flag_proforma: false,
      flag_imu: false,
      updated_at: new Date().toISOString(),
    })
    .eq("studio_id", studioId)
    .in("cliente_id", clienteIds);

  if (serviziError) {
    return res.status(500).json({ error: serviziError.message });
  }

  let recordEliminati = 0;

  for (const table of SCADENZARI_TABLES) {
    const { data, error } = await admin
      .from(table as any)
      .delete()
      .eq("studio_id", studioId)
      .in("cliente_id", clienteIds)
      .select("id");

    if (error) {
      return res.status(500).json({
        error: `Pulizia ${table} non riuscita: ${error.message}`,
      });
    }

    recordEliminati += Array.isArray(data) ? data.length : 0;
  }

  return res.status(200).json({
    ok: true,
    clienti_inattivi: clienteIds.length,
    record_eliminati: recordEliminati,
  });
}
