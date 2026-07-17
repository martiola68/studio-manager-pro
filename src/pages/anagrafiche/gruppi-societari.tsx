import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Network,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";

type TitolareEffettivoGruppo = {
  persona_id: string;
  persona_nome: string;

  societa: Array<{
    societa_id: string;
    societa_nome: string;
    quota_complessiva: number;

    tipo_titolarita:
      | "diretta"
      | "indiretta"
      | "diretta_e_indiretta"
      | "residuale";
  }>;
};

type TitolareEffettivoView = {
  persona_id: string;
  persona_nome: string;

  quota_diretta: number;
  quota_indiretta: number;
  quota_complessiva: number;

  tipo_titolarita:
    | "diretta"
    | "indiretta"
    | "diretta_e_indiretta"
    | "residuale";

  criterio_titolarita?:
    | "proprieta"
    | "residuale";

  ruolo?: string | null;
  carica?: string | null;
  principale?: boolean;
};

type SocioDirettoView = {
  id: string;
  nome: string;
  tipo: "persona_fisica" | "societa";
  quota_diretta: number;
  classificazione: string;
};

type SocietaCollegataView = {
  societa_id: string;
  societa_nome: string;
  quota: number;
  classificazione: string;

  soci_diretti: SocioDirettoView[];
  titolari_effettivi: TitolareEffettivoView[];
};

type SocietaGruppo = {
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

  societa_collegate: SocietaCollegataView[];

  altre_partecipazioni: Array<{
    societa_id: string;
    societa_nome: string;
    quota: number;
    classificazione: string;

    soci_diretti?: SocioDirettoView[];
    titolari_effettivi?: TitolareEffettivoView[];
  }>;

  soci_diretti: SocioDirettoView[];

  titolari_effettivi: TitolareEffettivoView[];
};

type GruppoSocietario = {
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

  societa: SocietaGruppo[];

  titolari_effettivi_gruppo:
    TitolareEffettivoGruppo[];
};

type SocietaSingola = {
  id: string;
  ragione_sociale: string;
  codice_fiscale: string | null;

  soci_diretti: SocioDirettoView[];

  titolari_effettivi:
    TitolareEffettivoView[];

  numero_soci_diretti: number;
  numero_titolari_effettivi: number;
};

type TitolareEffettivoApi = {
  persona_id: string;
  persona_nome: string;

  societa_id?: string;
  partecipata_id?: string;

  quota_diretta: number;
  quota_indiretta: number;
  quota_complessiva: number;

  tipo_titolarita:
    | "diretta"
    | "indiretta"
    | "diretta_e_indiretta"
    | "residuale";

  criterio_titolarita?:
    | "proprieta"
    | "residuale";

  ruolo?: string | null;
  carica?: string | null;
  principale?: boolean;

  candidato_titolare_effettivo: boolean;
};

type ApiResponse = {
  gruppi_dettaglio?: GruppoSocietario[];
  societa_singole?: SocietaSingola[];
  titolari_effettivi?: TitolareEffettivoApi[];
  error?: string;
};

type RisultatoRicerca = {
  chiave: string;

  tipo:
    | "societa_gruppo"
    | "societa_collegata"
    | "societa_singola"
    | "persona_fisica";

  nome: string;
  descrizione: string;

  gruppo_id?: string;
  societa_id?: string;

  societa_collegata_id?: string;
  societa_singola_id?: string;

  persona_id?: string;
};

function formattaPercentuale(value: number) {
  return `${Number(value || 0).toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })}%`;
}

function getEtichettaRuolo(
  ruolo: SocietaGruppo["ruolo_nel_gruppo"]
) {
  if (ruolo === "capogruppo") {
    return "Capogruppo";
  }

  if (ruolo === "controllata_diretta") {
    return "Controllata diretta";
  }

  return "Controllata indiretta";
}

function getEtichettaTitolarita(
  tipo:
    | "diretta"
    | "indiretta"
    | "diretta_e_indiretta"
    | "residuale"
) {
  if (tipo === "diretta") {
    return "Diretta";
  }

  if (tipo === "indiretta") {
    return "Indiretta";
  }

  if (tipo === "residuale") {
    return "Criterio residuale";
  }

  return "Diretta e indiretta";
}

