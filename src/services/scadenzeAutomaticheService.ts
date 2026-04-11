import { createClient } from "@supabase/supabase-js";

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
  email: string;
  nome: string;
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffDaysFromToday(targetDate: string): number {
  const today = startOfDay(new Date());
  const target = startOfDay(new Date(targetDate));
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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
  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${oggetto}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef4fb;font-family:Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef4fb;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dbe7f3;">
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb,#0ea5e9);padding:24px 28px;color:#ffffff;">
              <div style="font-size:13px;opacity:0.95;margin-bottom:8px;">Studio Manager Pro</div>
              <div style="font-size:24px;font-weight:700;line-height:1.3;">${oggetto}</div>
              <div style="font-size:13px;opacity:0.92;margin-top:8px;">Notifica automatica del sistema scadenze</div>
            </td>
          </tr>

          <tr>
            <td style="padding:28px;">
              <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:#e0f2fe;color:#0369a1;font-size:12px;font-weight:700;margin-bottom:18px;">
                Promemoria automatico
              </div>

              <div style="background:#f8fbff;border:1px solid #dbeafe;border-left:5px solid #3b82f6;border-radius:10px;padding:18px 20px;font-size:15px;line-height:1.7;color:#1f2937;">
                ${messaggio.replace(/\n/g, "<br>")}
              </div>
            </td>
          </tr>

          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:18px 24px;text-align:center;">
              <div style="font-size:13px;font-weight:700;color:#0f172a;">Studio Manager Pro</div>
              <div style="font-size:12px;color:#64748b;margin-top:4px;">
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

async function alertAlreadySent(
  tipoScadenzaId: string,
  annoInvio: number,
  tipoAlert: AlertType
): Promise<boolean> {
  const { data, error } = await supabase
    .from("tbtipi_scadenze_alert")
    .select("id")
    .eq("tipo_scadenza_id", tipoScadenzaId)
    .eq("anno_invio", annoInvio)
    .eq("tipo_alert", tipoAlert)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

async function createAlertRecord(
  tipoScadenzaId: string,
  annoInvio: number,
  tipoAlert: AlertType
): Promise<void> {
  const { error } = await supabase
    .from("tbtipi_scadenze_alert")
    .insert({
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
    .filter((u: any) => !!u.email)
    .map((u: any) => ({
      email: u.email as string,
      nome: [u.cognome, u.nome].filter(Boolean).join(" ").trim(),
    }));
}

async function loadNominativiPerTipoScadenza(
  tipoScadenzaId: string
): Promise<string[]> {
  const queries = await Promise.all([
    supabase
      .from("tbscadiva")
      .select("nominativo")
      .eq("tipo_scadenza_id", tipoScadenzaId),

    supabase
      .from("tbscadfiscali")
      .select("nominativo")
      .eq("tipo_scadenza_id", tipoScadenzaId),

    supabase
      .from("tbscadbilanci")
      .select("nominativo")
      .eq("tipo_scadenza_id", tipoScadenzaId),

    supabase
      .from("tbscad770")
      .select("nominativo")
      .eq("tipo_scadenza_id", tipoScadenzaId),

    supabase
      .from("tbscadccgg")
      .select("nominativo")
      .eq("tipo_scadenza_id", tipoScadenzaId),

    supabase
      .from("tbscadcu")
      .select("nominativo")
      .eq("tipo_scadenza_id", tipoScadenzaId),
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
      ? nominativi.map((n) => `• ${n}`).join("\n")
      : "• Nessun nominativo collegato trovato";

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
          "Nominativi collegati:",
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
          "Nominativi collegati:",
          elencoNominativi,
        ]
          .filter(Boolean)
          .join("\n");

  return { oggetto, messaggio };
}

async function sendEmailDirectServerSide(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          to,
          subject,
          html,
          text,
        }),
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: result?.error || `HTTP ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function sendScadenzaEmails(
  recipients: DestinatarioEmail[],
  oggetto: string,
  messaggio: string
): Promise<number> {
  let sent = 0;
  const html = buildHtmlScadenzaEmail(oggetto, messaggio);

  for (const recipient of recipients) {
    const result = await sendEmailDirectServerSide(
      recipient.email,
      oggetto,
      html,
      messaggio
    );

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

  const nominativi = await loadNominativiPerTipoScadenza(tipo.id);
  const { oggetto, messaggio } = buildMessaggioScadenza(
    tipo,
    tipoAlert,
    nominativi,
    giorniMancanti,
    nuovaData
  );

  return await sendScadenzaEmails(recipients, oggetto, messaggio);
}

export const scadenzeAutomaticheService = {
  async processaTipiScadenzeAutomatiche(): Promise<ProcessResult> {
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

 if (tipo.nome === "IVA") {
  const alreadySentDebug = await alertAlreadySent(tipo.id, annoInvio, "preavviso_1");

  result.errors.push(
    `[DEBUG IVA] id=${tipo.id} nome=${tipo.nome} giorniMancanti=${giorniMancanti} preavviso1=${preavviso1} alreadySent=${alreadySentDebug}`
  );
}

if (giorniMancanti === preavviso1) {
  const alreadySent = await alertAlreadySent(tipo.id, annoInvio, "preavviso_1");

  if (!alreadySent) {
    await createAlertRecord(tipo.id, annoInvio, "preavviso_1");
    result.alertsCreated += 1;

    const emailSent = await inviaEmailScadenza(
      tipo,
      "preavviso_1",
      giorniMancanti
    );

    if (emailSent) {
      await markAlertEmailSent(tipo.id, annoInvio, "preavviso_1");
      result.emailsSent += 1;
    }
  }
}
        if (giorniMancanti === preavviso2) {
          const alreadySent = await alertAlreadySent(
            tipo.id,
            annoInvio,
            "preavviso_2"
          );

          if (!alreadySent) {
            await createAlertRecord(tipo.id, annoInvio, "preavviso_2");
            result.alertsCreated += 1;

            const sentCount = await inviaEmailScadenza(
              tipo,
              "preavviso_2",
              giorniMancanti
            );

            if (sentCount > 0) {
              await markAlertEmailSent(tipo.id, annoInvio, "preavviso_2");
              result.emailsSent += sentCount;
            }
          }
        }

        if (giorniMancanti < 0 && tipo.ricorrente) {
          const alreadyRenewed = await alertAlreadySent(
            tipo.id,
            annoInvio,
            "rinnovo_auto"
          );

          if (!alreadyRenewed) {
            const nuovaData = await rinnovaScadenzaAutomatica(tipo);
            await createAlertRecord(tipo.id, annoInvio, "rinnovo_auto");
            result.renewals += 1;

            const sentCount = await inviaEmailScadenza(
              { ...tipo, data_scadenza: tipo.data_scadenza },
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
          `Errore su scadenza ${tipo.nome} (${tipo.id}): ${error?.message || "errore sconosciuto"}`
        );
      }
    }

    return result;
  },
};
