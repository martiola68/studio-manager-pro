import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // accetta SOLO POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // risposta di test FORZATA
    return res.status(200).json({
      url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    });
  } catch (e) {
    return res.status(500).json({ error: "connect crash" });
  }
}
