import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
  return res.status(405).json({
    success: false,
    error: "Metodo non consentito",
  });
}

  try {
    const supabase = getSupabaseAdmin();

    if (req.method === "POST") {
  const { azione, file_path, storage_bucket } = req.body || {};

  if (azione !== "signed_url") {
    return res.status(400).json({
      success: false,
      error: "Azione non valida",
    });
  }

  if (!file_path || !storage_bucket) {
    return res.status(400).json({
      success: false,
      error: "Percorso file mancante",
    });
  }

  const { data, error } = await supabase.storage
    .from(storage_bucket)
    .createSignedUrl(file_path, 60);

  if (error || !data?.signedUrl) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Impossibile aprire il documento",
    });
  }

  return res.status(200).json({
    success: true,
    signedUrl: data.signedUrl,
  });
}

    const richiestaId =
      typeof req.query.id === "string" ? req.query.id : null;

    let query = supabase
      .from("tbassunzioni_richieste")
      .select(`
        id,
        numero_richiesta,
        studio_id,
        cliente_id,
        submitted_at,
        created_at,
        azienda,
        cognome_nome,
        luogo_nascita,
        data_nascita,
        cittadinanza,
        extra_ue,
        codice_fiscale,
        indirizzo_residenza,
        indirizzo_domicilio,
        telefono,
        email,
        stato_civile,
        iban,
        percettore_naspi,
        data_iscrizione_naspi,
        decorrenza_assunzione,
        sede_lavoro,
        tipologia_contratto,
        durata,
        mansione,
        livello,
        orario_lavoro,
        distribuzione_oraria,
        retribuzione,
        centro_costo,
        note_cliente,
        stato,
        tbclienti:cliente_id (
          id,
          ragione_sociale,
          utente_payroll_id
        )
      `);

  if (richiestaId) {
  const { data, error } = await query.eq("id", richiestaId).single();

  if (error) {
    return res.status(404).json({
      success: false,
      error: "Richiesta non trovata",
    });
  }

  const { data: allegati, error: allegatiError } = await supabase
    .from("tbassunzioni_allegati")
    .select(`
      id,
      tipo_documento,
      file_name,
      file_path,
      storage_bucket,
      uploaded_at
    `)
    .eq("richiesta_id", richiestaId)
    .order("uploaded_at", { ascending: true });

  if (allegatiError) {
    return res.status(500).json({
      success: false,
      error: allegatiError.message,
    });
  }

  return res.status(200).json({
    success: true,
    richiesta: data,
    allegati: allegati || [],
  });
}

    const { data, error } = await query.order("submitted_at", {
      ascending: false,
    });

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      richieste: data || [],
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore caricamento richieste area cliente",
    });
  }
}
