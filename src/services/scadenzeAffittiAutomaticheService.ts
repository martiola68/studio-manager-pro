import { createClient } from "@supabase/supabase-js";
import { sendEmailServer } from "@/services/sendEmailServer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

type ContrattoAffittoRow = {
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

type ClienteLite = {
  id: string;
  ragione_sociale: string | null;
};

type UtenteLite = {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
};

function normalizeDate(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(date: Date) {
  return normalizeDate(date).toISOString().slice(0, 10);
}

function parseISODate(value: string) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addYears(dateString: string, yearsToAdd: number) {
  const d = parseISODate(dateString);
  d.setFullYear(d.getFullYear() + yearsToAdd);
  return toISODate(d);
}

function subtractDays(dateString: string, days: number) {
  const d = parseISODate(dateString);
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

function formatDateIT(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("it-IT");
}

function getDecorrenza(row: ContrattoAffittoRow) {
  return row.rinnovo && row.data_rinnovo_atto
    ? row.data_rinnovo_atto
    : row.data_registrazione_atto;
}

function getDateTriggers(dataScadenza: string) {
  return {
    alert1: subtractDays(dataScadenza, 30),
    alert2: subtractDays(dataScadenza, 15),
    alert3: dataScadenza,
  };
}

function getOperatoreLabel(utente?: UtenteLite) {
  if (!utente) return "-";
  const fullName = `${utente.cognome || ""} ${utente.nome || ""}`.trim();
  return fullName || utente.email || "-";
}

function getImpostaMessage(importoRegistrazione: number | null) {
  if (importoRegistrazione == null) {
    return "L’imposta comunicata è stata calcolata sulla base del valore registrato all’origine del contratto. In caso di variazione del canone di locazione o di altri elementi contrattuali rilevanti, l’importo dovrà essere aggiornato e ricalcolato prima del versamento.";
  }

  return `L’imposta comunicata per questa annualità è pari a € ${Number(
    importoRegistrazione
  ).toFixed(2)} ed è stata calcolata sulla base del valore registrato all’origine del contratto. In caso di variazione del canone di locazione o di altri elementi contrattuali rilevanti, l’importo dovrà essere aggiornato e ricalcolato prima del versamento.`;
}

function buildEmailSubject(params: {
  locatore: string;
  annualita: number;
  tipoAlert: 1 | 2 | 3;
}) {
  return `Promemoria rinnovo contratto affitto - ${params.locatore} - Annualità ${params.annualita} - Alert ${params.tipoAlert}`;
}

function buildEmailHtml(params: {
  locatore: string;
  conduttore: string;
  immobile: string;
  codiceRegistrazione: string;
  decorrenza: string;
  scadenza: string;
  annualita: number;
  durata: number;
  tipoAlert: 1 | 2 | 3;
  importoRegistrazione: number | null;
  operatore: string;
}) {
  const introByAlert = {
    1: "Si ricorda che tra 30 giorni scadrà il termine per il rinnovo dell’annualità del contratto di affitto.",
    2: "Si ricorda che tra 15 giorni scadrà il termine per il rinnovo dell’annualità del contratto di affitto.",
    3: "Si ricorda che in data odierna scade il termine per il rinnovo dell’annualità del contratto di affitto.",
  } as const;

 return `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; background:#f3f4f6; font-family:Arial, Helvetica, sans-serif; color:#111827;">
  <div style="max-width:720px; margin:0 auto; padding:28px 16px;">
    <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
      <div style="background:#1d4ed8; color:#ffffff; padding:22px 26px;">
        <div style="font-size:20px; font-weight:700;">Studio Manager Pro</div>
        <div style="font-size:13px; margin-top:4px; opacity:0.9;">
          Promemoria rinnovo contratto di affitto
        </div>
      </div>

      <div style="padding:26px;">
        <p style="margin:0 0 16px 0; font-size:15px;">
          Gentile utente,
        </p>

        <p style="margin:0 0 18px 0; font-size:15px; line-height:1.6;">
          ${introByAlert[params.tipoAlert]}
        </p>

        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:18px; margin:22px 0;">
          <div style="font-size:13px; color:#1d4ed8; font-weight:700; text-transform:uppercase; margin-bottom:12px;">
            Dettagli contratto
          </div>

          <table style="width:100%; border-collapse:collapse; font-size:14px;">
            <tr>
              <td style="padding:8px 0; color:#6b7280;">Locatore</td>
              <td style="padding:8px 0; text-align:right; font-weight:700;">${params.locatore || "-"}</td>
            </tr>
            <tr>
              <td style="padding:8px 0; color:#6b7280;">Conduttore</td>
              <td style="padding:8px 0; text-align:right; font-weight:700;">${params.conduttore || "-"}</td>
            </tr>
            <tr>
              <td style="padding:8px 0; color:#6b7280;">Immobile locato</td>
              <td style="padding:8px 0; text-align:right; font-weight:700;">${params.immobile || "-"}</td>
            </tr>
            <tr>
              <td style="padding:8px 0; color:#6b7280;">Codice registrazione</td>
              <td style="padding:8px 0; text-align:right; font-weight:700;">${params.codiceRegistrazione || "-"}</td>
            </tr>
            <tr>
              <td style="padding:8px 0; color:#6b7280;">Data decorrenza</td>
              <td style="padding:8px 0; text-align:right; font-weight:700;">${formatDateIT(params.decorrenza)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0; color:#6b7280;">Scadenza annualità</td>
              <td style="padding:8px 0; text-align:right; font-weight:700;">${formatDateIT(params.scadenza)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0; color:#6b7280;">Annualità</td>
              <td style="padding:8px 0; text-align:right; font-weight:700;">${params.annualita}/${params.durata}</td>
            </tr>
          </table>
        </div>

        <div style="margin:20px 0; padding:14px 16px; background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; font-size:14px; line-height:1.6;">
          ${getImpostaMessage(params.importoRegistrazione)}
        </div>

        <p style="margin:0 0 12px 0; font-size:15px; line-height:1.6;">
          Si consiglia di verificare la posizione e procedere con gli adempimenti necessari.
        </p>

        <p style="margin:26px 0 0 0; font-size:15px;">
          Cordiali saluti,<br/>
          <strong>${params.operatore || "-"}</strong>
        </p>
      </div>

      <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:16px 26px; text-align:center; font-size:12px; color:#6b7280;">
        Email automatica — non rispondere a questo messaggio.
      </div>
    </div>
  </div>
</body>
</html>
`.trim();
}

function buildEmailText(params: {
  locatore: string;
  conduttore: string;
  immobile: string;
  codiceRegistrazione: string;
  decorrenza: string;
  scadenza: string;
  annualita: number;
  durata: number;
  tipoAlert: 1 | 2 | 3;
  importoRegistrazione: number | null;
  operatore: string;
}) {
  const introByAlert = {
    1: "Si ricorda che tra 30 giorni scadrà il termine per il rinnovo dell’annualità del contratto di affitto.",
    2: "Si ricorda che tra 15 giorni scadrà il termine per il rinnovo dell’annualità del contratto di affitto.",
    3: "Si ricorda che in data odierna scade il termine per il rinnovo dell’annualità del contratto di affitto.",
  } as const;

  return [
    "Gentile utente,",
    "",
    introByAlert[params.tipoAlert],
    "",
    "Dettagli contratto",
    `Locatore: ${params.locatore || "-"}`,
    `Conduttore: ${params.conduttore || "-"}`,
    `Immobile locato: ${params.immobile || "-"}`,
    `Codice identificativo registrazione: ${params.codiceRegistrazione || "-"}`,
    `Data decorrenza: ${formatDateIT(params.decorrenza)}`,
    `Scadenza annualità: ${formatDateIT(params.scadenza)}`,
    `Annualità: ${params.annualita}/${params.durata}`,
    "",
    getImpostaMessage(params.importoRegistrazione),
    "",
    `Operatore incaricato: ${params.operatore || "-"}`,
    "",
    "Questa comunicazione è stata generata automaticamente dallo scadenzario affitti.",
  ].join("\n");
}

export async function processaScadenzeAffittiAutomatiche() {
  const today = toISODate(new Date());

  const result = {
    processed: 0,
    alert1Sent: 0,
    alert2Sent: 0,
    alert3Sent: 0,
    advanced: 0,
    closed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  const { data, error } = await (supabase as any)
    .from("tbscadaffitti")
    .select("*")
    .eq("attivo", true)
    .eq("contratto_concluso", false);

  if (error) {
    throw new Error(`Errore caricamento contratti affitto: ${error.message}`);
  }

  const contratti = ((data as unknown) as ContrattoAffittoRow[]) || [];

  const clienteIds = Array.from(
    new Set(contratti.map((r) => r.cliente_id).filter(Boolean))
  ) as string[];

  const utenteIds = Array.from(
    new Set(
      contratti
        .map((r) => r.utente_operatore_id)
        .filter((v): v is string => !!v)
    )
  );

  let clientiMap = new Map<string, ClienteLite>();
  let utentiMap = new Map<string, UtenteLite>();

  if (clienteIds.length > 0) {
    const { data: clientiData, error: clientiError } = await supabase
      .from("tbclienti")
      .select("id, ragione_sociale")
      .in("id", clienteIds);

    if (clientiError) {
      throw new Error(`Errore caricamento locatori: ${clientiError.message}`);
    }

    const clienti = ((clientiData as unknown) as ClienteLite[]) || [];
    clientiMap = new Map(clienti.map((c) => [c.id, c]));
  }

  if (utenteIds.length > 0) {
    const { data: utentiData, error: utentiError } = await supabase
      .from("tbutenti")
      .select("id, nome, cognome, email")
      .in("id", utenteIds);

    if (utentiError) {
      throw new Error(`Errore caricamento utenti: ${utentiError.message}`);
    }

    const utenti = ((utentiData as unknown) as UtenteLite[]) || [];
    utentiMap = new Map(utenti.map((u) => [u.id, u]));
  }

  for (const row of contratti) {
    try {
      result.processed += 1;

      if (!row.utente_operatore_id) {
        result.skipped += 1;
        continue;
      }

      const locatore =
        clientiMap.get(row.cliente_id)?.ragione_sociale?.trim() || "Locatore";
      const utente = utentiMap.get(row.utente_operatore_id);
      const operatore = getOperatoreLabel(utente);
      const decorrenza = getDecorrenza(row);
      const triggers = getDateTriggers(row.data_prossima_scadenza);

      let tipoAlert: 1 | 2 | 3 | null = null;

      if (today === triggers.alert1 && !row.alert1_inviato) tipoAlert = 1;
      else if (today === triggers.alert2 && !row.alert2_inviato) tipoAlert = 2;
      else if (today === triggers.alert3 && !row.alert3_inviato) tipoAlert = 3;

      if (!tipoAlert) {
        result.skipped += 1;
        continue;
      }

      const destinatari = [utente?.email || "", row.emailperalert || ""]
        .filter(Boolean)
        .filter((value, index, arr) => arr.indexOf(value) === index);

      if (destinatari.length === 0) {
        result.errors.push(
          `Contratto ${row.id}: nessun destinatario disponibile`
        );
        continue;
      }

      const subject = buildEmailSubject({
        locatore,
        annualita: row.contatore_anni,
        tipoAlert,
      });

      const html = buildEmailHtml({
        locatore,
        conduttore: row.conduttore || "-",
        immobile: row.descrizione_immobile_locato || "-",
        codiceRegistrazione: row.codice_identificativo_registrazione || "-",
        decorrenza,
        scadenza: row.data_prossima_scadenza,
        annualita: row.contatore_anni,
        durata: row.durata_contratto_anni,
        tipoAlert,
        importoRegistrazione: row.importo_registrazione,
        operatore,
      });

      const text = buildEmailText({
        locatore,
        conduttore: row.conduttore || "-",
        immobile: row.descrizione_immobile_locato || "-",
        codiceRegistrazione: row.codice_identificativo_registrazione || "-",
        decorrenza,
        scadenza: row.data_prossima_scadenza,
        annualita: row.contatore_anni,
        durata: row.durata_contratto_anni,
        tipoAlert,
        importoRegistrazione: row.importo_registrazione,
        operatore,
      });

      let inviiRiusciti = 0;

      for (const destinatario of destinatari) {
      const { data: studio, error: studioError } = await (supabase as any)
  .from("tbstudio")
  .select("microsoft_connection_id")
  .eq("id", row.studio_id)
  .maybeSingle();

if (studioError || !studio?.microsoft_connection_id) {
  result.errors.push(
    `Contratto ${row.id}: microsoft_connection_id studio mancante`
  );
  continue;
}

const emailResult = await sendEmailServer({
  senderUserId: row.utente_operatore_id,
  microsoftConnectionId: studio.microsoft_connection_id,
  to: destinatario,
  subject,
  html,
});

        if (emailResult.success) {
          inviiRiusciti += 1;
        } else {
          result.errors.push(
            `Contratto ${row.id}: invio fallito verso ${destinatario} - ${emailResult.error || "errore sconosciuto"}`
          );
        }
      }

      if (inviiRiusciti === 0) {
        continue;
      }

      const nowIso = new Date().toISOString();

      if (tipoAlert === 1) {
        const { error: updError } = await (supabase as any)
          .from("tbscadaffitti")
          .update({
            alert1_inviato: true,
            alert1_inviato_at: nowIso,
          })
          .eq("id", row.id);

        if (updError) {
          throw new Error(`Errore update alert1: ${updError.message}`);
        }

        result.alert1Sent += inviiRiusciti;
        continue;
      }

      if (tipoAlert === 2) {
        const { error: updError } = await (supabase as any)
          .from("tbscadaffitti")
          .update({
            alert2_inviato: true,
            alert2_inviato_at: nowIso,
          })
          .eq("id", row.id);

        if (updError) {
          throw new Error(`Errore update alert2: ${updError.message}`);
        }

        result.alert2Sent += inviiRiusciti;
        continue;
      }

      if (row.contatore_anni >= row.durata_contratto_anni) {
        const { error: closeError } = await (supabase as any)
          .from("tbscadaffitti")
          .update({
            alert3_inviato: true,
            alert3_inviato_at: nowIso,
            attivo: false,
            contratto_concluso: true,
          })
          .eq("id", row.id);

        if (closeError) {
          throw new Error(`Errore chiusura contratto: ${closeError.message}`);
        }

        result.alert3Sent += inviiRiusciti;
        result.closed += 1;
        continue;
      }

      const nextAnnualita = row.contatore_anni + 1;
      const nextScadenza = addYears(decorrenza, nextAnnualita - 1);

      const { error: advanceError } = await (supabase as any)
        .from("tbscadaffitti")
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

      if (advanceError) {
        throw new Error(`Errore avanzamento annualità: ${advanceError.message}`);
      }

      result.alert3Sent += inviiRiusciti;
      result.advanced += 1;
    } catch (err: any) {
      result.errors.push(
        `Contratto ${row.id}: ${err?.message || "Errore sconosciuto"}`
      );
    }
  }

  return result;
}
