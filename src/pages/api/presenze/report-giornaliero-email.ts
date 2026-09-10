import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmailServer } from "@/services/sendEmailServer";
import {
  AUTOMATIC_ALERT_FROM_MAILBOX,
  AUTOMATIC_ALERT_OWNER_EMAIL,
  resolveAutomaticMicrosoftAlertSender,
} from "@/services/automaticMicrosoftAlertSender";

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

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value || "";

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

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(bearer);

  if (authError || !authData.user?.email) return null;

  const { data: utente, error } = await supabaseAdmin
    .from("tbutenti")
    .select("studio_id,attivo")
    .eq("email", authData.user.email)
    .eq("attivo", true)
    .maybeSingle();

  if (error || !utente?.studio_id) return null;

  return { mode: "user" as const, studioId: utente.studio_id };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Metodo non consentito",
    });
  }

  const auth = await resolveAuth(req);
  if (!auth) {
    return res.status(401).json({ success: false, error: "Non autorizzato" });
  }

  const force = String(req.query.force || "") === "true";
  const testTo = typeof req.query.to === "string" ? req.query.to.trim() : "";
  let requestedStudio =
    typeof req.query.studio_id === "string" ? req.query.studio_id : "";

  if (auth.mode === "user") {
    requestedStudio = auth.studioId;
    if (!force) {
      return res.status(400).json({
        success: false,
        error: "Il test manuale richiede force=true",
      });
    }
  }

  const { date, weekday } = italyDateParts();

  if (!["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday) && !force) {
    return res.status(200).json({
      success: true,
      skipped: true,
      reason: "weekend",
      date,
    });
  }

  try {
    let q = supabaseAdmin
      .from("tbpresenze_report_email_config")
      .select("id,studio_id,destinatari,attivo,ultimo_invio_data");

    if (auth.mode === "cron") q = q.eq("attivo", true);
    if (requestedStudio) q = q.eq("studio_id", requestedStudio);

    const { data: configs, error: configError } = await q;
    if (configError) throw configError;

    const results: any[] = [];

    for (const config of configs || []) {
      if (!force && config.ultimo_invio_data === date) {
        results.push({
          studio_id: config.studio_id,
          sent: false,
          reason: "gia_inviato",
        });
        continue;
      }

      const configuredRecipients = Array.isArray(config.destinatari)
        ? config.destinatari.map(String).map((x: string) => x.trim()).filter(Boolean)
        : [];

      // "to" rimane disponibile per debug mirato; normalmente anche il test UI
      // usa tutti i destinatari configurati.
      const recipients = testTo ? [testTo] : configuredRecipients;

      if (!recipients.length) {
        results.push({
          studio_id: config.studio_id,
          sent: false,
          reason: "nessun_destinatario",
        });
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
          .select(
            "utente_id,codice_presenza,tbpresenze_codici(codice,descrizione,tipo)"
          )
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
            ? {
                codice: "N",
                descrizione: r.nota || "Festivo / Non lavorativo",
              }
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
        const isPermesso =
          tipo === "permesso" || /^P\d+(?:\.\d+)?(?:\.104)?$/.test(codice);
        const isAssenza = tipo === "assenza" || codice === "F" || codice === "M";
        const isFestivo = tipo === "festivo" || codice === "N";

        if (isPermesso || isAssenza || isFestivo || !stato.has(r.utente_id)) {
          stato.set(r.utente_id, {
            codice,
            descrizione: rel?.descrizione || codice,
          });
        }
      }

      const perSettore = new Map<
        string,
        { fisiche: any[]; smart: any[] }
      >();

      for (const u of utenti || []) {
        const s = stato.get(u.id);
        if (!s || (s.codice !== "Pp" && s.codice !== "Ps")) continue;

        const settore =
          String(u.settore || "Senza settore").trim() || "Senza settore";

        const gruppo = perSettore.get(settore) || { fisiche: [], smart: [] };

        if (s.codice === "Pp") gruppo.fisiche.push(u);
        if (s.codice === "Ps") gruppo.smart.push(u);

        perSettore.set(settore, gruppo);
      }

      const dataIt = date.split("-").reverse().join("/");

      const sezioni = Array.from(perSettore.entries())
        .sort(([a], [b]) => a.localeCompare(b, "it"))
        .map(([settore, gruppo]) => {
          const fisiche = gruppo.fisiche.map(nomeCompleto).join(", ") || "Nessuno";
          const smartList = gruppo.smart.map(nomeCompleto).join(", ") || "Nessuno";

          return `
            <div style="margin:0 0 20px 0">
              <div style="background:#eaf4fb;border-left:4px solid #1478a6;padding:8px 12px;font-weight:700">
                ${esc(settore)}
              </div>
              <div style="padding:10px 12px;border-bottom:1px solid #e5e7eb">
                <strong>Presenze fisiche:</strong> ${esc(fisiche)}
              </div>
              <div style="padding:10px 12px;border-bottom:1px solid #e5e7eb">
                <strong>Presenze in smart:</strong> ${esc(smartList)}
              </div>
            </div>
          `;
        })
        .join("");

      const html = `
        <div style="font-family:Arial,sans-serif;color:#111827;max-width:760px;margin:auto">
          <h2 style="margin-bottom:18px">PRESENZE DEL ${dataIt}</h2>
          ${
            sezioni ||
            "<p><strong>Nessuna presenza fisica o in smart prevista per oggi.</strong></p>"
          }
          <p style="font-size:12px;color:#64748b;margin-top:26px">
            Mittente automatico: <strong>${esc(AUTOMATIC_ALERT_FROM_MAILBOX)}</strong><br />
            Report automatico Studio Manager Pro.
          </p>
        </div>
      `;

      const automaticSender = await resolveAutomaticMicrosoftAlertSender(
        supabaseAdmin,
        config.studio_id
      );

      const sent: any[] = [];

      for (const to of recipients) {
        const result = await sendEmailServer({
          senderUserId: automaticSender.senderUserId,
          microsoftConnectionId: automaticSender.microsoftConnectionId,
          fromMailbox: automaticSender.fromMailbox,
          to,
          subject: `PRESENZE DEL ${dataIt}`,
          html,
        });

        sent.push({
          to,
          success: result.success,
          error: result.error || null,
        });
      }

      const ok = sent.every((x) => x.success);

      if (ok && !force) {
        await supabaseAdmin
          .from("tbpresenze_report_email_config")
          .update({
            ultimo_invio_data: date,
            updated_at: new Date().toISOString(),
          })
          .eq("id", config.id);
      }

      const presenzeFisiche = Array.from(perSettore.values()).reduce(
        (n, gruppo) => n + gruppo.fisiche.length,
        0
      );

      const presenzeSmart = Array.from(perSettore.values()).reduce(
        (n, gruppo) => n + gruppo.smart.length,
        0
      );

      results.push({
        studio_id: config.studio_id,
        sent: ok,
        sender: automaticSender.fromMailbox,
        microsoft_owner: AUTOMATIC_ALERT_OWNER_EMAIL,
        presenze_fisiche: presenzeFisiche,
        presenze_smart: presenzeSmart,
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
