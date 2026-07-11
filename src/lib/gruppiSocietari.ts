export type TipoPartecipante = "persona_fisica" | "societa";

export type ClassificazionePartecipazione =
  | "controllata"
  | "collegata"
  | "altra_partecipazione"
  | "partecipazione_persona_fisica";

export type PartecipazioneDiretta = {
  id: string;

  partecipante_id: string;
  partecipante_nome: string;
  partecipante_tipo: TipoPartecipante;

  partecipata_id: string;
  partecipata_nome: string;

  quota_diretta: number;
  classificazione: ClassificazionePartecipazione;

  controllo_diretto: boolean;
  collegamento_diretto: boolean;
  candidato_titolare_effettivo_diretto: boolean;
};

export type NodoGruppo = {
  societa_id: string;
  societa_nome: string;

  controllante_diretta_id: string | null;
  controllante_diretta_nome: string | null;

  quota_diretta: number;
  quota_dalla_capogruppo: number;

  livello: number;
  relazione: "capogruppo" | "controllata";

  percorso_ids: string[];
  percorso_nomi: string[];

  figli: NodoGruppo[];
};

export type PercorsoPartecipazione = {
  titolare_id: string;
  titolare_nome: string;
  titolare_tipo: TipoPartecipante;

  societa_id: string;
  societa_nome: string;

  quota_percorso: number;
  quota_diretta: number;

  livello: number;
  percorso_ids: string[];
  percorso_nomi: string[];
};

export type TitolareEffettivo = {
  persona_id: string;
  persona_nome: string;

  societa_id: string;
  societa_nome: string;

  quota_diretta: number;
  quota_indiretta: number;
  quota_complessiva: number;

  candidato_titolare_effettivo: boolean;

  percorsi: PercorsoPartecipazione[];
};

export type GruppoSocietario = {
  capogruppo_id: string;
  capogruppo_nome: string;

  numero_societa: number;
  albero: NodoGruppo[];

  societa_ids: string[];
};

const SOGLIA_CONTROLLO = 50;
const SOGLIA_COLLEGAMENTO = 20;
const SOGLIA_TITOLARE_EFFETTIVO = 25;

function normalizzaQuota(value: unknown): number {
  const quota = Number(value);

  if (!Number.isFinite(quota)) {
    return 0;
  }

  return Math.max(0, Math.min(100, quota));
}

