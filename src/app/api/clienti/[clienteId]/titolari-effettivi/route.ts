import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  classificaPartecipazione,
  type PartecipazioneDiretta,
} from "@/lib/gruppiSocietari";

import {
  calcolaTitolariEffettiviAllaData,
  filtraOrganiResidualAllaData,
  raccogliDateVariazione,
  type OrganoResidualTemporale,
  type PartecipazioneTemporale,
  type TitolareEffettivoTemporale,
} from "@/lib/titolariEffettiviTemporali";

type ClienteRow = {
  id: string;
  ragione_sociale: string | null;
  codice_fiscale: string | null;
  tipo_cliente: string | null;
  cliente: boolean | null;
};

type PartecipazioneRow = {
  id: string;
  cliente_id: string;
  soggetto_cliente_id: string;

  percentuale_partecipazione:
    | number
    | string
    | null;

  tipo_soggetto: string | null;
  ruolo: string | null;
  attivo: boolean | null;

  data_nomina: string | null;
  data_scadenza: string | null;
  data_cessazione: string | null;
};

type OrganoResidualRow = {
  id: string;
  cliente_id: string;
  soggetto_cliente_id: string;

  ruolo: string | null;
  carica: string | null;
  principale: boolean | null;
  attivo: boolean | null;

  data_nomina: string | null;
  data_scadenza: string | null;
  data_cessazione: string | null;
};

const RUOLI_RESIDUALI = [
  "amministratore",
  "amministratore_unico",
  "amministratore_delegato",
  "presidente_cda",
  "liquidatore",
  "rappresentante_legale",
];

function normalizzaData(
  valore: string | null | undefined
): string | null {
  if (!valore) {
    return null;
  }

  return String(valore).slice(0, 10);
}

