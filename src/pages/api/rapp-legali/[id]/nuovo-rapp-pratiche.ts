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
      amministratore_principale,
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

    const { data: pratica, error: praticaError } =
      await supabaseAdmin
        .from("tbpratiche")
        .select("studio_id")
        .eq("id", praticaId)
        .single();

    if (praticaError || !pratica?.studio_id) {
      return res.status(400).json({
        ok: false,
        error:
          praticaError?.message ||
          "studio_id pratica non trovato",
      });
    }

    const studioId = String(pratica.studio_id);

    const indirizzoFinale =
      testoPulito(indirizzo_residenza) ||
      testoPulito(indirizzo);

    const cittaFinale =
      testoPulito(citta_residenza) ||
      testoPulito(citta);

    /*
     * 1. Cerchiamo o creiamo l'anagrafica unica.
     */
    const { data: soggetti, error: soggettiError } =
      await supabaseAdmin
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

    if (!soggettoClienteId) {
      const {
        data: nuovoSoggetto,
        error: nuovoSoggettoError,
      } = await supabaseAdmin
        .from("tbclienti")
        .insert({
          studio_id: studioId,
          ragione_sociale: nomeCognome,
          codice_fiscale: codiceFiscale,
          luogo_nascita: testoPulito(luogo_nascita),
          data_nascita: data_nascita || null,
          indirizzo: indirizzoFinale,
          citta: cittaFinale,
          provincia: testoPulito(provincia)?.toUpperCase() || null,
          cap: testoPulito(cap),
          tipo_cliente: "Persona fisica",
          tipologia_cliente: "Interno",
          cliente: false,
          attivo: false,
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (nuovoSoggettoError || !nuovoSoggetto?.id) {
        throw new Error(
          nuovoSoggettoError?.message ||
            "Errore creazione anagrafica rappresentante"
        );
      }

      soggettoClienteId = String(nuovoSoggetto.id);
    } else {
      const { error: aggiornaSoggettoError } =
        await supabaseAdmin
          .from("tbclienti")
          .update({
            ragione_sociale: nomeCognome,
            luogo_nascita: testoPulito(luogo_nascita),
            data_nascita: data_nascita || null,
            indirizzo: indirizzoFinale,
            citta: cittaFinale,
            provincia:
              testoPulito(provincia)?.toUpperCase() || null,
            cap: testoPulito(cap),
            updated_at: new Date().toISOString(),
          })
          .eq("id", soggettoClienteId)
          .eq("studio_id", studioId);

      if (aggiornaSoggettoError) {
        throw aggiornaSoggettoError;
      }
    }

    /*
     * 2. Manteniamo temporaneamente il record legacy.
     * Se esiste già per CF, lo aggiorniamo.
     */
    const {
      data: legacyEsistente,
      error: legacyLookupError,
    } = await supabaseAdmin
      .from("rapp_legali")
      .select("id")
      .eq("codice_fiscale", codiceFiscale)
      .maybeSingle();

    if (legacyLookupError) {
      throw legacyLookupError;
    }

    const payloadLegacy = {
      studio_id: studioId,
      nome_cognome: nomeCognome,
      codice_fiscale: codiceFiscale,
      luogo_nascita: testoPulito(luogo_nascita),
      data_nascita: data_nascita || null,
      indirizzo: indirizzoFinale,
      indirizzo_residenza: indirizzoFinale,
      citta: cittaFinale,
      citta_residenza: cittaFinale,
      provincia:
        testoPulito(provincia)?.toUpperCase() || null,
      cap: testoPulito(cap),
      rappresentante_legale: true,
      amministratore_principale:
        amministratore_principale === true,
      updated_at: new Date().toISOString(),
    };

    let legacyData: any;

    if (legacyEsistente?.id) {
      const { data, error } = await supabaseAdmin
        .from("rapp_legali")
        .update(payloadLegacy)
        .eq("id", legacyEsistente.id)
        .select()
        .single();

      if (error) throw error;
      legacyData = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("rapp_legali")
        .insert(payloadLegacy)
        .select()
        .single();

      if (error) throw error;
      legacyData = data;
    }

    /*
     * 3. Creiamo, riattiviamo o aggiorniamo
     * il contenitore documentale AML.
     */
    const {
      data: documentoEsistente,
      error: documentoLookupError,
    } = await supabaseAdmin
      .from("tbclienti_documenti_aml")
      .select("id")
      .eq("studio_id", studioId)
      .eq("soggetto_cliente_id", soggettoClienteId)
      .maybeSingle();

    if (documentoLookupError) {
      throw documentoLookupError;
    }

    let documentoAml: any;

    if (documentoEsistente?.id) {
      const { data, error } = await supabaseAdmin
        .from("tbclienti_documenti_aml")
        .update({
          legacy_rapp_legale_id: legacyData.id,
          attivo: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentoEsistente.id)
        .select()
        .single();

      if (error) throw error;
      documentoAml = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("tbclienti_documenti_aml")
        .insert({
          studio_id: studioId,
          soggetto_cliente_id: soggettoClienteId,
          legacy_rapp_legale_id: legacyData.id,
          attivo: true,
        })
        .select()
        .single();

      if (error) throw error;
      documentoAml = data;
    }

    return res.status(200).json({
      ok: true,
      data: {
        ...legacyData,
        soggetto_cliente_id: soggettoClienteId,
        documento_aml_id: documentoAml.id,
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
