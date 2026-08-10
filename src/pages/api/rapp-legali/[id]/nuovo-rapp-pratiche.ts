import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

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

function testoPulito(value: unknown): string | null {
  const result = String(value ?? "").trim();
  return result || null;
}

function normalizzaCodiceFiscale(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Metodo non consentito",
    });
  }

  try {
    const praticaId =
      typeof req.query.id === "string"
        ? req.query.id.trim()
        : "";

    const {
      nome_cognome,
      codice_fiscale,
      luogo_nascita,
      data_nascita,
      indirizzo,
      indirizzo_residenza,
      cap,
      citta,
      citta_residenza,
      provincia,
    } = req.body ?? {};

    if (!praticaId) {
      return res.status(400).json({
        ok: false,
        error: "pratica_id mancante",
      });
    }

    const nomeCognome =
      String(nome_cognome ?? "").trim();

    const codiceFiscale =
      normalizzaCodiceFiscale(codice_fiscale);

    if (!nomeCognome) {
      return res.status(400).json({
        ok: false,
        error: "Nome e cognome obbligatorio",
      });
    }

    if (!codiceFiscale) {
      return res.status(400).json({
        ok: false,
        error: "Codice fiscale obbligatorio",
      });
    }

    /*
     * Recuperiamo lo studio dalla pratica.
     */
    const {
      data: pratica,
      error: praticaError,
    } = await supabaseAdmin
      .from("tbpratiche")
      .select("studio_id")
      .eq("id", praticaId)
      .single();

    if (
      praticaError ||
      !pratica?.studio_id
    ) {
      return res.status(400).json({
        ok: false,
        error:
          praticaError?.message ||
          "studio_id pratica non trovato",
      });
    }

    const studioId =
      String(pratica.studio_id);

    const indirizzoFinale =
      testoPulito(indirizzo_residenza) ||
      testoPulito(indirizzo);

    const cittaFinale =
      testoPulito(citta_residenza) ||
      testoPulito(citta);

    /*
     * 1. ANAGRAFICA UNICA
     *
     * Cerchiamo il soggetto direttamente in tbclienti
     * tramite studio_id + codice fiscale.
     */
    const {
      data: soggetti,
      error: soggettiError,
    } = await supabaseAdmin
      .from("tbclienti")
      .select("id")
      .eq("studio_id", studioId)
      .eq("codice_fiscale", codiceFiscale)
      .limit(2);

    if (soggettiError) {
      throw soggettiError;
    }

    if ((soggetti || []).length > 1) {
      return res.status(409).json({
        ok: false,
        error:
          "Esistono più anagrafiche con lo stesso codice fiscale.",
      });
    }

    let soggettoClienteId =
      soggetti?.[0]?.id
        ? String(soggetti[0].id)
        : "";

    /*
     * Se il soggetto non esiste lo creiamo
     * nell'anagrafica unica come nominativo
     * non cliente.
     */
    if (!soggettoClienteId) {
      const {
        data: nuovoSoggetto,
        error: nuovoSoggettoError,
      } = await supabaseAdmin
        .from("tbclienti")
        .insert({
          studio_id: studioId,

          ragione_sociale:
            nomeCognome,

          codice_fiscale:
            codiceFiscale,

          luogo_nascita:
            testoPulito(luogo_nascita),

          data_nascita:
            data_nascita || null,

          indirizzo:
            indirizzoFinale,

          citta:
            cittaFinale,

          provincia:
            testoPulito(provincia)
              ?.toUpperCase() ||
            null,

          cap:
            testoPulito(cap),

          tipo_cliente:
            "Persona fisica",

          tipologia_cliente:
            "Interno",

          cliente:
            false,

          attivo:
            true,

          professionista_incaricato:
            false,

          soggetto_isa:
            false,

          updated_at:
            new Date().toISOString(),
        })
        .select(`
          id,
          ragione_sociale,
          codice_fiscale,
          luogo_nascita,
          data_nascita,
          indirizzo,
          citta,
          provincia,
          cap,
          nazionalita,
          email
        `)
        .single();

      if (
        nuovoSoggettoError ||
        !nuovoSoggetto?.id
      ) {
        throw new Error(
          nuovoSoggettoError?.message ||
            "Errore creazione anagrafica rappresentante"
        );
      }

      soggettoClienteId =
        String(nuovoSoggetto.id);
    } else {
      /*
       * Se il nominativo esiste già,
       * aggiorniamo i dati anagrafici senza
       * creare duplicati.
       */
      const {
        data: soggettoAggiornato,
        error: aggiornaSoggettoError,
      } = await supabaseAdmin
        .from("tbclienti")
        .update({
          ragione_sociale:
            nomeCognome,

          luogo_nascita:
            testoPulito(luogo_nascita),

          data_nascita:
            data_nascita || null,

          indirizzo:
            indirizzoFinale,

          citta:
            cittaFinale,

          provincia:
            testoPulito(provincia)
              ?.toUpperCase() ||
            null,

          cap:
            testoPulito(cap),

          attivo:
            true,

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
        )
        .select(`
          id,
          ragione_sociale,
          codice_fiscale,
          luogo_nascita,
          data_nascita,
          indirizzo,
          citta,
          provincia,
          cap,
          nazionalita,
          email
        `)
        .single();

      if (aggiornaSoggettoError) {
        throw aggiornaSoggettoError;
      }
    }

    /*
     * Recuperiamo sempre il record definitivo
     * dall'anagrafica unica.
     */
    const {
      data: soggettoData,
      error: soggettoDataError,
    } = await supabaseAdmin
      .from("tbclienti")
      .select(`
        id,
        ragione_sociale,
        codice_fiscale,
        luogo_nascita,
        data_nascita,
        indirizzo,
        citta,
        provincia,
        cap,
        nazionalita,
        email
      `)
      .eq(
        "id",
        soggettoClienteId
      )
      .eq(
        "studio_id",
        studioId
      )
      .single();

    if (
      soggettoDataError ||
      !soggettoData
    ) {
      throw new Error(
        soggettoDataError?.message ||
          "Errore recupero anagrafica rappresentante"
      );
    }

    /*
     * 2. DOCUMENTO AML
     *
     * Creiamo o riattiviamo il contenitore
     * documentale associato direttamente
     * a tbclienti.id.
     *
     * legacy_rapp_legale_id non viene più
     * valorizzato.
     */
    const {
      data: documentiEsistenti,
      error: documentoLookupError,
    } = await supabaseAdmin
      .from(
        "tbclienti_documenti_aml"
      )
      .select("id, attivo")
      .eq(
        "studio_id",
        studioId
      )
      .eq(
        "soggetto_cliente_id",
        soggettoClienteId
      )
      .order(
        "created_at",
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

    let documentoAml: any;

    if (documentoEsistente?.id) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "tbclienti_documenti_aml"
        )
        .update({
          attivo: true,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          documentoEsistente.id
        )
        .select()
        .single();

      if (error) {
        throw error;
      }

      documentoAml = data;
    } else {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "tbclienti_documenti_aml"
        )
        .insert({
          studio_id:
            studioId,

          soggetto_cliente_id:
            soggettoClienteId,

          attivo:
            true,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      documentoAml = data;
    }

    /*
     * Restituiamo il soggetto moderno mantenendo
     * anche alcuni alias compatibili con il
     * frontend che prima riceveva rapp_legali.
     */
    return res.status(200).json({
      ok: true,

      data: {
        id:
          soggettoData.id,

        soggetto_cliente_id:
          soggettoClienteId,

        nome_cognome:
          soggettoData.ragione_sociale,

        ragione_sociale:
          soggettoData.ragione_sociale,

        codice_fiscale:
          soggettoData.codice_fiscale,

        luogo_nascita:
          soggettoData.luogo_nascita,

        data_nascita:
          soggettoData.data_nascita,

        indirizzo:
          soggettoData.indirizzo,

        indirizzo_residenza:
          soggettoData.indirizzo,

        citta:
          soggettoData.citta,

        citta_residenza:
          soggettoData.citta,

        provincia:
          soggettoData.provincia,

        cap:
          soggettoData.cap,

        CAP:
          soggettoData.cap,

        nazionalita:
          soggettoData.nazionalita,

        email:
          soggettoData.email,

        documento_aml_id:
          documentoAml.id,
      },
    });
  } catch (error: any) {
    console.error(
      "Errore creazione rappresentante dalla pratica:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Errore creazione rappresentante",
    });
  }
}
