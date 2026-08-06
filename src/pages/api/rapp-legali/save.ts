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

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

function normalizzaCodiceFiscale(
  value: unknown
): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function valoreTesto(
  value: unknown
): string | null {
  const risultato =
    String(value || "").trim();

  return risultato || null;
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

  let legacyRappLegaleId: string | null =
    null;

  try {
    const body = req.body ?? {};

    const studioId =
      String(body.studio_id || "").trim();

    const nomeCognome =
      String(body.nome_cognome || "").trim();

    const codiceFiscale =
      normalizzaCodiceFiscale(
        body.codice_fiscale
      );

    if (!studioId) {
      return res.status(400).json({
        ok: false,
        error: "studio_id obbligatorio",
      });
    }

    if (!nomeCognome) {
      return res.status(400).json({
        ok: false,
        error: "nome_cognome obbligatorio",
      });
    }

    /*
     * Il codice fiscale è indispensabile
     * per identificare univocamente il soggetto
     * tra rapp_legali e tbclienti.
     */
    if (!codiceFiscale) {
      return res.status(400).json({
        ok: false,
        error: "codice_fiscale obbligatorio",
      });
    }

    /*
     * 1. Manteniamo temporaneamente la scrittura
     * nella tabella legacy.
     *
     * Questo evita di rompere:
     * - link pubblici;
     * - API ancora non migrate;
     * - fascicoli e pratiche esistenti.
     */
    const payloadLegacy = {
      studio_id: studioId,

      nome_cognome:
        nomeCognome,

      codice_fiscale:
        codiceFiscale,

      luogo_nascita:
        valoreTesto(body.luogo_nascita),

      data_nascita:
        body.data_nascita || null,

      citta_residenza:
        valoreTesto(body.citta_residenza),

      indirizzo_residenza:
        valoreTesto(
          body.indirizzo_residenza
        ),

      CAP:
        valoreTesto(body.CAP),

      nazionalita:
        valoreTesto(body.nazionalita),

      email:
        valoreTesto(body.email),

      tipo_doc:
        valoreTesto(body.tipo_doc),

      num_doc:
        valoreTesto(body.num_doc),

      scadenza_doc:
        body.scadenza_doc || null,

      allegato_doc:
        valoreTesto(body.allegato_doc),

      rappresentante_legale:
        body.rappresentante_legale ??
        false,
    };

    const {
      data: legacyData,
      error: legacyError,
    } = await supabaseAdmin
      .from("rapp_legali")
      .insert([payloadLegacy])
      .select()
      .single();

    if (
      legacyError ||
      !legacyData?.id
    ) {
      return res.status(500).json({
        ok: false,
        error:
          legacyError?.message ||
          "Errore creazione rappresentante legacy",
      });
    }

    legacyRappLegaleId =
      String(legacyData.id);

    /*
     * 2. Cerchiamo la persona in tbclienti
     * tramite studio_id + codice fiscale.
     */
    const {
      data: soggettiEsistenti,
      error: soggettoLookupError,
    } = await supabaseAdmin
      .from("tbclienti")
      .select("id")
      .eq("studio_id", studioId)
      .eq(
        "codice_fiscale",
        codiceFiscale
      )
      .limit(2);

    if (soggettoLookupError) {
      throw soggettoLookupError;
    }

    if (
      (soggettiEsistenti || [])
        .length > 1
    ) {
      throw new Error(
        "Sono presenti più anagrafiche con lo stesso codice fiscale."
      );
    }

    let soggettoClienteId =
      soggettiEsistenti?.[0]?.id
        ? String(
            soggettiEsistenti[0].id
          )
        : "";

    /*
     * 3. Se la persona non esiste,
     * la creiamo come nominativo non cliente.
     */
    if (!soggettoClienteId) {
      const {
        data: nuovoSoggetto,
        error: nuovoSoggettoError,
      } = await supabaseAdmin
        .from("tbclienti")
        .insert({
          studio_id:
            studioId,

          ragione_sociale:
            nomeCognome,

          codice_fiscale:
            codiceFiscale,

          luogo_nascita:
            valoreTesto(
              body.luogo_nascita
            ),

          data_nascita:
            body.data_nascita ||
            null,

          indirizzo:
            valoreTesto(
              body.indirizzo_residenza
            ),

          citta:
            valoreTesto(
              body.citta_residenza
            ),

          cap:
            valoreTesto(body.CAP),

          email:
            valoreTesto(body.email),

          tipo_cliente:
            "Persona fisica",

          tipologia_cliente:
            "Interno",

          cliente:
            false,

          attivo:
            false,

          updated_at:
            new Date().toISOString(),
        })
        .select("id")
        .single();

      if (
        nuovoSoggettoError ||
        !nuovoSoggetto?.id
      ) {
        throw new Error(
          nuovoSoggettoError?.message ||
            "Errore creazione anagrafica del rappresentante."
        );
      }

      soggettoClienteId =
        String(nuovoSoggetto.id);
    } else {
      /*
       * Se esiste già, aggiorniamo soltanto
       * i dati disponibili senza modificare
       * cliente e attivo.
       */
      const {
        error: aggiornaSoggettoError,
      } = await supabaseAdmin
        .from("tbclienti")
        .update({
          ragione_sociale:
            nomeCognome,

          luogo_nascita:
            valoreTesto(
              body.luogo_nascita
            ),

          data_nascita:
            body.data_nascita ||
            null,

          indirizzo:
            valoreTesto(
              body.indirizzo_residenza
            ),

          citta:
            valoreTesto(
              body.citta_residenza
            ),

          cap:
            valoreTesto(body.CAP),

          email:
            valoreTesto(body.email),

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          soggettoClienteId
        )
        .eq(
          "studio_id",
          studioId
        );

      if (aggiornaSoggettoError) {
        throw aggiornaSoggettoError;
      }
    }

    /*
     * 4. Verifichiamo se esiste già
     * un documento AML attivo.
     */
    const {
      data: documentoEsistente,
      error: documentoLookupError,
    } = await supabaseAdmin
      .from(
        "tbclienti_documenti_aml"
      )
      .select("id")
      .eq(
        "studio_id",
        studioId
      )
      .eq(
        "soggetto_cliente_id",
        soggettoClienteId
      )
      .eq("attivo", true)
      .maybeSingle();

    if (documentoLookupError) {
      throw documentoLookupError;
    }

    const payloadDocumento = {
      tipo_documento:
        valoreTesto(body.tipo_doc),

      numero_documento:
        valoreTesto(body.num_doc),

      scadenza_documento:
        body.scadenza_doc ||
        null,

      allegato_documento:
        valoreTesto(
          body.allegato_doc
        ),

      legacy_rapp_legale_id:
        legacyRappLegaleId,

      attivo:
        true,

      updated_at:
        new Date().toISOString(),
    };

    if (documentoEsistente?.id) {
      const {
        data: documentoAggiornato,
        error: aggiornaDocumentoError,
      } = await supabaseAdmin
        .from(
          "tbclienti_documenti_aml"
        )
        .update(
          payloadDocumento
        )
        .eq(
          "id",
          documentoEsistente.id
        )
        .eq(
          "studio_id",
          studioId
        )
        .select()
        .single();

      if (aggiornaDocumentoError) {
        throw aggiornaDocumentoError;
      }

      return res.status(200).json({
        ok: true,
        data: {
          ...legacyData,
          soggetto_cliente_id:
            soggettoClienteId,
          documento_aml:
            documentoAggiornato,
        },
      });
    }

    const {
      data: nuovoDocumento,
      error: nuovoDocumentoError,
    } = await supabaseAdmin
      .from(
        "tbclienti_documenti_aml"
      )
      .insert({
        studio_id:
          studioId,

        soggetto_cliente_id:
          soggettoClienteId,

        ...payloadDocumento,
      })
      .select()
      .single();

    if (nuovoDocumentoError) {
      throw nuovoDocumentoError;
    }

    return res.status(200).json({
      ok: true,
      data: {
        ...legacyData,
        soggetto_cliente_id:
          soggettoClienteId,
        documento_aml:
          nuovoDocumento,
      },
    });
  } catch (e: any) {
    /*
     * Se la scrittura sulla nuova struttura
     * fallisce dopo aver creato il record legacy,
     * eliminiamo il record appena creato per
     * evitare un salvataggio parziale.
     */
    if (legacyRappLegaleId) {
      await supabaseAdmin
        .from("rapp_legali")
        .delete()
        .eq(
          "id",
          legacyRappLegaleId
        );
    }

    return res.status(500).json({
      ok: false,
      error:
        e?.message ||
        "Errore salvataggio rappresentante",
    });
  }
}
