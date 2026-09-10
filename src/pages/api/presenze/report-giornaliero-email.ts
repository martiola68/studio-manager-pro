import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmailServer } from "@/services/sendEmailServer";

const supabaseAdmin = getSupabaseAdmin();
const SECRET = process.env.CRON_SECRET;

function italyDateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: get("weekday"),
  };
}

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nomeCompleto(u: any) {
  return `${u.cognome || ""} ${u.nome || ""}`.trim() || u.email || u.id;
}

async function resolveAuth(req: NextApiRequest) {
  const header = String(req.headers.authorization || "");
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const querySecret = typeof req.query.secret === "string" ? req.query.secret : "";

  if (SECRET && (bearer === SECRET || querySecret === SECRET)) {
    return { mode: "cron" as const, studioId: "" };
  }

  if (!bearer) return null;

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(bearer);
  if (authError || !authData.user?.email) return null;

  const { data: utente, error: utenteError } = await supabaseAdmin
    .from("tbutenti")
    .select("studio_id, attivo")
    .eq("email", authData.user.email)
    .eq("attivo", true)
    .maybeSingle();

  if (utenteError || !utente?.studio_id) return null;
  return { mode: "user" as const, studioId: utente.studio_id };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Metodo non consentito" });
  }

  const auth = await resolveAuth(req);
  if (!auth) {
    return res.status(401).json({ success: false, error: "Non autorizzato" });
  }

  const force = String(req.query.force || "") === "true";
  const testTo = typeof req.query.to === "string" ? req.query.to.trim() : "";
  let requestedStudio = typeof req.query.studio_id === "string" ? req.query.studio_id : "";

  if (auth.mode === "user") {
    requestedStudio = auth.studioId;
    if (!force || !testTo) {
      return res.status(400).json({
        success: false,
        error: "Il test manuale richiede force=true e un destinatario",
      });
    }
  }

  const { date, weekday } = italyDateParts();
  const feriale = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday);

  if (!feriale && !force) {
    return res.status(200).json({ success: true, skipped: true, reason: "weekend", date });
  }

  try {
    let configQuery = supabaseAdmin
      .from("tbpresenze_report_email_config")
      .select("id, studio_id, destinatari, attivo, ultimo_invio_data");

    if (auth.mode === "cron") {
      configQuery = configQuery.eq("attivo", true);
    }
    if (requestedStudio) {
      configQuery = configQuery.eq("studio_id", requestedStudio);
    }

    const { data: configs, error: configError } = await configQuery;
    if (configError) throw configError;

    const results: any[] = [];

    for (const config of configs || []) {
      if (!force && config.ultimo_invio_data === date) {
        results.push({ studio_id: config.studio_id, sent: false, reason: "gia_inviato" });
        continue;
      }

      const recipients = testTo
        ? [testTo]
        : (Array.isArray(config.destinatari) ? config.destinatari : [])
            .map(String)
            .map((x) => x.trim())
            .filter(Boolean);

      if (!recipients.length) {
        results.push({ studio_id: config.studio_id, sent: false, reason: "nessun_destinatario" });
        continue;
      }

      const [
        { data: utenti, error: utentiError },
        { data: smart, error: smartError },
        { data: actual, error: actualError },
      ] = await Promise.all([
        supabaseAdmin
          .from("tbutenti")
          .select("id,nome,cognome,email,settore,tipo_rapporto")
          .eq("studio_id", config.studio_id)
          .eq("attivo", true)
          .eq("tipo_rapporto", "Dipendente")
          .order("settore")
          .order("cognome"),
        supabaseAdmin
          .from("tbpresenze_smart_calendario")
          .select("utente_id,presenza,festivo,nota")
          .eq("studio_id", config.studio_id)
          .eq("data", date),
        supabaseAdmin
          .from("tbpresenze_dipendenti")
          .select("utente_id,codice_presenza,tbpresenze_codici(codice,descrizione,tipo)")
          .eq("studio_id", config.studio_id)
          .eq("data_presenza", date),
      ]);

      if (utentiError) throw utentiError;
      if (smartError) throw smartError;
      if (actualError) throw actualError;

      const stato = new Map<string, { codice: string; descrizione: string }>();

      for (const r of smart || []) {
        stato.set(
          r.utente_id,
          r.festivo
            ? { codice: "N", descrizione: r.nota || "Festivo / Non lavorativo" }
            : r.presenza
              ? { codice: "Pp", descrizione: "Presente in ufficio" }
              : { codice: "Ps", descrizione: "Smart working" }
        );
      }

      for (const r of actual || []) {
        const codice = String(r.codice_presenza || "").trim();
        if (!codice || codice === "-") continue;

        const rel: any = Array.isArray(r.tbpresenze_codici)
          ? r.tbpresenze_codici[0]
          : r.tbpresenze_codici;
        const tipo = rel?.tipo;
        const isPermesso = tipo === "permesso" || /^P\d+(?:\.\d+)?(?:\.104)?$/.test(codice);
        const isAssenza = tipo === "assenza" || codice === "F" || codice === "M";
        const isFestivo = tipo === "festivo" || codice === "N";

        if (isPermesso || isAssenza || isFestivo || !stato.has(r.utente_id)) {
          stato.set(r.utente_id, { codice, descrizione: rel?.descrizione || codice });
        }
      }

      const perSettore = new Map<string, any[]>();
      for (const u of utenti || []) {
        const s = stato.get(u.id);
        if (!s || s.codice !== "Pp") continue;
        const settore = String(u.settore || "Senza settore").trim() || "Senza settore";
        const list = perSettore.get(settore) || [];
        list.push(u);
        perSettore.set(settore, list);
      }

      const sezioni = Array.from(perSettore.entries())
        .sort(([a], [b]) => a.localeCompare(b, "it"))
        .map(
          ([settore, list]) => `
        <div style="margin:0 0 20px 0">
          <div style="background:#eaf4fb;border-left:4px solid #1478a6;padding:8px 12px;font-weight:700">${esc(settore)} — ${list.length}</div>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            ${list
              .map(
                (u) => `<tr><td style="padding:7px 12px;border-bottom:1px solid #e5e7eb">${esc(nomeCompleto(u))}</td><td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#166534">Presente in ufficio</td></tr>`
              )
              .join("")}
          </table>
        </div>`
        )
        .join("");

      const dataIt = date.split("-").reverse().join("/");
      const html = `<div style="font-family:Arial,sans-serif;color:#111827;max-width:760px;margin:auto">
        <h2 style="margin-bottom:4px">Presenze fisiche del ${dataIt}</h2>
        <p style="margin-top:0;color:#64748b">Dipendenti presenti fisicamente in ufficio, suddivisi per settore.</p>
        ${sezioni || "<p><strong>Nessuna presenza fisica prevista per oggi.</strong></p>"}
        <p style="font-size:12px;color:#94a3b8;margin-top:24px">Report automatico Studio Manager Pro.</p>
      </div>`;

      const { data: studio, error: studioError } = await supabaseAdmin
        .from("tbstudio")
        .select("microsoft_connection_id")
        .eq("id", config.studio_id)
        .single();
      if (studioError || !studio?.microsoft_connection_id) {
        throw new Error("Connessione Microsoft dello studio non trovata");
      }

      const { data: tokenOwner, error: tokenError } = await supabaseAdmin
        .from("tbmicrosoft365_user_tokens")
        .select("user_id")
        .eq("microsoft_connection_id", studio.microsoft_connection_id)
        .is("revoked_at", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (tokenError || !tokenOwner?.user_id) {
        throw new Error("Proprietario token Microsoft non trovato");
      }

      const sent: any[] = [];
      for (const to of recipients) {
        const result = await sendEmailServer({
          senderUserId: tokenOwner.user_id,
          microsoftConnectionId: studio.microsoft_connection_id,
          to,
          subject: `Presenze fisiche - ${dataIt}`,
          html,
        });
        sent.push({ to, success: result.success, error: result.error || null });
      }

      const ok = sent.every((x) => x.success);

      if (ok && !testTo) {
        await supabaseAdmin
          .from("tbpresenze_report_email_config")
          .update({
            ultimo_invio_data: date,
            updated_at: new Date().toISOString(),
          })
          .eq("id", config.id);
      }

      results.push({
        studio_id: config.studio_id,
        sent: ok,
        presenze_fisiche: Array.from(perSettore.values()).reduce((n, l) => n + l.length, 0),
        recipients: sent,
      });
    }

    return res
      .status(results.some((x) => x.sent === false && !x.reason) ? 207 : 200)
      .json({ success: true, date, results });
  } catch (error: any) {
    console.error("Errore report presenze giornaliero:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore report presenze giornaliero",
    });
  }
}
