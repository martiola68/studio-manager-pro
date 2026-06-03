import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SECRET = process.env.CRON_SECRET || "x9KfP2LmQ8zYtA71vBnR";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function callInternal(
  path: string,
  method: "GET" | "POST" = "GET"
) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://studio-manager-pro.vercel.app";

  const startedAt = Date.now();

  try {
    const response = await fetch(`${baseUrl}${path}`, { method });
    const text = await response.text();
    const durataMs = Date.now() - startedAt;

    const { error: logError } = await supabase.from("tbcron_log").insert({
      nome_cron: "hourly",
      endpoint: path,
      metodo: method,
      ok: response.ok,
      status: response.status,
      body: { raw: text.slice(0, 5000) },
      errore: null,
      durata_ms: durataMs,
      executed_at: new Date().toISOString(),
    });

    if (logError) {
      console.error("Errore tbcron_log:", logError);
    }

    return {
      path,
      method,
      ok: response.ok,
      status: response.status,
      durata_ms: durataMs,
      body: text,
    };
  } catch (error: any) {
    const durataMs = Date.now() - startedAt;

    const errore = error?.message || String(error);

    await supabase.from("tbcron_log").insert({
      nome_cron: "hourly",
      endpoint: path,
      metodo: method,
      ok: false,
      status: 500,
      body: null,
      errore,
      durata_ms: durataMs,
      executed_at: new Date().toISOString(),
    });

    return {
      path,
      method,
      ok: false,
      status: 500,
      durata_ms: durataMs,
      body: errore,
    };
  }
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
//  if (true) {
    results.push(
      await callInternal(`/api/scadenze/processa?secret=${SECRET}`)
    );

    results.push(
    await callInternal(`/api/presenze/sollecito-settimanale?secret=${SECRET}`)
    );

    results.push(
      await callInternal(`/api/scadenze/processa-scadenzari?secret=${SECRET}`)
    );

   results.push(
      await callInternal(`/api/scadenze/tipi/processa?secret=${SECRET}`)
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
     await callInternal(`/api/contenzioso/invia-alert?secret=${SECRET}`, "POST")
    );

    results.push(
      await callInternal(`/api/promemoria/alert?secret=${SECRET}`, "POST")
    );

  results.push(
  await callInternal(
    `/api/controllo-gestione/alert?secret=${SECRET}`,
    "POST"
  )
);
  
  }

  return res.status(200).json({
    ok: true,
    hourUtc,
    minuteUtc,
    results,
  });
}
