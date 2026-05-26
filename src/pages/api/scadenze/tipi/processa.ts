import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SECRET = process.env.CRON_SECRET || "x9KfP2LmQ8zYtA71vBnR";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function toDateOnly(date: Date) {
  return date.toISOString().split("T")[0];
}

function diffDaysFromToday(dateValue: string) {
  const today = new Date();
  const todayOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const target = new Date(dateValue);
  const targetOnly = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  );

  return Math.round(
    (targetOnly.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24)
  );
}

async function alertGiaInviato(
  tipoScadenzaId: string,
  annoInvio: number,
  tipoAlert: string
) {
  const { data, error } = await supabase
    .from("tbtipi_scadenze_alert")
    .select("id")
    .eq("tipo_scadenza_id", tipoScadenzaId)
    .eq("anno_invio", annoInvio)
    .eq("tipo_alert", tipoAlert)
    .maybeSingle();

  if (error) throw error;

  return !!data;
}

async function registraAlert(
  tipoScadenzaId: string,
  annoInvio: number,
  tipoAlert: string
) {
  const { error } = await supabase.from("tbtipi_scadenze_alert").insert({
    tipo_scadenza_id: tipoScadenzaId,
    anno_invio: annoInvio,
    tipo_alert: tipoAlert,
    data_invio: new Date().toISOString(),
  });

  if (error) throw error;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const querySecret =
    typeof req.query.secret === "string" ? req.query.secret : null;

  if (!SECRET || querySecret !== SECRET) {
    return res.status(401).json({
      ok: false,
      error: "Non autorizzato",
    });
  }

  try {
    const { data: tipi, error } = await supabase
      .from("tbtipi_scadenze")
      .select("*")
      .eq("attivo", true)
      .eq("ricorrente", true);

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }

    const risultati: any[] = [];

    for (const tipo of tipi || []) {
      try {
        if (!tipo.data_scadenza) {
          risultati.push({
            id: tipo.id,
            nome: tipo.nome,
            ok: false,
            error: "data_scadenza mancante",
          });
          continue;
        }

        const giorni = diffDaysFromToday(tipo.data_scadenza);
        const annoInvio = new Date(tipo.data_scadenza).getFullYear();

       const preavviso1 = Number(tipo.giorni_preavviso_1 || 15);
const preavviso2 = Number(tipo.giorni_preavviso_2 || 7);

const preavvisi = [
  preavviso1,
  preavviso2,
  0,
];
        const alertDaInviare = preavvisi.filter(
          (giorniPreavviso, index, self) =>
            giorni === giorniPreavviso &&
            self.indexOf(giorniPreavviso) === index
        );

        const alerts: string[] = [];

        for (const giorniPreavviso of alertDaInviare) {
         const tipoAlert =
  giorniPreavviso === 0
    ? "giorno_0"
    : giorniPreavviso === preavviso1
      ? "preavviso_1"
      : "preavviso_2";
          
          const giaInviato = await alertGiaInviato(
            tipo.id,
            annoInvio,
            tipoAlert
          );

          if (!giaInviato) {
            await registraAlert(tipo.id, annoInvio, tipoAlert);
            alerts.push(tipoAlert);

            console.log(
              `Alert ${tipoAlert} registrato per ${tipo.nome}`
            );
          }
        }

        let rinnovata = false;
        let nuovaDataStr: string | null = null;

        if (giorni < 0) {
          const nuovaData = new Date(tipo.data_scadenza);

          do {
            nuovaData.setFullYear(nuovaData.getFullYear() + 1);
          } while (diffDaysFromToday(toDateOnly(nuovaData)) < 0);

          nuovaDataStr = toDateOnly(nuovaData);

          const { error: updateError } = await supabase
            .from("tbtipi_scadenze")
            .update({
              data_scadenza: nuovaDataStr,
            })
            .eq("id", tipo.id);

          if (updateError) throw updateError;

          rinnovata = true;
        }

        risultati.push({
          id: tipo.id,
          nome: tipo.nome,
          giorni,
          alerts,
          rinnovata,
          nuovaData: nuovaDataStr,
          ok: true,
        });
      } catch (err: any) {
        risultati.push({
          id: tipo.id,
          nome: tipo.nome,
          ok: false,
          error: err?.message || String(err),
        });
      }
    }

    return res.status(200).json({
      ok: true,
      risultati,
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
