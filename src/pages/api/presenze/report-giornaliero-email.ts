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

  const { data: utente, error } = await supabaseAdmin
    .from("tbutenti")
    .select("studio_id,attivo")
    .eq("email", authData.user.email)
    .eq("attivo", true)
    .maybeSingle();

  if (error || !utente?.studio_id) return null;

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
    if (!force) {
      return res.status(400).json({ success: false, error: "Il test manuale richiede force=true" });
    }
  }

  const { date, weekday } = italyDateParts();

  if (!["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday) && !force) {
    return res.status(200).json({ success: true, skipped: true, reason: "weekend", date });
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
        results.push({ studio_id: config.studio_id, sent: false, reason: "gia_inviato" });
        continue;
      }

      const configuredRecipients = Array.isArray(config.destinatari)
        ? config.destinatari.map(String).map((x: string) => x.trim()).filter(Boolean)
        : [];

      const recipients = testTo ? [testTo] : configuredRecipients;

      if (!recipients.length) {
        results.push({ studio_id: config.studio_id, sent: false, reason: "nessun_destinatario" });
        continue;
      }

      const [
        { data: utenti, error: utentiError },
        { data: smart, error: smartError },
        { data: actual, error: actualError },
        { data: gruppiSmart, error: gruppiSmartError },
      ] = await Promise.all([
        supabaseAdmin
          .from("tbutenti")
          .select("id,nome,cognome,email,settore,tipo_rapporto")
          .eq("studio_id", config.studio_id)
          .eq("attivo", true)
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
        supabaseAdmin
          .from("tbpresenze_smart_gruppi")
          .select(`
            id,
            giorno_fisso,
            scelta_libera,
            utenti:tbpresenze_smart_gruppi_utenti(
              utente_id,
              ordine,
              giorni_presenza
            )
          `)
          .eq("studio_id", config.studio_id)
          .eq("attivo", true),
      ]);

      if (utentiError) throw utentiError;
      if (smartError) throw smartError;
      if (actualError) throw actualError;
      if (gruppiSmartError) throw gruppiSmartError;

      const smartMemberIds = new Set<string>();
      for (const gruppo of gruppiSmart || []) {
        for (const membro of gruppo.utenti || []) {
          if (membro?.utente_id) smartMemberIds.add(String(membro.utente_id));
        }
      }

      const personeIncluse = (utenti || []).filter(
        (u: any) => u.tipo_rapporto === "Dipendente" || smartMemberIds.has(String(u.id))
      );

      const stato = new Map<string, { codice: string; descrizione: string }>();

      for (const r of smart || []) {
        stato.set(
          String(r.utente_id),
          r.festivo
            ? { codice: "N", descrizione: r.nota || "Festivo / Non lavorativo" }
            : r.presenza
              ? { codice: "Pp", descrizione: "Presente in ufficio" }
              : { codice: "Ps", descrizione: "Smart working" }
        );
      }

      const today = new Date(`${date}T12:00:00`);
      const wd = today.getDay();
      const mondayOf = (d: Date) => {
        const copy = new Date(d);
        const day = copy.getDay() || 7;
        copy.setDate(copy.getDate() - day + 1);
        copy.setHours(0, 0, 0, 0);
        return copy;
      };
      const excelBase = new Date(2025, 11, 1);
      const extraIndexForDay = (d: Date, weekday: number, count: number) => {
        if (!count) return null;
        const posByDay: Record<number, number> = { 1: 0, 3: 1, 4: 2, 5: 3 };
        const pos = posByDay[weekday];
        if (pos === undefined) return null;
        const weekIndex = Math.floor(
          (mondayOf(d).getTime() - excelBase.getTime()) / (7 * 24 * 60 * 60 * 1000)
        );
        return (weekIndex + pos) % count;
      };

      for (const gruppo of gruppiSmart || []) {
        const membri = [...(gruppo.utenti || [])].sort(
          (a: any, b: any) => Number(a.ordine || 0) - Number(b.ordine || 0)
        );
        const extraIndex = extraIndexForDay(today, wd, membri.length);

        membri.forEach((membro: any, userIndex: number) => {
          const userId = String(membro?.utente_id || "");
          if (!userId || stato.has(userId)) return;

          const giorni = Array.isArray(membro.giorni_presenza)
            ? membro.giorni_presenza.map(Number)
            : [];

          const presenza = gruppo.scelta_libera
            ? giorni.includes(wd)
            : wd === Number(gruppo.giorno_fisso || 2) || userIndex === extraIndex;

          stato.set(userId, {
            codice: presenza ? "Pp" : "Ps",
            descrizione: presenza ? "Presente in ufficio" : "Smart working",
          });
        });
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
        const userId = String(r.utente_id);

        if (isPermesso || isAssenza || isFestivo || !stato.has(userId)) {
          stato.set(userId, { codice, descrizione: rel?.descrizione || codice });
        }
      }

      const perSettore = new Map<
        string,
        {
          fisiche: any[];
          smart: any[];
          assenze: Array<{ utente: any; stato: { codice: string; descrizione: string } }>;
          permessi: Array<{ utente: any; stato: { codice: string; descrizione: string } }>;
        }
      >();

      for (const u of personeIncluse) {
        const s = stato.get(String(u.id));
        if (!s) continue;

        const settore = String(u.settore || "Senza settore").trim() || "Senza settore";
        const gruppo = perSettore.get(settore) || {
          fisiche: [],
          smart: [],
          assenze: [],
          permessi: [],
        };

        const isPermesso = /^P\d+(?:\.\d+)?(?:\.104)?$/.test(s.codice) ||
          String(s.descrizione || "").toLowerCase().includes("permesso");
        const isAssenza = s.codice === "F" || s.codice === "M" ||
          ["ferie", "malattia", "assenza"].some((x) =>
            String(s.descrizione || "").toLowerCase().includes(x)
          );

        if (s.codice === "Pp") gruppo.fisiche.push(u);
        else if (s.codice === "Ps") gruppo.smart.push(u);
        else if (isPermesso) gruppo.permessi.push({ utente: u, stato: s });
        else if (isAssenza) gruppo.assenze.push({ utente: u, stato: s });

        perSettore.set(settore, gruppo);
      }

      const dataIt = date.split("-").reverse().join("/");

      const sezioni = Array.from(perSettore.entries())
        .sort(([a], [b]) => a.localeCompare(b, "it"))
        .map(([settore, gruppo]) => {
          const fisicheRows = gruppo.fisiche.length
            ? gruppo.fisiche
                .map(
                  (u) => `<tr>
                    <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb">${esc(nomeCompleto(u))}</td>
                    <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#166534">Presente in ufficio</td>
                  </tr>`
                )
                .join("")
            : `<tr><td colspan="2" style="padding:7px 12px;border-bottom:1px solid #e5e7eb;color:#64748b">Nessuno</td></tr>`;

          const smartRows = gruppo.smart.length
            ? gruppo.smart
                .map(
                  (u) => `<tr>
                    <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb">${esc(nomeCompleto(u))}</td>
                    <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#1d4ed8">Smart working</td>
                  </tr>`
                )
                .join("")
            : `<tr><td colspan="2" style="padding:7px 12px;border-bottom:1px solid #e5e7eb;color:#64748b">Nessuno</td></tr>`;

          return `
            <div style="margin:0 0 22px 0">
              <div style="background:#eaf4fb;border-left:4px solid #1478a6;padding:8px 12px;font-weight:700">${esc(settore)}</div>
              <div style="padding:9px 12px 4px;font-weight:700;color:#166534">Presenze fisiche — ${gruppo.fisiche.length}</div>
              <table style="width:100%;border-collapse:collapse;font-size:14px">${fisicheRows}</table>
              <div style="padding:12px 12px 4px;font-weight:700;color:#1d4ed8">Presenze in smart — ${gruppo.smart.length}</div>
              <table style="width:100%;border-collapse:collapse;font-size:14px">${smartRows}</table>
            </div>
          `;
        })
        .join("");

      const html = `
        <div style="font-family:Arial,sans-serif;color:#111827;max-width:760px;margin:auto">
          <h2 style="margin-bottom:4px">PRESENZE DEL ${dataIt}</h2>
          <p style="margin-top:0;margin-bottom:18px;color:#64748b">Presenze fisiche e Smart Working, suddivise per settore.</p>
          ${sezioni || "<p><strong>Nessuna presenza fisica o in smart prevista per oggi.</strong></p>"}
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

      const sectorRecipients = [
        { key: "Fiscale", to: configuredRecipients[0] || "" },
        { key: "Lavoro", to: configuredRecipients[1] || "" },
        { key: "Consulenza", to: configuredRecipients[2] || "" },
      ];

      const sent: any[] = [];
      const skippedRecipients: string[] = [];

      const makeRows = (
        rows: Array<{ nome: string; stato: string; colore: string }>,
        emptyLabel = "Nessuno"
      ) => rows.length
        ? rows.map((row) => `<tr>
            <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb">${esc(row.nome)}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:${row.colore}">${esc(row.stato)}</td>
          </tr>`).join("")
        : `<tr><td colspan="2" style="padding:7px 12px;border-bottom:1px solid #e5e7eb;color:#64748b">${emptyLabel}</td></tr>`;

      for (const item of sectorRecipients) {
        const to = String(item.to || "").trim();
        if (!to) {
          skippedRecipients.push(item.key);
          continue;
        }

        const settoreEntry = Array.from(perSettore.entries()).find(
          ([settore]) => settore.trim().toLowerCase() === item.key.toLowerCase()
        );
        const gruppo = settoreEntry?.[1] || {
          fisiche: [], smart: [], assenze: [], permessi: [],
        };

        const fisicheRows = makeRows(
          gruppo.fisiche.map((u) => ({
            nome: nomeCompleto(u),
            stato: "Presente in ufficio",
            colore: "#166534",
          }))
        );

        const smartRows = makeRows(
          gruppo.smart.map((u) => ({
            nome: nomeCompleto(u),
            stato: "Smart working",
            colore: "#1d4ed8",
          }))
        );

        const assenzeRows = makeRows(
          gruppo.assenze.map((x) => ({
            nome: nomeCompleto(x.utente),
            stato: x.stato.descrizione || x.stato.codice || "Assenza",
            colore: "#b91c1c",
          }))
        );

        const permessiRows = makeRows(
          gruppo.permessi.map((x) => ({
            nome: nomeCompleto(x.utente),
            // La descrizione del codice contiene già le ore richieste,
            // es. "Permesso L.104 1 ora" per P1.104.
            stato: x.stato.descrizione || x.stato.codice || "Permesso",
            colore: "#a16207",
          }))
        );

        const settoreHtml = `
          <div style="font-family:Arial,sans-serif;color:#111827;max-width:760px;margin:auto">
            <h2 style="margin-bottom:4px">PRESENZE DEL ${dataIt}</h2>
            <p style="margin-top:0;margin-bottom:18px;color:#64748b">Settore ${esc(item.key)}</p>
            <div style="margin:0 0 22px 0">
              <div style="background:#eaf4fb;border-left:4px solid #1478a6;padding:8px 12px;font-weight:700">${esc(item.key)}</div>

              <div style="padding:9px 12px 4px;font-weight:700;color:#166534">Presenze fisiche — ${gruppo.fisiche.length}</div>
              <table style="width:100%;border-collapse:collapse;font-size:14px">${fisicheRows}</table>

              <div style="padding:12px 12px 4px;font-weight:700;color:#1d4ed8">Presenze in smart — ${gruppo.smart.length}</div>
              <table style="width:100%;border-collapse:collapse;font-size:14px">${smartRows}</table>

              <div style="padding:12px 12px 4px;font-weight:700;color:#b91c1c">Ferie / Assenze — ${gruppo.assenze.length}</div>
              <table style="width:100%;border-collapse:collapse;font-size:14px">${assenzeRows}</table>

              <div style="padding:12px 12px 4px;font-weight:700;color:#a16207">Permessi — ${gruppo.permessi.length}</div>
              <table style="width:100%;border-collapse:collapse;font-size:14px">${permessiRows}</table>
            </div>
            <p style="font-size:12px;color:#64748b;margin-top:26px">
              Mittente automatico: <strong>${esc(AUTOMATIC_ALERT_FROM_MAILBOX)}</strong><br />
              Report automatico Studio Manager Pro.
            </p>
          </div>
        `;

        const result = await sendEmailServer({
          senderUserId: automaticSender.senderUserId,
          microsoftConnectionId: automaticSender.microsoftConnectionId,
          fromMailbox: automaticSender.fromMailbox,
          to,
          subject: `PRESENZE ${item.key.toUpperCase()} - ${dataIt}`,
          html: settoreHtml,
        });

        sent.push({
          settore: item.key,
          to,
          success: result.success,
          error: result.error || null,
          presenze_fisiche: gruppo.fisiche.length,
          presenze_smart: gruppo.smart.length,
          assenze: gruppo.assenze.length,
          permessi: gruppo.permessi.length,
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

      const presenzeFisiche = sent.reduce(
        (n, row) => n + Number(row.presenze_fisiche || 0),
        0
      );
      const presenzeSmart = sent.reduce(
        (n, row) => n + Number(row.presenze_smart || 0),
        0
      );
      const assenzeTotali = sent.reduce(
        (n, row) => n + Number(row.assenze || 0),
        0
      );
      const permessiTotali = sent.reduce(
        (n, row) => n + Number(row.permessi || 0),
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
        skipped_recipients: skippedRecipients,
        assenze: assenzeTotali,
        permessi: permessiTotali,
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
