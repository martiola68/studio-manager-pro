import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { createClient } from "@supabase/supabase-js";

type ResponseData =
  | {
      ok: true;
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
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Metodo non consentito",
    });
  }

  try {
    /*
     * =========================================================
     * 1. IDENTIFICATIVO ANAGRAFICA
     * =========================================================
     *
     * L'id ricevuto dal frontend è:
     *
     * tbclienti.id
     *
     * cioè l'anagrafica del rappresentante.
     */
    const soggettoClienteId =
      String(
        req.body?.id || ""
      ).trim();

    if (!soggettoClienteId) {
      return res.status(400).json({
        ok: false,
        error: "ID rappresentante mancante",
      });
    }

    /*
     * =========================================================
     * 2. RECUPERO ANAGRAFICA
     * =========================================================
     *
     * Serve anche per conoscere lo studio_id
     * ed evitare operazioni fuori studio.
     */
    const {
      data: soggetto,
      error: soggettoError,
    } = await supabaseAdmin
      .from("tbclienti")
      .select(`
        id,
        studio_id
      `)
      .eq(
        "id",
        soggettoClienteId
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

    const studioId =
      String(
        soggetto.studio_id || ""
      );

    if (!studioId) {
      return res.status(400).json({
        ok: false,
        error:
          "Studio del rappresentante non disponibile",
      });
    }

    /*
     * =========================================================
     * 3. RECUPERO DOCUMENTI AML ATTIVI
     * =========================================================
     *
     * Non utilizziamo più:
     *
     * - rapp_legali
     * - legacy_rapp_legale_id
     *
     * La relazione corretta è:
     *
     * tbclienti_documenti_aml.soggetto_cliente_id
     * =
     * tbclienti.id
     */
    const {
      data: documentiAml,
      error: documentiError,
    } = await supabaseAdmin
      .from(
        "tbclienti_documenti_aml"
      )
      .select(`
        id
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
      );

    if (documentiError) {
      return res.status(500).json({
        ok: false,
        error:
          documentiError.message,
      });
    }

    const documentoIds =
      (documentiAml || [])
        .map((documento) =>
          String(
            documento.id || ""
          )
        )
        .filter(Boolean);

    /*
     * =========================================================
     * 4. DISATTIVAZIONE DOCUMENTI AML
     * =========================================================
     *
     * Non cancelliamo fisicamente i record.
     *
     * In questo modo:
     * - manteniamo lo storico;
     * - il rappresentante sparisce dalla view;
     * - eventuali link pubblici vengono disabilitati.
     */
    if (documentoIds.length > 0) {
      const adesso =
        new Date().toISOString();

      const {
        error:
          disattivaDocumentiError,
      } = await supabaseAdmin
        .from(
          "tbclienti_documenti_aml"
        )
        .update({
          attivo:
            false,

          public_doc_enabled:
            false,

          updated_at:
            adesso,
        })
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
        );

      if (
        disattivaDocumentiError
      ) {
        return res.status(500).json({
          ok: false,
          error:
            disattivaDocumentiError
              .message,
        });
      }

      /*
       * =======================================================
       * 5. ANNULLAMENTO SCADENZE AML COLLEGATE
       * =======================================================
       *
       * Se il rappresentante viene rimosso dall'elenco AML,
       * non devono continuare a partire alert relativi
       * ai suoi documenti disattivati.
       */
      const {
        error:
          annullaScadenzeError,
      } = await supabaseAdmin
        .from(
          "tbscadenze_centrale"
        )
        .update({
          stato:
            "annullata",

          prossimo_alert_at:
            null,

          annullata_at:
            adesso,

          updated_at:
            adesso,
        })
        .eq(
          "studio_id",
          studioId
        )
        .eq(
          "origine_tabella",
          "tbclienti_documenti_aml"
        )
        .in(
          "origine_record_id",
          documentoIds
        )
        .neq(
          "stato",
          "annullata"
        );

      if (
        annullaScadenzeError
      ) {
        return res.status(500).json({
          ok: false,
          error:
            annullaScadenzeError
              .message,
        });
      }
    }

    /*
     * =========================================================
     * 6. NON ELIMINIAMO TBCLIENTI
     * =========================================================
     *
     * L'anagrafica rimane perché lo stesso soggetto
     * può essere:
     *
     * - socio;
     * - amministratore;
     * - titolare effettivo;
     * - rappresentante di altre società;
     * - cliente dello studio.
     *
     * Eliminiamo quindi soltanto la sua presenza
     * nel modulo Rappresentanti AML.
     */

    return res.status(200).json({
      ok: true,
    });
  } catch (error: any) {
    console.error(
      "Errore eliminazione rappresentante:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Errore eliminazione rappresentante",
    });
  }
}
