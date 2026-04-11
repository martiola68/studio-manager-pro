import type { NextApiRequest, NextApiResponse } from "next";
import { scadenzeAutomaticheService } from "@/services/scadenzeAutomaticheService";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const forceTipoScadenzaId =
      typeof req.query.forceTipoScadenzaId === "string"
        ? req.query.forceTipoScadenzaId
        : undefined;

    const ignoreAlreadySent = req.query.ignoreAlreadySent === "1";

    const result =
      await scadenzeAutomaticheService.processaTipiScadenzeAutomatiche({
        forceTipoScadenzaId,
        ignoreAlreadySent,
      });

    return res.status(200).json({
      ok: true,
      forceTipoScadenzaId,
      ignoreAlreadySent,
      result,
    });
  } catch (error: any) {
    console.error("❌ Errore processa scadenze:", error);

    return res.status(500).json({
      ok: false,
      error: error?.message || "Errore interno",
    });
  }
}
