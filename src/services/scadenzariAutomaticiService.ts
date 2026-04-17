import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type DestinatarioEmail = {
  id: string;
  email: string;
  nome: string;
};

type RigaScadenzarioBase = {
  id: string;
  nominativo: string;
  studio_id: string | null;
  data_scadenza_adempimento: string | null;
  data_avviso_1: string | null;
  data_avviso_2: string | null;
  alert_1_inviato: boolean;
  alert_2_inviato: boolean;
};

type RigaIva = RigaScadenzarioBase & {
  utente_operatore_id: string | null;
  utente_professionista_id: string | null;
  conferma_riga: boolean | null;
};

type RigaCcgg = RigaScadenzarioBase & {
  utente_operatore_id: string | null;
  utente_professionista_id: string | null;
  conferma_riga: boolean | null;
};

type RigaCu = RigaScadenzarioBase & {
  utente_operatore_id: string | null;
  utente_professionista_id: string | null;
  conferma_riga: boolean | null;
};

type RigaFiscali = RigaScadenzarioBase & {
  utente_operatore_id: string | null;
  utente_professionista_id: string | null;
  conferma_riga: boolean | null;
};

type RigaBilanci = RigaScadenzarioBase & {
  utente_operatore_id: string | null;
  utente_professionista_id: string | null;
  conferma_riga: boolean | null;
};

type Riga770 = RigaScadenzarioBase & {
  utente_operatore_id: string | null;
  utente_professionista_id: string | null;
  conferma_riga: boolean | null;
};

type RigaAffitti = {
  id: string;
  studio_id: string;
  cliente_id: string;
  utente_operatore_id: string | null;
  conduttore: string | null;
  descrizione_immobile_locato: string | null;
  data_registrazione_atto: string;
  data_rinnovo_atto: string | null;
  durata_contratto_anni: number;
  codice_identificativo_registrazione: string | null;
  importo_registrazione: number | null;
  contatore_anni: number;
  data_prossima_scadenza: string;
  emailperalert: string | null;
  alert1_inviato: boolean;
  alert1_inviato_at: string | null;
  alert2_inviato: boolean;
  alert2_inviato_at: string | null;
  alert3_inviato: boolean;
  alert3_inviato_at: string | null;
  attivo: boolean;
  rinnovo: boolean;
  contratto_concluso: boolean;
};

type ClienteAffittoLite = {
  id: string;
  ragione_sociale: string | null;
};

type ProcessResult = {
  processedTables: number;
  processedRows: number;
  emailsSent: number;
  errors: string[];
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDateIT(dateString: string): string {
  return new Date(dateString).toLocaleDateString("it-IT");
}

function diffDaysFromToday(targetDate: string): number {
  const today = startOfDay(new Date());
  const target = startOfDay(new Date(targetDate));
  return Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function buildHtmlEmail(oggetto: string, messaggio: string): string {
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
              <div style="font-size:13px;line-height:18px;padding-top:8px;opacity:0.95;">Notifica automatica scadenzario</div>
            </td>
          </tr>
          <tr>
            <td valign="top" style="padding:24px 28px 28px 28px;">
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

async function sendEmails(
  recipients: DestinatarioEmail[],
  oggetto: string,
  messaggio: string
): Promise<number> {
  let sent = 0;
  const html = buildHtmlEmail(oggetto, messaggio);

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
      console.error(`Invio email fallito per ${recipient.email}:`, result.error);
    }
  }

  return sent;
}

async function loadDestinatarioByUserId(
  userId: string
): Promise<DestinatarioEmail | null> {
  const { data, error } = await supabase
    .from("tbutenti")
    .select("id, nome, cognome, email")
    .eq("id", userId)
    .eq("attivo", true)
    .maybeSingle();

  if (error) throw error;
  if (!data?.email) return null;

  return {
    id: data.id,
    email: data.email,
    nome: [data.cognome, data.nome].filter(Boolean).join(" ").trim(),
  };
}

function groupByUserId<
  T extends {
    utente_operatore_id: string | null;
    utente_professionista_id: string | null;
  }
>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    const userId = row.utente_operatore_id || row.utente_professionista_id;
    if (!userId) continue;

    if (!grouped.has(userId)) {
      grouped.set(userId, []);
    }

    grouped.get(userId)!.push(row);
  }

  return grouped;
}

