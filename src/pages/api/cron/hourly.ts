import type { NextApiRequest, NextApiResponse } from "next";

const SECRET = process.env.CRON_SECRET || "x9KfP2LmQ8zYtA71vBnR";

async function callInternal(
  path: string,
  method: "GET" | "POST" = "GET"
) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://studio-manager-pro.vercel.app";

  const res = await fetch(`${baseUrl}${path}`, { method });
  const text = await res.text();

  return {
    path,
    method,
    ok: res.ok,
    status: res.status,
    body: text,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const querySecret =
    typeof req.query.secret === "string" ? req.query.secret : null;

  if (!SECRET || querySecret !== SECRET) {
    return res.status(401).json({
      ok: false,
      error: "Non autorizzato",
    });
  }

  const results = [];

  const now = new Date();
  const hourUtc = now.getUTCHours();
  const minuteUtc = now.getUTCMinutes();

  // JOB GIORNALIERI: una volta al giorno alle 08:00 UTC
  if (hourUtc === 8) {
    results.push(
      await callInternal(`/api/scadenze/processa?secret=${SECRET}`)
    );

    results.push(
      await callInternal(`/api/scadenze/processa-scadenzari?secret=${SECRET}`)
    );

    results.push(
      await callInternal(`/api/scadenze/affitti/processa?secret=${SECRET}`)
    );

    results.push(
      await callInternal(
        `/api/antiriciclaggio/scadenze-verifica/send-alerts?secret=${SECRET}`
      )
    );

    results.push(
      await callInternal(`/api/contenzioso/alert?secret=${SECRET}`, "POST")
    );

    results.push(
      await callInternal(`/api/promemoria/alert?secret=${SECRET}`, "POST")
    );
  }

  return res.status(200).json({
    ok: true,
    hourUtc,
    minuteUtc,
    results,
  });
}
