import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import {
  generaReportQualitaAnagraficheAML,
} from "@/services/anagraficheQualityReport";

type ResponseData =
  | {
      ok: true;
      test: true;
      gruppi: number;
      anomalie: number;
      data: any[];
    }
  | {
      ok: false;
      error: string;
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Metodo non consentito",
    });
  }

  try {
    /*
     * =========================================================
     * MODALITÀ TEST
     * =========================================================
     *
     * Per ora questa API NON invia email.
     *
     * Serve solo per verificare:
     *
     * - quali operatori vengono trovati;
     * - quali clienti sono assegnati;
     * - quali rappresentanti hanno anomalie;
     * - quali anomalie sono presenti.
     */
    const report =
      await generaReportQualitaAnagraficheAML();

    const totaleAnomalie =
      report.reduce(
        (totale, gruppo) =>
          totale +
          gruppo.anomalie.length,
        0
      );

    return res.status(200).json({
      ok: true,
      test: true,
      gruppi:
        report.length,
      anomalie:
        totaleAnomalie,
      data:
        report,
    });
  } catch (error: any) {
    console.error(
      "Errore report qualità anagrafiche AML:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Errore durante la generazione del report AML",
    });
  }
}
