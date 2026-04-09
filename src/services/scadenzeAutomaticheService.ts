import { supabase } from "@/lib/supabase/client";

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

export const scadenzeAutomaticheService = {
  async processaTipiScadenzeAutomatiche(): Promise<ProcessResult> {
    const result: ProcessResult = {
      processed: 0,
      alertsCreated: 0,
      renewals: 0,
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
          }
        }

        if (giorniMancanti === preavviso2) {
          const alreadySent = await alertAlreadySent(tipo.id, annoInvio, "preavviso_2");

          if (!alreadySent) {
            await createAlertRecord(tipo.id, annoInvio, "preavviso_2");
            result.alertsCreated += 1;
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
