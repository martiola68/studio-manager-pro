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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const { id } = req.query;

    if (
      !id ||
      typeof id !== "string"
    ) {
      return res.status(400).json({
        ok: false,
        error: "ID mancante",
      });
    }

    /*
     * =========================================================
     * 1. ANAGRAFICA DEL RAPPRESENTANTE
     * =========================================================
     *
     * L'id ricevuto dal frontend è:
     *
     * tbclienti.id
     *
     * quindi identifica direttamente il soggetto.
     *
     * Il documento AML è un record separato e collegato
     * tramite:
     *
     * tbclienti_documenti_aml.soggetto_cliente_id
     */
    const {
      data: soggetto,
      error: soggettoError,
    } = await supabaseAdmin
      .from("tbclienti")
      .select(`
        id,
        studio_id,
        ragione_sociale,
        codice_fiscale,
        luogo_nascita,
        data_nascita,
        indirizzo,
        citta,
        provincia,
        cap,
        nazionalita,
        email,
        created_at,
        updated_at
      `)
      .eq("id", id)
      .maybeSingle();

    if (soggettoError) {
      return res.status(500).json({
        ok: false,
        error: soggettoError.message,
      });
    }

    if (!soggetto?.id) {
      return res.status(404).json({
        ok: false,
        error:
          "Anagrafica del rappresentante non trovata",
      });
    }

    const studioId =
      soggetto.studio_id
        ? String(soggetto.studio_id)
        : "";

    if (!studioId) {
      return res.status(400).json({
        ok: false,
        error:
          "Studio del rappresentante non disponibile",
      });
    }

    /*
     * =========================================================
     * 2. DOCUMENTO AML DEL SOGGETTO
     * =========================================================
     *
     * Il documento NON identifica il rappresentante.
     *
     * Cerchiamo il documento AML attivo collegato
     * all'anagrafica.
     *
     * Usiamo array + limit(1), non maybeSingle(),
     * così questo caricamento non può andare in errore
     * nel caso esistano accidentalmente più documenti
     * AML attivi per lo stesso soggetto.
     */
    const {
      data: documenti,
      error: documentoError,
    } = await supabaseAdmin
      .from("tbclienti_documenti_aml")
      .select(`
        id,
        studio_id,
        soggetto_cliente_id,
        tipo_documento,
        numero_documento,
        scadenza_documento,
        allegato_documento,
        public_doc_token,
        public_doc_enabled,
        public_doc_sent_at,
        public_doc_opened_at,
        public_doc_submitted_at,
        documento_richiesto_il,
        microsoft_connection_id,
        created_at,
        updated_at
      `)
      .eq(
        "soggetto_cliente_id",
        soggetto.id
      )
      .eq(
        "studio_id",
        studioId
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

    if (documentoError) {
      return res.status(500).json({
        ok: false,
        error: documentoError.message,
      });
    }

    const documento =
      documenti?.[0] || null;

    /*
     * =========================================================
     * 3. FORMATO ATTESO DA nuovo.tsx
     * =========================================================
     *
     * Manteniamo la struttura che il frontend utilizza,
     * ma distinguiamo chiaramente:
     *
     * id                 = tbclienti.id
     * soggetto_cliente_id = tbclienti.id
     * documento_aml_id   = tbclienti_documenti_aml.id
     */
    const data = {
      id:
        soggetto.id,

      studio_id:
        studioId,

      nome_cognome:
        soggetto.ragione_sociale || "",

      codice_fiscale:
        soggetto.codice_fiscale || "",

      luogo_nascita:
        soggetto.luogo_nascita || null,

      data_nascita:
        soggetto.data_nascita || null,

      citta_residenza:
        soggetto.citta || null,

      indirizzo_residenza:
        soggetto.indirizzo || null,

      CAP:
        soggetto.cap || null,

      nazionalita:
        soggetto.nazionalita || null,

      email:
        soggetto.email || null,

      /*
       * Dati documento AML.
       *
       * Se il documento non esiste ancora,
       * restituiamo semplicemente valori vuoti.
       */
      tipo_doc:
        documento?.tipo_documento || null,

      num_doc:
        documento?.numero_documento || null,

      scadenza_doc:
        documento?.scadenza_documento || null,

      allegato_doc:
        documento?.allegato_documento || null,

      public_doc_token:
        documento?.public_doc_token || null,

      public_doc_enabled:
        documento?.public_doc_enabled ?? false,

      public_doc_sent_at:
        documento?.public_doc_sent_at || null,

      public_doc_opened_at:
        documento?.public_doc_opened_at || null,

      public_doc_submitted_at:
        documento?.public_doc_submitted_at || null,

      doc_richiesto_il:
        documento?.documento_richiesto_il || null,

      microsoft_connection_id:
        documento?.microsoft_connection_id || null,

      rappresentante_legale:
        true,

      /*
       * Identificativi distinti.
       */
      soggetto_cliente_id:
        soggetto.id,

      documento_aml_id:
        documento?.id || null,

      created_at:
        documento?.created_at ||
        soggetto.created_at ||
        null,

      updated_at:
        documento?.updated_at ||
        soggetto.updated_at ||
        null,
    };

    return res.status(200).json({
      ok: true,
      data,
    });
  } catch (e: any) {
    console.error(
      "Errore caricamento rappresentante:",
      e
    );

    return res.status(500).json({
      ok: false,
      error:
        e?.message ||
        "Errore caricamento rappresentante",
    });
  }
}
