import type { NextApiRequest, NextApiResponse } from "next";
import { scadenzeAutomaticheService } from "@/services/scadenzeAutomaticheService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const result = await scadenzeAutomaticheService.processaTipiScadenzeAutomatiche();

    return res.status(200).json({
      ok: true,
      result,
    });
  } catch (error: any) {
    console.error("Errore processa scadenze:", error);

    return res.status(500).json({
      ok: false,
      error: error?.message || "Errore interno",
    });
  }
}
