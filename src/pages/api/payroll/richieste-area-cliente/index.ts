import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmailServer } from "@/services/sendEmailServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST" && req.method !== "PUT") {
  return res.status(405).json({
    success: false,
    error: "Metodo non consentito",
  });
}

  try {
    const supabase = getSupabaseAdmin();

if (req.method === "PUT") {
 const { richiesta_id, stato, note_integrazione } = req.body || {};

  const statiValidi = [
    "bozza",
    "da_prendere_in_carico",
    "in_lavorazione",
    "integrazione_documenti",
    "conclusa",
  ];

  if (!richiesta_id) {
    return res.status(400).json({
      success: false,
      error: "ID richiesta mancante",
    });
  }

  if (!stato || !statiValidi.includes(stato)) {
    return res.status(400).json({
      success: false,
      error: "Stato pratica non valido",
    });
  }

  const now = new Date().toISOString();

  if (stato === "integrazione_documenti") {
    const { data: richiesta, error: richiestaError } = await supabase
      .from("tbassunzioni_richieste")
      .select(`
        id,
        numero_richiesta,
        cliente_id,
        cognome_nome,
        decorrenza_assunzione
      `)
      .eq("id", richiesta_id)
      .single();

    if (richiestaError || !richiesta) {
      return res.status(404).json({
        success: false,
        error: "Richiesta non trovata",
      });
    }

    const { data: cliente, error: clienteError } = await supabase
      .from("tbclienti")
      .select("id, ragione_sociale, utente_payroll_id")
      .eq("id", richiesta.cliente_id)
      .single();

    if (clienteError || !cliente) {
      return res.status(404).json({
        success: false,
        error: "Cliente non trovato",
      });
    }

    const { data: accessoCliente, error: accessoError } = await supabase
      .from("tbclienti_accessi_pubblici")
      .select("email_accesso")
      .eq("cliente_id", richiesta.cliente_id)
      .eq("attivo", true)
      .maybeSingle();

    if (accessoError || !accessoCliente?.email_accesso) {
      return res.status(400).json({
        success: false,
        error: "Email accesso Area Cliente non trovata.",
      });
    }

    if (!cliente.utente_payroll_id) {
      return res.status(400).json({
        success: false,
        error: "Operatore payroll non associato al cliente.",
      });
    }

    const { data: operatore, error: operatoreError } = await supabase
      .from("tbutenti")
      .select("id, nome, cognome, microsoft_connection_id")
      .eq("id", cliente.utente_payroll_id)
      .single();

    if (operatoreError || !operatore) {
      return res.status(404).json({
        success: false,
        error: "Operatore payroll non trovato.",
      });
    }

    if (!operatore.microsoft_connection_id) {
      return res.status(400).json({
        success: false,
        error: "Connessione Microsoft operatore non configurata.",
      });
    }

    const firma = [operatore.nome, operatore.cognome]
      .filter(Boolean)
      .join(" ");

    const emailResult = await sendEmailServer({
      senderUserId: operatore.id,
      microsoftConnectionId: operatore.microsoft_connection_id,
      to: accessoCliente.email_accesso,
      subject: `Integrazione documenti richiesta ${richiesta.numero_richiesta || ""}`,
      html: `
        <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #111827;">
          <p>Gentile Cliente,</p>

          <p>
            per completare la pratica di assunzione relativa a
            <strong>${richiesta.cognome_nome || "-"}</strong>
            è necessario integrare o reinviare la documentazione.
          </p>

          <p>
            La invitiamo ad accedere all'Area Cliente e utilizzare il pulsante
            <strong>Rinvia documenti</strong> presente sulla pratica.
            ${
  note_integrazione
    ? `
      <div style="margin: 16px 0; padding: 12px; border-left: 4px solid #f97316; background: #fff7ed;">
        <strong>Documentazione richiesta / Note dello Studio:</strong><br />
        ${String(note_integrazione).replace(/\n/g, "<br />")}
      </div>
    `
    : ""
}
          </p>

          <p>
            <strong>Numero richiesta:</strong> ${richiesta.numero_richiesta || "-"}<br />
            <strong>Lavoratore:</strong> ${richiesta.cognome_nome || "-"}<br />
            <strong>Decorrenza:</strong> ${
              richiesta.decorrenza_assunzione
                ? new Date(richiesta.decorrenza_assunzione).toLocaleDateString("it-IT")
                : "-"
            }
          </p>

          <p>Cordiali saluti</p>
          ${firma ? `<p>${firma}</p>` : ""}
        </div>
      `,
    });

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        error: emailResult.error || "Invio email richiesta integrazione non riuscito.",
      });
    }
  }

  const { error } = await supabase
    .from("tbassunzioni_richieste")
    .update({
      stato,
      updated_at: now,
    })
    .eq("id", richiesta_id);

  if (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }

  return res.status(200).json({
    success: true,
    stato,
  });
}
    
    if (req.method === "POST") {
  const {
    richiesta_id,
    doc_fronte_confermato,
    doc_retro_confermato,
    doc_codice_fiscale_confermato,
    doc_permesso_soggiorno_confermato,
    doc_curriculum_confermato,
  } = req.body || {};

  if (!richiesta_id) {
    return res.status(400).json({
      success: false,
      error: "ID richiesta mancante",
    });
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("tbassunzioni_richieste")
    .update({
      doc_fronte_confermato: !!doc_fronte_confermato,
      doc_retro_confermato: !!doc_retro_confermato,
      doc_codice_fiscale_confermato: !!doc_codice_fiscale_confermato,
      doc_permesso_soggiorno_confermato: !!doc_permesso_soggiorno_confermato,
      doc_curriculum_confermato: !!doc_curriculum_confermato,
      documenti_confermati_at: now,
      updated_at: now,
    })
    .eq("id", richiesta_id);

  if (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }

  return res.status(200).json({
    success: true,
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
