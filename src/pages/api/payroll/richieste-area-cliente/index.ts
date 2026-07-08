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
        doc_fronte_confermato,
        doc_retro_confermato,
        doc_codice_fiscale_confermato,
        doc_permesso_soggiorno_confermato,
        doc_curriculum_confermato,
        documenti_confermati_at,
        documenti_confermati_da,
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

  return res.status(200).json({
    success: true,
    richiesta: data,
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
