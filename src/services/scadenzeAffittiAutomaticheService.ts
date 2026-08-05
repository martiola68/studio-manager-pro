import { createClient } from "@supabase/supabase-js";

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

  data_registrazione_atto: string;
  data_rinnovo_atto: string | null;

  durata_contratto_anni: number;
  contatore_anni: number;

  data_prossima_scadenza: string;

  attivo: boolean;
  rinnovo: boolean;
  contratto_concluso: boolean;
};

type ScadenzaCentraleRow = {
  id: string;
};

type DestinatarioRow = {
  utente_id: string | null;
  destinatario_email: string | null;
  tipo_destinatario: "interno" | "esterno";
};

type AlertLogRow = {
  destinatario_utente_id: string | null;
  destinatario_email: string | null;
  tipo_alert: string | null;
  esito: string;
};

function normalizzaData(
  valore: string
): string {
  return String(valore)
    .trim()
    .slice(0, 10);
}

function parseISODate(
  valore: string
): Date {
  const data = new Date(
    `${normalizzaData(valore)}T12:00:00Z`
  );

  if (Number.isNaN(data.getTime())) {
    throw new Error(
      `Data non valida: ${valore}`
    );
  }

  return data;
}

function toISODate(
  data: Date
): string {
  return data
    .toISOString()
    .slice(0, 10);
}

function addYears(
  dataString: string,
  anni: number
): string {
  const data =
    parseISODate(dataString);

  data.setUTCFullYear(
    data.getUTCFullYear() + anni
  );

  return toISODate(data);
}

function getDecorrenza(
  contratto: ContrattoAffittoRow
): string {
  return (
    contratto.rinnovo &&
    contratto.data_rinnovo_atto
      ? normalizzaData(
          contratto.data_rinnovo_atto
        )
      : normalizzaData(
          contratto.data_registrazione_atto
        )
  );
}

function chiaveDestinatario(params: {
  utenteId?: string | null;
  email?: string | null;
}): string | null {
  if (params.utenteId) {
    return `utente:${params.utenteId}`;
  }

  const email =
    String(params.email || "")
      .trim()
      .toLowerCase();

  if (email) {
    return `email:${email}`;
  }

  return null;
}

/**
 * Questo servizio NON invia più email.
 *
 * Le email vengono inviate esclusivamente da:
 * /api/scadenze-centrale/processa-alert
 *
 * Qui gestiamo soltanto:
 * - avanzamento annualità;
 * - chiusura del contratto;
 * - aggiornamento della prossima scadenza.
 */
