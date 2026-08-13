import type { NextApiRequest, NextApiResponse } from "next";
import {
  parseDatevKoinosCsv,
  RigaContabileDatev,
} from "../../../utils/contabilita/parsers/datevKoinosParser";

type RigaAnteprima = RigaContabileDatev & {
  utilizzata: boolean;
  motivo: string;
};

/*
 * Per l'anteprima NON eliminiamo nulla.
 * Vogliamo vedere tutti i conti trovati e capire quali
 * verrebbero utilizzati dal motore.
 */
function costruisciAnteprima(
  righe: RigaContabileDatev[]
): RigaAnteprima[] {
  const risultato: RigaAnteprima[] = [];

  const perSezione = new Map<
    RigaContabileDatev["sezione"],
    RigaContabileDatev[]
  >();

  for (const riga of righe) {
    const elenco = perSezione.get(riga.sezione) || [];
    elenco.push(riga);
    perSezione.set(riga.sezione, elenco);
  }

  for (const [, elenco] of perSezione) {
    const analitici = elenco.filter(
      (riga) => riga.livello === "analitico"
    );

    const padriConFigli = new Set(
      analitici
        .map((riga) => riga.codicePadre)
        .filter((value): value is string => Boolean(value))
    );

    for (const riga of elenco) {
      /*
       * Conto analitico:
       * viene utilizzato.
       */
      if (riga.livello === "analitico") {
        risultato.push({
          ...riga,
          utilizzata: true,
          motivo: "Conto analitico",
        });

        continue;
      }

      /*
       * Sintetico con conti analitici:
       * NON viene utilizzizzato per evitare doppia somma.
       */
      if (padriConFigli.has(riga.codiceConto)) {
        risultato.push({
          ...riga,
          utilizzata: false,
          motivo:
            "Conto sintetico escluso: presenti conti analitici",
        });

        continue;
      }

      /*
       * Sintetico senza dettaglio:
       * deve essere utilizzato perché altrimenti
       * perderemmo l'importo.
       */
      risultato.push({
        ...riga,
        utilizzata: true,
        motivo:
          "Conto sintetico senza dettaglio analitico",
      });
    }
  }

  return risultato.sort(
    (a, b) => a.numeroRiga - b.numeroRiga
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Metodo non consentito",
      });
    }

    const {
      contenuto_csv,
      software_contabile = "datev_koinos",
    } = req.body;

    if (software_contabile !== "datev_koinos") {
      return res.status(400).json({
        success: false,
        error: "Software contabile non supportato",
      });
    }

    if (
      typeof contenuto_csv !== "string" ||
      !contenuto_csv.trim()
    ) {
      return res.status(400).json({
        success: false,
        error: "contenuto_csv obbligatorio",
      });
    }

    const parsed = parseDatevKoinosCsv(contenuto_csv);

    if (!parsed.righe.length) {
      return res.status(400).json({
        success: false,
        error:
          "Nessuna riga contabile riconosciuta nel file DATEV KOINOS",
      });
    }

    const righe = costruisciAnteprima(parsed.righe);

    const utilizzate = righe.filter(
      (riga) => riga.utilizzata
    );

    const escluse = righe.filter(
      (riga) => !riga.utilizzata
    );

    const perSezione = {
      SP_ATTIVO: utilizzate.filter(
        (r) => r.sezione === "SP_ATTIVO"
      ).length,

      SP_PASSIVO: utilizzate.filter(
        (r) => r.sezione === "SP_PASSIVO"
      ).length,

      CE_COSTI: utilizzate.filter(
        (r) => r.sezione === "CE_COSTI"
      ).length,

      CE_RICAVI: utilizzate.filter(
        (r) => r.sezione === "CE_RICAVI"
      ).length,
    };

    return res.status(200).json({
      success: true,

      azienda: {
        codice: parsed.codiceAzienda,
        societa: parsed.societa,
      },

      periodo: {
        dal: parsed.periodoDal,
        al: parsed.periodoAl,
      },

      totali: parsed.totali,

      quadratura: parsed.quadratura,

      riepilogo: {
        righe_contabili: parsed.righe.length,
        utilizzate: utilizzate.length,
        escluse: escluse.length,
        per_sezione: perSezione,
      },

      righe,
    });
  } catch (error: any) {
    console.error(
      "Errore anteprima import DATEV:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Errore durante l'analisi del file",
    });
  }
}
