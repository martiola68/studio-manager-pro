import type { NextApiRequest, NextApiResponse } from "next";
import { processaScadenzeAffittiAutomatiche } from "@/services/scadenzeAffittiAutomaticheService";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Metodo non consentito",
    });
  }

  const cronSecret = process.env.CRON_SECRET;

  const querySecret =
    typeof req.query.secret === "string" ? req.query.secret : null;

  const authHeader = req.headers.authorization;

  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const receivedSecret = querySecret || bearerToken;

  if (!cronSecret || receivedSecret !== cronSecret) {
    return res.status(401).json({
      ok: false,
      error: "Non autorizzato",
    });
  }

  try {
    const result = await processaScadenzeAffittiAutomatiche();

    return res.status(200).json({
      ok: true,
      result,
    });
  } catch (error: any) {
    console.error("Errore processa scadenze affitti:", error);

    return res.status(500).json({
      ok: false,
      error: error?.message || "Errore interno",
    });
  }
}
