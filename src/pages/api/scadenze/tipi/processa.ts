import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { createClient } from "@supabase/supabase-js";

const SECRET =
  process.env.CRON_SECRET ||
  "x9KfP2LmQ8zYtA71vBnR";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

type TipoScadenzaRow = {
  id: string;
  studio_id: string | null;
  nome: string;
  data_scadenza: string;
  ricorrente: boolean | null;
  attivo: boolean | null;
};

function normalizzaData(
  valore: string
): string {
  return String(valore)
    .trim()
    .slice(0, 10);
}

function parseDataIso(
  valore: string
): Date {
  const data = new Date(
    `${normalizzaData(valore)}T12:00:00Z`
  );

  if (Number.isNaN(data.getTime())) {
    throw new Error(
      `Data non valida: ${valore}`
    );
  }

  return data;
}

function dataIsoOggi(): string {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function portaNelFuturo(
  dataScadenza: string,
  oggi: string
): string {
  const nuovaData =
    parseDataIso(dataScadenza);

  /*
   * Manteniamo giorno e mese originali,
   * incrementando l'anno finché la data
   * non risulta successiva o uguale a oggi.
   */
  while (
    nuovaData
      .toISOString()
      .slice(0, 10) < oggi
  ) {
    nuovaData.setUTCFullYear(
      nuovaData.getUTCFullYear() + 1
    );
  }

  return nuovaData
    .toISOString()
    .slice(0, 10);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (
    req.method !== "GET" &&
    req.method !== "POST"
  ) {
    res.setHeader(
      "Allow",
      ["GET", "POST"]
    );

    return res.status(405).json({
      ok: false,
      error: "Metodo non consentito",
    });
  }

  const querySecret =
    typeof req.query.secret === "string"
      ? req.query.secret
      : null;

  const authHeader =
    req.headers.authorization || "";

  const bearerSecret =
    authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

  if (
    !SECRET ||
    (
      querySecret !== SECRET &&
      bearerSecret !== SECRET
    )
  ) {
    return res.status(401).json({
      ok: false,
      error: "Non autorizzato",
    });
  }

  try {
    const oggi =
      dataIsoOggi();

    const {
      data,
      error,
    } = await supabase
      .from("tbtipi_scadenze")
      .select(`
        id,
        studio_id,
        nome,
        data_scadenza,
        ricorrente,
        attivo
      `)
      .eq("attivo", true)
      .eq("ricorrente", true)
      .lt("data_scadenza", oggi);

    if (error) {
      throw error;
    }

    const scadenze =
      (data || []) as TipoScadenzaRow[];

    const risultati: Array<{
      id: string;
      nome: string;
      vecchia_data: string;
      nuova_data?: string;
      ok: boolean;
      errore?: string;
    }> = [];

    let rinnovate = 0;
    let errori = 0;

    for (const scadenza of scadenze) {
      try {
        if (!scadenza.studio_id) {
          throw new Error(
            "studio_id mancante"
          );
        }

        if (!scadenza.data_scadenza) {
          throw new Error(
            "data_scadenza mancante"
          );
        }

        const nuovaData =
          portaNelFuturo(
            scadenza.data_scadenza,
            oggi
          );

        const {
          error: updateError,
        } = await supabase
          .from("tbtipi_scadenze")
          .update({
            data_scadenza:
              nuovaData,

            /*
             * Campi del vecchio sistema:
             * li azzeriamo per coerenza,
             * anche se l'invio passa ormai
             * dal motore centrale.
             */
            alert_1_inviato:
              false,

            alert_2_inviato:
              false,

            data_invio_alert_1:
              null,

            data_invio_alert_2:
              null,

            updated_at:
              new Date().toISOString(),
          })
          .eq("id", scadenza.id)
          .eq(
            "studio_id",
            scadenza.studio_id
          );

        if (updateError) {
          throw updateError;
        }

        /*
         * L'UPDATE attiva automaticamente:
         *
         * trg_sync_tipo_scadenza_centrale
         *
         * che aggiorna:
         * - tbscadenze_centrale;
         * - prossimo_alert_at;
         * - destinatari per settore.
         */
        rinnovate += 1;

        risultati.push({
          id: scadenza.id,
          nome: scadenza.nome,
          vecchia_data:
            scadenza.data_scadenza,
          nuova_data:
            nuovaData,
          ok: true,
        });
      } catch (error: any) {
        errori += 1;

        risultati.push({
          id: scadenza.id,
          nome: scadenza.nome,
          vecchia_data:
            scadenza.data_scadenza,
          ok: false,
          errore:
            error?.message ||
            "Errore rinnovo",
        });
      }
    }

    return res.status(
      errori > 0 ? 207 : 200
    ).json({
      ok: errori === 0,
      trovate:
        scadenze.length,
      rinnovate,
      errori,
      risultati,
    });
  } catch (error: any) {
    console.error(
      "Errore rinnovo tipi scadenze:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Errore interno",
    });
  }
}
