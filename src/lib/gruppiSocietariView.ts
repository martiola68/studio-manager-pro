import type {
  GruppoSocietario,
  NodoGruppo,
  PartecipazioneDiretta,
  TitolareEffettivo,
} from "@/lib/gruppiSocietari";

export type SoggettoPartecipanteView = {
  id: string;
  nome: string;
  tipo: "persona_fisica" | "societa";
  quota_diretta: number;
  classificazione: string;
};

export type RelazioneSocietariaView = {
  societa_id: string;
  societa_nome: string;
  quota: number;

  classificazione:
    | "controllata"
    | "collegata"
    | "altra_partecipazione";

  soci_diretti: SoggettoPartecipanteView[];

  titolari_effettivi: TitolareEffettivoView[];
};

export type TitolareEffettivoView = {
  persona_id: string;
  persona_nome: string;
  quota_diretta: number;
  quota_indiretta: number;
  quota_complessiva: number;
  tipo_titolarita:
    | "diretta"
    | "indiretta"
    | "diretta_e_indiretta";
  percorsi: Array<{
    livello: number;
    quota_percorso: number;
    percorso_nomi: string[];
  }>;
};

export type SocietaGruppoView = {
  id: string;
  nome: string;

  ruolo_nel_gruppo:
    | "capogruppo"
    | "controllata_diretta"
    | "controllata_indiretta";

  livello: number;

  controllante_diretta: {
    id: string;
    nome: string;
    quota: number;
  } | null;

  controllante_ultima: {
    id: string;
    nome: string;
  };

  quota_dalla_capogruppo: number;

  percorso_ids: string[];
  percorso_nomi: string[];

  societa_figlie: Array<{
    id: string;
    nome: string;
    quota: number;
  }>;

  societa_sorelle: Array<{
    id: string;
    nome: string;
  }>;

  societa_collegate: RelazioneSocietariaView[];
  altre_partecipazioni: RelazioneSocietariaView[];

  soci_diretti: SoggettoPartecipanteView[];

  titolari_effettivi: TitolareEffettivoView[];
};

export type GruppoSocietarioView = {
  id: string;
  denominazione: string;

  capogruppo: {
    id: string;
    nome: string;
  };

  riepilogo: {
    numero_societa: number;
    numero_controllate_dirette: number;
    numero_controllate_indirette: number;
    numero_collegate: number;
    numero_persone_fisiche_rilevate: number;
    numero_titolari_effettivi: number;
    livelli_gruppo: number;
  };

  societa: SocietaGruppoView[];

  titolari_effettivi_gruppo: Array<{
    persona_id: string;
    persona_nome: string;
    societa: Array<{
      societa_id: string;
      societa_nome: string;
      quota_complessiva: number;
      tipo_titolarita:
        | "diretta"
        | "indiretta"
        | "diretta_e_indiretta";
    }>;
  }>;
};

type NodoPiatto = {
  societa_id: string;
  societa_nome: string;

  controllante_diretta_id: string | null;
  controllante_diretta_nome: string | null;

  quota_diretta: number;
  quota_dalla_capogruppo: number;

  livello: number;
  percorso_ids: string[];
  percorso_nomi: string[];
};

