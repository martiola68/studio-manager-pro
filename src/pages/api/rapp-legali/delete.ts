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

  let documentoAmlId: string | null = null;

  try {
    const id = String(
      req.body?.id || ""
    ).trim();

    if (!id) {
      return res.status(400).json({
        ok: false,
        error: "ID mancante",
      });
    }

    /*
     * L'id ricevuto dal frontend è ancora
     * rapp_legali.id.
     *
     * Cerchiamo il relativo documento
     * nella nuova struttura.
     */
    const {
      data: documentoAml,
      error: documentoLookupError,
    } = await supabaseAdmin
      .from("tbclienti_documenti_aml")
      .select(
        `
          id,
          studio_id,
          soggetto_cliente_id,
          attivo
        `
      )
      .eq(
        "legacy_rapp_legale_id",
        id
      )
      .eq("attivo", true)
      .maybeSingle();

    if (documentoLookupError) {
      return res.status(500).json({
        ok: false,
        error:
          documentoLookupError.message,
      });
    }

    /*
     * Se il documento nuovo esiste,
     * lo disattiviamo.
     *
     * Non eliminiamo tbclienti:
     * il soggetto potrebbe essere socio,
     * amministratore o rappresentante
     * di altre società.
     */
    if (documentoAml?.id) {
      documentoAmlId = String(
        documentoAml.id
      );

      const {
        error: documentoUpdateError,
      } = await supabaseAdmin
        .from(
          "tbclienti_documenti_aml"
        )
        .update({
          attivo: false,

          public_doc_enabled:
            false,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          documentoAmlId
        );

      if (documentoUpdateError) {
        return res.status(500).json({
          ok: false,
          error:
            documentoUpdateError.message,
        });
      }
    }

    /*
     * Durante la fase transitoria
     * eliminiamo anche la riga legacy.
     */
    const {
      error: legacyDeleteError,
    } = await supabaseAdmin
      .from("rapp_legali")
      .delete()
      .eq("id", id);

    if (legacyDeleteError) {
      /*
       * Ripristino compensativo:
       * se l'eliminazione legacy fallisce,
       * riattiviamo il documento nuovo.
       */
      if (documentoAmlId) {
        await supabaseAdmin
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
            documentoAmlId
          );
      }

      return res.status(500).json({
        ok: false,
        error:
          legacyDeleteError.message,
      });
    }

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
