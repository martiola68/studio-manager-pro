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

  // =========================
  // 🔄 SEMPRE (OGNI ORA)
  // =========================
  results.push(
    await callInternal(
      `/api/microsoft365/calendar/sync-cron?secret=${SECRET}`
    )
  );

  const hourUtc = new Date().getUTCHours();

  // =========================
  // ⏰ JOB GIORNALIERI (08 UTC)
  // =========================
  if (hourUtc === 8) {
    // SCADENZE GENERICHE
    results.push(
      await callInternal(`/api/scadenze/processa?secret=${SECRET}`)
    );

    // SCADENZARI
    results.push(
      await callInternal(
        `/api/scadenze/processa-scadenzari?secret=${SECRET}`
      )
    );

    // AFFITTI
    results.push(
      await callInternal(
        `/api/scadenze/affitti/processa?secret=${SECRET}`
      )
    );

    // ANTIRICICLAGGIO (AML)
    results.push(
      await callInternal(
        `/api/antiriciclaggio/scadenze-verifica/send-alerts?secret=${SECRET}`
      )
    );

   // CONTENZIOSO
results.push(
  await callInternal(`/api/contenzioso/alert?secret=${SECRET}`, "POST")
);

// PROMEMORIA
results.push(
  await callInternal(`/api/promemoria/alert?secret=${SECRET}`, "POST")
);
  }

  return res.status(200).json({
    ok: true,
    hourUtc,
    results,
  });
}
