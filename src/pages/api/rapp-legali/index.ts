import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { createClient } from "@supabase/supabase-js";

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Metodo non consentito",
    });
  }

  const studioId =
    typeof req.query.studio_id === "string"
      ? req.query.studio_id
      : null;

  if (!studioId) {
    return res.status(400).json({
      ok: false,
      error: "studio_id obbligatorio",
    });
  }

  try {
    /*
     * =========================================================
     * 1. RAPPRESENTANTI ATTUALI
     * =========================================================
     *
     * La sorgente ufficiale non è più rapp_legali.
     *
     * Un soggetto compare nell'elenco Rappresentanti quando:
     *
     * tipo_ruolo = R
     * principale = true
     * attivo = true
     */
    const {
      data: organi,
      error: organiError,
    } = await supabaseAdmin
      .from("tbclienti_organi")
      .select(`
        id,
        studio_id,
        cliente_id,
        soggetto_cliente_id,
        tipo_ruolo,
        ruolo,
        rappresentante_legale,
        principale,
        attivo
      `)
      .eq("studio_id", studioId)
      .eq("tipo_ruolo", "R")
      .eq("principale", true)
      .eq("attivo", true)
      .not(
        "soggetto_cliente_id",
        "is",
        null
      );

    if (organiError) {
      return res.status(500).json({
        ok: false,
        error: organiError.message,
      });
    }

    /*
     * =========================================================
     * 2. UN SOLO RECORD PER PERSONA
     * =========================================================
     *
     * Lo stesso soggetto può essere rappresentante principale
     * di più società.
     *
     * Nell'elenco Rappresentanti AML deve però comparire
     * una sola volta.
     */
    const soggettiIds = Array.from(
      new Set(
        (organi || [])
          .map((o: any) =>
            String(
              o.soggetto_cliente_id || ""
            ).trim()
          )
          .filter(Boolean)
      )
    );

    if (soggettiIds.length === 0) {
      return res.status(200).json({
        ok: true,
        data: [],
      });
    }

    /*
     * =========================================================
     * 3. ANAGRAFICHE
     * =========================================================
     */
    const {
      data: soggetti,
      error: soggettiError,
    } = await supabaseAdmin
      .from("tbclienti")
      .select(`
        id,
        studio_id,
        ragione_sociale,
        codice_fiscale,
        luogo_nascita,
        data_nascita,
        nazionalita,
        indirizzo,
        citta,
        provincia,
        cap,
        email,
        created_at,
        updated_at
      `)
      .eq("studio_id", studioId)
      .in("id", soggettiIds)
      .eq("attivo", true);

    if (soggettiError) {
      return res.status(500).json({
        ok: false,
        error: soggettiError.message,
      });
    }

    /*
     * =========================================================
     * 4. DOCUMENTI AML
     * =========================================================
     *
     * Il documento è accessorio.
     *
     * Un rappresentante DEVE comparire anche se non ha ancora
     * un documento AML.
     */
    const {
      data: documenti,
      error: documentiError,
    } = await supabaseAdmin
      .from(
        "tbclienti_documenti_aml"
      )
      .select(`
        id,
        studio_id,
        soggetto_cliente_id,
        tipo_documento,
        numero_documento,
        scadenza_documento,
        allegato_documento,
        documento_richiesto_il,
        microsoft_connection_id,
        public_doc_token,
        public_doc_enabled,
        public_doc_sent_at,
        public_doc_opened_at,
        public_doc_submitted_at,
        created_at,
        updated_at
      `)
      .eq("studio_id", studioId)
      .eq("attivo", true)
      .in(
        "soggetto_cliente_id",
        soggettiIds
      )
      .order(
        "updated_at",
        {
          ascending: false,
        }
      );

    if (documentiError) {
      return res.status(500).json({
        ok: false,
        error: documentiError.message,
      });
    }

    /*
     * =========================================================
     * 5. DOCUMENTO PIÙ RECENTE PER SOGGETTO
     * =========================================================
     */
    const documentoPerSoggetto =
      new Map<string, any>();

    for (
      const documento of
        documenti || []
    ) {
      const soggettoId =
        String(
          documento.soggetto_cliente_id ||
            ""
        );

      if (
        soggettoId &&
        !documentoPerSoggetto.has(
          soggettoId
        )
      ) {
        documentoPerSoggetto.set(
          soggettoId,
          documento
        );
      }
    }

    /*
     * =========================================================
     * 6. COSTRUZIONE RISPOSTA
     * =========================================================
     *
     * Manteniamo per ora i nomi dei campi che il frontend
     * utilizzava con rapp_legali.
     *
     * MA:
     *
     * id = tbclienti.id
     *
     * documento_aml_id =
     * tbclienti_documenti_aml.id
     */
    const risultato =
      (soggetti || []).map(
        (soggetto: any) => {
          const soggettoId =
            String(soggetto.id);

          const documento =
            documentoPerSoggetto.get(
              soggettoId
            ) || null;

          const organiSoggetto =
            (organi || []).filter(
              (o: any) =>
                String(
                  o.soggetto_cliente_id
                ) === soggettoId
            );

          return {
            /*
             * ID UFFICIALE DEL RAPPRESENTANTE
             */
            id:
              soggetto.id,

            studio_id:
              soggetto.studio_id,

            soggetto_cliente_id:
              soggetto.id,

            /*
             * ANAGRAFICA
             */
            nome_cognome:
              soggetto.ragione_sociale ||
              "",

            codice_fiscale:
              soggetto.codice_fiscale ||
              "",

            luogo_nascita:
              soggetto.luogo_nascita ||
              null,

            data_nascita:
              soggetto.data_nascita ||
              null,

            nazionalita:
              soggetto.nazionalita ||
              null,

            indirizzo_residenza:
              soggetto.indirizzo ||
              null,

            citta_residenza:
              soggetto.citta ||
              null,

            indirizzo:
              soggetto.indirizzo ||
              null,

            citta:
              soggetto.citta ||
              null,

            provincia:
              soggetto.provincia ||
              null,

            cap:
              soggetto.cap ||
              null,

            CAP:
              soggetto.cap ||
              null,

            email:
              soggetto.email ||
              null,

            /*
             * Il soggetto è presente in questa API
             * proprio perché è R + principale.
             *
             * Manteniamo questi campi per compatibilità
             * con il frontend esistente.
             */
            rappresentante_legale:
              true,

            amministratore_principale:
              true,

            principale:
              true,

            /*
             * Informazione reale dell'organo.
             *
             * Può esserci più di una società per
             * lo stesso soggetto.
             */
            organi:
              organiSoggetto.map(
                (o: any) => ({
                  id:
                    o.id,

                  cliente_id:
                    o.cliente_id,

                  tipo_ruolo:
                    o.tipo_ruolo,

                  ruolo:
                    o.ruolo,

                  principale:
                    o.principale,

                  rappresentante_legale:
                    o.rappresentante_legale,
                })
              ),

            /*
             * DOCUMENTO AML
             */
            documento_aml_id:
              documento?.id || null,

            tipo_doc:
              documento
                ?.tipo_documento ||
              null,

            num_doc:
              documento
                ?.numero_documento ||
              null,

            scadenza_doc:
              documento
                ?.scadenza_documento ||
              null,

            allegato_doc:
              documento
                ?.allegato_documento ||
              null,

            doc_richiesto_il:
              documento
                ?.documento_richiesto_il ||
              null,

            microsoft_connection_id:
              documento
                ?.microsoft_connection_id ||
              null,

            public_doc_token:
              documento
                ?.public_doc_token ||
              null,

            public_doc_enabled:
              documento
                ?.public_doc_enabled ??
              false,

            public_doc_sent_at:
              documento
                ?.public_doc_sent_at ||
              null,

            public_doc_opened_at:
              documento
                ?.public_doc_opened_at ||
              null,

            public_doc_submitted_at:
              documento
                ?.public_doc_submitted_at ||
              null,

            created_at:
              soggetto.created_at ||
              null,

            updated_at:
              documento?.updated_at ||
              soggetto.updated_at ||
              null,
          };
        }
      );

    /*
     * =========================================================
     * 7. ORDINAMENTO
     * =========================================================
     */
    risultato.sort(
      (a: any, b: any) =>
        String(
          a.nome_cognome || ""
        ).localeCompare(
          String(
            b.nome_cognome || ""
          ),
          "it",
          {
            sensitivity: "base",
          }
        )
    );

    return res.status(200).json({
      ok: true,
      data: risultato,
    });
  } catch (error: any) {
    console.error(
      "Errore caricamento rappresentanti:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Errore caricamento rappresentanti",
    });
  }
}
