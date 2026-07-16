import {
  calcolaTitolariEffettivi,
  type PartecipazioneDiretta,
  type TitolareEffettivo,
} from "@/lib/gruppiSocietari";

export type PartecipazioneTemporale =
  PartecipazioneDiretta & {
    valido_dal?: string | null;
    valido_al?: string | null;
  };

export type OrganoResidualTemporale = {
  id: string;
  cliente_id: string;
  soggetto_cliente_id: string;

  ruolo: string | null;
  carica: string | null;
  principale: boolean | null;

  valido_dal?: string | null;
  valido_al?: string | null;
};

export type TitolareEffettivoTemporale =
  TitolareEffettivo & {
    criterio_titolarita:
      | "proprieta"
      | "residuale";

    tipo_titolarita:
      | "diretta"
      | "indiretta"
      | "mista"
      | "residuale";

    valido_dal: string | null;
    valido_al: string | null;
  };

function normalizzaData(
  valore?: string | null
): string | null {
  if (!valore) {
    return null;
  }

  const testo = String(valore).trim();

  if (!testo) {
    return null;
  }

  /*
   * Se arriva un timestamp, manteniamo
   * soltanto la parte AAAA-MM-GG.
   */
  return testo.slice(0, 10);
}

function dataValida(
  valore?: string | null
): boolean {
  const data = normalizzaData(valore);

  if (!data) {
    return false;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(data);
}

/**
 * Verifica se un titolo di possesso o una carica
 * risulta valido alla data richiesta.
 *
 * Regole:
 * - senza data iniziale: valido dall'origine;
 * - senza data finale: ancora valido;
 * - estremi inclusi.
 */
export function isValidoAllaData(
  validoDal: string | null | undefined,
  validoAl: string | null | undefined,
  dataRiferimento: string
): boolean {
  const riferimento =
    normalizzaData(dataRiferimento);

  if (!riferimento || !dataValida(riferimento)) {
    throw new Error(
      `Data di riferimento non valida: ${dataRiferimento}`
    );
  }

  const dal = normalizzaData(validoDal);
  const al = normalizzaData(validoAl);

  if (dal && riferimento < dal) {
    return false;
  }

  if (al && riferimento > al) {
    return false;
  }

  return true;
}

/**
 * Restituisce soltanto le partecipazioni valide
 * alla data indicata.
 */
export function filtraPartecipazioniAllaData(
  partecipazioni: PartecipazioneTemporale[],
  dataRiferimento: string
): PartecipazioneTemporale[] {
  return partecipazioni.filter(
    (partecipazione) =>
      isValidoAllaData(
        partecipazione.valido_dal,
        partecipazione.valido_al,
        dataRiferimento
      )
  );
}

/**
 * Restituisce soltanto gli organi residuali validi
 * alla data indicata.
 */
export function filtraOrganiResidualAllaData(
  organi: OrganoResidualTemporale[],
  dataRiferimento: string
): OrganoResidualTemporale[] {
  return organi.filter((organo) =>
    isValidoAllaData(
      organo.valido_dal,
      organo.valido_al,
      dataRiferimento
    )
  );
}

function determinaTipoTitolarita(
  titolare: TitolareEffettivo
):
  | "diretta"
  | "indiretta"
  | "mista" {
  const diretta =
    Number(titolare.quota_diretta || 0) > 0;

  const indiretta =
    Number(titolare.quota_indiretta || 0) > 0;

  if (diretta && indiretta) {
    return "mista";
  }

  if (indiretta) {
    return "indiretta";
  }

  return "diretta";
}

/**
 * Ricava il periodo temporale comune ai percorsi
 * che generano il Titolare Effettivo.
 *
 * La data iniziale è la più recente tra gli inizi
 * delle partecipazioni coinvolte.
 *
 * La data finale è la più vicina tra le eventuali
 * date di fine.
 */
function calcolaPeriodoTitolare(
  titolare: TitolareEffettivo,
  partecipazioni: PartecipazioneTemporale[]
): {
  valido_dal: string | null;
  valido_al: string | null;
} {
  const idsPartecipazioniCoinvolte =
    new Set<string>();

  titolare.percorsi.forEach((percorso) => {
    for (
      let indice = 0;
      indice <
      percorso.percorso_ids.length - 1;
      indice += 1
    ) {
      const partecipanteId =
        percorso.percorso_ids[indice];

      const partecipataId =
        percorso.percorso_ids[indice + 1];

      partecipazioni
        .filter(
          (partecipazione) =>
            String(
              partecipazione.partecipante_id
            ) === String(partecipanteId) &&
            String(
              partecipazione.partecipata_id
            ) === String(partecipataId)
        )
        .forEach((partecipazione) => {
          idsPartecipazioniCoinvolte.add(
            partecipazione.id
          );
        });
    }
  });

  const partecipazioniCoinvolte =
    partecipazioni.filter(
      (partecipazione) =>
        idsPartecipazioniCoinvolte.has(
          partecipazione.id
        )
    );

  const dateInizio =
    partecipazioniCoinvolte
      .map((partecipazione) =>
        normalizzaData(
          partecipazione.valido_dal
        )
      )
      .filter(
        (data): data is string =>
          Boolean(data)
      );

  const dateFine =
    partecipazioniCoinvolte
      .map((partecipazione) =>
        normalizzaData(
          partecipazione.valido_al
        )
      )
      .filter(
        (data): data is string =>
          Boolean(data)
      );

  return {
    valido_dal:
      dateInizio.length > 0
        ? dateInizio.sort().at(-1) || null
        : null,

    valido_al:
      dateFine.length > 0
        ? dateFine.sort()[0] || null
        : null,
  };
}

/**
 * Calcola i Titolari Effettivi per proprietà
 * validi alla data indicata.
 */
export function calcolaTitolariEffettiviAllaData(
  partecipazioni: PartecipazioneTemporale[],
  dataRiferimento: string
): TitolareEffettivoTemporale[] {
  const partecipazioniValide =
    filtraPartecipazioniAllaData(
      partecipazioni,
      dataRiferimento
    );

  const risultati =
    calcolaTitolariEffettivi(
      partecipazioniValide
    );

  return risultati
    .filter(
      (titolare) =>
        titolare
          .candidato_titolare_effettivo ===
        true
    )
    .map((titolare) => {
      const periodo =
        calcolaPeriodoTitolare(
          titolare,
          partecipazioniValide
        );

      return {
        ...titolare,

        criterio_titolarita:
          "proprieta" as const,

        tipo_titolarita:
          determinaTipoTitolarita(
            titolare
          ),

        valido_dal:
          periodo.valido_dal,

        valido_al:
          periodo.valido_al,
      };
    });
}

/**
 * Raccoglie tutte le date in cui la composizione
 * sociale potrebbe aver modificato il TE.
 *
 * Servirà successivamente per costruire lo storico.
 */
export function raccogliDateVariazione(
  partecipazioni: PartecipazioneTemporale[],
  organiResidual: OrganoResidualTemporale[] = []
): string[] {
  const date = new Set<string>();

  partecipazioni.forEach(
    (partecipazione) => {
      const dal = normalizzaData(
        partecipazione.valido_dal
      );

      const al = normalizzaData(
        partecipazione.valido_al
      );

      if (dal) {
        date.add(dal);
      }

      if (al) {
        date.add(al);
      }
    }
  );

  organiResidual.forEach((organo) => {
    const dal = normalizzaData(
      organo.valido_dal
    );

    const al = normalizzaData(
      organo.valido_al
    );

    if (dal) {
      date.add(dal);
    }

    if (al) {
      date.add(al);
    }
  });

  return Array.from(date).sort();
}
