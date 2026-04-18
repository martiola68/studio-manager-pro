import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/services/emailService";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type TipoScadenza = {
  id: string;
  nome: string;
  descrizione: string | null;
  data_scadenza: string;
  tipo_scadenza: string;
  ricorrente: boolean | null;
  giorni_preavviso_1: number | null;
  giorni_preavviso_2: number | null;
  attivo: boolean | null;
  studio_id: string | null;
  settore_fiscale: boolean | null;
  settore_lavoro: boolean | null;
  settore_consulenza: boolean | null;
};

type AlertType = "preavviso_1" | "preavviso_2" | "rinnovo_auto";

type ProcessResult = {
  processed: number;
  alertsCreated: number;
  renewals: number;
  emailsSent: number;
  errors: string[];
};

type DestinatarioEmail = {
  id: string;
  email: string;
  nome: string;
};

type AlertRecord = {
  id: string;
  email_inviata: boolean | null;
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffDaysFromToday(targetDate: string): number {
  const today = startOfDay(new Date());
  const target = startOfDay(new Date(targetDate));
  return Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function addOneYear(dateString: string): string {
  const d = new Date(dateString);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split("T")[0];
}

function formatDateIT(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleDateString("it-IT");
}

function buildHtmlScadenzaEmail(oggetto: string, messaggio: string): string {
  const messaggioHtml = messaggio
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${oggetto}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef4fb;font-family:Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#eef4fb;margin:0;padding:24px 0;">
    <tr>
      <td align="center" valign="top" style="padding:0 12px;">
        <table role="presentation" width="720" cellpadding="0" cellspacing="0" border="0" style="width:720px;max-width:720px;background:#ffffff;border:1px solid #dbe7f3;">
          <tr>
            <td valign="top" style="background:#1d4ed8;padding:24px 28px;color:#ffffff;">
              <div style="font-size:13px;line-height:18px;font-weight:bold;opacity:0.95;">Studio Manager Pro</div>
              <div style="font-size:26px;line-height:34px;font-weight:bold;padding-top:8px;">${oggetto}</div>
              <div style="font-size:13px;line-height:18px;padding-top:8px;opacity:0.95;">Notifica automatica del sistema scadenze</div>
            </td>
          </tr>

          <tr>
            <td valign="top" style="padding:24px 28px 12px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#e0f2fe;color:#0369a1;font-size:12px;line-height:16px;font-weight:bold;padding:8px 12px;">
                    Promemoria automatico
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td valign="top" style="padding:0 28px 28px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f8fbff;border:1px solid #dbeafe;">
                <tr>
                  <td width="6" style="width:6px;background:#3b82f6;font-size:0;line-height:0;">&nbsp;</td>
                  <td valign="top" style="padding:18px 20px;font-size:16px;line-height:26px;color:#1f2937;">
                    ${messaggioHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td valign="top" style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:18px 24px;text-align:center;">
              <div style="font-size:14px;line-height:20px;font-weight:bold;color:#0f172a;">Studio Manager Pro</div>
              <div style="font-size:12px;line-height:18px;color:#64748b;padding-top:4px;">
                Messaggio generato automaticamente dal sistema. Non rispondere a questa email.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

async function loadTipiScadenzeAttive(): Promise<TipoScadenza[]> {
  const { data, error } = await supabase
    .from("tbtipi_scadenze")
    .select("*")
    .eq("attivo", true);

  if (error) throw error;
  return (data || []) as TipoScadenza[];
}

async function getAlertRecord(
  tipoScadenzaId: string,
  annoInvio: number,
  tipoAlert: AlertType
): Promise<AlertRecord | null> {
  const { data, error } = await supabase
    .from("tbtipi_scadenze_alert")
    .select("id, email_inviata")
    .eq("tipo_scadenza_id", tipoScadenzaId)
    .eq("anno_invio", annoInvio)
    .eq("tipo_alert", tipoAlert)
    .maybeSingle();

  if (error) throw error;
  return (data as AlertRecord | null) ?? null;
}

async function createAlertRecord(
  tipoScadenzaId: string,
  annoInvio: number,
  tipoAlert: AlertType
): Promise<void> {
  const { error } = await supabase.from("tbtipi_scadenze_alert").insert({
    tipo_scadenza_id: tipoScadenzaId,
    anno_invio: annoInvio,
    data_invio: new Date().toISOString(),
    email_inviata: false,
    promemoria_inviato: false,
    tipo_alert: tipoAlert,
  });

  if (error) throw error;
}

async function markAlertEmailSent(
  tipoScadenzaId: string,
  annoInvio: number,
  tipoAlert: AlertType
): Promise<void> {
  const { error } = await supabase
    .from("tbtipi_scadenze_alert")
    .update({
      email_inviata: true,
      data_invio: new Date().toISOString(),
    })
    .eq("tipo_scadenza_id", tipoScadenzaId)
    .eq("anno_invio", annoInvio)
    .eq("tipo_alert", tipoAlert);

  if (error) throw error;
}

async function rinnovaScadenzaAutomatica(tipo: TipoScadenza): Promise<string> {
  const nuovaData = addOneYear(tipo.data_scadenza);

  const { error } = await supabase
    .from("tbtipi_scadenze")
    .update({
      data_scadenza: nuovaData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tipo.id);

  if (error) throw error;
  return nuovaData;
}

async function loadDestinatariInterniEmailPerScadenza(
  tipo: TipoScadenza
): Promise<DestinatarioEmail[]> {
  if (!tipo.studio_id) return [];

  const settori: string[] = [];
  if (tipo.settore_fiscale) settori.push("Fiscale");
  if (tipo.settore_lavoro) settori.push("Lavoro");
  if (tipo.settore_consulenza) settori.push("Consulenza");

  if (settori.length === 0) return [];

  const { data, error } = await supabase
    .from("tbutenti")
    .select("id, nome, cognome, email")
    .eq("attivo", true)
    .eq("studio_id", tipo.studio_id)
    .in("settore", settori);

  if (error) throw error;

  return (data || [])
    .filter((u: any) => !!u.email && !!u.id)
    .map((u: any) => ({
      id: u.id as string,
      email: u.email as string,
      nome: [u.cognome, u.nome].filter(Boolean).join(" ").trim(),
    }));
}

async function loadNominativiPerTipoScadenza(
  tipoScadenzaId: string,
  utenteOperatoreId: string
): Promise<string[]> {
  const queries = await Promise.all([
    supabase
      .from("tbscadiva")
      .select("nominativo")
      .eq("tipo_scadenza_id", tipoScadenzaId)
      .eq("utente_operatore_id", utenteOperatoreId),

    supabase
      .from("tbscadfiscali")
      .select("nominativo")
      .eq("tipo_scadenza_id", tipoScadenzaId)
      .eq("utente_operatore_id", utenteOperatoreId),

    supabase
      .from("tbscadbilanci")
      .select("nominativo")
      .eq("tipo_scadenza_id", tipoScadenzaId)
      .eq("utente_operatore_id", utenteOperatoreId),

    supabase
      .from("tbscad770")
      .select("nominativo")
      .eq("tipo_scadenza_id", tipoScadenzaId)
      .eq("utente_operatore_id", utenteOperatoreId),

    supabase
      .from("tbscadccgg")
      .select("nominativo")
      .eq("tipo_scadenza_id", tipoScadenzaId)
      .eq("utente_operatore_id", utenteOperatoreId),

    supabase
      .from("tbscadcu")
      .select("nominativo")
      .eq("tipo_scadenza_id", tipoScadenzaId)
      .eq("utente_operatore_id", utenteOperatoreId),
  ]);

  const errors = queries
    .map((q) => q.error)
    .filter(Boolean)
    .map((e) => (e as any).message);

  if (errors.length > 0) {
    throw new Error(errors.join(" | "));
  }

  const nominativi = queries
    .flatMap((q) => q.data || [])
    .map((r: any) => (r.nominativo || "").trim())
    .filter(Boolean);

  return [...new Set(nominativi)].sort((a, b) =>
    a.localeCompare(b, "it", { sensitivity: "base" })
  );
}

function buildMessaggioScadenza(
  tipo: TipoScadenza,
  tipoAlert: AlertType,
  nominativi: string[],
  giorniMancanti: number,
  nuovaData?: string
): { oggetto: string; messaggio: string } {
  const titoloAlert =
    tipoAlert === "preavviso_1" || tipoAlert === "preavviso_2"
      ? `Promemoria scadenza a ${giorniMancanti} giorn${giorniMancanti === 1 ? "o" : "i"}`
      : "Rinnovo automatico scadenza";

  const elencoNominativi =
    nominativi.length > 0
      ? nominativi.map((n, index) => `${index + 1}. ${n}`).join("\n")
      : "Nessun nominativo collegato trovato";

  const oggetto =
    tipoAlert === "rinnovo_auto"
      ? `Rinnovo automatico scadenza: ${tipo.nome}`
      : `${titoloAlert} — ${tipo.nome}`;

  const messaggio =
    tipoAlert === "rinnovo_auto"
      ? [
          `È stato eseguito il rinnovo automatico della scadenza "${tipo.nome}".`,
          "",
          `Data precedente: ${formatDateIT(tipo.data_scadenza)}`,
          `Nuova data: ${nuovaData ? formatDateIT(nuovaData) : "aggiornata automaticamente"}`,
          tipo.descrizione ? `Descrizione: ${tipo.descrizione}` : "",
          "",
          "Clienti / nominativi collegati alla scadenza:",
          elencoNominativi,
        ]
          .filter(Boolean)
          .join("\n")
      : [
          `Ti segnalo che una scadenza richiede attenzione.`,
          "",
          `Scadenza: ${tipo.nome}`,
          `Data scadenza: ${formatDateIT(tipo.data_scadenza)}`,
          `Giorni mancanti: ${giorniMancanti}`,
          tipo.descrizione ? `Descrizione: ${tipo.descrizione}` : "",
          "",
          "Clienti / nominativi collegati alla scadenza:",
          elencoNominativi,
        ]
          .filter(Boolean)
          .join("\n");

  return { oggetto, messaggio };
}

async function sendScadenzaEmails(
  recipients: DestinatarioEmail[],
  oggetto: string,
  messaggio: string
): Promise<number> {
  let sent = 0;
  const html = buildHtmlScadenzaEmail(oggetto, messaggio);

  for (const recipient of recipients) {
    const result = await sendEmail({
      to: recipient.email,
      subject: oggetto,
      html,
      text: messaggio,
      sendMode: "studio",
    });

    if (result.success) {
      sent += 1;
    } else {
      console.error(
        `❌ Invio email fallito per ${recipient.email}:`,
        result.error
      );
    }
  }

  return sent;
}

async function inviaEmailScadenza(
  tipo: TipoScadenza,
  tipoAlert: AlertType,
  giorniMancanti: number,
  nuovaData?: string
): Promise<number> {
  const recipients = await loadDestinatariInterniEmailPerScadenza(tipo);
  if (recipients.length === 0) return 0;

  let sentTotale = 0;

  for (const recipient of recipients) {
    const nominativi = await loadNominativiPerTipoScadenza(tipo.id, recipient.id);

    if (nominativi.length === 0) {
      continue;
    }

    const { oggetto, messaggio } = buildMessaggioScadenza(
      tipo,
      tipoAlert,
      nominativi,
      giorniMancanti,
      nuovaData
    );

    const sentCount = await sendScadenzaEmails(
      [{ id: recipient.id, email: recipient.email, nome: recipient.nome }],
      oggetto,
      messaggio
    );

    sentTotale += sentCount;
  }

  return sentTotale;
}

async function processAlertInvio(
  tipo: TipoScadenza,
  annoInvio: number,
  tipoAlert: AlertType,
  giorniMancanti: number,
  result: ProcessResult,
  nuovaData?: string,
  forceSend: boolean = false
): Promise<void> {
  const alertEsistente = await getAlertRecord(tipo.id, annoInvio, tipoAlert);
  const emailGiaInviata = alertEsistente?.email_inviata === true;

  if (emailGiaInviata && !forceSend) {
    return;
  }

  if (!alertEsistente) {
    await createAlertRecord(tipo.id, annoInvio, tipoAlert);
    result.alertsCreated += 1;
  }

  const sentCount = await inviaEmailScadenza(
    tipo,
    tipoAlert,
    giorniMancanti,
    nuovaData
  );

  if (sentCount > 0) {
    await markAlertEmailSent(tipo.id, annoInvio, tipoAlert);
    result.emailsSent += sentCount;
  }
}

export const scadenzeAutomaticheService = {
  async processaTipiScadenzeAutomatiche(options?: {
    forceTipoScadenzaId?: string;
    ignoreAlreadySent?: boolean;
  }): Promise<ProcessResult> {
    const result: ProcessResult = {
      processed: 0,
      alertsCreated: 0,
      renewals: 0,
      emailsSent: 0,
      errors: [],
    };

    const tipi = await loadTipiScadenzeAttive();

    for (const tipo of tipi) {
      try {
        result.processed += 1;

        const giorniMancanti = diffDaysFromToday(tipo.data_scadenza);
        const annoInvio = new Date(tipo.data_scadenza).getFullYear();

        const preavviso1 = Number(tipo.giorni_preavviso_1 ?? 15);
        const preavviso2 = Number(tipo.giorni_preavviso_2 ?? 7);

        const forceThisTipo =
          options?.ignoreAlreadySent === true &&
          options?.forceTipoScadenzaId === tipo.id;

        if (giorniMancanti === preavviso1 || forceThisTipo) {
          await processAlertInvio(
            tipo,
            annoInvio,
            "preavviso_1",
            giorniMancanti,
            result,
            undefined,
            forceThisTipo
          );
        }

        if (giorniMancanti === preavviso2 || forceThisTipo) {
          await processAlertInvio(
            tipo,
            annoInvio,
            "preavviso_2",
            giorniMancanti,
            result,
            undefined,
            forceThisTipo
          );
        }

        if (giorniMancanti < 0 && tipo.ricorrente) {
          const alertRinnovo = await getAlertRecord(
            tipo.id,
            annoInvio,
            "rinnovo_auto"
          );
          const rinnovoGiaGestito = !!alertRinnovo;

          if (!rinnovoGiaGestito) {
            const nuovaData = await rinnovaScadenzaAutomatica(tipo);
            await createAlertRecord(tipo.id, annoInvio, "rinnovo_auto");
            result.alertsCreated += 1;
            result.renewals += 1;

            const sentCount = await inviaEmailScadenza(
              tipo,
              "rinnovo_auto",
              giorniMancanti,
              nuovaData
            );

            if (sentCount > 0) {
              await markAlertEmailSent(tipo.id, annoInvio, "rinnovo_auto");
              result.emailsSent += sentCount;
            }
          }
        }
      } catch (error: any) {
        result.errors.push(
          `Errore su scadenza ${tipo.nome} (${tipo.id}): ${
            error?.message || "errore sconosciuto"
          }`
        );
      }
    }

    return result;
  },
};
