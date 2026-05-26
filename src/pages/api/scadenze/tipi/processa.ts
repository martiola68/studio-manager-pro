import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SECRET = process.env.CRON_SECRET || "x9KfP2LmQ8zYtA71vBnR";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const querySecret =
    typeof req.query.secret === "string"
      ? req.query.secret
      : null;

  if (!SECRET || querySecret !== SECRET) {
    return res.status(401).json({
      ok: false,
      error: "Non autorizzato",
    });
  }

  try {
    const oggi = new Date();

    const { data: tipi, error } = await supabase
      .from("tbtipiscadenze")
      .select("*")
      .eq("attivo", true)
      .eq("ricorrente", true);

    if (error) {
      console.error(error);

      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }

    const risultati = [];

    for (const tipo of tipi || []) {
      try {
        const dataScadenza = new Date(tipo.data_scadenza);

        const diffMs =
          dataScadenza.getTime() - oggi.getTime();

        const giorni = Math.ceil(
          diffMs / (1000 * 60 * 60 * 24)
        );

        // ALERT 7 GIORNI
        if (
          giorni <= 7 &&
          giorni > 0 &&
          !tipo.alert_7gg_inviato
        ) {
          console.log(
            `Alert 7 giorni per ${tipo.nome}`
          );

          await supabase
            .from("tbtipiscadenze")
            .update({
              alert_7gg_inviato: true,
            })
            .eq("id", tipo.id);
        }

        // ALERT GIORNO STESSO
        if (
          giorni <= 0 &&
          !tipo.alert_oggi_inviato
        ) {
          console.log(
            `Alert oggi per ${tipo.nome}`
          );

          await supabase
            .from("tbtipiscadenze")
            .update({
              alert_oggi_inviato: true,
            })
            .eq("id", tipo.id);
        }

        // RINNOVO AUTOMATICO
        if (giorni < 0) {
          const nuovaData = new Date(dataScadenza);

          switch (tipo.frequenza) {
            case "mensile":
              nuovaData.setMonth(
                nuovaData.getMonth() + 1
              );
              break;

            case "trimestrale":
              nuovaData.setMonth(
                nuovaData.getMonth() + 3
              );
              break;

            case "semestrale":
              nuovaData.setMonth(
                nuovaData.getMonth() + 6
              );
              break;

            case "annuale":
            default:
              nuovaData.setFullYear(
                nuovaData.getFullYear() + 1
              );
              break;
          }

          await supabase
            .from("tbtipiscadenze")
            .update({
              data_scadenza: nuovaData
                .toISOString()
                .split("T")[0],

              alert_7gg_inviato: false,
              alert_oggi_inviato: false,
            })
            .eq("id", tipo.id);

          console.log(
            `Scadenza rinnovata: ${tipo.nome}`
          );
        }

        risultati.push({
          id: tipo.id,
          nome: tipo.nome,
          ok: true,
        });
      } catch (err) {
        console.error(err);

        risultati.push({
          id: tipo.id,
          nome: tipo.nome,
          ok: false,
        });
      }
    }

    return res.status(200).json({
      ok: true,
      risultati,
    });
  } catch (error: any) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
