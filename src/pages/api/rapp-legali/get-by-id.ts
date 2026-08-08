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
     * L'id ricevuto dal frontend è ancora
     * il vecchio rapp_legali.id.
     *
     * Lo usiamo per trovare il documento AML
     * tramite legacy_rapp_legale_id.
     */
    const {
      data: documento,
      error: documentoError,
    } = await supabaseAdmin
      .from("tbclienti_documenti_aml")
      .select(
        `
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
        `
      )
      .eq("id", id)
      .eq("attivo", true)
      .maybeSingle();

    if (documentoError) {
      return res.status(500).json({
        ok: false,
        error: documentoError.message,
      });
    }

    if (
      !documento?.id ||
      !documento?.soggetto_cliente_id
    ) {
      return res.status(404).json({
        ok: false,
        error:
          "Rappresentante non trovato nella nuova struttura AML",
      });
    }

    /*
     * Recuperiamo l'anagrafica unica
     * del soggetto.
     */
    const {
      data: soggetto,
      error: soggettoError,
    } = await supabaseAdmin
      .from("tbclienti")
      .select(
        `
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
        `
      )
      .eq(
        "id",
        documento.soggetto_cliente_id
      )
      .eq(
        "studio_id",
        documento.studio_id
      )
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

    /*
     * Manteniamo lo stesso formato che
     * nuovo.tsx si aspetta oggi.
     */
    const data = {
      id:
        documento.id,

      studio_id:
        documento.studio_id,

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

      tipo_doc:
        documento.tipo_documento || null,

      num_doc:
        documento.numero_documento || null,

      scadenza_doc:
        documento.scadenza_documento || null,

      allegato_doc:
        documento.allegato_documento || null,

      public_doc_token:
        documento.public_doc_token || null,

      public_doc_enabled:
        documento.public_doc_enabled ?? false,

      public_doc_sent_at:
        documento.public_doc_sent_at || null,

      public_doc_opened_at:
        documento.public_doc_opened_at || null,

      public_doc_submitted_at:
        documento.public_doc_submitted_at || null,

      doc_richiesto_il:
        documento.documento_richiesto_il || null,

      microsoft_connection_id:
        documento.microsoft_connection_id || null,

      rappresentante_legale:
        true,

      soggetto_cliente_id:
        documento.soggetto_cliente_id,

      documento_aml_id:
        documento.id,

      created_at:
        documento.created_at ||
        soggetto.created_at ||
        null,

      updated_at:
        documento.updated_at ||
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