function dataOggi(): string {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function aggiungiGiorni(
  dataInput: string,
  giorni: number
): string {
  const data = new Date(
    `${dataInput}T12:00:00Z`
  );

  data.setUTCDate(
    data.getUTCDate() + giorni
  );

  return data
    .toISOString()
    .slice(0, 10);
}

function firmaTitolari(
  titolari: Array<{
    chiave_soggetto?: string | null;
    persona_id?: string | null;
    persona_nome?: string | null;
  }>
): string[] {
  return Array.from(
    new Set(
      titolari.map((titolare) =>
        String(
          titolare.chiave_soggetto ||
            titolare.persona_id ||
            titolare.persona_nome ||
            ""
        )
          .trim()
          .toUpperCase()
      )
    )
  )
    .filter(Boolean)
    .sort();
}

function firmeUguali(
  prima: string[],
  dopo: string[]
): boolean {
  if (prima.length !== dopo.length) {
    return false;
  }

  return prima.every(
    (valore, indice) =>
      valore === dopo[indice]
  );
}

function isPersonaFisica(
  tipoCliente: string | null | undefined
): boolean {
  return String(tipoCliente || "")
    .toLowerCase()
    .includes("persona fisica");
}

function costruisciChiaveSoggetto(params: {
  personaId?: string | null;
  codiceFiscale?: string | null;
  personaNome?: string | null;
}): string {
  const codiceFiscale = String(
    params.codiceFiscale || ""
  )
    .trim()
    .toUpperCase();

  if (codiceFiscale) {
    return codiceFiscale;
  }

  if (params.personaId) {
    return String(params.personaId);
  }

  return String(params.personaNome || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

export async function GET(
  req: NextRequest,
  context: {
    params: Promise<{
      clienteId: string;
    }>;
  }
) {
  try {
    const {
      clienteId,
    } = await context.params;

    if (!clienteId) {
      return NextResponse.json(
        {
          error: "clienteId mancante",
        },
        {
          status: 400,
        }
      );
    }

    const {
      searchParams,
    } = new URL(req.url);

    const dataRiferimento =
      searchParams.get("data_riferimento") ||
      dataOggi();

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        dataRiferimento
      )
    ) {
      return NextResponse.json(
        {
          error:
            "data_riferimento non valida. Usare il formato AAAA-MM-GG.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase = createClient(
      process.env
        .NEXT_PUBLIC_SUPABASE_URL!,
      process.env
        .SUPABASE_SERVICE_ROLE_KEY!
    );

    /*
     * Carichiamo tutte le anagrafiche perché
     * servono per ricostruire i percorsi
     * societari diretti e indiretti.
     */
    const [
      clienteRes,
      clientiRes,
      partecipazioniRes,
      organiResidualRes,
    ] = await Promise.all([
      supabase
        .from("tbclienti")
        .select(`
          id,
          ragione_sociale,
          codice_fiscale,
          tipo_cliente,
          cliente
        `)
        .eq("id", clienteId)
        .maybeSingle(),

      supabase
        .from("tbclienti")
        .select(`
          id,
          ragione_sociale,
          codice_fiscale,
          tipo_cliente,
          cliente
        `),

      /*
       * Non filtriamo solo attivo=true:
       * per il calcolo storico servono anche
       * le partecipazioni cessate.
       */
      supabase
        .from("tbclienti_organi")
        .select(`
          id,
          cliente_id,
          soggetto_cliente_id,
          percentuale_partecipazione,
          tipo_soggetto,
          ruolo,
          attivo,
          data_nomina,
          data_scadenza,
          data_cessazione
        `)
        .eq("ruolo", "socio")
        .not(
          "soggetto_cliente_id",
          "is",
          null
        )
        .not(
          "cliente_id",
          "is",
          null
        ),

      supabase
        .from("tbclienti_organi")
        .select(`
          id,
          cliente_id,
          soggetto_cliente_id,
          ruolo,
          carica,
          principale,
          attivo,
          data_nomina,
          data_scadenza,
          data_cessazione
        `)
        .in(
          "ruolo",
          RUOLI_RESIDUALI
        )
        .not(
          "soggetto_cliente_id",
          "is",
          null
        )
        .not(
          "cliente_id",
          "is",
          null
        ),
    ]);

    if (clienteRes.error) {
      throw clienteRes.error;
    }

    if (!clienteRes.data) {
      return NextResponse.json(
        {
          error: "Cliente non trovato",
        },
        {
          status: 404,
        }
      );
    }

    if (clientiRes.error) {
      throw clientiRes.error;
    }

    if (partecipazioniRes.error) {
      throw partecipazioniRes.error;
    }

    if (organiResidualRes.error) {
      throw organiResidualRes.error;
    }

    const cliente =
      clienteRes.data as ClienteRow;

    const clienti =
      (clientiRes.data ||
        []) as ClienteRow[];

    const partecipazioni =
      (partecipazioniRes.data ||
        []) as PartecipazioneRow[];

    const organiResidual =
      (organiResidualRes.data ||
        []) as OrganoResidualRow[];

    const clientiMap = new Map<
      string,
      ClienteRow
    >(
      clienti.map((item) => [
        String(item.id),
        item,
      ])
    );

    /*
     * Trasformiamo tbclienti_organi nel
     * formato già utilizzato dal motore
     * dei Gruppi societari.
     */
    const partecipazioniNormalizzate:
      PartecipazioneTemporale[] =
      partecipazioni
        .map((row) => {
          const partecipante =
            clientiMap.get(
              String(
                row.soggetto_cliente_id
              )
            );

          const partecipata =
            clientiMap.get(
              String(row.cliente_id)
            );

          if (
            !partecipante ||
            !partecipata
          ) {
            return null;
          }

          /*
           * Se una riga è disattivata senza
           * alcuna data finale, non possiamo
           * attribuirle un periodo storico
           * attendibile.
           */
          if (
            row.attivo === false &&
            !row.data_scadenza &&
            !row.data_cessazione
          ) {
            return null;
          }

          const quota = Number(
            row
              .percentuale_partecipazione ||
              0
          );

          const tipoPartecipante =
            isPersonaFisica(
              partecipante.tipo_cliente
            )
              ? "persona_fisica"
              : "societa";

          const relazione:
            PartecipazioneTemporale = {
            id: String(row.id),

            partecipante_id:
              String(
                row.soggetto_cliente_id
              ),

            partecipante_nome:
              partecipante
                .ragione_sociale ||
              "Nominativo non trovato",

            partecipante_tipo:
              tipoPartecipante,

            partecipata_id:
              String(row.cliente_id),

            partecipata_nome:
              partecipata
                .ragione_sociale ||
              "Società non trovata",

            quota_diretta: quota,

            classificazione:
              classificaPartecipazione(
                quota,
                tipoPartecipante
              ),

            controllo_diretto:
              tipoPartecipante ===
                "societa" &&
              quota > 50,

            collegamento_diretto:
              tipoPartecipante ===
                "societa" &&
              quota > 20 &&
              quota <= 50,

            candidato_titolare_effettivo_diretto:
              tipoPartecipante ===
                "persona_fisica" &&
              quota > 25,

            /*
             * Nel form:
             * data_nomina = Possesso dal
             * data_scadenza = Possesso fino a
             */
            valido_dal:
              normalizzaData(
                row.data_nomina
              ),

            valido_al:
              normalizzaData(
                row.data_scadenza ||
                  row.data_cessazione
              ),
          };

          return relazione;
        })
        .filter(
          (
            item
          ): item is PartecipazioneTemporale =>
            Boolean(item)
        );

  const organiResidualNormalizzati:
  OrganoResidualTemporale[] =
  organiResidual.flatMap((row) => {
    /*
     * Se l’organo è disattivato ma non ha
     * alcuna data finale, non può essere
     * ricostruito storicamente.
     */
    if (
      row.attivo === false &&
      !row.data_scadenza &&
      !row.data_cessazione
    ) {
      return [];
    }

    const organo:
      OrganoResidualTemporale = {
      id: String(row.id),

      cliente_id:
        String(row.cliente_id),

      soggetto_cliente_id:
        String(
          row.soggetto_cliente_id
        ),

      ruolo:
        row.ruolo,

      carica:
        row.carica,

      principale:
        row.principale,

      valido_dal:
        normalizzaData(
          row.data_nomina
        ),

      valido_al:
        normalizzaData(
          row.data_scadenza ||
            row.data_cessazione
        ),
    };

    return [organo];
  });

    /*
     * Calcolo per proprietà, diretto e
     * indiretto, mediante il motore già
     * utilizzato dai Gruppi societari.
     */
type TitolareEffettivoNormalizzato =
  TitolareEffettivoTemporale & {
    codice_fiscale: string | null;
    chiave_soggetto: string;

    ruolo?: string | null;
    carica?: string | null;
    principale?: boolean;
  };

type SituazioneTitolareEffettivo = {
  criterio_utilizzato:
    | "proprieta"
    | "residuale";

  titolari_effettivi:
    TitolareEffettivoNormalizzato[];
};
    
function calcolaSituazioneAllaData(
  dataCalcolo: string
): SituazioneTitolareEffettivo {
  const titolariPerProprieta =
    calcolaTitolariEffettiviAllaData(
      partecipazioniNormalizzate,
      dataCalcolo
    ).filter(
      (titolare) =>
        String(titolare.societa_id) ===
        String(clienteId)
    );

  let titolariEffettivi:
    TitolareEffettivoTemporale[] =
    titolariPerProprieta;

  /*
   * Se non esistono Titolari Effettivi
   * per proprietà, applichiamo
   * il criterio residuale.
   */
  if (titolariPerProprieta.length === 0) {
    const organiValidi =
      filtraOrganiResidualAllaData(
        organiResidualNormalizzati,
        dataCalcolo
      )
        .filter(
          (organo) =>
            String(organo.cliente_id) ===
            String(clienteId)
        )
        .sort((a, b) => {
          if (a.principale === b.principale) {
            return 0;
          }

          return a.principale ? -1 : 1;
        });

    const residualiMap =
      new Map<string, any>();

    organiValidi.forEach((organo) => {
      const soggetto =
        clientiMap.get(
          String(organo.soggetto_cliente_id)
        );

      if (
        !soggetto ||
        !isPersonaFisica(
          soggetto.tipo_cliente
        )
      ) {
        return;
      }

      const personaId =
        String(soggetto.id);

      /*
       * Evita duplicazioni quando la stessa
       * persona ricopre più cariche.
       */
      if (residualiMap.has(personaId)) {
        return;
      }

      residualiMap.set(personaId, {
        persona_id: personaId,

        persona_nome:
          soggetto.ragione_sociale ||
          "Nominativo non trovato",

        societa_id:
          String(cliente.id),

        societa_nome:
          cliente.ragione_sociale ||
          "Società non trovata",

        quota_diretta: 0,
        quota_indiretta: 0,
        quota_complessiva: 0,

        candidato_titolare_effettivo:
          true,

        criterio_titolarita:
          "residuale",

        tipo_titolarita:
          "residuale",

        ruolo:
          organo.ruolo || null,

        carica:
          organo.carica ||
          organo.ruolo ||
          "Amministratore",

        principale:
          organo.principale === true,

        valido_dal:
          organo.valido_dal || null,

        valido_al:
          organo.valido_al || null,

        percorsi: [],
      });
    });

    titolariEffettivi =
      Array.from(
        residualiMap.values()
      );
  }

  const titolariNormalizzati:
    TitolareEffettivoNormalizzato[] =
    titolariEffettivi.map(
      (titolare: any) => {
        const persona =
          clientiMap.get(
            String(titolare.persona_id)
          );

        return {
          ...titolare,

          codice_fiscale:
            persona?.codice_fiscale ||
            null,

          chiave_soggetto:
            costruisciChiaveSoggetto({
              personaId:
                titolare.persona_id,

              codiceFiscale:
                persona?.codice_fiscale,

              personaNome:
                titolare.persona_nome,
            }),
        };
      }
    );
    /*
     * Qui siamo dentro la funzione:
     * titolariPerProprieta esiste.
     */
 return {
  criterio_utilizzato:
    titolariPerProprieta.length > 0
      ? "proprieta"
      : "residuale",

  titolari_effettivi:
    titolariNormalizzati,
};
}

/*
 * Situazione alla data richiesta.
 */
const situazioneAttuale =
  calcolaSituazioneAllaData(
    dataRiferimento
  );

const titolariNormalizzati =
  situazioneAttuale
    .titolari_effettivi;

/*
 * Raccogliamo le date potenziali presenti
 * nelle partecipazioni e nelle cariche.
 */
const dateBase =
  raccogliDateVariazione(
    partecipazioniNormalizzate,
    organiResidualNormalizzati
  );

/*
 * Una data di inizio produce effetto
 * nella data stessa.
 *
 * Una data di fine produce il cambiamento
 * dal giorno successivo.
 */
const dateCandidateSet =
  new Set<string>();

partecipazioniNormalizzate.forEach(
  (partecipazione) => {
    if (partecipazione.valido_dal) {
      dateCandidateSet.add(
        partecipazione.valido_dal
      );
    }

    if (partecipazione.valido_al) {
      dateCandidateSet.add(
        aggiungiGiorni(
          partecipazione.valido_al,
          1
        )
      );
    }
  }
);

organiResidualNormalizzati.forEach(
  (organo) => {
    if (organo.valido_dal) {
      dateCandidateSet.add(
        organo.valido_dal
      );
    }

    if (organo.valido_al) {
      dateCandidateSet.add(
        aggiungiGiorni(
          organo.valido_al,
          1
        )
      );
    }
  }
);

/*
 * Manteniamo anche le date già raccolte
 * dalla funzione temporale.
 */
dateBase.forEach((data) => {
  dateCandidateSet.add(data);
});

const datePotenzialiVariazione =
  Array.from(dateCandidateSet)
    .filter(
      (data) =>
        data <= dataRiferimento
    )
    .sort();

/*
 * Una data è una variazione effettiva
 * soltanto se cambia l'elenco dei TE.
 */
const variazioniEffettive =
  datePotenzialiVariazione.flatMap(
    (dataVariazione) => {
      const dataPrecedente =
        aggiungiGiorni(
          dataVariazione,
          -1
        );

      const situazionePrima =
        calcolaSituazioneAllaData(
          dataPrecedente
        );

      const situazioneDopo =
        calcolaSituazioneAllaData(
          dataVariazione
        );

      const firmaPrima =
        firmaTitolari(
          situazionePrima
            .titolari_effettivi
        );

      const firmaDopo =
        firmaTitolari(
          situazioneDopo
            .titolari_effettivi
        );

      if (
        firmeUguali(
          firmaPrima,
          firmaDopo
        )
      ) {
        return [];
      }

      return [
        {
          data:
            dataVariazione,

          criterio_precedente:
            situazionePrima
              .criterio_utilizzato,

          criterio_successivo:
            situazioneDopo
              .criterio_utilizzato,

          precedenti:
            situazionePrima
              .titolari_effettivi
              .map((titolare) => ({
                persona_id:
                  titolare.persona_id,

                persona_nome:
                  titolare.persona_nome,

                codice_fiscale:
                  titolare.codice_fiscale,

                chiave_soggetto:
                  titolare.chiave_soggetto,

                criterio_titolarita:
                  titolare
                    .criterio_titolarita,

                quota_complessiva:
                  Number(
                    titolare
                      .quota_complessiva ||
                      0
                  ),
              })),

          successivi:
            situazioneDopo
              .titolari_effettivi
              .map((titolare) => ({
                persona_id:
                  titolare.persona_id,

                persona_nome:
                  titolare.persona_nome,

                codice_fiscale:
                  titolare.codice_fiscale,

                chiave_soggetto:
                  titolare.chiave_soggetto,

                criterio_titolarita:
                  titolare
                    .criterio_titolarita,

                quota_complessiva:
                  Number(
                    titolare
                      .quota_complessiva ||
                      0
                  ),
              })),
        },
      ];
    }
  );

const ultimaVariazione =
  variazioniEffettive.length > 0
    ? variazioniEffettive[
        variazioniEffettive.length - 1
      ]
    : null;

return NextResponse.json({
  cliente: {
    id:
      cliente.id,

    ragione_sociale:
      cliente.ragione_sociale,

    codice_fiscale:
      cliente.codice_fiscale,
  },

  data_riferimento:
    dataRiferimento,

   numero_titolari_effettivi:
    titolariNormalizzati.length,

  date_potenziali_variazione:
    datePotenzialiVariazione,

  variazioni_effettive:
    variazioniEffettive,

  numero_variazioni_effettive:
    variazioniEffettive.length,

  alert: {
    titolare_effettivo_assente:
      titolariNormalizzati.length ===
      0,

    variazione_rilevata:
      Boolean(ultimaVariazione),

    data_ultima_variazione:
      ultimaVariazione?.data ||
      null,

    messaggio:
      titolariNormalizzati.length ===
      0
        ? "Nessun Titolare Effettivo individuato alla data richiesta."
        : ultimaVariazione
        ? `Ultima variazione del Titolare Effettivo rilevata in data ${ultimaVariazione.data}.`
        : null,
  },
});
  } catch (error: any) {
    console.error(
      "Errore calcolo Titolare Effettivo:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Errore durante il calcolo del Titolare Effettivo",
      },
      {
        status: 500,
      }
    );
  }
}