export default function GruppiSocietariPage() {
  const router = useRouter();

  const [gruppi, setGruppi] = useState<GruppoSocietario[]>([]);
  const [gruppoSelezionatoId, setGruppoSelezionatoId] =
    useState("");

  const [societaSingole, setSocietaSingole] = useState<
  SocietaSingola[]
>([]);

  const [titolariEffettivi, setTitolariEffettivi] = useState<
  TitolareEffettivoApi[]
>([]);

  const [societaSelezionataId, setSocietaSelezionataId] =
    useState("");

  const [
  societaSingolaSelezionataId,
  setSocietaSingolaSelezionataId,
] = useState("");

  const [
  societaCollegataSelezionataId,
  setSocietaCollegataSelezionataId,
] = useState("");

  const [gruppiAperti, setGruppiAperti] = useState<
    Record<string, boolean>
  >({});

  const [loading, setLoading] = useState(true);
const [errore, setErrore] = useState("");

const [ricerca, setRicerca] = useState("");

  async function caricaGruppi() {
    setLoading(true);
    setErrore("");

    try {
      const response = await fetch("/api/gruppi-societari", {
        cache: "no-store",
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Errore durante il caricamento dei gruppi societari"
        );
      }

      const nuoviGruppi = data.gruppi_dettaglio || [];

     setGruppi(nuoviGruppi);

setSocietaSingole(data.societa_singole || []);

setTitolariEffettivi(
  data.titolari_effettivi || []
);
      if (nuoviGruppi.length > 0) {
        setGruppoSelezionatoId((precedente) => {
          const ancoraPresente = nuoviGruppi.some(
            (gruppo) => gruppo.id === precedente
          );

          return ancoraPresente
            ? precedente
            : nuoviGruppi[0].id;
        });

      setGruppiAperti((precedente) => {
  const prossimo = { ...precedente };

  nuoviGruppi.forEach((gruppo) => {
    if (prossimo[gruppo.id] === undefined) {
      prossimo[gruppo.id] = false;
    }
  });

  return prossimo;
});
        
      } else {
        setGruppoSelezionatoId("");
        setSocietaSelezionataId("");
      }
    } catch (error: any) {
      console.error(error);
      setErrore(
        error?.message ||
          "Impossibile caricare i gruppi societari"
      );
      setGruppi([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    caricaGruppi();
  }, []);

  const gruppoSelezionato = useMemo(
    () =>
      gruppi.find(
        (gruppo) => gruppo.id === gruppoSelezionatoId
      ) || null,
    [gruppi, gruppoSelezionatoId]
  );

  useEffect(() => {
    if (!gruppoSelezionato) {
      setSocietaSelezionataId("");
      return;
    }

    const societaAncoraPresente =
      gruppoSelezionato.societa.some(
        (societa) =>
          societa.id === societaSelezionataId
      );

    if (!societaAncoraPresente) {
      setSocietaSelezionataId(
        gruppoSelezionato.capogruppo.id
      );
    }
  }, [
    gruppoSelezionato,
    societaSelezionataId,
  ]);

const societaSelezionata = useMemo(() => {
  if (!gruppoSelezionato) {
    return null;
  }

  return (
    gruppoSelezionato.societa.find(
      (societa) =>
        societa.id === societaSelezionataId
    ) || null
  );
}, [
  gruppoSelezionato,
  societaSelezionataId,
]);

const societaSingolaSelezionata = useMemo(() => {
  return (
    societaSingole.find(
      (societa) =>
        societa.id === societaSingolaSelezionataId
    ) || null
  );
}, [
  societaSingole,
  societaSingolaSelezionataId,
]);

  const societaCollegateGruppo = useMemo(() => {
  if (!gruppoSelezionato) {
    return [];
  }

  const societaInterneIds = new Set(
    gruppoSelezionato.societa.map(
      (societa) => String(societa.id)
    )
  );

 const collegateMap = new Map<
  string,
  {
    societa_id: string;
    societa_nome: string;
    quota: number;
    classificazione: string;

    soci_diretti: SocietaGruppo["soci_diretti"];
    titolari_effettivi: SocietaGruppo["titolari_effettivi"];

    collegata_da_id: string;
    collegata_da_nome: string;
  }
>();

  gruppoSelezionato.societa.forEach(
    (societaInterna) => {
      societaInterna.societa_collegate.forEach(
        (collegata) => {
          const collegataId = String(
            collegata.societa_id
          );

          /*
           * Esclude:
           * - la stessa società;
           * - società già appartenenti materialmente al gruppo;
           * - duplicati.
           */
          if (
            collegataId === String(societaInterna.id) ||
            societaInterneIds.has(collegataId)
          ) {
            return;
          }

          const chiave = `${societaInterna.id}-${collegataId}`;

          if (!collegateMap.has(chiave)) {
           collegateMap.set(chiave, {
  societa_id: collegata.societa_id,
  societa_nome: collegata.societa_nome,
  quota: collegata.quota,
  classificazione:
    collegata.classificazione,

  soci_diretti:
    collegata.soci_diretti || [],

  titolari_effettivi:
    collegata.titolari_effettivi || [],

  collegata_da_id: societaInterna.id,
  collegata_da_nome: societaInterna.nome,
});
          }
        }
      );
    }
  );

  return Array.from(collegateMap.values()).sort(
    (a, b) =>
      a.societa_nome.localeCompare(
        b.societa_nome,
        "it"
      )
  );
}, [gruppoSelezionato]);

const societaCollegataSelezionata = useMemo(() => {
  return (
    societaCollegateGruppo.find(
      (societa) =>
        String(societa.societa_id) ===
        String(societaCollegataSelezionataId)
    ) || null
  );
}, [
  societaCollegateGruppo,
  societaCollegataSelezionataId,
]);

const titolariSocietaCollegata = useMemo(() => {
  return (
    societaCollegataSelezionata
      ?.titolari_effettivi || []
  );
}, [societaCollegataSelezionata]);

  const risultatiRicerca = useMemo<RisultatoRicerca[]>(() => {
  const testo = ricerca.trim().toLowerCase();

  if (testo.length < 2) {
    return [];
  }

  const risultati = new Map<
    string,
    RisultatoRicerca
  >();

  gruppi.forEach((gruppo) => {
    gruppo.societa.forEach((societa) => {
      if (
        societa.nome
          .toLowerCase()
          .includes(testo)
      ) {
        const chiave =
          `societa-gruppo-${gruppo.id}-${societa.id}`;

        risultati.set(chiave, {
          chiave,
          tipo: "societa_gruppo",
          nome: societa.nome,
          descrizione:
            `${gruppo.denominazione} · ${getEtichettaRuolo(
              societa.ruolo_nel_gruppo
            )}`,
          gruppo_id: gruppo.id,
          societa_id: societa.id,
        });
      }

      societa.soci_diretti.forEach((socio) => {
        if (
          socio.tipo === "persona_fisica" &&
          socio.nome
            .toLowerCase()
            .includes(testo)
        ) {
          const chiave =
            `persona-socio-${socio.id}-${societa.id}`;

          risultati.set(chiave, {
            chiave,
            tipo: "persona_fisica",
            nome: socio.nome,
            descrizione:
              `Socio di ${societa.nome} · ${formattaPercentuale(
                socio.quota_diretta
              )}`,
            gruppo_id: gruppo.id,
            societa_id: societa.id,
            persona_id: socio.id,
          });
        }
      });

      societa.titolari_effettivi.forEach(
        (titolare) => {
          if (
            titolare.persona_nome
              .toLowerCase()
              .includes(testo)
          ) {
            const chiave =
              `persona-titolare-${titolare.persona_id}-${societa.id}`;

            risultati.set(chiave, {
              chiave,
              tipo: "persona_fisica",
              nome: titolare.persona_nome,
              descrizione:
                `Titolare effettivo di ${societa.nome} · ${getEtichettaTitolarita(
                  titolare.tipo_titolarita
                )}`,
              gruppo_id: gruppo.id,
              societa_id: societa.id,
              persona_id:
                titolare.persona_id,
            });
          }
        }
      );

      societa.societa_collegate.forEach(
        (collegata) => {
          if (
            String(collegata.societa_id) ===
            String(societa.id)
          ) {
            return;
          }

          if (
            collegata.societa_nome
              .toLowerCase()
              .includes(testo)
          ) {
            const chiave =
              `societa-collegata-${gruppo.id}-${collegata.societa_id}`;

            risultati.set(chiave, {
              chiave,
              tipo: "societa_collegata",
              nome: collegata.societa_nome,
              descrizione:
                `Collegata a ${societa.nome} · ${formattaPercentuale(
                  collegata.quota
                )}`,
              gruppo_id: gruppo.id,
              societa_collegata_id:
                collegata.societa_id,
            });
          }

          (
            collegata.titolari_effettivi || []
          ).forEach((titolare) => {
            if (
              titolare.persona_nome
                .toLowerCase()
                .includes(testo)
            ) {
              const chiave =
                `persona-collegata-${titolare.persona_id}-${collegata.societa_id}`;

              risultati.set(chiave, {
                chiave,
                tipo: "persona_fisica",
                nome: titolare.persona_nome,
                descrizione:
                  `Titolare effettivo di ${collegata.societa_nome} · ${getEtichettaTitolarita(
                    titolare.tipo_titolarita
                  )}`,
                gruppo_id: gruppo.id,
                societa_collegata_id:
                  collegata.societa_id,
                persona_id:
                  titolare.persona_id,
              });
            }
          });
        }
      );
    });
  });

  societaSingole.forEach((societa) => {
    if (
      societa.ragione_sociale
        .toLowerCase()
        .includes(testo)
    ) {
      const chiave =
        `societa-singola-${societa.id}`;

      risultati.set(chiave, {
        chiave,
        tipo: "societa_singola",
        nome: societa.ragione_sociale,
        descrizione: "Società singola",
        societa_singola_id: societa.id,
      });
    }

    societa.soci_diretti.forEach((socio) => {
      if (
        socio.tipo === "persona_fisica" &&
        socio.nome
          .toLowerCase()
          .includes(testo)
      ) {
        const chiave =
          `persona-singola-socio-${socio.id}-${societa.id}`;

        risultati.set(chiave, {
          chiave,
          tipo: "persona_fisica",
          nome: socio.nome,
          descrizione:
            `Socio di ${societa.ragione_sociale} · ${formattaPercentuale(
              socio.quota_diretta
            )}`,
          societa_singola_id: societa.id,
          persona_id: socio.id,
        });
      }
    });

    societa.titolari_effettivi.forEach(
      (titolare) => {
        if (
          titolare.persona_nome
            .toLowerCase()
            .includes(testo)
        ) {
          const chiave =
            `persona-singola-titolare-${titolare.persona_id}-${societa.id}`;

          risultati.set(chiave, {
            chiave,
            tipo: "persona_fisica",
            nome: titolare.persona_nome,
            descrizione:
              `Titolare effettivo di ${societa.ragione_sociale} · ${getEtichettaTitolarita(
                titolare.tipo_titolarita
              )}`,
            societa_singola_id: societa.id,
            persona_id:
              titolare.persona_id,
          });
        }
      }
    );
  });

  return Array.from(risultati.values())
    .sort((a, b) =>
      a.nome.localeCompare(b.nome, "it")
    )
    .slice(0, 30);
}, [
  ricerca,
  gruppi,
  societaSingole,
]);

  function apriRisultatoRicerca(
  risultato: RisultatoRicerca
) {
  if (
    risultato.tipo === "societa_singola" ||
    risultato.societa_singola_id
  ) {
    setSocietaCollegataSelezionataId("");
    setGruppoSelezionatoId("");
    setSocietaSelezionataId("");

    setSocietaSingolaSelezionataId(
      risultato.societa_singola_id || ""
    );

    setRicerca("");
    return;
  }

  if (
    risultato.tipo === "societa_collegata" ||
    risultato.societa_collegata_id
  ) {
    setSocietaSingolaSelezionataId("");

    if (risultato.gruppo_id) {
      setGruppoSelezionatoId(
        risultato.gruppo_id
      );
    }

    setSocietaSelezionataId("");

    setSocietaCollegataSelezionataId(
      risultato.societa_collegata_id || ""
    );

    setRicerca("");
    return;
  }

  if (
    risultato.gruppo_id &&
    risultato.societa_id
  ) {
    setSocietaCollegataSelezionataId("");
    setSocietaSingolaSelezionataId("");

    setGruppoSelezionatoId(
      risultato.gruppo_id
    );

    setSocietaSelezionataId(
      risultato.societa_id
    );

    setRicerca("");
  }
}

function selezionaGruppo(gruppo: GruppoSocietario) {
  setSocietaCollegataSelezionataId("");
  setSocietaSingolaSelezionataId("");
  setGruppoSelezionatoId(gruppo.id);
  setSocietaSelezionataId(gruppo.capogruppo.id);
}

 function toggleGruppo(gruppoId: string) {
  setGruppiAperti((precedente) => ({
    ...precedente,
    [gruppoId]: !precedente[gruppoId],
  }));
}

function stampaGruppoSelezionato() {
  if (!gruppoSelezionato) {
    alert("Seleziona prima un gruppo societario.");
    return;
  }

  window.open(
    `/stampa/gruppo-societario?id=${encodeURIComponent(
      gruppoSelezionato.id
    )}`,
    "_blank",
    "noopener,noreferrer"
  );
}
  
  return (
    <main style={paginaStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={titoloPaginaStyle}>
            Gruppi societari
          </h1>

          <p style={sottotitoloStyle}>
            Consultazione delle capogruppo, società
            controllate, collegate e titolari effettivi.
          </p>
        </div>

        <div style={azioniHeaderStyle}>
         <button
  type="button"
  onClick={caricaGruppi}
  disabled={loading}
  style={bottoneSecondarioStyle}
>
  <RefreshCw size={17} />
  Aggiorna
</button>

<button
  type="button"
  onClick={stampaGruppoSelezionato}
  disabled={!gruppoSelezionato}
  style={{
    ...bottoneSecondarioStyle,
    opacity: gruppoSelezionato ? 1 : 0.55,
    cursor: gruppoSelezionato
      ? "pointer"
      : "not-allowed",
  }}
>
  <Printer size={17} />
  Stampa gruppo
</button>

<button
  type="button"
  onClick={() => router.push("/clienti")}
  style={bottoneSecondarioStyle}
>
  ← Torna ai clienti
</button>
        </div>
      </div>

      {errore && (
        <div style={erroreStyle}>
          {errore}
        </div>
      )}

      <div style={ricercaWrapperStyle}>
  <div style={ricercaInputWrapperStyle}>
    <Search
      size={18}
      style={ricercaIconaStyle}
    />

    <input
      type="text"
      value={ricerca}
      onChange={(event) =>
        setRicerca(event.target.value)
      }
      placeholder="Cerca società o persona fisica..."
      style={ricercaInputStyle}
    />
  </div>

  {ricerca.trim().length >= 2 && (
    <div style={risultatiRicercaStyle}>
      {risultatiRicerca.length === 0 ? (
        <div style={nessunRisultatoStyle}>
          Nessun nominativo trovato.
        </div>
      ) : (
        risultatiRicerca.map((risultato) => (
          <button
            type="button"
            key={risultato.chiave}
            onClick={() =>
              apriRisultatoRicerca(
                risultato
              )
            }
            style={risultatoRicercaButtonStyle}
          >
            <div>
              <div
                style={
                  risultatoRicercaNomeStyle
                }
              >
                {risultato.nome}
              </div>

              <div
                style={
                  risultatoRicercaDescrizioneStyle
                }
              >
                {risultato.descrizione}
              </div>
            </div>

            <ChevronRight size={17} />
          </button>
        ))
      )}
    </div>
  )}
</div>

      {loading ? (
        <div style={statoVuotoStyle}>
          <RefreshCw
            size={24}
            style={{
              animation: "spin 1s linear infinite",
            }}
          />

          <span>
            Caricamento gruppi societari...
          </span>
        </div>
      ) : gruppi.length === 0 ? (
        <div style={statoVuotoStyle}>
          <Network size={34} />

          <strong>
            Nessun gruppo societario individuato
          </strong>

          <span>
            Un gruppo viene ricostruito quando una società
            possiede più del 50% di un’altra società.
          </span>
        </div>
      ) : (
        <>
          <div style={cardsRiepilogoStyle}>
            <RiepilogoCard
              icona={<Network size={22} />}
              etichetta="Gruppi individuati"
              valore={gruppi.length}
            />

            <RiepilogoCard
              icona={<Building2 size={22} />}
              etichetta="Società nei gruppi"
              valore={gruppi.reduce(
                (totale, gruppo) =>
                  totale +
                  gruppo.riepilogo.numero_societa,
                0
              )}
            />

            <RiepilogoCard
  icona={<Building2 size={22} />}
  etichetta="Società singole"
  valore={societaSingole.length}
/>

            <RiepilogoCard
              icona={<ShieldCheck size={22} />}
              etichetta="Titolari effettivi"
              valore={gruppi.reduce(
                (totale, gruppo) =>
                  totale +
                  gruppo.riepilogo
                    .numero_titolari_effettivi,
                0
              )}
            />
          </div>

          <div style={layoutStyle}>
            <aside style={sidebarStyle}>
              <div style={titoloPannelloStyle}>
                <Network size={19} />
                Struttura gruppi
              </div>

              <div style={elencoGruppiStyle}>
                {gruppi.map((gruppo) => {
                  const aperto =
                    gruppiAperti[gruppo.id] !== false;

                  const selezionato =
                    gruppo.id ===
                    gruppoSelezionatoId;

                  return (
                    <div
                      key={gruppo.id}
                      style={gruppoSidebarStyle}
                    >
                      <div
                        style={{
                          ...rigaGruppoStyle,
                          ...(selezionato
                            ? rigaGruppoSelezionataStyle
                            : {}),
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            toggleGruppo(gruppo.id)
                          }
                          style={bottoneChevronStyle}
                        >
                          {aperto ? (
                            <ChevronDown size={17} />
                          ) : (
                            <ChevronRight size={17} />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            selezionaGruppo(gruppo)
                          }
                          style={bottoneGruppoStyle}
                        >
                          <Building2 size={17} />

                          <span>
                            {gruppo.denominazione}
                          </span>
                        </button>
                      </div>

                      {aperto && (
                        <div style={alberoStyle}>
                          {gruppo.societa
                            .sort(
                              (a, b) =>
                                a.livello -
                                  b.livello ||
                                a.nome.localeCompare(
                                  b.nome
                                )
                            )
                            .map((societa) => {
                              const societaAttiva =
                                societa.id ===
                                  societaSelezionataId &&
                                selezionato;

                              return (
                                <button
                                  type="button"
                                  key={societa.id}
 onClick={() => {
  setSocietaCollegataSelezionataId("");
  setSocietaSingolaSelezionataId("");

  setGruppoSelezionatoId(
    gruppo.id
  );

  setSocietaSelezionataId(
    societa.id
  );
}}
                                  style={{
                                    ...rigaSocietaAlberoStyle,
                                    paddingLeft:
                                      14 +
                                      societa.livello *
                                        20,

                                    ...(societaAttiva
                                      ? rigaSocietaAttivaStyle
                                      : {}),
                                  }}
                                >
                                  <span
                                    style={{
                                      ...puntoAlberoStyle,
                                      ...(societa.ruolo_nel_gruppo ===
                                      "capogruppo"
                                        ? puntoCapogruppoStyle
                                        : {}),
                                    }}
                                  />

                                  <span
                                    style={{
                                      flex: 1,
                                      textAlign: "left",
                                    }}
                                  >
                                    {societa.nome}
                                  </span>

                                  {societa.livello > 0 && (
                                    <span
                                      style={
                                        quotaCompattaStyle
                                      }
                                    >
                                      {formattaPercentuale(
                                        societa
                                          .controllante_diretta
                                          ?.quota || 0
                                      )}
                                    </span>
                                  )}
                                </button>
                              );
                                                      })}

                          {gruppo.id ===
                            gruppoSelezionatoId &&
                            societaCollegateGruppo.length >
                              0 && (
                              <div
                                style={{
                                  marginTop: 8,
                                  paddingTop: 8,
                                  borderTop:
                                    "1px solid #e2e8f0",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 7,
                                    padding:
                                      "5px 10px 7px",
                                    color: "#92400e",
                                    fontSize: 12,
                                    fontWeight: 800,
                                    textTransform:
                                      "uppercase",
                                  }}
                                >
                                  <Network size={14} />
                                  Società collegate
                                </div>

                               {societaCollegateGruppo.map(
  (collegata) => {
    const attiva =
      String(collegata.societa_id) ===
      String(societaCollegataSelezionataId);

    return (
      <button
        type="button"
        key={`${collegata.collegata_da_id}-${collegata.societa_id}`}
        onClick={() => {
          setSocietaSingolaSelezionataId("");
          setSocietaSelezionataId("");
          setSocietaCollegataSelezionataId(
            String(collegata.societa_id)
          );
        }}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          minHeight: 36,
          padding: "7px 9px 7px 34px",
          border: 0,
          borderRadius: 8,
          background: attiva
            ? "#fef3c7"
            : "transparent",
          color: "#92400e",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
        }}
      >
                                      <span
                                        style={{
                                          ...puntoAlberoStyle,
                                          background:
                                            "#f59e0b",
                                        }}
                                      />

                                      <div
                                        style={{
                                          flex: 1,
                                          minWidth: 0,
                                        }}
                                      >
                                        <div>
                                          {
                                            collegata.societa_nome
                                          }
                                        </div>

                                        <div
                                          style={{
                                            marginTop: 2,
                                            color:
                                              "#64748b",
                                            fontSize: 10,
                                          }}
                                        >
                                          Collegata a{" "}
                                          {
                                            collegata.collegata_da_nome
                                          }
                                        </div>
                                      </div>

                                      <span
                                        style={
                                          quotaCompattaStyle
                                        }
                                      >
                                        {formattaPercentuale(
                                          collegata.quota
                                        )}
                                      </span>
                                    </button>
    );
  }
)}
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  );
               })}
              </div>

              {societaSingole.length > 0 && (
                <>
                  <div
                    style={{
                      marginTop: 20,
                      marginBottom: 10,
                      fontWeight: 800,
                      color: "#475569",
                    }}
                  >
                    Società singole
                  </div>

                  <div style={gruppoSidebarStyle}>
                    {societaSingole.map((societa) => (
                      <button
                        key={societa.id}
                        type="button"
                       style={{
  ...rigaSocietaAlberoStyle,
  paddingLeft: 14,

  ...(societa.id ===
  societaSingolaSelezionataId
    ? rigaSocietaAttivaStyle
    : {}),
}}
 onClick={() => {
  setSocietaCollegataSelezionataId("");
  setGruppoSelezionatoId("");
  setSocietaSelezionataId("");

  setSocietaSingolaSelezionataId(
    societa.id
  );
}}
                      >
                        <span
                          style={{
                            ...puntoAlberoStyle,
                            background: "#0ea5e9",
                          }}
                        />

                        <span
                          style={{
                            flex: 1,
                            textAlign: "left",
                          }}
                        >
                          {societa.ragione_sociale}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </aside>

        <section style={contenutoStyle}>
  {societaCollegataSelezionata ? (
    <>
      <div style={testataGruppoStyle}>
        <div>
          <div style={eyebrowStyle}>
            Società collegata
          </div>

          <h2 style={titoloGruppoStyle}>
            {
              societaCollegataSelezionata
                .societa_nome
            }
          </h2>

          <div
            style={{
              ...badgeCapogruppoStyle,
              background: "#fef3c7",
              color: "#92400e",
            }}
          >
            <Network size={15} />
            Società collegata
          </div>
        </div>

        <div style={riepilogoGruppoStyle}>
          <DatoCompatto
            etichetta="Quota"
            valore={
              societaCollegataSelezionata.quota
            }
          />
        </div>
      </div>

      <div style={cardPrincipaleStyle}>
        <div style={intestazioneCardStyle}>
          <div>
            <div style={eyebrowStyle}>
              Società selezionata
            </div>

            <h3 style={titoloCardStyle}>
              {
                societaCollegataSelezionata
                  .societa_nome
              }
            </h3>
          </div>

          <span
            style={{
              ...badgeRuoloSocietaStyle,
              background: "#fef3c7",
              color: "#92400e",
            }}
          >
            Collegata
          </span>
        </div>

        <div style={grigliaDatiSocietaStyle}>
          <DatoSocieta
            etichetta="Collegata a"
            valore={
              societaCollegataSelezionata
                .collegata_da_nome
            }
          />

          <DatoSocieta
            etichetta="Quota detenuta"
            valore={formattaPercentuale(
              societaCollegataSelezionata.quota
            )}
          />

          <DatoSocieta
            etichetta="Classificazione"
            valore="Società collegata"
          />

          <DatoSocieta
            etichetta="Gruppo di riferimento"
            valore={
              gruppoSelezionato?.denominazione ||
              "—"
            }
          />
        </div>
      </div>

     <div style={cardStyle}>
  <div style={titoloPannelloStyle}>
    <ShieldCheck size={19} />
    Titolari effettivi
  </div>

  {titolariSocietaCollegata.length === 0 ? (
    <div style={testoVuotoStyle}>
      Nessun titolare effettivo individuato
      tramite le partecipazioni.
    </div>
  ) : (
    <div style={listaStyle}>
      {titolariSocietaCollegata.map(
        (titolare) => (
          <div
            key={`${societaCollegataSelezionata?.societa_id}-${titolare.persona_id}`}
            style={rigaListaStyle}
          >
            <div>
              <strong>
                {titolare.persona_nome}
              </strong>

              <div style={dettaglioListaStyle}>
                {getEtichettaTitolarita(
                  titolare.tipo_titolarita
                )}
              </div>
            </div>

           <span style={titolareBadgeStyle}>
  {titolare.tipo_titolarita ===
  "residuale"
    ? titolare.carica ||
      titolare.ruolo ||
      "Amministratore"
    : formattaPercentuale(
        titolare.quota_complessiva
      )}
</span>
          </div>
        )
      )}
    </div>
  )}
</div>
    </>
  ) : gruppoSelezionato ? (
                <>
                  <div style={testataGruppoStyle}>
                    <div>
                      <div style={eyebrowStyle}>
                        Gruppo societario
                      </div>

                      <h2 style={titoloGruppoStyle}>
                        {
                          gruppoSelezionato
                            .capogruppo.nome
                        }
                      </h2>

                      <div style={badgeCapogruppoStyle}>
                        <Building2 size={15} />
                        Capogruppo
                      </div>
                    </div>

                    <div style={riepilogoGruppoStyle}>
                      <DatoCompatto
                        etichetta="Società"
                        valore={
                          gruppoSelezionato.riepilogo
                            .numero_societa
                        }
                      />

                      <DatoCompatto
                        etichetta="Dirette"
                        valore={
                          gruppoSelezionato.riepilogo
                            .numero_controllate_dirette
                        }
                      />

                      <DatoCompatto
                        etichetta="Indirette"
                        valore={
                          gruppoSelezionato.riepilogo
                            .numero_controllate_indirette
                        }
                      />
<DatoCompatto
  etichetta="Collegate"
  valore={societaCollegateGruppo.length}
/>

                      <DatoCompatto
                        etichetta="Livelli"
                        valore={
                          gruppoSelezionato.riepilogo
                            .livelli_gruppo
                        }
                      />
                    </div>
                  </div>

                  {societaSelezionata && (
                    <>
                      <div style={cardPrincipaleStyle}>
                        <div style={intestazioneCardStyle}>
                          <div>
                            <div style={eyebrowStyle}>
                              Società selezionata
                            </div>

                            <h3 style={titoloCardStyle}>
                              {societaSelezionata.nome}
                            </h3>
                          </div>

                          <span
                            style={
                              badgeRuoloSocietaStyle
                            }
                          >
                            {getEtichettaRuolo(
                              societaSelezionata.ruolo_nel_gruppo
                            )}
                          </span>
                        </div>

                        <div style={grigliaDatiSocietaStyle}>
                          <DatoSocieta
                            etichetta="Livello nel gruppo"
                            valore={String(
                              societaSelezionata.livello
                            )}
                          />

                          <DatoSocieta
                            etichetta="Controllante diretta"
                            valore={
                              societaSelezionata
                                .controllante_diretta
                                ?.nome || "—"
                            }
                          />

                          <DatoSocieta
                            etichetta="Quota diretta"
                            valore={
                              societaSelezionata
                                .controllante_diretta
                                ? formattaPercentuale(
                                    societaSelezionata
                                      .controllante_diretta
                                      .quota
                                  )
                                : "—"
                            }
                          />

                          <DatoSocieta
                            etichetta="Quota dalla capogruppo"
                            valore={formattaPercentuale(
                              societaSelezionata
                                .quota_dalla_capogruppo
                            )}
                          />

                          <DatoSocieta
                            etichetta="Controllante ultima"
                            valore={
                              societaSelezionata
                                .controllante_ultima.nome
                            }
                          />

                          <DatoSocieta
                            etichetta="Percorso"
                            valore={societaSelezionata.percorso_nomi.join(
                              " → "
                            )}
                          />
                        </div>
                      </div>

                      <div style={dueColonneStyle}>
                        <div style={cardStyle}>
                          <div style={titoloPannelloStyle}>
                            <Users size={19} />
                            Soci diretti
                          </div>

                          {societaSelezionata
                            .soci_diretti.length === 0 ? (
                            <div style={testoVuotoStyle}>
                              Nessun socio rilevato.
                            </div>
                          ) : (
                            <div style={listaStyle}>
                              {societaSelezionata.soci_diretti.map(
                                (socio) => (
                                  <div
                                    key={`${societaSelezionata.id}-${socio.id}`}
                                    style={rigaListaStyle}
                                  >
                                    <div>
                                      <strong>
                                        {socio.nome}
                                      </strong>

                                      <div
                                        style={
                                          dettaglioListaStyle
                                        }
                                      >
                                        {socio.tipo ===
                                        "societa"
                                          ? "Società"
                                          : "Persona fisica"}
                                      </div>
                                    </div>

                                    <span
                                      style={
                                        quotaBadgeStyle
                                      }
                                    >
                                      {formattaPercentuale(
                                        socio.quota_diretta
                                      )}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>

                        <div style={cardStyle}>
                          <div style={titoloPannelloStyle}>
                            <ShieldCheck size={19} />
                            Titolari effettivi
                          </div>

                          {societaSelezionata
                            .titolari_effettivi.length ===
                          0 ? (
                            <div style={testoVuotoStyle}>
                              Nessun titolare effettivo
                              individuato tramite le
                              partecipazioni.
                            </div>
                          ) : (
                            <div style={listaStyle}>
                              {societaSelezionata.titolari_effettivi.map(
                                (titolare) => (
                                  <div
                                    key={`${societaSelezionata.id}-${titolare.persona_id}`}
                                    style={rigaListaStyle}
                                  >
                                    <div>
                                      <strong>
                                        {
                                          titolare.persona_nome
                                        }
                                      </strong>

                                      <div
                                        style={
                                          dettaglioListaStyle
                                        }
                                      >
                                        {getEtichettaTitolarita(
                                          titolare.tipo_titolarita
                                        )}
                                      </div>
                                    </div>

                                    <span
                                      style={
                                        titolareBadgeStyle
                                      }
                                    >
                                      {formattaPercentuale(
                                        titolare.quota_complessiva
                                      )}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={dueColonneStyle}>
                        <div style={cardStyle}>
                          <div style={titoloPannelloStyle}>
                            <Building2 size={19} />
                            Società controllate
                          </div>

                          {societaSelezionata
                            .societa_figlie.length === 0 ? (
                            <div style={testoVuotoStyle}>
                              Nessuna controllata diretta.
                            </div>
                          ) : (
                            <div style={listaStyle}>
                              {societaSelezionata.societa_figlie.map(
                                (figlia) => (
                                  <button
                                    type="button"
                                    key={figlia.id}
                                    onClick={() =>
                                      setSocietaSelezionataId(
                                        figlia.id
                                      )
                                    }
                                    style={
                                      rigaListaButtonStyle
                                    }
                                  >
                                    <strong>
                                      {figlia.nome}
                                    </strong>

                                    <span
                                      style={
                                        quotaBadgeStyle
                                      }
                                    >
                                      {formattaPercentuale(
                                        figlia.quota
                                      )}
                                    </span>
                                  </button>
                                )
                              )}
                            </div>
                          )}
                        </div>

                        <div style={cardStyle}>
                          <div style={titoloPannelloStyle}>
                            <Network size={19} />
                            Società collegate
                          </div>

                         {societaSelezionata.societa_collegate.filter(
                          (collegata) =>
                            String(collegata.societa_id) !==
                            String(societaSelezionata.id)
                            ).length === 0 ? (
                            <div style={testoVuotoStyle}>
                              Nessuna società collegata.
                            </div>
                          ) : (
                            <div style={listaStyle}>
                              {societaSelezionata.societa_collegate
  .filter(
    (collegata) =>
      String(collegata.societa_id) !==
      String(societaSelezionata.id)
  )
  .map((collegata) => (
                                  <div
                                    key={
                                      collegata.societa_id
                                    }
                                    style={rigaListaStyle}
                                  >
                                    <strong>
                                      {
                                        collegata.societa_nome
                                      }
                                    </strong>

                                    <span
                                      style={
                                        quotaBadgeCollegataStyle
                                      }
                                    >
                                      {formattaPercentuale(
                                        collegata.quota
                                      )}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={cardStyle}>
                        <div style={titoloPannelloStyle}>
                          <ShieldCheck size={19} />
                          Titolari effettivi del gruppo
                        </div>

                        {gruppoSelezionato
                          .titolari_effettivi_gruppo
                          .length === 0 ? (
                          <div style={testoVuotoStyle}>
                            Nessun titolare effettivo
                            individuato per il gruppo.
                          </div>
                        ) : (
                          <div style={tabellaWrapperStyle}>
                            <table style={tabellaStyle}>
                              <thead>
                                <tr>
                                  <th
                                    style={
                                      intestazioneTabellaStyle
                                    }
                                  >
                                    Persona fisica
                                  </th>

                                  <th
                                    style={
                                      intestazioneTabellaStyle
                                    }
                                  >
                                    Società
                                  </th>

                                  <th
                                    style={
                                      intestazioneTabellaStyle
                                    }
                                  >
                                    Tipologia
                                  </th>

                                  <th
                                    style={
                                      intestazioneTabellaDestraStyle
                                    }
                                  >
                                    Quota complessiva
                                  </th>
                                </tr>
                              </thead>

                              <tbody>
                                {gruppoSelezionato.titolari_effettivi_gruppo.flatMap(
                                  (persona) =>
                                    persona.societa.map(
                                      (
                                        societa,
                                        indice
                                      ) => (
                                        <tr
                                          key={`${persona.persona_id}-${societa.societa_id}`}
                                        >
                                          <td
                                            style={
                                              cellaTabellaStyle
                                            }
                                          >
                                            {indice ===
                                            0 ? (
                                              <strong>
                                                {
                                                  persona.persona_nome
                                                }
                                              </strong>
                                            ) : (
                                              ""
                                            )}
                                          </td>

                                          <td
                                            style={
                                              cellaTabellaStyle
                                            }
                                          >
                                            {
                                              societa.societa_nome
                                            }
                                          </td>

                                          <td
                                            style={
                                              cellaTabellaStyle
                                            }
                                          >
                                            {getEtichettaTitolarita(
                                              societa.tipo_titolarita
                                            )}
                                          </td>

                                          <td
                                            style={
                                              cellaTabellaDestraStyle
                                            }
                                          >
                                            <strong>
                                              {formattaPercentuale(
                                                societa.quota_complessiva
                                              )}
                                            </strong>
                                          </td>
                                        </tr>
                                      )
                                    )
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                              </>
              ) : societaSingolaSelezionata ? (
                <>
                  <div style={testataGruppoStyle}>
                    <div>
                      <div style={eyebrowStyle}>
                        Società singola
                      </div>

                      <h2 style={titoloGruppoStyle}>
                        {
                          societaSingolaSelezionata
                            .ragione_sociale
                        }
                      </h2>

                      <div style={badgeCapogruppoStyle}>
                        <Building2 size={15} />
                        Società autonoma
                      </div>
                    </div>

                    <div style={riepilogoGruppoStyle}>
                      <DatoCompatto
                        etichetta="Soci diretti"
                        valore={
                          societaSingolaSelezionata
                            .soci_diretti.length
                        }
                      />

                      <DatoCompatto
                        etichetta="Titolari effettivi"
                        valore={
                          societaSingolaSelezionata
                            .titolari_effettivi.length
                        }
                      />
                    </div>
                  </div>

                  <div style={cardPrincipaleStyle}>
                    <div style={intestazioneCardStyle}>
                      <div>
                        <div style={eyebrowStyle}>
                          Società selezionata
                        </div>

                        <h3 style={titoloCardStyle}>
                          {
                            societaSingolaSelezionata
                              .ragione_sociale
                          }
                        </h3>
                      </div>

                      <span style={badgeRuoloSocietaStyle}>
                        Società singola
                      </span>
                    </div>

                    <div style={grigliaDatiSocietaStyle}>
                      <DatoSocieta
                        etichetta="Codice fiscale"
                        valore={
                          societaSingolaSelezionata
                            .codice_fiscale || "—"
                        }
                      />

                      <DatoSocieta
                        etichetta="Appartenenza"
                        valore="Nessun gruppo societario"
                      />

                      <DatoSocieta
                        etichetta="Soci diretti"
                        valore={String(
                          societaSingolaSelezionata
                            .soci_diretti.length
                        )}
                      />

                      <DatoSocieta
                        etichetta="Titolari effettivi"
                        valore={String(
                          societaSingolaSelezionata
                            .titolari_effettivi.length
                        )}
                      />
                    </div>
                  </div>

                  <div style={dueColonneStyle}>
                    <div style={cardStyle}>
                      <div style={titoloPannelloStyle}>
                        <Users size={19} />
                        Soci diretti
                      </div>

                      {societaSingolaSelezionata
                        .soci_diretti.length === 0 ? (
                        <div style={testoVuotoStyle}>
                          Nessun socio rilevato.
                        </div>
                      ) : (
                        <div style={listaStyle}>
                          {societaSingolaSelezionata.soci_diretti.map(
                            (socio) => (
                              <div
                                key={`${societaSingolaSelezionata.id}-${socio.id}`}
                                style={rigaListaStyle}
                              >
                                <div>
                                  <strong>
                                    {socio.nome}
                                  </strong>

                                  <div
                                    style={
                                      dettaglioListaStyle
                                    }
                                  >
                                    {socio.tipo ===
                                    "societa"
                                      ? "Società"
                                      : "Persona fisica"}
                                  </div>
                                </div>

                                <span
                                  style={quotaBadgeStyle}
                                >
                                  {formattaPercentuale(
                                    socio.quota_diretta
                                  )}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    <div style={cardStyle}>
                      <div style={titoloPannelloStyle}>
                        <ShieldCheck size={19} />
                        Titolari effettivi
                      </div>

                      {societaSingolaSelezionata
                        .titolari_effettivi.length ===
                      0 ? (
                        <div style={testoVuotoStyle}>
                          Nessun titolare effettivo
                          individuato tramite le
                          partecipazioni.
                        </div>
                      ) : (
                        <div style={listaStyle}>
                          {societaSingolaSelezionata.titolari_effettivi.map(
                            (titolare) => (
                              <div
                                key={`${societaSingolaSelezionata.id}-${titolare.persona_id}`}
                                style={rigaListaStyle}
                              >
                                <div>
                                  <strong>
                                    {
                                      titolare.persona_nome
                                    }
                                  </strong>

                                  <div
                                    style={
                                      dettaglioListaStyle
                                    }
                                  >
                                    {getEtichettaTitolarita(
                                      titolare.tipo_titolarita
                                    )}
                                  </div>
                                </div>

                                <span
                                  style={titolareBadgeStyle}
                                >
                                  {formattaPercentuale(
                                    titolare.quota_complessiva
                                  )}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </section>
                 </div>
        </>
      )}

    
    </main>
  );
}

function RiepilogoCard({
  icona,
  etichetta,
  valore,
}: {
  icona: React.ReactNode;
  etichetta: string;
  valore: number;
}) {
  return (
    <div style={riepilogoCardStyle}>
      <div style={iconaCardStyle}>{icona}</div>

      <div>
        <div style={valoreCardStyle}>{valore}</div>
        <div style={etichettaCardStyle}>{etichetta}</div>
      </div>
    </div>
  );
}

function DatoCompatto({
  etichetta,
  valore,
}: {
  etichetta: string;
  valore: number;
}) {
  return (
    <div style={datoCompattoStyle}>
      <strong style={datoCompattoValoreStyle}>
        {valore}
      </strong>

      <span style={datoCompattoEtichettaStyle}>
        {etichetta}
      </span>
    </div>
  );
}

function DatoSocieta({
  etichetta,
  valore,
}: {
  etichetta: string;
  valore: string;
}) {
  return (
    <div style={datoSocietaStyle}>
      <div style={datoSocietaEtichettaStyle}>
        {etichetta}
      </div>

      <div style={datoSocietaValoreStyle}>
        {valore}
      </div>
    </div>
  );
}

const ricercaWrapperStyle: React.CSSProperties = {
  position: "relative",
  marginBottom: 18,
  zIndex: 20,
};

const ricercaInputWrapperStyle: React.CSSProperties = {
  position: "relative",
  maxWidth: 620,
};

const ricercaIconaStyle: React.CSSProperties = {
  position: "absolute",
  left: 14,
  top: "50%",
  transform: "translateY(-50%)",
  color: "#64748b",
  pointerEvents: "none",
};

const ricercaInputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  padding: "11px 14px 11px 43px",
  border: "1px solid #cbd5e1",
  borderRadius: 11,
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 14,
  outline: "none",
};

const risultatiRicercaStyle: React.CSSProperties = {
  position: "absolute",
  top: 52,
  left: 0,
  width: "min(700px, 100%)",
  maxHeight: 430,
  overflowY: "auto",
  padding: 7,
  border: "1px solid #cbd5e1",
  borderRadius: 11,
  background: "#ffffff",
  boxShadow:
    "0 16px 40px rgba(15, 23, 42, 0.14)",
};

const risultatoRicercaButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  padding: "11px 12px",
  border: 0,
  borderRadius: 8,
  background: "transparent",
  color: "#0f172a",
  textAlign: "left",
  cursor: "pointer",
};

const risultatoRicercaNomeStyle: React.CSSProperties = {
  fontWeight: 800,
};

const risultatoRicercaDescrizioneStyle: React.CSSProperties = {
  marginTop: 3,
  color: "#64748b",
  fontSize: 12,
};

const nessunRisultatoStyle: React.CSSProperties = {
  padding: 16,
  color: "#64748b",
  textAlign: "center",
};

const paginaStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: 28,
  background: "#f8fafc",
  color: "#0f172a",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 20,
  marginBottom: 24,
};

const titoloPaginaStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 34,
  fontWeight: 800,
};

const sottotitoloStyle: React.CSSProperties = {
  marginTop: 7,
  marginBottom: 0,
  color: "#64748b",
};

const azioniHeaderStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const bottoneSecondarioStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "10px 14px",
  border: "1px solid #cbd5e1",
  borderRadius: 9,
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 700,
  cursor: "pointer",
};

const erroreStyle: React.CSSProperties = {
  padding: 14,
  marginBottom: 18,
  borderRadius: 10,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#b91c1c",
  fontWeight: 600,
};

const statoVuotoStyle: React.CSSProperties = {
  minHeight: 300,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: 12,
  padding: 30,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  color: "#64748b",
  textAlign: "center",
};

const cardsRiepilogoStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  marginBottom: 18,
};

const riepilogoCardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: 18,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 13,
};

const iconaCardStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 11,
  background: "#eff6ff",
  color: "#2563eb",
};

const valoreCardStyle: React.CSSProperties = {
  fontSize: 25,
  fontWeight: 800,
};

const etichettaCardStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
};

const layoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "330px minmax(0, 1fr)",
  gap: 18,
  alignItems: "start",
};

const sidebarStyle: React.CSSProperties = {
  position: "sticky",
  top: 18,
  maxHeight: "calc(100vh - 36px)",
  overflow: "auto",
  padding: 16,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
};

const contenutoStyle: React.CSSProperties = {
  minWidth: 0,
};

const titoloPannelloStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  marginBottom: 14,
  fontSize: 17,
  fontWeight: 800,
};

const elencoGruppiStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const gruppoSidebarStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  overflow: "hidden",
};

const rigaGruppoStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "7px 8px",
  background: "#ffffff",
};

const rigaGruppoSelezionataStyle: React.CSSProperties = {
  background: "#eff6ff",
};

const bottoneChevronStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: 0,
  background: "transparent",
  cursor: "pointer",
};

const bottoneGruppoStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  gap: 8,
  border: 0,
  background: "transparent",
  fontWeight: 800,
  textAlign: "left",
  cursor: "pointer",
};

const alberoStyle: React.CSSProperties = {
  padding: "6px 6px 9px",
  background: "#f8fafc",
};

const rigaSocietaAlberoStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 36,
  display: "flex",
  alignItems: "center",
  gap: 8,
  paddingTop: 7,
  paddingBottom: 7,
  paddingRight: 9,
  border: 0,
  borderRadius: 8,
  background: "transparent",
  color: "#334155",
  cursor: "pointer",
};

const rigaSocietaAttivaStyle: React.CSSProperties = {
  background: "#dbeafe",
  color: "#1d4ed8",
  fontWeight: 800,
};

const puntoAlberoStyle: React.CSSProperties = {
  width: 9,
  height: 9,
  flexShrink: 0,
  borderRadius: "50%",
  background: "#94a3b8",
};

const puntoCapogruppoStyle: React.CSSProperties = {
  background: "#2563eb",
};

const quotaCompattaStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#475569",
};

const testataGruppoStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  marginBottom: 18,
  padding: 22,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
};

const eyebrowStyle: React.CSSProperties = {
  marginBottom: 5,
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const titoloGruppoStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 27,
  fontWeight: 800,
};

const badgeCapogruppoStyle: React.CSSProperties = {
  width: "fit-content",
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginTop: 10,
  padding: "6px 9px",
  borderRadius: 999,
  background: "#dbeafe",
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 800,
};

const riepilogoGruppoStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const datoCompattoStyle: React.CSSProperties = {
  minWidth: 76,
  padding: "9px 11px",
  borderRadius: 10,
  background: "#f8fafc",
  textAlign: "center",
};

const datoCompattoValoreStyle: React.CSSProperties = {
  display: "block",
  fontSize: 20,
};

const datoCompattoEtichettaStyle: React.CSSProperties = {
  display: "block",
  marginTop: 2,
  color: "#64748b",
  fontSize: 11,
};

const cardPrincipaleStyle: React.CSSProperties = {
  padding: 20,
  marginBottom: 18,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
};

const cardStyle: React.CSSProperties = {
  padding: 18,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
};

const intestazioneCardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "flex-start",
  marginBottom: 18,
};

const titoloCardStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 23,
};

const badgeRuoloSocietaStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "#f1f5f9",
  color: "#334155",
  fontSize: 12,
  fontWeight: 800,
};

const grigliaDatiSocietaStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 12,
};

const datoSocietaStyle: React.CSSProperties = {
  padding: 13,
  borderRadius: 10,
  background: "#f8fafc",
};

const datoSocietaEtichettaStyle: React.CSSProperties = {
  marginBottom: 5,
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
};

const datoSocietaValoreStyle: React.CSSProperties = {
  fontWeight: 800,
  wordBreak: "break-word",
};

const dueColonneStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 18,
  marginBottom: 18,
};

const listaStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 9,
};

const rigaListaStyle: React.CSSProperties = {
  minHeight: 53,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "11px 12px",
  borderRadius: 9,
  background: "#f8fafc",
};

const rigaListaButtonStyle: React.CSSProperties = {
  ...rigaListaStyle,
  width: "100%",
  border: 0,
  color: "#0f172a",
  textAlign: "left",
  cursor: "pointer",
};

const dettaglioListaStyle: React.CSSProperties = {
  marginTop: 3,
  color: "#64748b",
  fontSize: 12,
};

const quotaBadgeStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: "6px 9px",
  borderRadius: 999,
  background: "#dbeafe",
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 800,
};

const quotaBadgeCollegataStyle: React.CSSProperties = {
  ...quotaBadgeStyle,
  background: "#fef3c7",
  color: "#92400e",
};

const titolareBadgeStyle: React.CSSProperties = {
  ...quotaBadgeStyle,
  background: "#dcfce7",
  color: "#166534",
};

const testoVuotoStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 9,
  background: "#f8fafc",
  color: "#64748b",
  textAlign: "center",
};

const tabellaWrapperStyle: React.CSSProperties = {
  overflowX: "auto",
};

const tabellaStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const intestazioneTabellaStyle: React.CSSProperties = {
  padding: "11px 12px",
  borderBottom: "1px solid #cbd5e1",
  color: "#475569",
  fontSize: 12,
  textAlign: "left",
};

const intestazioneTabellaDestraStyle: React.CSSProperties = {
  ...intestazioneTabellaStyle,
  textAlign: "right",
};

const cellaTabellaStyle: React.CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 13,
};

const cellaTabellaDestraStyle: React.CSSProperties = {
  ...cellaTabellaStyle,
  textAlign: "right",
};

const stampaTitoloStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 25,
  fontWeight: 800,
};

const stampaDataStyle: React.CSSProperties = {
  marginTop: 6,
  color: "#475569",
  fontSize: 12,
};

const stampaRiepilogoStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 8,
  padding: 14,
  marginBottom: 20,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  fontSize: 13,
};

const stampaSezioneStyle: React.CSSProperties = {
  marginBottom: 22,
  breakInside: "avoid",
};

const stampaSottotitoloStyle: React.CSSProperties = {
  margin: "0 0 10px",
  paddingBottom: 6,
  borderBottom: "1px solid #94a3b8",
  fontSize: 17,
};

const stampaRigaSocietaStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "7px 9px",
  marginBottom: 5,
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  fontSize: 12,
  breakInside: "avoid",
};

const stampaDettaglioStyle: React.CSSProperties = {
  marginTop: 3,
  color: "#475569",
  fontSize: 11,
};

const stampaTestoVuotoStyle: React.CSSProperties = {
  padding: 10,
  color: "#64748b",
  fontSize: 12,
  fontStyle: "italic",
};

const stampaBloccoTitolariStyle: React.CSSProperties = {
  marginBottom: 14,
  breakInside: "avoid",
};

const stampaNomeSocietaStyle: React.CSSProperties = {
  margin: "0 0 6px",
  fontSize: 14,
};

const stampaRigaTitolareStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "7px 9px",
  marginBottom: 4,
  background: "#f8fafc",
  borderRadius: 6,
  fontSize: 12,
};
