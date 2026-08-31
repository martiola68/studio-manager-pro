import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmailServer } from "@/services/sendEmailServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Metodo non consentito" });
  }

 const cronSecret =
  process.env.CRON_SECRET;
  
  const querySecret = typeof req.query.secret === "string" ? req.query.secret : null;

  if (!cronSecret || querySecret !== cronSecret) {
    return res.status(401).json({ success: false, error: "Non autorizzato" });
  }

  const supabase = getSupabaseAdmin();

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

const oggiIso = oggi.toISOString().split("T")[0];

/*
 * Intervalli uniformi per tutti i promemoria,
 * indipendentemente dalla priorità.
 */
const alertOffsets = [
  30,
  20,
  10,
  5,
  2,
  1,
  0,
];

const dateAlertIso =
  alertOffsets.map((offset) => {
    const d = new Date(oggi);

    d.setDate(
      d.getDate() + offset
    );

    return d
      .toISOString()
      .split("T")[0];
  });

/*
 * I promemoria già scaduti vengono
 * richiamati soltanto il lunedì.
 */
const oggiELunedi =
  oggi.getDay() === 1;

  try {
  let queryPromemoria = supabase
  .from("tbpromemoria")
  .select(`
    *,
    destinatario:tbutenti!destinatario_id (
      id,
      nome,
      cognome,
      email
    )
  `)
  .neq(
    "working_progress",
    "Completato"
  );

/*
 * Dal martedì alla domenica leggiamo
 * soltanto i promemoria che coincidono
 * con uno degli intervalli previsti.
 *
 * Il lunedì leggiamo anche quelli scaduti.
 */
if (oggiELunedi) {
  queryPromemoria =
    queryPromemoria.or(
      [
        `data_scadenza.in.(${dateAlertIso.join(",")})`,
        `data_scadenza.lt.${oggiIso}`,
      ].join(",")
    );
} else {
  queryPromemoria =
    queryPromemoria.in(
      "data_scadenza",
      dateAlertIso
    );
}

const {
  data: promemoria,
  error,
} = await queryPromemoria;

    if (error) throw error;

    let emailInviate = 0;
    let emailFallite = 0;
    let saltati = 0;
    let giaInviati = 0;
    let logCreati = 0;

    for (const p of promemoria || []) {
      const scadenza = new Date(p.data_scadenza);
      scadenza.setHours(0, 0, 0, 0);

      const giorniRimasti = Math.round(
        (scadenza.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24)
      );

const priorita =
  String(
    p.priorita || ""
  ).toLowerCase();

let deveInviare = false;
let tipoAlert = "";

/*
 * Promemoria non ancora scaduto:
 * alert a 30, 20, 10, 5, 2, 1 e 0 giorni.
 */
if (giorniRimasti >= 0) {
  deveInviare =
    alertOffsets.includes(
      giorniRimasti
    );

  tipoAlert =
    giorniRimasti === 0
      ? "oggi"
      : `${giorniRimasti}gg`;
}

/*
 * Promemoria già scaduto:
 * alert soltanto ogni lunedì.
 */
if (
  giorniRimasti < 0 &&
  oggiELunedi
) {
  deveInviare = true;

  /*
   * La data rende univoco l’invio
   * per ciascun lunedì.
   */
  tipoAlert =
    `scaduto_lunedi_${oggiIso}`;
}

if (!deveInviare) {
  saltati++;
  continue;
}

if (
  tipoAlert === "oggi" &&
  p.alert_oggi_inviato
) {
  giaInviati++;
  continue;
}

      if (!p.studio_id || !p.destinatario?.email) {
        saltati++;
        continue;
      }

      const markerUnivoco = `promemoria:${p.id}:${tipoAlert}:${p.data_scadenza}`;

      const { data: logEsistente } = await supabase
        .from("tbalert_log")
        .select("id")
        .eq("marker_univoco", markerUnivoco)
        .maybeSingle();

      if (logEsistente) {
        giaInviati++;
        continue;
      }

      const { data: studio, error: studioError } = await supabase
        .from("tbstudio")
        .select("microsoft_connection_id")
        .eq("id", p.studio_id)
        .maybeSingle();

      if (studioError || !studio?.microsoft_connection_id) {
        saltati++;
        continue;
      }

      const codicePromemoria = (p as any).codice_promemoria || "-";

 const subject =
  giorniRimasti < 0
    ? `[${codicePromemoria}] Promemoria scaduto: ${p.titolo}`
    : tipoAlert === "oggi"
      ? `[${codicePromemoria}] Promemoria in scadenza oggi: ${p.titolo}`
      : `[${codicePromemoria}] Promemoria in scadenza tra ${giorniRimasti} giorni: ${p.titolo}`;

      const html = `
        <div style="font-family: Arial, sans-serif; font-size: 14px; color: #1f2937; line-height: 1.6;">
          <p>Gentile ${p.destinatario.nome || "utente"},</p>
   <p>
  ${
    giorniRimasti < 0
      ? `ti ricordiamo che il seguente promemoria è scaduto da ${Math.abs(
          giorniRimasti
        )} ${
          Math.abs(
            giorniRimasti
          ) === 1
            ? "giorno"
            : "giorni"
        } ed è ancora aperto.`
      : tipoAlert === "oggi"
        ? "ti ricordiamo che il seguente promemoria scade oggi."
        : `ti ricordiamo che il seguente promemoria andrà in scadenza tra ${giorniRimasti} giorni.`
  }
</p>
          <ul>
            <li><strong>Codice:</strong> ${codicePromemoria}</li>
            <li><strong>Titolo:</strong> ${p.titolo}</li>
            <li><strong>Scadenza:</strong> ${new Date(p.data_scadenza).toLocaleDateString("it-IT")}</li>
            <li><strong>Priorità:</strong> ${p.priorita || "-"}</li>
            <li><strong>Stato:</strong> ${p.working_progress || "-"}</li>
            <li><strong>Descrizione:</strong> ${p.descrizione || "Nessuna descrizione"}</li>
          </ul>
        </div>
      `.trim();

      const result = await sendEmailServer({
        senderUserId: p.operatore_id,
        microsoftConnectionId: studio.microsoft_connection_id,
        to: p.destinatario.email,
        subject,
        html,
      });

      await supabase.from("tbalert_log").insert({
        studio_id: p.studio_id,
        modulo: "promemoria",
        riferimento_tabella: "tbpromemoria",
        riferimento_id: p.id,
        tipo_alert: tipoAlert,
        data_scadenza: p.data_scadenza,
giorni_preavviso:
  Math.max(
    giorniRimasti,
    0
  ),
        destinatario_utente_id: p.destinatario?.id || p.destinatario_id,
        destinatario_email: p.destinatario.email,
        messaggio_interno_creato: false,
        email_inviata: !!result.success,
        marker_univoco: markerUnivoco,
        errore: result.success ? null : String(result.error || "Errore invio email"),
        inviato_at: new Date().toISOString(),
      });

      logCreati++;

    if (result.success) {
  emailInviate++;

  if (tipoAlert === "oggi") {
    await supabase
      .from("tbpromemoria")
      .update({
        alert_oggi_inviato: true,
        alert_oggi_inviato_at: new Date().toISOString(),
      })
      .eq("id", p.id);
  }
} else {
        
        emailFallite++;
        console.error("Errore email promemoria:", result.error);
      }
    }

    return res.status(200).json({
      success: true,
      date: {
  oggiIso,
  oggiELunedi,
  intervalli: alertOffsets,
  dateAlertIso,
},
      promemoria_trovati: promemoria?.length || 0,
      email_inviate: emailInviate,
      email_fallite: emailFallite,
      gia_inviati: giaInviati,
      log_creati: logCreati,
      saltati,
    });
  } catch (error: any) {
    console.error("Errore alert promemoria:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno",
    });
  }
}