export async function processaScadenzeAffittiAutomatiche() {
  const oggi =
    new Date()
      .toISOString()
      .slice(0, 10);

  const result = {
    processed: 0,
    advanced: 0,
    closed: 0,
    waitingAlerts: 0,
    skipped: 0,
    errors: [] as string[],
  };

  const {
    data,
    error,
  } = await supabase
    .from("tbscadaffitti")
    .select(`
      id,
      studio_id,
      cliente_id,
      utente_operatore_id,
      data_registrazione_atto,
      data_rinnovo_atto,
      durata_contratto_anni,
      contatore_anni,
      data_prossima_scadenza,
      attivo,
      rinnovo,
      contratto_concluso
    `)
    .eq("attivo", true)
    .eq(
      "contratto_concluso",
      false
    )
    .lte(
      "data_prossima_scadenza",
      oggi
    );

  if (error) {
    throw new Error(
      `Errore caricamento contratti affitto: ${error.message}`
    );
  }

  const contratti =
    (data || []) as ContrattoAffittoRow[];

  for (const contratto of contratti) {
    try {
      result.processed += 1;

      const {
        data: scadenza,
        error: scadenzaError,
      } = await supabase
        .from("tbscadenze_centrale")
        .select("id")
        .eq(
          "studio_id",
          contratto.studio_id
        )
        .eq(
          "origine_tabella",
          "tbscadaffitti"
        )
        .eq(
          "origine_record_id",
          contratto.id
        )
        .eq(
          "tipo_scadenza",
          "rinnovo_annualita_affitto"
        )
        .maybeSingle();

      if (scadenzaError) {
        throw new Error(
          `Errore ricerca scadenza centrale: ${scadenzaError.message}`
        );
      }

      if (!scadenza?.id) {
        result.skipped += 1;

        result.errors.push(
          `Contratto ${contratto.id}: scadenza centrale non trovata`
        );

        continue;
      }

      const scadenzaCentrale =
        scadenza as ScadenzaCentraleRow;

      /*
       * Recuperiamo tutti i destinatari
       * attivi previsti per il contratto.
       */
      const {
        data: destinatariData,
        error: destinatariError,
      } = await supabase
        .from(
          "tbscadenze_centrale_destinatari"
        )
        .select(`
          utente_id,
          destinatario_email,
          tipo_destinatario
        `)
        .eq(
          "studio_id",
          contratto.studio_id
        )
        .eq(
          "scadenza_id",
          scadenzaCentrale.id
        )
        .eq("attivo", true);

      if (destinatariError) {
        throw new Error(
          `Errore destinatari affitto: ${destinatariError.message}`
        );
      }

      const destinatari =
        (destinatariData ||
          []) as DestinatarioRow[];

      const chiaviDestinatari =
        new Set<string>();

      destinatari.forEach(
        (destinatario) => {
          const chiave =
            chiaveDestinatario({
              utenteId:
                destinatario.utente_id,

              email:
                destinatario
                  .destinatario_email,
            });

          if (chiave) {
            chiaviDestinatari.add(
              chiave
            );
          }
        }
      );

      if (
        chiaviDestinatari.size === 0
      ) {
        result.skipped += 1;

        result.errors.push(
          `Contratto ${contratto.id}: nessun destinatario attivo`
        );

        continue;
      }

      /*
       * Consideriamo validi:
       * - alert del giorno della scadenza;
       * - eventuale alert di scadenza superata.
       *
       * In questo modo il contratto può essere
       * avanzato anche se l'invio avviene dopo
       * il giorno esatto della scadenza.
       */
      const {
        data: logData,
        error: logError,
      } = await supabase
        .from(
          "tbscadenze_centrale_alert_log"
        )
        .select(`
          destinatario_utente_id,
          destinatario_email,
          tipo_alert,
          esito
        `)
        .eq(
          "studio_id",
          contratto.studio_id
        )
        .eq(
          "scadenza_id",
          scadenzaCentrale.id
        )
        .eq("esito", "inviato")
        .in(
          "tipo_alert",
          [
            "scade_oggi",
            "scadenza_superata",
          ]
        );

      if (logError) {
        throw new Error(
          `Errore verifica alert affitto: ${logError.message}`
        );
      }

      const logInviati =
        (logData ||
          []) as AlertLogRow[];

      const chiaviInviate =
        new Set<string>();

      logInviati.forEach((log) => {
        const chiave =
          chiaveDestinatario({
            utenteId:
              log.destinatario_utente_id,

            email:
              log.destinatario_email,
          });

        if (chiave) {
          chiaviInviate.add(
            chiave
          );
        }
      });

      const tuttiInviati =
        Array.from(
          chiaviDestinatari
        ).every((chiave) =>
          chiaviInviate.has(chiave)
        );

      /*
       * Non avanziamo il contratto finché
       * tutti i destinatari previsti non
       * hanno ricevuto l'alert.
       */
      if (!tuttiInviati) {
        result.waitingAlerts += 1;
        continue;
      }

      const nowIso =
        new Date().toISOString();

      /*
       * Ultima annualità:
       * chiudiamo il contratto.
       */
      if (
        Number(
          contratto.contatore_anni
        ) >=
        Number(
          contratto
            .durata_contratto_anni
        )
      ) {
        const {
          error: closeError,
        } = await supabase
          .from("tbscadaffitti")
          .update({
            alert3_inviato: true,
            alert3_inviato_at:
              nowIso,

            attivo: false,

            contratto_concluso:
              true,
          })
          .eq("id", contratto.id)
          .eq(
            "studio_id",
            contratto.studio_id
          );

        if (closeError) {
          throw new Error(
            `Errore chiusura contratto: ${closeError.message}`
          );
        }

        result.closed += 1;
        continue;
      }

      /*
       * Contratto ancora attivo:
       * passiamo all'annualità successiva.
       */
      const nextAnnualita =
        Number(
          contratto.contatore_anni
        ) + 1;

      const decorrenza =
        getDecorrenza(contratto);

      const nextScadenza =
        addYears(
          decorrenza,
          nextAnnualita - 1
        );

      const {
        error: advanceError,
      } = await supabase
        .from("tbscadaffitti")
        .update({
          alert1_inviato: false,
          alert1_inviato_at: null,

          alert2_inviato: false,
          alert2_inviato_at: null,

          alert3_inviato: false,
          alert3_inviato_at: null,

          contatore_anni:
            nextAnnualita,

          data_prossima_scadenza:
            nextScadenza,

          attivo: true,

          contratto_concluso:
            false,
        })
        .eq("id", contratto.id)
        .eq(
          "studio_id",
          contratto.studio_id
        );

      if (advanceError) {
        throw new Error(
          `Errore avanzamento annualità: ${advanceError.message}`
        );
      }

      result.advanced += 1;
    } catch (error: any) {
      result.errors.push(
        `Contratto ${contratto.id}: ${
          error?.message ||
          "Errore sconosciuto"
        }`
      );
    }
  }

  return result;
}
