import type { NextApiRequest, NextApiResponse } from "next";
import { scadenzariAutomaticiService } from "@/services/scadenzariAutomaticiService";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  }

  try {
    const { forceAlert1, forceAlert2 } = req.body || {};

    const result =
      await scadenzariAutomaticiService.processaScadenzariAutomatici({
        forceAlert1: forceAlert1 === true,
        forceAlert2: forceAlert2 === true,
      });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Errore processa-scadenzari:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno del server",
    });
  }
}