function buildEmailMessage(
  titolo: string,
  rows: RigaScadenzarioBase[],
  alertNumero: 1 | 2
): { oggetto: string; messaggio: string } {
  const dataScadenza = rows[0]?.data_scadenza_adempimento || "";
  const giorniMancanti = dataScadenza ? diffDaysFromToday(dataScadenza) : 0;
  const nominativi = rows
    .map((r, index) => `${index + 1}. ${r.nominativo}`)
    .join("\n");

  const oggetto = `Promemoria scadenzario ${titolo}`;

  const messaggio = [
    `Ti segnalo uno scadenzario con clienti ancora da lavorare.`,
    "",
    `Scadenzario: ${titolo}`,
    `Data scadenza adempimento: ${
      dataScadenza ? formatDateIT(dataScadenza) : "-"
    }`,
    `Giorni mancanti: ${giorniMancanti}`,
    `Numero avviso: ${alertNumero}`,
    "",
    "Clienti da definire/inviare:",
    nominativi,
  ].join("\n");

  return { oggetto, messaggio };
}

async function markAlertSent(
  tableName: string,
  ids: string[],
  alertNumero: 1 | 2
): Promise<void> {
  if (ids.length === 0) return;

  const payload =
    alertNumero === 1
      ? {
          alert_1_inviato: true,
          data_invio_alert_1: new Date().toISOString(),
        }
      : {
          alert_2_inviato: true,
          data_invio_alert_2: new Date().toISOString(),
        };

  const { error } = await supabase
    .from(tableName as any)
    .update(payload)
    .in("id", ids);

  if (error) throw error;
}

function addYears(dateString: string, yearsToAdd: number): string {
  const d = new Date(dateString);
  d.setHours(0, 0, 0, 0);
  d.setFullYear(d.getFullYear() + yearsToAdd);
  return d.toISOString().split("T")[0];
}

