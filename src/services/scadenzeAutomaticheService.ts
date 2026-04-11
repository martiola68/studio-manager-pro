import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

import { sendComunicazioneEmail } from "@/services/emailService";

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

async function loadDestinatariInterniPerScadenza(
  tipo: TipoScadenza
): Promise<string[]> {
  if (!tipo.studio_id) return [];

  const settori: string[] = [];
  if (tipo.settore_fiscale) settori.push("Fiscale");
  if (tipo.settore_lavoro) settori.push("Lavoro");
  if (tipo.settore_consulenza) settori.push("Consulenza");

  if (settori.length === 0) return [];

  const { data, error } = await supabase
    .from("tbutenti")
    .select("id")
    .eq("attivo", true)
    .eq("studio_id", tipo.studio_id)
    .in("settore", settori);

  if (error) throw error;

  return [...new Set((data || []).map((u: any) => u.id).filter(Boolean))];
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

async function inviaEmailScadenza(
  tipo: TipoScadenza,
  tipoAlert: AlertType,
  giorniMancanti: number
): Promise<boolean> {
  const destinatariIds = await loadDestinatariInterniPerScadenza(tipo);
  if (destinatariIds.length === 0) return false;

  const nominativi = await loadNominativiPerTipoScadenza(tipo.id);
  const { oggetto, messaggio } = buildMessaggioScadenza(
    tipo,
    tipoAlert,
    nominativi,
    giorniMancanti
  );

  const result = await sendComunicazioneEmail({
    tipo: "interna",
    destinatariIds,
    oggetto,
    messaggio,
  });

  return !!result.success;
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
