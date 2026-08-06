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
     * 1. Recuperiamo il rappresentante legacy.
     * L'id ricevuto dal frontend è ancora
     * rapp_legali.id.
     */
    const {
      data: rappresentanteLegacy,
      error: legacyLookupError,
    } = await supabaseAdmin
      .from("rapp_legali")
      .select(
        `
          id,
          studio_id,
          codice_fiscale
        `
      )
      .eq("id", id)
      .maybeSingle();

    if (
      legacyLookupError ||
      !rappresentanteLegacy?.id
    ) {
      return res.status(404).json({
        ok: false,
        error:
          legacyLookupError?.message ||
          "Rappresentante non trovato",
      });
    }

    const studioId = String(
      rappresentanteLegacy.studio_id || ""
    );

    if (!studioId) {
      return res.status(400).json({
        ok: false,
        error:
          "Studio del rappresentante non disponibile",
      });
    }

    /*
     * 2. Recuperiamo il documento AML collegato
     * tramite legacy_rapp_legale_id.
     */
    const {
      data: documentoAml,
      error: documentoLookupError,
    } = await supabaseAdmin
      .from("tbclienti_documenti_aml")
      .select(
        `
          id,
          soggetto_cliente_id,
          studio_id
        `
      )
      .eq("legacy_rapp_legale_id", id)
      .eq("studio_id", studioId)
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
      return res.status(409).json({
        ok: false,
        error:
          "Collegamento con il documento AML non trovato. Verificare la migrazione del rappresentante.",
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
     * 6. Manteniamo sincronizzata la tabella
     * legacy finché il lato pubblico e tutte
     * le pratiche non saranno migrati.
     */
    const payloadLegacy = {
      nome_cognome:
        nomeCognome,

      codice_fiscale:
        codiceFiscale,

      luogo_nascita:
        testoPulito(
          body.luogo_nascita
        ),

      data_nascita:
        body.data_nascita || null,

      citta_residenza:
        testoPulito(
          body.citta_residenza
        ),

      indirizzo_residenza:
        testoPulito(
          body.indirizzo_residenza
        ),

      CAP:
        testoPulito(body.CAP),

      nazionalita:
        testoPulito(
          body.nazionalita
        ),

      email:
        testoPulito(body.email),

      tipo_doc:
        testoPulito(body.tipo_doc),

      num_doc:
        testoPulito(body.num_doc),

      scadenza_doc:
        body.scadenza_doc || null,

      allegato_doc:
        testoPulito(
          body.allegato_doc
        ),

      rappresentante_legale:
        body.rappresentante_legale ??
        false,

      updated_at:
        new Date().toISOString(),
    };

    const {
      data: legacyAggiornato,
      error: legacyUpdateError,
    } = await supabaseAdmin
      .from("rapp_legali")
      .update(payloadLegacy)
      .eq("id", id)
      .eq("studio_id", studioId)
      .select()
      .single();

    if (legacyUpdateError) {
      return res.status(500).json({
        ok: false,
        error: legacyUpdateError.message,
      });
    }

    return res.status(200).json({
      ok: true,
      data: {
        ...legacyAggiornato,

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