function arrotondaPercentuale(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function classificaPartecipazione(
  quotaInput: number,
  tipoPartecipante: TipoPartecipante
): ClassificazionePartecipazione {
  const quota = normalizzaQuota(quotaInput);

  if (tipoPartecipante === "persona_fisica") {
    return "partecipazione_persona_fisica";
  }

  if (quota > SOGLIA_CONTROLLO) {
    return "controllata";
  }

  if (
    quota > SOGLIA_COLLEGAMENTO &&
    quota <= SOGLIA_CONTROLLO
  ) {
    return "collegata";
  }

  return "altra_partecipazione";
}

/**
 * Restituisce le partecipazioni in cui il partecipante è una società.
 */
export function getPartecipazioniSocietarie(
  partecipazioni: PartecipazioneDiretta[]
): PartecipazioneDiretta[] {
  return partecipazioni.filter(
    (relazione) =>
      relazione.partecipante_tipo === "societa"
  );
}

/**
 * Relazioni societarie con quota superiore al 50%.
 */
export function getRelazioniDiControllo(
  partecipazioni: PartecipazioneDiretta[]
): PartecipazioneDiretta[] {
  return partecipazioni.filter(
    (relazione) =>
      relazione.partecipante_tipo === "societa" &&
      normalizzaQuota(relazione.quota_diretta) >
        SOGLIA_CONTROLLO
  );
}

/**
 * Società che controllano almeno un'altra società e che non risultano
 * a loro volta controllate da un'altra società.
 */
export function trovaCapogruppo(
  partecipazioni: PartecipazioneDiretta[]
): Array<{
  id: string;
  nome: string;
}> {
  const controlli = getRelazioniDiControllo(partecipazioni);

  const societaControllanti = new Map<string, string>();
  const societaControllate = new Set<string>();

  controlli.forEach((relazione) => {
    societaControllanti.set(
      relazione.partecipante_id,
      relazione.partecipante_nome
    );

    societaControllate.add(relazione.partecipata_id);
  });

  return Array.from(societaControllanti.entries())
    .filter(([societaId]) => !societaControllate.has(societaId))
    .map(([id, nome]) => ({
      id,
      nome,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

function costruisciFigliControllati(
  societaId: string,
  societaNome: string,
  relazioniPerControllante: Map<
    string,
    PartecipazioneDiretta[]
  >,
  quotaDallaCapogruppo: number,
  livello: number,
  percorsoIds: string[],
  percorsoNomi: string[]
): NodoGruppo[] {
  const relazioni =
    relazioniPerControllante.get(societaId) || [];

  return relazioni.map((relazione) => {
    const quotaDiretta = normalizzaQuota(
      relazione.quota_diretta
    );

    const nuovaQuotaDallaCapogruppo =
      livello === 0
        ? quotaDiretta
        : (quotaDallaCapogruppo * quotaDiretta) / 100;

    const nuovoPercorsoIds = [
      ...percorsoIds,
      relazione.partecipata_id,
    ];

    const nuovoPercorsoNomi = [
      ...percorsoNomi,
      relazione.partecipata_nome,
    ];

    const cicloRilevato = percorsoIds.includes(
      relazione.partecipata_id
    );

    const figli = cicloRilevato
      ? []
      : costruisciFigliControllati(
          relazione.partecipata_id,
          relazione.partecipata_nome,
          relazioniPerControllante,
          nuovaQuotaDallaCapogruppo,
          livello + 1,
          nuovoPercorsoIds,
          nuovoPercorsoNomi
        );

    return {
      societa_id: relazione.partecipata_id,
      societa_nome: relazione.partecipata_nome,

      controllante_diretta_id: societaId,
      controllante_diretta_nome: societaNome,

      quota_diretta: quotaDiretta,
      quota_dalla_capogruppo: arrotondaPercentuale(
        nuovaQuotaDallaCapogruppo
      ),

      livello: livello + 1,
      relazione: "controllata" as const,

      percorso_ids: nuovoPercorsoIds,
      percorso_nomi: nuovoPercorsoNomi,

      figli,
    };
  });
}

function raccogliIdsDaAlbero(
  nodi: NodoGruppo[],
  ids: Set<string>
) {
  nodi.forEach((nodo) => {
    ids.add(nodo.societa_id);
    raccogliIdsDaAlbero(nodo.figli, ids);
  });
}

export function costruisciGruppiSocietari(
  partecipazioni: PartecipazioneDiretta[]
): GruppoSocietario[] {
  const controlli = getRelazioniDiControllo(partecipazioni);
  const capogruppo = trovaCapogruppo(partecipazioni);

  const relazioniPerControllante = new Map<
    string,
    PartecipazioneDiretta[]
  >();

  controlli.forEach((relazione) => {
    const esistenti =
      relazioniPerControllante.get(
        relazione.partecipante_id
      ) || [];

    esistenti.push(relazione);

    relazioniPerControllante.set(
      relazione.partecipante_id,
      esistenti
    );
  });

  return capogruppo.map((capo) => {
    const albero = costruisciFigliControllati(
      capo.id,
      capo.nome,
      relazioniPerControllante,
      100,
      0,
      [capo.id],
      [capo.nome]
    );

    const societaIds = new Set<string>();
    societaIds.add(capo.id);

    raccogliIdsDaAlbero(albero, societaIds);

    return {
      capogruppo_id: capo.id,
      capogruppo_nome: capo.nome,

      numero_societa: societaIds.size,
      societa_ids: Array.from(societaIds),

      albero,
    };
  });
}

/**
 * Trova tutti i percorsi di partecipazione da un soggetto a una società.
 *
 * Esempio:
 * persona → A → B → C
 *
 * La quota del percorso è:
 * quota persona/A × quota A/B × quota B/C.
 */
export function trovaPercorsiPartecipazione(
  partecipazioni: PartecipazioneDiretta[],
  titolareId: string,
  societaDestinazioneId?: string
): PercorsoPartecipazione[] {
  const relazioniPerPartecipante = new Map<
    string,
    PartecipazioneDiretta[]
  >();

  partecipazioni.forEach((relazione) => {
    const esistenti =
      relazioniPerPartecipante.get(
        relazione.partecipante_id
      ) || [];

    esistenti.push(relazione);

    relazioniPerPartecipante.set(
      relazione.partecipante_id,
      esistenti
    );
  });

  const titolare = partecipazioni.find(
    (relazione) =>
      relazione.partecipante_id === titolareId
  );

  if (!titolare) {
    return [];
  }

  const risultati: PercorsoPartecipazione[] = [];

  function visita(
    soggettoCorrenteId: string,
    quotaAccumula: number,
    livello: number,
    percorsoIds: string[],
    percorsoNomi: string[]
  ) {
    const relazioni =
      relazioniPerPartecipante.get(soggettoCorrenteId) ||
      [];

    relazioni.forEach((relazione) => {
      if (percorsoIds.includes(relazione.partecipata_id)) {
        return;
      }

      const quotaDiretta = normalizzaQuota(
        relazione.quota_diretta
      );

      const quotaPercorso =
        (quotaAccumula * quotaDiretta) / 100;

      const nuoviIds = [
        ...percorsoIds,
        relazione.partecipata_id,
      ];

      const nuoviNomi = [
        ...percorsoNomi,
        relazione.partecipata_nome,
      ];

      if (
        !societaDestinazioneId ||
        relazione.partecipata_id ===
          societaDestinazioneId
      ) {
        risultati.push({
          titolare_id: titolareId,
          titolare_nome: titolare.partecipante_nome,
          titolare_tipo: titolare.partecipante_tipo,

          societa_id: relazione.partecipata_id,
          societa_nome: relazione.partecipata_nome,

          quota_percorso:
            arrotondaPercentuale(quotaPercorso),

          quota_diretta:
            livello === 0 ? quotaDiretta : 0,

          livello: livello + 1,

          percorso_ids: nuoviIds,
          percorso_nomi: nuoviNomi,
        });
      }

      visita(
        relazione.partecipata_id,
        quotaPercorso,
        livello + 1,
        nuoviIds,
        nuoviNomi
      );
    });
  }

  visita(
    titolareId,
    100,
    0,
    [titolareId],
    [titolare.partecipante_nome]
  );

  return risultati;
}

/**
 * Calcola i candidati titolari effettivi per ogni società.
 *
 * Somma:
 * - quota diretta;
 * - quote indirette ottenute attraverso tutti i percorsi distinti.
 */
export function calcolaTitolariEffettivi(
  partecipazioni: PartecipazioneDiretta[]
): TitolareEffettivo[] {
  const personeFisiche = Array.from(
    new Map(
      partecipazioni
        .filter(
          (relazione) =>
            relazione.partecipante_tipo ===
            "persona_fisica"
        )
        .map((relazione) => [
          relazione.partecipante_id,
          {
            id: relazione.partecipante_id,
            nome: relazione.partecipante_nome,
          },
        ])
    ).values()
  );

  const risultati: TitolareEffettivo[] = [];

  personeFisiche.forEach((persona) => {
    const percorsi = trovaPercorsiPartecipazione(
      partecipazioni,
      persona.id
    );

    const percorsiPerSocieta = new Map<
      string,
      PercorsoPartecipazione[]
    >();

    percorsi.forEach((percorso) => {
      const esistenti =
        percorsiPerSocieta.get(percorso.societa_id) || [];

      esistenti.push(percorso);

      percorsiPerSocieta.set(
        percorso.societa_id,
        esistenti
      );
    });

    percorsiPerSocieta.forEach(
      (percorsiSocieta, societaId) => {
        const societaNome =
          percorsiSocieta[0]?.societa_nome || "";

        const quotaDiretta = percorsiSocieta
          .filter((percorso) => percorso.livello === 1)
          .reduce(
            (totale, percorso) =>
              totale + percorso.quota_percorso,
            0
          );

        const quotaIndiretta = percorsiSocieta
          .filter((percorso) => percorso.livello > 1)
          .reduce(
            (totale, percorso) =>
              totale + percorso.quota_percorso,
            0
          );

        const quotaComplessiva = Math.min(
          100,
          quotaDiretta + quotaIndiretta
        );

        risultati.push({
          persona_id: persona.id,
          persona_nome: persona.nome,

          societa_id: societaId,
          societa_nome: societaNome,

          quota_diretta:
            arrotondaPercentuale(quotaDiretta),

          quota_indiretta:
            arrotondaPercentuale(quotaIndiretta),

          quota_complessiva:
            arrotondaPercentuale(quotaComplessiva),

          candidato_titolare_effettivo:
            quotaComplessiva >
            SOGLIA_TITOLARE_EFFETTIVO,

          percorsi: percorsiSocieta,
        });
      }
    );
  });

  return risultati.sort((a, b) => {
    const societaCompare = a.societa_nome.localeCompare(
      b.societa_nome
    );

    if (societaCompare !== 0) {
      return societaCompare;
    }

    return (
      b.quota_complessiva - a.quota_complessiva
    );
  });
}
