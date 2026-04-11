import type { NextApiRequest, NextApiResponse } from "next";
import { scadenzeAutomaticheService } from "@/services/scadenzeAutomaticheService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const now = new Date();

    console.log("👉 API scadenze processa chiamata", {
      method: req.method,
      nowIso: now.toISOString(),
    });

    const result = await scadenzeAutomaticheService.processaTipiScadenzeAutomatiche();

    console.log("✅ Processa scadenze completata", result);

    return res.status(200).json({
      ok: true,
      now: {
        iso: now.toISOString(),
        date: now.toISOString().split("T")[0],
      },
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
