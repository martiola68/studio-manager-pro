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
    String(value ?? "").trim();

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

  try {
    const body = req.body ?? {};

    const studioId =
      String(
        body.studio_id || ""
      ).trim();

    const nomeCognome =
      String(
        body.nome_cognome || ""
      ).trim();

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

    if (!codiceFiscale) {
      return res.status(400).json({
        ok: false,
        error: "codice_fiscale obbligatorio",
      });
    }

    /*
     * =========================================================
     * 1. CERCHIAMO IL SOGGETTO IN TBCLIENTI
     * =========================================================
     *
     * Il rappresentante è identificato dall'anagrafica
     * unica tbclienti.
     *
     * Non creiamo più alcun record in rapp_legali.
     */
    const {
      data: soggettiEsistenti,
      error: soggettoLookupError,
    } = await supabaseAdmin
      .from("tbclienti")
      .select(`
        id,
        studio_id,
        cliente,
        attivo
      `)
      .eq(
        "studio_id",
        studioId
      )
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
      return res.status(409).json({
        ok: false,
        error:
          "Sono presenti più anagrafiche con lo stesso codice fiscale.",
      });
    }

    let soggettoClienteId =
      soggettiEsistenti?.[0]?.id
        ? String(
            soggettiEsistenti[0].id
          )
        : "";

    let soggettoSalvato: any = null;

    /*
     * =========================================================
     * 2A. SOGGETTO NON ESISTENTE → CREAZIONE
     * =========================================================
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
            valoreTesto(
              body.CAP
            ),

          nazionalita:
            valoreTesto(
              body.nazionalita
            ),

          email:
            valoreTesto(
              body.email
            ),

          tipo_cliente:
            "Persona fisica",

          tipologia_cliente:
            "Interno",

          /*
           * Il rappresentante può essere
           * un nominativo non cliente.
           */
          cliente:
            false,

          attivo:
            false,

          updated_at:
            new Date()
              .toISOString(),
        })
        .select(`
          id,
          studio_id,
          ragione_sociale,
          codice_fiscale,
          email
        `)
        .single();

      if (
        nuovoSoggettoError ||
        !nuovoSoggetto?.id
      ) {
        throw new Error(
          nuovoSoggettoError
            ?.message ||
          "Errore creazione anagrafica del rappresentante."
        );
      }

      soggettoClienteId =
        String(
          nuovoSoggetto.id
        );

      soggettoSalvato =
        nuovoSoggetto;
    } else {
      /*
       * =======================================================
       * 2B. SOGGETTO GIÀ ESISTENTE → AGGIORNAMENTO
       * =======================================================
       *
       * Non cambiamo cliente e attivo.
       */
      const {
        data: soggettoAggiornato,
        error: aggiornaSoggettoError,
      } = await supabaseAdmin
        .from("tbclienti")
        .update({
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
            valoreTesto(
              body.CAP
            ),

          nazionalita:
            valoreTesto(
              body.nazionalita
            ),

          email:
            valoreTesto(
              body.email
            ),

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          soggettoClienteId
        )
        .eq(
          "studio_id",
          studioId
        )
        .select(`
          id,
          studio_id,
          ragione_sociale,
          codice_fiscale,
          email
        `)
        .single();

      if (
        aggiornaSoggettoError
      ) {
        throw aggiornaSoggettoError;
      }

      soggettoSalvato =
        soggettoAggiornato;
    }

    /*
     * =========================================================
     * 3. CERCHIAMO IL DOCUMENTO AML DEL SOGGETTO
     * =========================================================
     */
    const {
      data: documentiEsistenti,
      error: documentoLookupError,
    } = await supabaseAdmin
      .from(
        "tbclienti_documenti_aml"
      )
      .select(`
        id,
        studio_id,
        soggetto_cliente_id,
        attivo
      `)
      .eq(
        "studio_id",
        studioId
      )
      .eq(
        "soggetto_cliente_id",
        soggettoClienteId
      )
      .eq(
        "attivo",
        true
      )
      .order(
        "updated_at",
        {
          ascending: false,
        }
      )
      .limit(1);

    if (documentoLookupError) {
      throw documentoLookupError;
    }

    const documentoEsistente =
      documentiEsistenti?.[0] ||
      null;

    /*
     * =========================================================
     * 4. DATI DOCUMENTO
     * =========================================================
     *
     * Non valorizziamo più:
     *
     * legacy_rapp_legale_id
     */
    const payloadDocumento = {
      tipo_documento:
        valoreTesto(
          body.tipo_doc
        ),

      numero_documento:
        valoreTesto(
          body.num_doc
        ),

      scadenza_documento:
        body.scadenza_doc ||
        null,

      allegato_documento:
        valoreTesto(
          body.allegato_doc
        ),

      microsoft_connection_id:
        valoreTesto(
          body.microsoft_connection_id
        ),

      attivo:
        true,

      updated_at:
        new Date()
          .toISOString(),
    };

    let documentoSalvato: any;

    /*
     * =========================================================
     * 5A. DOCUMENTO ESISTENTE → UPDATE
     * =========================================================
     */
    if (documentoEsistente?.id) {
      const {
        data:
          documentoAggiornato,
        error:
          aggiornaDocumentoError,
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

      if (
        aggiornaDocumentoError
      ) {
        throw aggiornaDocumentoError;
      }

      documentoSalvato =
        documentoAggiornato;
    } else {
      /*
       * =======================================================
       * 5B. DOCUMENTO NON ESISTENTE → CREAZIONE
       * =======================================================
       */
      const {
        data:
          nuovoDocumento,
        error:
          nuovoDocumentoError,
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

      if (
        nuovoDocumentoError
      ) {
        throw nuovoDocumentoError;
      }

      documentoSalvato =
        nuovoDocumento;
    }

    /*
     * =========================================================
     * 6. RISPOSTA
     * =========================================================
     *
     * ATTENZIONE:
     *
     * data.id è sempre tbclienti.id.
     *
     * Questo è importante perché nuovo.tsx,
     * AV4 e gli altri flussi devono identificare
     * il rappresentante tramite l'anagrafica,
     * non tramite il documento.
     */
    return res.status(200).json({
      ok: true,

      data: {
        id:
          soggettoClienteId,

        studio_id:
          studioId,

        soggetto_cliente_id:
          soggettoClienteId,

        documento_aml_id:
          documentoSalvato?.id ||
          null,

        soggetto:
          soggettoSalvato,

        documento_aml:
          documentoSalvato,
      },
    });
  } catch (e: any) {
    console.error(
      "Errore salvataggio rappresentante:",
      e
    );

    return res.status(500).json({
      ok: false,

      error:
        e?.message ||
        "Errore salvataggio rappresentante",
    });
  }
}
