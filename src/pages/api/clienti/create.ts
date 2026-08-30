import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Sessione non valida" });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !anonKey || !serviceKey) {
      return res.status(500).json({ error: "Configurazione server Supabase incompleta" });
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data: authData, error: authError } = await authClient.auth.getUser();
    const user = authData.user;
    if (authError || !user) return res.status(401).json({ error: "Sessione scaduta o non valida" });

    let { data: userData, error: userError } = await admin
      .from("tbutenti")
      .select("id, studio_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if ((!userData || userError) && user.email) {
      const fallback = await admin
        .from("tbutenti")
        .select("id, studio_id")
        .eq("email", user.email.toLowerCase())
        .maybeSingle();
      userData = fallback.data;
      userError = fallback.error;
    }

    if (userError) return res.status(500).json({ error: "Impossibile determinare lo studio dell'utente", details: userError.message });
    if (!userData?.studio_id || !userData?.id) return res.status(403).json({ error: "Utente senza studio associato" });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const codiceFiscale = String(body?.codice_fiscale ?? "").trim().toUpperCase();
    if (!codiceFiscale) return res.status(400).json({ error: "Codice Fiscale obbligatorio" });

    const { data: existing, error: existingError } = await admin
      .from("tbclienti")
      .select("id, ragione_sociale")
      .eq("studio_id", userData.studio_id)
      .eq("codice_fiscale", codiceFiscale)
      .limit(1);

    if (existingError) return res.status(500).json({ error: "Errore nel controllo duplicati", details: existingError.message });
    if (existing?.length) {
      return res.status(409).json({ error: `Cliente già esistente: ${existing[0].ragione_sociale || codiceFiscale}` });
    }

    const hasResponsabile = Boolean(body?.utente_operatore_id || body?.utente_professionista_id || body?.utente_payroll_id);
    const clienteData = {
      ...body,
      codice_fiscale: codiceFiscale,
      studio_id: userData.studio_id,
      utente_operatore_id: hasResponsabile ? body?.utente_operatore_id ?? null : userData.id,
      utente_professionista_id: body?.utente_professionista_id ?? null,
      utente_payroll_id: body?.utente_payroll_id ?? null,
    };
    delete clienteData.id;

    const { data: inserted, error: insertError } = await admin
      .from("tbclienti")
      .insert(clienteData)
      .select("*")
      .single();

    if (insertError) {
      return res.status(500).json({ error: "Errore inserimento cliente", details: insertError.message, code: insertError.code });
    }

    return res.status(201).json(inserted);
  } catch (error) {
    return res.status(500).json({
      error: "Errore interno durante la creazione del cliente",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
