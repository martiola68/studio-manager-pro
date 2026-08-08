import type {
  NextApiRequest,
  NextApiResponse,
} from "next";
import { createClient } from "@supabase/supabase-js";

type ResponseData =
  | {
      ok: true;
      data: any;
    }
  | {
      ok: false;
      error: string;
    };

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

function testoPulito(
  value: unknown
): string | null {
  const risultato = String(value ?? "").trim();

  return risultato || null;
}

function normalizzaCodiceFiscale(
  value: unknown
): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Metodo non consentito",
    });
  }

  try {
    const body = req.body ?? {};

    const id = String(body.id || "").trim();

    const nomeCognome = String(
      body.nome_cognome || ""
    ).trim();

    const codiceFiscale =
      normalizzaCodiceFiscale(
        body.codice_fiscale
      );

    if (!id) {
      return res.status(400).json({
        ok: false,
        error: "ID rappresentante mancante",
      });
    }

    if (!nomeCognome) {
      return res.status(400).json({
        ok: false,
        error: "Nome e cognome obbligatori",
      });
    }

    if (!codiceFiscale) {
      return res.status(400).json({
        ok: false,
        error: "Codice fiscale obbligatorio",
      });
    }

  /*
 * 1. L'id ricevuto dal frontend è direttamente
 * tbclienti_documenti_aml.id.
 */
const {
  data: documentoAml,
  error: documentoLookupError,
} = await supabaseAdmin
  .from("tbclienti_documenti_aml")
  .select(`
    id,
    soggetto_cliente_id,
    studio_id,
    scadenza_documento
  `)
  .eq("id", id)
  .eq("attivo", true)
  .maybeSingle();

if (documentoLookupError) {
  return res.status(500).json({
    ok: false,
    error: documentoLookupError.message,
  });
}

if (
  !documentoAml?.id ||
  !documentoAml?.soggetto_cliente_id
) {
  return res.status(404).json({
    ok: false,
    error:
      "Documento AML del rappresentante non trovato",
  });
}

const studioId = String(
  documentoAml.studio_id || ""
);

if (!studioId) {
  return res.status(400).json({
    ok: false,
    error:
      "Studio del rappresentante non disponibile",
  });
}
  
    const soggettoClienteId = String(
      documentoAml.soggetto_cliente_id
    );

    /*
     * 3. Evitiamo che il nuovo codice fiscale
     * appartenga a un'altra anagrafica dello
     * stesso studio.
     */
    const {
      data: soggettoConStessoCf,
      error: controlloCfError,
    } = await supabaseAdmin
      .from("tbclienti")
      .select("id")
      .eq("studio_id", studioId)
      .eq("codice_fiscale", codiceFiscale)
      .neq("id", soggettoClienteId)
      .limit(1)
      .maybeSingle();

    if (controlloCfError) {
      return res.status(500).json({
        ok: false,
        error: controlloCfError.message,
      });
    }

    if (soggettoConStessoCf?.id) {
      return res.status(409).json({
        ok: false,
        error:
          "Esiste già un'altra anagrafica con questo codice fiscale.",
      });
    }

    /*
     * 4. Aggiorniamo l'anagrafica unica.
     *
     * Non tocchiamo cliente e attivo:
     * conserviamo lo stato già presente
     * nell'anagrafica.
     */
    const {
      data: soggettoAggiornato,
      error: soggettoUpdateError,
    } = await supabaseAdmin
      .from("tbclienti")
      .update({
        ragione_sociale:
          nomeCognome,

        codice_fiscale:
          codiceFiscale,

        luogo_nascita:
          testoPulito(
            body.luogo_nascita
          ),

        data_nascita:
          body.data_nascita || null,

        indirizzo:
          testoPulito(
            body.indirizzo_residenza
          ),

        citta:
          testoPulito(
            body.citta_residenza
          ),

        cap:
          testoPulito(body.CAP),

        email:
          testoPulito(body.email),

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", soggettoClienteId)
      .eq("studio_id", studioId)
      .select(
        `
          id,
          studio_id,
          ragione_sociale,
          codice_fiscale,
          email
        `
      )
      .single();

    if (soggettoUpdateError) {
      return res.status(500).json({
        ok: false,
        error: soggettoUpdateError.message,
      });
    }

    /*
     * 5. Aggiorniamo esclusivamente i dati
     * documentali nella nuova tabella.
     *
     * Token, date di apertura/invio e connessione
     * Microsoft restano invariati.
     */
    const {
      data: documentoAggiornato,
      error: documentoUpdateError,
    } = await supabaseAdmin
      .from("tbclienti_documenti_aml")
      .update({
        tipo_documento:
          testoPulito(body.tipo_doc),

        numero_documento:
          testoPulito(body.num_doc),

        scadenza_documento:
          body.scadenza_doc || null,

        allegato_documento:
          testoPulito(
            body.allegato_doc
          ),

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", documentoAml.id)
      .eq("studio_id", studioId)
      .select()
      .single();

 if (documentoUpdateError) {
  return res.status(500).json({
    ok: false,
    error: documentoUpdateError.message,
  });
}

/*
 * 6. Sincronizzazione con Scadenze unificate.
 *
 * La scadenza appartiene al documento AML
 * della persona, non alle società rappresentate.
 */
const nuovaScadenzaDocumento =
  documentoAggiornato.scadenza_documento
    ? String(documentoAggiornato.scadenza_documento)
    : null;

const vecchiaScadenzaDocumento =
  documentoAml.scadenza_documento
    ? String(documentoAml.scadenza_documento)
    : null;

const scadenzaDocumentoCambiata =
  nuovaScadenzaDocumento !==
  vecchiaScadenzaDocumento;

/*
 * Cerchiamo la scadenza centrale dello stesso
 * record documentale AML.
 */
const {
  data: scadenzaCentraleEsistente,
  error: scadenzaCentraleLookupError,
} = await supabaseAdmin
  .from("tbscadenze_centrale")
  .select(`
    id,
    data_scadenza,
    stato,
    numero_alert_inviati,
    prossimo_alert_at
  `)
  .eq("studio_id", studioId)
  .eq(
    "origine_tabella",
    "tbclienti_documenti_aml"
  )
  .eq(
    "origine_record_id",
    documentoAggiornato.id
  )
  .maybeSingle();

if (scadenzaCentraleLookupError) {
  return res.status(500).json({
    ok: false,
    error:
      scadenzaCentraleLookupError.message,
  });
}

/*
 * Se non esiste più una data di scadenza,
 * l'eventuale scadenza centrale viene annullata.
 */
if (!nuovaScadenzaDocumento) {
  if (scadenzaCentraleEsistente?.id) {
    const adesso =
      new Date().toISOString();

    const {
      error: annullaScadenzaError,
    } = await supabaseAdmin
      .from("tbscadenze_centrale")
      .update({
        stato: "annullata",
        prossimo_alert_at: null,
        annullata_at: adesso,
        updated_at: adesso,
      })
      .eq(
        "id",
        scadenzaCentraleEsistente.id
      )
      .eq("studio_id", studioId);

    if (annullaScadenzaError) {
      return res.status(500).json({
        ok: false,
        error:
          annullaScadenzaError.message,
      });
    }
  }
} else {
  /*
   * Calcoliamo il primo alert a -30 giorni.
   *
   * Se siamo già dentro la finestra dei 30 giorni,
   * la scadenza diventa processabile subito.
   */
  const dataPrimoAlert = new Date(
    `${nuovaScadenzaDocumento}T08:00:00.000Z`
  );

  dataPrimoAlert.setUTCDate(
    dataPrimoAlert.getUTCDate() - 30
  );

  const adesso =
    new Date();

  const prossimoAlertAt =
    dataPrimoAlert.getTime() >
    adesso.getTime()
      ? dataPrimoAlert.toISOString()
      : adesso.toISOString();

  const tipoDocumento =
    testoPulito(body.tipo_doc);

  const numeroDocumento =
    testoPulito(body.num_doc);

  const descrizioneDocumento = [
    tipoDocumento,
    numeroDocumento
      ? `n. ${numeroDocumento}`
      : null,
  ]
    .filter(Boolean)
    .join(" - ");

  /*
   * La scadenza esiste già.
   */
  if (scadenzaCentraleEsistente?.id) {
    const aggiornamentoScadenza: any = {
      origine_modulo:
        "Antiriciclaggio",

      tipo_scadenza:
        "documento_aml",

      titolo:
        `Documento AML - ${nomeCognome}`,

      descrizione:
        descrizioneDocumento || null,

      data_scadenza:
        nuovaScadenzaDocumento,

      stato:
        "attiva",

      priorita:
        "normale",

      intervalli_alert:
        [30, 20, 10, 5, 2, 1, 0],

      link_dettaglio:
        "/antiriciclaggio/rappresentanti",

      metadati: {
        soggetto_cliente_id:
          soggettoClienteId,

        documento_aml_id:
          documentoAggiornato.id,

        tipo_documento:
          tipoDocumento,

        numero_documento:
          numeroDocumento,
      },

      completata_at:
        null,

      annullata_at:
        null,

      updated_at:
        new Date().toISOString(),
    };

    /*
     * ATTENZIONE:
     * azzeriamo il ciclo alert SOLO se è cambiata
     * la data di scadenza.
     */
    if (scadenzaDocumentoCambiata) {
      aggiornamentoScadenza.prossimo_alert_at =
        prossimoAlertAt;

      aggiornamentoScadenza.numero_alert_inviati =
        0;

      aggiornamentoScadenza.ultimo_alert_inviato_at =
        null;
    }

    const {
      error: aggiornaScadenzaError,
    } = await supabaseAdmin
      .from("tbscadenze_centrale")
      .update(
        aggiornamentoScadenza
      )
      .eq(
        "id",
        scadenzaCentraleEsistente.id
      )
      .eq(
        "studio_id",
        studioId
      );

    if (aggiornaScadenzaError) {
      return res.status(500).json({
        ok: false,
        error:
          aggiornaScadenzaError.message,
      });
    }
  } else {
    /*
     * Prima registrazione della scadenza
     * di questo documento AML.
     */
    const {
      error: inserisciScadenzaError,
    } = await supabaseAdmin
      .from("tbscadenze_centrale")
      .insert({
        studio_id:
          studioId,

        cliente_id:
          null,

        operatore_responsabile_id:
          null,

        origine_modulo:
          "Antiriciclaggio",

        origine_tabella:
          "tbclienti_documenti_aml",

        origine_record_id:
          documentoAggiornato.id,

        tipo_scadenza:
          "documento_aml",

        titolo:
          `Documento AML - ${nomeCognome}`,

        descrizione:
          descrizioneDocumento || null,

        data_scadenza:
          nuovaScadenzaDocumento,

        stato:
          "attiva",

        priorita:
          "normale",

        giorni_preavviso_1:
          30,

        giorni_preavviso_2:
          10,

        giorni_preavviso_3:
          5,

        intervalli_alert:
          [30, 20, 10, 5, 2, 1, 0],

        prossimo_alert_at:
          prossimoAlertAt,

        ultimo_alert_inviato_at:
          null,

        numero_alert_inviati:
          0,

        link_dettaglio:
          "/antiriciclaggio/rappresentanti",

        metadati: {
          soggetto_cliente_id:
            soggettoClienteId,

          documento_aml_id:
            documentoAggiornato.id,

          tipo_documento:
            tipoDocumento,

          numero_documento:
            numeroDocumento,
        },

        completata_at:
          null,

        annullata_at:
          null,

        updated_at:
          new Date().toISOString(),
      });

    if (inserisciScadenzaError) {
      return res.status(500).json({
        ok: false,
        error:
          inserisciScadenzaError.message,
      });
    }
  }
}

return res.status(200).json({
  ok: true,
  data: {
    id: documentoAggiornato.id,
    studio_id: studioId,
    soggetto_cliente_id:
      soggettoClienteId,

    soggetto:
      soggettoAggiornato,

    documento_aml:
      documentoAggiornato,
  },
});
    
  } catch (error: any) {
    console.error(
      "Errore aggiornamento rappresentante:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Errore interno server",
    });
  }
}
