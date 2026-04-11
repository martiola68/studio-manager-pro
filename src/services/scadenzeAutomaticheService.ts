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
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .container {
      max-width: 700px;
      margin: 20px auto;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      background: #111827;
      color: white;
      padding: 20px;
      font-size: 20px;
      font-weight: bold;
    }
    .content {
      padding: 24px;
    }
    .message {
      background: #f9fafb;
      border-left: 4px solid #2563eb;
      padding: 16px;
      border-radius: 4px;
      white-space: pre-wrap;
    }
    .footer {
      background: #f3f4f6;
      padding: 16px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      margin: 5px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">${oggetto}</div>
    <div class="content">
      <div class="message">${messaggio.replace(/\n/g, "<br>")}</div>
    </div>
    <div class="footer">
      <p><strong>Studio Manager Pro</strong></p>
      <p>Questa è una email automatica, non rispondere a questo messaggio</p>
    </div>
  </div>
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

async function rinnovaScadenzaAutomatica(tipo: TipoScadenza): Promise<void> {
  const nuovaData = addOneYear(tipo.data_scadenza);

  const { error } = await supabase
    .from("tbtipi_scadenze")
    .update({
      data_scadenza: nuovaData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tipo.id);

  if (error) throw error;
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
  giorniMancanti: number
): { oggetto: string; messaggio: string } {
  const titoloAlert =
    tipoAlert === "preavviso_1"
      ? `Promemoria scadenza a ${giorniMancanti} giorni`
      : tipoAlert === "preavviso_2"
      ? `Promemoria scadenza a ${giorniMancanti} giorni`
      : "Rinnovo automatico scadenza";

  const elencoNominativi =
    nominativi.length > 0
      ? nominativi.map((n) => `- ${n}`).join("\n")
      : "- Nessun nominativo collegato trovato";

  const oggetto =
    tipoAlert === "rinnovo_auto"
      ? `Rinnovo automatico scadenza: ${tipo.nome}`
      : `${titoloAlert}: ${tipo.nome} del ${formatDateIT(tipo.data_scadenza)}`;

  const messaggio =
    tipoAlert === "rinnovo_auto"
      ? [
          `È stato eseguito il rinnovo automatico della scadenza "${tipo.nome}".`,
          "",
          `Data precedente: ${formatDateIT(tipo.data_scadenza)}`,
          `Nuova data annuale aggiornata automaticamente.`,
          "",
          "Nominativi collegati:",
          elencoNominativi,
        ].join("\n")
      : [
          `${titoloAlert}.`,
          "",
          `Scadenza: ${tipo.nome}`,
          `Data scadenza: ${formatDateIT(tipo.data_scadenza)}`,
          tipo.descrizione ? `Descrizione: ${tipo.descrizione}` : "",
          "",
          "Nominativi collegati:",
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
  giorniMancanti: number
): Promise<boolean> {
  const recipients = await loadDestinatariInterniEmailPerScadenza(tipo);
  if (recipients.length === 0) return false;

  const nominativi = await loadNominativiPerTipoScadenza(tipo.id);
  const { oggetto, messaggio } = buildMessaggioScadenza(
    tipo,
    tipoAlert,
    nominativi,
    giorniMancanti
  );

  const sentCount = await sendScadenzaEmails(recipients, oggetto, messaggio);
  return sentCount > 0;
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
          const alreadySent = await alertAlreadySent(tipo.id, annoInvio, "preavviso_2");

          if (!alreadySent) {
            await createAlertRecord(tipo.id, annoInvio, "preavviso_2");
            result.alertsCreated += 1;

            const emailSent = await inviaEmailScadenza(
              tipo,
              "preavviso_2",
              giorniMancanti
            );

            if (emailSent) {
              await markAlertEmailSent(tipo.id, annoInvio, "preavviso_2");
              result.emailsSent += 1;
            }
          }
        }

        if (giorniMancanti < 0 && tipo.ricorrente) {
          const alreadyRenewed = await alertAlreadySent(tipo.id, annoInvio, "rinnovo_auto");

          if (!alreadyRenewed) {
            await rinnovaScadenzaAutomatica(tipo);
            await createAlertRecord(tipo.id, annoInvio, "rinnovo_auto");
            result.renewals += 1;
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
