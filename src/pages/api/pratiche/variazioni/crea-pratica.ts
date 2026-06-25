import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  return res.status(410).json({
    success: false,
    error:
      "Endpoint dismesso. Le pratiche devono essere create dal form Variazioni CCIAA / AdE.",
  });
}
