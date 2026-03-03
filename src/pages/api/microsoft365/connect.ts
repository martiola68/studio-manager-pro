// src/pages/api/microsoft365/connect.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Manteniamo il metodo (POST resta POST) e rimandiamo alla nuova route /api/m365/connect
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = req.headers.host;
  const location = `${proto}://${host}/api/m365/connect`;

  res.writeHead(307, { Location: location });
  res.end();
}