function arrotonda(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function appiattisciAlbero(nodi: NodoGruppo[]): NodoPiatto[] {
  const risultati: NodoPiatto[] = [];

  function visita(nodo: NodoGruppo) {
    risultati.push({
      societa_id: nodo.societa_id,
      societa_nome: nodo.societa_nome,

      controllante_diretta_id:
        nodo.controllante_diretta_id,

      controllante_diretta_nome:
        nodo.controllante_diretta_nome,

      quota_diretta: nodo.quota_diretta,

      quota_dalla_capogruppo:
        nodo.quota_dalla_capogruppo,

      livello: nodo.livello,

      percorso_ids: nodo.percorso_ids,
      percorso_nomi: nodo.percorso_nomi,
    });

    nodo.figli.forEach(visita);
  }

  nodi.forEach(visita);

  return risultati;
}

function determinaTipoTitolarita(
  titolare: TitolareEffettivo
): "diretta" | "indiretta" | "diretta_e_indiretta" {
  if (
    titolare.quota_diretta > 0 &&
    titolare.quota_indiretta > 0
  ) {
    return "diretta_e_indiretta";
  }

  if (titolare.quota_diretta > 0) {
    return "diretta";
  }

  return "indiretta";
}

function costruisciTitolariEffettiviSocieta(
  societaId: string,
  titolariEffettivi: TitolareEffettivo[]
): TitolareEffettivoView[] {
  return titolariEffettivi
    .filter(
      (titolare) =>
        titolare.societa_id === societaId &&
        titolare.candidato_titolare_effettivo
    )
    .map((titolare) => ({
      persona_id: titolare.persona_id,
      persona_nome: titolare.persona_nome,

      quota_diretta: arrotonda(
        titolare.quota_diretta
      ),

      quota_indiretta: arrotonda(
        titolare.quota_indiretta
      ),

      quota_complessiva: arrotonda(
        titolare.quota_complessiva
      ),

      tipo_titolarita:
        determinaTipoTitolarita(titolare),

      percorsi: titolare.percorsi.map((percorso) => ({
        livello: percorso.livello,
        quota_percorso: arrotonda(
          percorso.quota_percorso
        ),
        percorso_nomi: percorso.percorso_nomi,
      })),
    }))
    .sort(
      (a, b) =>
        b.quota_complessiva - a.quota_complessiva
    );
}

function costruisciTitolariEffettiviGruppo(
  societaIds: string[],
  titolariEffettivi: TitolareEffettivo[]
): GruppoSocietarioView["titolari_effettivi_gruppo"] {
  const candidati = titolariEffettivi.filter(
    (titolare) =>
      societaIds.includes(titolare.societa_id) &&
      titolare.candidato_titolare_effettivo
  );

  const personeMap = new Map<
    string,
    GruppoSocietarioView["titolari_effettivi_gruppo"][number]
  >();

  candidati.forEach((titolare) => {
    const esistente = personeMap.get(
      titolare.persona_id
    );

    const societa = {
      societa_id: titolare.societa_id,
      societa_nome: titolare.societa_nome,

      quota_complessiva: arrotonda(
        titolare.quota_complessiva
      ),

      tipo_titolarita:
        determinaTipoTitolarita(titolare),
    };

    if (esistente) {
      esistente.societa.push(societa);
      return;
    }

    personeMap.set(titolare.persona_id, {
      persona_id: titolare.persona_id,
      persona_nome: titolare.persona_nome,
      societa: [societa],
    });
  });

  return Array.from(personeMap.values())
    .map((persona) => ({
      ...persona,
      societa: persona.societa.sort(
        (a, b) =>
          b.quota_complessiva -
          a.quota_complessiva
      ),
    }))
    .sort((a, b) =>
      a.persona_nome.localeCompare(b.persona_nome)
    );
}

export function costruisciVistaGruppiSocietari(
  partecipazioni: PartecipazioneDiretta[],
  gruppi: GruppoSocietario[],
  titolariEffettivi: TitolareEffettivo[]
): GruppoSocietarioView[] {
  return gruppi.map((gruppo) => {
    const nodiPiatti = appiattisciAlbero(
      gruppo.albero
    );

    const capogruppoNodo: NodoPiatto = {
      societa_id: gruppo.capogruppo_id,
      societa_nome: gruppo.capogruppo_nome,

      controllante_diretta_id: null,
      controllante_diretta_nome: null,

      quota_diretta: 100,
      quota_dalla_capogruppo: 100,

      livello: 0,

      percorso_ids: [gruppo.capogruppo_id],
      percorso_nomi: [gruppo.capogruppo_nome],
    };

    const tutteLeSocieta = [
      capogruppoNodo,
      ...nodiPiatti,
    ];

    const societaIds = tutteLeSocieta.map(
      (societa) => societa.societa_id
    );

    const societaView: SocietaGruppoView[] =
      tutteLeSocieta.map((societa) => {
        const relazioniInUscita =
          partecipazioni.filter(
            (relazione) =>
              relazione.partecipante_id ===
                societa.societa_id &&
              relazione.partecipante_tipo ===
                "societa"
          );

        const relazioniInEntrata =
          partecipazioni.filter(
            (relazione) =>
              relazione.partecipata_id ===
              societa.societa_id
          );

        const figlie = relazioniInUscita
          .filter(
            (relazione) =>
              relazione.classificazione ===
              "controllata"
          )
          .map((relazione) => ({
            id: relazione.partecipata_id,
            nome: relazione.partecipata_nome,
            quota: relazione.quota_diretta,
          }));

       const collegate = relazioniInUscita
  .filter(
    (relazione) =>
      relazione.classificazione ===
      "collegata"
  )
  .map((relazione) => {
    const sociDirettiCollegata =
      partecipazioni
        .filter(
          (p) =>
            p.partecipata_id ===
            relazione.partecipata_id
        )
        .map((p) => ({
          id: p.partecipante_id,
          nome: p.partecipante_nome,
          tipo: p.partecipante_tipo,
          quota_diretta: p.quota_diretta,
          classificazione: p.classificazione,
        }));

    return {
      societa_id: relazione.partecipata_id,

      societa_nome:
        relazione.partecipata_nome,

      quota: relazione.quota_diretta,

      classificazione:
        "collegata" as const,

      soci_diretti:
        sociDirettiCollegata,

      titolari_effettivi:
        costruisciTitolariEffettiviSocieta(
          relazione.partecipata_id,
          titolariEffettivi
        ),
    };
  });

        const altrePartecipazioni =
          relazioniInUscita
            .filter(
              (relazione) =>
                relazione.classificazione ===
                "altra_partecipazione"
            )
            .map((relazione) => ({
              societa_id:
                relazione.partecipata_id,

              societa_nome:
                relazione.partecipata_nome,

              quota: relazione.quota_diretta,

              classificazione:
                "altra_partecipazione" as const,
            }));

        const sorelle = tutteLeSocieta
          .filter(
            (altraSocieta) =>
              altraSocieta.societa_id !==
                societa.societa_id &&
              altraSocieta.controllante_diretta_id ===
                societa.controllante_diretta_id &&
              societa.controllante_diretta_id !== null
          )
          .map((altraSocieta) => ({
            id: altraSocieta.societa_id,
            nome: altraSocieta.societa_nome,
          }));

        const sociDiretti =
          relazioniInEntrata.map((relazione) => ({
            id: relazione.partecipante_id,
            nome: relazione.partecipante_nome,
            tipo: relazione.partecipante_tipo,

            quota_diretta:
              relazione.quota_diretta,

            classificazione:
              relazione.classificazione,
          }));

        const ruoloNelGruppo =
          societa.livello === 0
            ? "capogruppo"
            : societa.livello === 1
            ? "controllata_diretta"
            : "controllata_indiretta";

        return {
          id: societa.societa_id,
          nome: societa.societa_nome,

          ruolo_nel_gruppo: ruoloNelGruppo,

          livello: societa.livello,

          controllante_diretta:
            societa.controllante_diretta_id
              ? {
                  id:
                    societa.controllante_diretta_id,

                  nome:
                    societa.controllante_diretta_nome ||
                    "",

                  quota: societa.quota_diretta,
                }
              : null,

          controllante_ultima: {
            id: gruppo.capogruppo_id,
            nome: gruppo.capogruppo_nome,
          },

          quota_dalla_capogruppo:
            arrotonda(
              societa.quota_dalla_capogruppo
            ),

          percorso_ids: societa.percorso_ids,
          percorso_nomi: societa.percorso_nomi,

          societa_figlie: figlie,
          societa_sorelle: sorelle,

          societa_collegate: collegate,

          altre_partecipazioni:
            altrePartecipazioni,

          soci_diretti: sociDiretti,

          titolari_effettivi:
            costruisciTitolariEffettiviSocieta(
              societa.societa_id,
              titolariEffettivi
            ),
        };
      });

    const titolariGruppo =
      costruisciTitolariEffettiviGruppo(
        societaIds,
        titolariEffettivi
      );

    const personeFisicheRilevate = new Set(
      titolariEffettivi
        .filter((titolare) =>
          societaIds.includes(titolare.societa_id)
        )
        .map((titolare) => titolare.persona_id)
    );

    const collegateUniche = new Set<string>();

    societaView.forEach((societa) => {
      societa.societa_collegate.forEach(
        (collegata) => {
          collegateUniche.add(
            `${societa.id}:${collegata.societa_id}`
          );
        }
      );
    });

    const massimoLivello = Math.max(
      ...societaView.map(
        (societa) => societa.livello
      ),
      0
    );

    return {
      id: gruppo.capogruppo_id,

      denominazione: `Gruppo ${gruppo.capogruppo_nome}`,

      capogruppo: {
        id: gruppo.capogruppo_id,
        nome: gruppo.capogruppo_nome,
      },

      riepilogo: {
        numero_societa: societaView.length,

        numero_controllate_dirette:
          societaView.filter(
            (societa) =>
              societa.ruolo_nel_gruppo ===
              "controllata_diretta"
          ).length,

        numero_controllate_indirette:
          societaView.filter(
            (societa) =>
              societa.ruolo_nel_gruppo ===
              "controllata_indiretta"
          ).length,

        numero_collegate: collegateUniche.size,

        numero_persone_fisiche_rilevate:
          personeFisicheRilevate.size,

        numero_titolari_effettivi:
          titolariGruppo.length,

        livelli_gruppo: massimoLivello,
      },

      societa: societaView,

      titolari_effettivi_gruppo:
        titolariGruppo,
    };
  });
}
