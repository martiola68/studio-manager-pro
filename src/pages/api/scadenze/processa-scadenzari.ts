import type { NextApiRequest, NextApiResponse } from "next";
import { scadenzariAutomaticiService } from "@/services/scadenzariAutomaticiService";

const SECRET = process.env.CRON_SECRET || "x9KfP2LmQ8zYtA71vBnR";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  }

  const authHeader = req.headers.authorization;

  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const querySecret =
    typeof req.query.secret === "string" ? req.query.secret : null;

  if (!SECRET || (bearerToken !== SECRET && querySecret !== SECRET)) {
    return res.status(401).json({
      success: false,
      error: "Non autorizzato",
    });
  }

  try {
    const forceAlert1 =
      req.method === "GET" ? false : req.body?.forceAlert1 === true;

    const forceAlert2 =
      req.method === "GET" ? false : req.body?.forceAlert2 === true;

    const result =
      await scadenzariAutomaticiService.processaScadenzariAutomatici({
        forceAlert1,
        forceAlert2,
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