function subtractDays(dateString: string, days: number): string {
  const d = new Date(dateString);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function getRowsForToday<T extends RigaScadenzarioBase>(
  rows: T[],
  oggi: string,
  alertNumero: 1 | 2,
  forceSend = false
): T[] {
  return rows.filter((row) => {
    if (!row.data_scadenza_adempimento) return false;

    if (alertNumero === 1) {
      return (row.data_avviso_1 === oggi || forceSend) && !row.alert_1_inviato;
    }

    return (row.data_avviso_2 === oggi || forceSend) && !row.alert_2_inviato;
  });
}

function filterOpenIvaRows(
  rows: Array<
    RigaScadenzarioBase & {
      utente_operatore_id: string | null;
      utente_professionista_id: string | null;
      conferma_riga?: boolean | null;
    }
  >
) {
  return rows.filter((r) => !r.conferma_riga);
}

function filterOpenCcggRows(
  rows: Array<
    RigaScadenzarioBase & {
      utente_operatore_id: string | null;
      utente_professionista_id: string | null;
      conferma_riga?: boolean | null;
    }
  >
) {
  return rows.filter((r) => !r.conferma_riga);
}

function filterOpenCuRows(
  rows: Array<
    RigaScadenzarioBase & {
      utente_operatore_id: string | null;
      utente_professionista_id: string | null;
      conferma_riga?: boolean | null;
    }
  >
) {
  return rows.filter((r) => !r.conferma_riga);
}

function filterOpenFiscaliRows(
  rows: Array<
    RigaScadenzarioBase & {
      utente_operatore_id: string | null;
      utente_professionista_id: string | null;
      conferma_riga?: boolean | null;
    }
  >
) {
  return rows.filter((r) => !r.conferma_riga);
}

function filterOpenBilanciRows(
  rows: Array<
    RigaScadenzarioBase & {
      utente_operatore_id: string | null;
      utente_professionista_id: string | null;
      conferma_riga?: boolean | null;
    }
  >
) {
  return rows.filter((r) => !r.conferma_riga);
}

function filterOpen770Rows(
  rows: Array<
    RigaScadenzarioBase & {
      utente_operatore_id: string | null;
      utente_professionista_id: string | null;
      conferma_riga?: boolean | null;
    }
  >
) {
  return rows.filter((r) => !r.conferma_riga);
}

function getAffittoDecorrenza(row: RigaAffitti): string {
  return row.rinnovo && row.data_rinnovo_atto
    ? row.data_rinnovo_atto
    : row.data_registrazione_atto;
}

function getAffittoAlertDate(
  row: RigaAffitti,
  alertNumero: 1 | 2 | 3
): string | null {
  if (!row.data_prossima_scadenza) return null;

  if (alertNumero === 1) {
    return subtractDays(row.data_prossima_scadenza, 30);
  }

  if (alertNumero === 2) {
    return subtractDays(row.data_prossima_scadenza, 15);
  }

  return row.data_prossima_scadenza;
}

function buildAffittoEmailMessage(params: {
  row: RigaAffitti;
  locatore: string;
  alertNumero: 1 | 2 | 3;
}): { oggetto: string; messaggio: string } {
  const { row, locatore, alertNumero } = params;

  const giorniMancanti = row.data_prossima_scadenza
    ? diffDaysFromToday(row.data_prossima_scadenza)
    : 0;

  const oggetto =
    alertNumero === 1
      ? `Promemoria rinnovo contratto affitto a 30 giorni — ${locatore}`
      : alertNumero === 2
      ? `Promemoria rinnovo contratto affitto a 15 giorni — ${locatore}`
      : `Promemoria scadenza rinnovo contratto affitto — ${locatore}`;

  const messaggio = [
    "Ti segnalo che un contratto di affitto richiede attenzione.",
    "",
    `Locatore: ${locatore}`,
    `Conduttore: ${row.conduttore || "-"}`,
    `Immobile locato: ${row.descrizione_immobile_locato || "-"}`,
    `Codice identificativo registrazione: ${
      row.codice_identificativo_registrazione || "-"
    }`,
    `Data decorrenza: ${formatDateIT(getAffittoDecorrenza(row))}`,
    `Data scadenza annualità: ${
      row.data_prossima_scadenza ? formatDateIT(row.data_prossima_scadenza) : "-"
    }`,
    `Annualità corrente: ${row.contatore_anni}/${row.durata_contratto_anni}`,
    `Giorni mancanti: ${giorniMancanti}`,
    `Numero avviso: ${alertNumero}`,
    "",
    row.importo_registrazione != null
      ? `Imposta registrata a sistema: € ${Number(row.importo_registrazione).toFixed(2)}`
      : "Imposta registrata a sistema: -",
    "",
    "L’imposta comunicata è stata calcolata sulla base del valore registrato all’origine del contratto.",
    "In caso di variazione del canone di locazione o di altri elementi contrattuali rilevanti, l’importo dovrà essere aggiornato e ricalcolato prima del versamento.",
  ].join("\n");

  return { oggetto, messaggio };
}

async function markAffittoAlertSent(
  ids: string[],
  alertNumero: 1 | 2 | 3
): Promise<void> {
  if (ids.length === 0) return;

  const nowIso = new Date().toISOString();

  const payload =
    alertNumero === 1
      ? {
          alert1_inviato: true,
          alert1_inviato_at: nowIso,
        }
      : alertNumero === 2
      ? {
          alert2_inviato: true,
          alert2_inviato_at: nowIso,
        }
      : {
          alert3_inviato: true,
          alert3_inviato_at: nowIso,
        };

  const { error } = await supabase
    .from("tbscadaffitti" as any)
    .update(payload)
    .in("id", ids);

  if (error) throw error;
}

async function advanceOrCloseAffitto(row: RigaAffitti): Promise<void> {
  const nowIso = new Date().toISOString();

  if (row.contatore_anni >= row.durata_contratto_anni) {
    const { error } = await supabase
      .from("tbscadaffitti" as any)
      .update({
        alert3_inviato: true,
        alert3_inviato_at: nowIso,
        attivo: false,
        contratto_concluso: true,
      })
      .eq("id", row.id);

    if (error) throw error;
    return;
  }

  const nextAnnualita = row.contatore_anni + 1;
  const decorrenza = getAffittoDecorrenza(row);
  const nextScadenza = addYears(decorrenza, nextAnnualita - 1);

  const { error } = await supabase
    .from("tbscadaffitti" as any)
    .update({
      alert1_inviato: false,
      alert1_inviato_at: null,
      alert2_inviato: false,
      alert2_inviato_at: null,
      alert3_inviato: false,
      alert3_inviato_at: null,
      contatore_anni: nextAnnualita,
      data_prossima_scadenza: nextScadenza,
      attivo: true,
      contratto_concluso: false,
    })
    .eq("id", row.id);

  if (error) throw error;
}

async function processAffittiAutomatici(oggi: string): Promise<{
  emailsSent: number;
  processedRows: number;
}> {
  const { data, error } = await supabase
    .from("tbscadaffitti" as any)
    .select(`
      id,
      studio_id,
      cliente_id,
      utente_operatore_id,
      conduttore,
      descrizione_immobile_locato,
      data_registrazione_atto,
      data_rinnovo_atto,
      durata_contratto_anni,
      codice_identificativo_registrazione,
      importo_registrazione,
      contatore_anni,
      data_prossima_scadenza,
      emailperalert,
      alert1_inviato,
      alert1_inviato_at,
      alert2_inviato,
      alert2_inviato_at,
      alert3_inviato,
      alert3_inviato_at,
      attivo,
      rinnovo,
      contratto_concluso
    `)
    .eq("attivo", true)
    .eq("contratto_concluso", false)
    .not("data_prossima_scadenza", "is", null);

  if (error) throw error;

  const rows = ((data || []) as unknown) as RigaAffitti[];

  if (rows.length === 0) {
    return { emailsSent: 0, processedRows: 0 };
  }

  const clienteIds = Array.from(
    new Set(rows.map((r) => r.cliente_id).filter(Boolean))
  ) as string[];

  const clientiMap = new Map<string, ClienteAffittoLite>();

  if (clienteIds.length > 0) {
    const { data: clientiData, error: clientiError } = await supabase
      .from("tbclienti")
      .select("id, ragione_sociale")
      .in("id", clienteIds);

    if (clientiError) throw clientiError;

    const clienti = ((clientiData || []) as unknown) as ClienteAffittoLite[];
    for (const c of clienti) {
      clientiMap.set(c.id, c);
    }
  }

  let processedRows = 0;
  let emailsSent = 0;

  for (const row of rows) {
    let alertNumero: 1 | 2 | 3 | null = null;

    const dataAlert1 = getAffittoAlertDate(row, 1);
    const dataAlert2 = getAffittoAlertDate(row, 2);
    const dataAlert3 = getAffittoAlertDate(row, 3);

    if (dataAlert1 === oggi && !row.alert1_inviato) {
      alertNumero = 1;
    } else if (dataAlert2 === oggi && !row.alert2_inviato) {
      alertNumero = 2;
    } else if (dataAlert3 === oggi && !row.alert3_inviato) {
      alertNumero = 3;
    }

    if (!alertNumero) continue;

    processedRows += 1;

    const destinatari: DestinatarioEmail[] = [];
    const seenEmails = new Set<string>();

    if (row.utente_operatore_id) {
      const utente = await loadDestinatarioByUserId(row.utente_operatore_id);
      if (utente?.email && !seenEmails.has(utente.email)) {
        destinatari.push(utente);
        seenEmails.add(utente.email);
      }
    }

    if (row.emailperalert && !seenEmails.has(row.emailperalert)) {
      destinatari.push({
        id: `affitto-${row.id}`,
        email: row.emailperalert,
        nome: row.conduttore || "Destinatario contratto affitto",
      });
      seenEmails.add(row.emailperalert);
    }

    if (destinatari.length === 0) continue;

    const locatore =
      clientiMap.get(row.cliente_id)?.ragione_sociale ||
      row.cliente_id ||
      "Locatore";

    const { oggetto, messaggio } = buildAffittoEmailMessage({
      row,
      locatore,
      alertNumero,
    });

    const sentCount = await sendEmails(destinatari, oggetto, messaggio);

    if (sentCount > 0) {
      if (alertNumero === 3) {
        await advanceOrCloseAffitto(row);
      } else {
        await markAffittoAlertSent([row.id], alertNumero);
      }

      emailsSent += sentCount;
    }
  }

  return {
    emailsSent,
    processedRows,
  };
}

async function processTable(params: {
  tableName: string;
  titolo: string;
  select: string;
  filterOpenRows: (
    rows: Array<
      RigaScadenzarioBase & {
        utente_operatore_id: string | null;
        utente_professionista_id: string | null;
      }
    >
  ) => Array<
    RigaScadenzarioBase & {
      utente_operatore_id: string | null;
      utente_professionista_id: string | null;
    }
  >;
  alertNumero: 1 | 2;
  oggi: string;
  forceSend?: boolean;
}): Promise<{ emailsSent: number; processedRows: number }> {
  const {
    tableName,
    titolo,
    select,
    filterOpenRows,
    alertNumero,
    oggi,
    forceSend,
  } = params;

  const { data, error } = await supabase
    .from(tableName as any)
    .select(select)
    .not("data_scadenza_adempimento", "is", null);

  if (error) throw error;

  const rows = ((data || []) as unknown) as Array<
    RigaScadenzarioBase & {
      utente_operatore_id: string | null;
      utente_professionista_id: string | null;
    }
  >;

  const dueTodayRows = getRowsForToday(rows, oggi, alertNumero, forceSend);
  const openRows = filterOpenRows(dueTodayRows);
  const grouped = groupByUserId(openRows);

  let sentTotal = 0;

  for (const [userId, userRows] of grouped.entries()) {
    if (userRows.length === 0) continue;

    const destinatario = await loadDestinatarioByUserId(userId);
    if (!destinatario) continue;

    const { oggetto, messaggio } = buildEmailMessage(
      titolo,
      userRows,
      alertNumero
    );

    const sentCount = await sendEmails([destinatario], oggetto, messaggio);

    if (sentCount > 0) {
      await markAlertSent(
        tableName,
        userRows.map((r) => r.id),
        alertNumero
      );
      sentTotal += sentCount;
    }
  }

  return {
    emailsSent: sentTotal,
    processedRows: openRows.length,
  };
}

export const scadenzariAutomaticiService = {
  async processaScadenzariAutomatici(options?: {
    forceAlert1?: boolean;
    forceAlert2?: boolean;
  }): Promise<ProcessResult> {
    const result: ProcessResult = {
      processedTables: 0,
      processedRows: 0,
      emailsSent: 0,
      errors: [],
    };

    const oggi = isoDate(startOfDay(new Date()));

    const configs = [
      {
        tableName: "tbscadiva",
        titolo: "IVA",
        select:
          "id, nominativo, studio_id, utente_operatore_id, utente_professionista_id, data_scadenza_adempimento, data_avviso_1, data_avviso_2, alert_1_inviato, alert_2_inviato, conferma_riga",
        filterOpenRows: filterOpenIvaRows,
      },
      {
        tableName: "tbscadccgg",
        titolo: "CCGG",
        select:
          "id, nominativo, studio_id, utente_operatore_id, utente_professionista_id, data_scadenza_adempimento, data_avviso_1, data_avviso_2, alert_1_inviato, alert_2_inviato, conferma_riga",
        filterOpenRows: filterOpenCcggRows,
      },
      {
        tableName: "tbscadcu",
        titolo: "CU",
        select:
          "id, nominativo, studio_id, utente_operatore_id, utente_professionista_id, data_scadenza_adempimento, data_avviso_1, data_avviso_2, alert_1_inviato, alert_2_inviato, conferma_riga",
        filterOpenRows: filterOpenCuRows,
      },
      {
        tableName: "tbscadfiscali",
        titolo: "Fiscali",
        select:
          "id, nominativo, studio_id, utente_operatore_id, utente_professionista_id, data_scadenza_adempimento, data_avviso_1, data_avviso_2, alert_1_inviato, alert_2_inviato, conferma_riga",
        filterOpenRows: filterOpenFiscaliRows,
      },
      {
        tableName: "tbscadbilanci",
        titolo: "Bilanci",
        select:
          "id, nominativo, studio_id, utente_operatore_id, utente_professionista_id, data_scadenza_adempimento, data_avviso_1, data_avviso_2, alert_1_inviato, alert_2_inviato, conferma_riga",
        filterOpenRows: filterOpenBilanciRows,
      },
      {
        tableName: "tbscad770",
        titolo: "770",
        select:
          "id, nominativo, studio_id, utente_operatore_id, utente_professionista_id, data_scadenza_adempimento, data_avviso_1, data_avviso_2, alert_1_inviato, alert_2_inviato, conferma_riga",
        filterOpenRows: filterOpen770Rows,
      },
    ] as const;

    for (const config of configs) {
      try {
        result.processedTables += 1;

        const alert1Result = await processTable({
          ...config,
          alertNumero: 1,
          oggi,
          forceSend: options?.forceAlert1 === true,
        });

        const alert2Result = await processTable({
          ...config,
          alertNumero: 2,
          oggi,
          forceSend: options?.forceAlert2 === true,
        });

        result.emailsSent += alert1Result.emailsSent + alert2Result.emailsSent;
        result.processedRows +=
          alert1Result.processedRows + alert2Result.processedRows;
      } catch (error: any) {
        result.errors.push(
          `Errore su ${config.titolo}: ${
            error?.message || "errore sconosciuto"
          }`
        );
      }
    }

    try {
      result.processedTables += 1;

      const affittiResult = await processAffittiAutomatici(oggi);

      result.emailsSent += affittiResult.emailsSent;
      result.processedRows += affittiResult.processedRows;
    } catch (error: any) {
      result.errors.push(
        `Errore su Affitti: ${error?.message || "errore sconosciuto"}`
      );
    }

    return result;
  },
};
