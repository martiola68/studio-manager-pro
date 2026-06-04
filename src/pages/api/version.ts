import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  res.status(200).json({
    version:
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.NEXT_PUBLIC_APP_VERSION ||
      "local-dev",
    checkedAt: new Date().toISOString(),
  });
}
