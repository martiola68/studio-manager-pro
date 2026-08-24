import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SECRET =
  process.env.CRON_SECRET;

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
  "https://app.studiomanagerpro.it";

  const startedAt = Date.now();

  try {
  const response = await fetch(
  `${baseUrl}${path}`,
  {
    method,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
  }
);
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
  typeof req.query.secret === "string"
    ? req.query.secret
    : null;

const authorization =
  typeof req.headers.authorization === "string"
    ? req.headers.authorization
    : "";

const bearerSecret =
  authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

const secretRicevuto =
  querySecret || bearerSecret;

if (
  !SECRET ||
  secretRicevuto !== SECRET
) {
  return res.status(401).json({
    ok: false,
    error: "Non autorizzato",
  });
}

const now = new Date();
const hourUtc = now.getUTCHours();
const minuteUtc = now.getUTCMinutes();

const results = await Promise.all([
  callInternal(
    `/api/scadenze-centrale/processa-alert?secret=${SECRET}`
  ),

  callInternal(
    `/api/scadenze/affitti/processa?secret=${SECRET}`
  ),

  callInternal(
    `/api/scadenze/tipi/processa?secret=${SECRET}`
  ),

  callInternal(
    `/api/cron/aml-fascicoli-alert`,
    "GET"
  ),

  callInternal(
    `/api/presenze/sollecito-settimanale?secret=${SECRET}`
  ),

  callInternal(
    `/api/revisione-controllo/followup-alert?secret=${SECRET}`,
    "POST"
  ),

  callInternal(
    `/api/promemoria/alert?secret=${SECRET}`,
    "POST"
  ),

  callInternal(
    `/api/controllo-gestione/alert?secret=${SECRET}`,
    "POST"
  ),

  callInternal(
    `/api/revisione-controllo/alert?secret=${SECRET}`,
    "POST"
  ),
]);

 const errori = results.filter(
  (result) => !result.ok
);

return res.status(errori.length > 0 ? 207 : 200).json({
  ok: errori.length === 0,
  hourUtc,
  minuteUtc,
  numero_job: results.length,
  numero_job_ok: results.length - errori.length,
  numero_job_errore: errori.length,
  results,
});
}
