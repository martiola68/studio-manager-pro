import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

type TitolareEffettivo = {
  persona_id: string;
  persona_nome: string;
  codice_fiscale: string | null;

  societa_id: string;
  societa_nome: string;

  quota_diretta: number;
  quota_indiretta: number;
  quota_complessiva: number;

  criterio_titolarita:
    | "proprieta"
    | "residuale";

  tipo_titolarita:
    | "diretta"
    | "indiretta"
    | "mista"
    | "residuale";

  ruolo?: string | null;
  carica?: string | null;
  principale?: boolean;

  valido_dal: string | null;
  valido_al: string | null;

  chiave_soggetto: string;

  percorsi: Array<{
    quota_percorso?: number;
    percorso_nomi?: string[];
  }>;
};

type TitolareVariazione = {
  persona_id: string;
  persona_nome: string;
  codice_fiscale: string | null;
  chiave_soggetto: string;
  criterio_titolarita: string;
  quota_complessiva: number;
};

type VariazioneEffettiva = {
  data: string;

  criterio_precedente:
    | "proprieta"
    | "residuale";

  criterio_successivo:
    | "proprieta"
    | "residuale";

  precedenti: TitolareVariazione[];
  successivi: TitolareVariazione[];
};

type RispostaApi = {
  cliente: {
    id: string;
    ragione_sociale: string | null;
    codice_fiscale: string | null;
  };

  data_riferimento: string;

  criterio_utilizzato:
    | "proprieta"
    | "residuale";

  titolari_effettivi:
    TitolareEffettivo[];

  numero_titolari_effettivi: number;

  date_potenziali_variazione: string[];

  variazioni_effettive:
    VariazioneEffettiva[];

  numero_variazioni_effettive: number;

  alert: {
    titolare_effettivo_assente: boolean;
    variazione_rilevata: boolean;
    data_ultima_variazione: string | null;
    messaggio: string | null;
  };
};

type TitolareAml = {
  id: string;
  chiave_soggetto: string;
  nome_cognome: string;
  codice_fiscale: string | null;
  sezioni: string[];
};

type RispostaAmlApi = {
  aml_presente: boolean;

  av4: {
    id: string;
    pratica_id: string | null;
    stato: string | null;
    versione: number | null;
    data_documento: string | null;
    compilato_da_cliente: boolean;
    caricato_manualmente: boolean;
  } | null;

  titolari_aml: TitolareAml[];
  numero_titolari_aml: number;
  messaggio: string | null;
};

type EsitoConfronto =
  | "ok"
  | "solo_soci"
  | "solo_aml"
  | "contrastante";

type RigaConfronto = {
  chiave_soggetto: string;

  nome_soci: string | null;
  nome_aml: string | null;

  codice_fiscale_soci: string | null;
  codice_fiscale_aml: string | null;

  presente_soci: boolean;
  presente_aml: boolean;

  esito: EsitoConfronto;
};

function formattaData(
  valore: string | null | undefined
): string {
  if (!valore) {
    return "—";
  }

  const parti = valore
    .slice(0, 10)
    .split("-");

  if (parti.length !== 3) {
    return valore;
  }

  return `${parti[2]}/${parti[1]}/${parti[0]}`;
}

function formattaPercentuale(
  valore: number | null | undefined
): string {
  return Number(valore || 0).toLocaleString(
    "it-IT",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ) + "%";
}

function formattaCriterio(
  valore: string | null | undefined
): string {
  switch (valore) {
    case "diretta":
      return "Proprietà diretta";

    case "indiretta":
      return "Proprietà indiretta";

    case "mista":
      return "Proprietà diretta e indiretta";

    case "residuale":
      return "Criterio residuale";

    case "proprieta":
      return "Criterio di proprietà";

    default:
      return "Non determinato";
  }
}

export default function VerificaTitolariEffettiviPage() {
  const router = useRouter();

  const clienteId = useMemo(() => {
    const valore = router.query.cliente_id;

    return typeof valore === "string"
      ? valore
      : "";
  }, [router.query.cliente_id]);

  const [dataRiferimento, setDataRiferimento] =
    useState("");

const [dati, setDati] =
  useState<RispostaApi | null>(null);

const [datiAml, setDatiAml] =
  useState<RispostaAmlApi | null>(null);

const [loading, setLoading] =
  useState(true);

 const [errore, setErrore] =
  useState("");

const [
  salvataggioVerifica,
  setSalvataggioVerifica,
] = useState(false);

const [
  verificaConfermata,
  setVerificaConfermata,
] = useState<{
  id: string;
  data_verifica: string;
  esito_confronto: string;
} | null>(null);

  async function caricaDati(
    clienteIdDaCaricare: string,
    data?: string
  ) {
    if (!clienteIdDaCaricare) {
      return;
    }

    setLoading(true);
    setErrore("");

    try {
      const queryData = data
        ? `?data_riferimento=${encodeURIComponent(
            data
          )}`
        : "";

      const response = await fetch(
        `/api/clienti/${clienteIdDaCaricare}/titolari-effettivi${queryData}`,
        {
          cache: "no-store",
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "Errore durante il caricamento dei Titolari Effettivi."
        );
      }

      const risultato =
        json as RispostaApi;

      setDati(risultato);

      setDataRiferimento(
        risultato.data_riferimento
      );
    } catch (error: any) {
      console.error(
        "Errore caricamento verifica TE:",
        error
      );

      setDati(null);

      setErrore(
        error?.message ||
          "Errore durante il caricamento dei Titolari Effettivi."
      );
    } finally {
    setLoading(false);
  }
}

async function caricaDatiAml(
  clienteIdDaCaricare: string
) {
  if (!clienteIdDaCaricare) {
    setDatiAml(null);
    return;
  }

  const response = await fetch(
    `/api/clienti/${clienteIdDaCaricare}/titolari-effettivi/aml`,
    {
      cache: "no-store",
    }
  );

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      json?.error ||
        "Errore durante il caricamento del dato AML."
    );
  }

  setDatiAml(
    json as RispostaAmlApi
  );
}

useEffect(() => {
    if (!router.isReady) {
      return;
    }

    if (!clienteId) {
      setLoading(false);
      setErrore(
        "Cliente non selezionato."
      );
      return;
    }

void Promise.all([
  caricaDati(clienteId),
  caricaDatiAml(clienteId),
]).catch((error: any) => {
  console.error(
    "Errore caricamento verifica TE:",
    error
  );

  setErrore(
    error?.message ||
      "Errore durante il caricamento della verifica."
  );
});
  
 }, [router.isReady, clienteId]);

const righeConfronto =
  useMemo<RigaConfronto[]>(() => {
    if (!dati) {
      return [];
    }

    const sociMap =
      new Map<string, TitolareEffettivo>();

    dati.titolari_effettivi.forEach(
      (titolare) => {
        sociMap.set(
          titolare.chiave_soggetto,
          titolare
        );
      }
    );

    const amlMap =
      new Map<string, TitolareAml>();

    (
      datiAml?.titolari_aml || []
    ).forEach((titolare) => {
      amlMap.set(
        titolare.chiave_soggetto,
        titolare
      );
    });

    const chiavi = new Set<string>([
      ...sociMap.keys(),
      ...amlMap.keys(),
    ]);

    return Array.from(chiavi)
      .map((chiave) => {
        const socio = sociMap.get(chiave);
        const aml = amlMap.get(chiave);

        const presenteSoci =
          Boolean(socio);

        const presenteAml =
          Boolean(aml);

        let esito: EsitoConfronto;

        if (
          presenteSoci &&
          presenteAml
        ) {
          const nomeSoci = String(
            socio?.persona_nome || ""
          )
            .trim()
            .toUpperCase();

          const nomeAml = String(
            aml?.nome_cognome || ""
          )
            .trim()
            .toUpperCase();

          esito =
            nomeSoci &&
            nomeAml &&
            nomeSoci !== nomeAml
              ? "contrastante"
              : "ok";
        } else if (presenteSoci) {
          esito = "solo_soci";
        } else {
          esito = "solo_aml";
        }

        return {
          chiave_soggetto: chiave,

          nome_soci:
            socio?.persona_nome || null,

          nome_aml:
            aml?.nome_cognome || null,

          codice_fiscale_soci:
            socio?.codice_fiscale || null,

          codice_fiscale_aml:
            aml?.codice_fiscale || null,

          presente_soci:
            presenteSoci,

          presente_aml:
            presenteAml,

          esito,
        };
      })
      .sort((a, b) =>
        String(
          a.nome_soci ||
            a.nome_aml ||
            ""
        ).localeCompare(
          String(
            b.nome_soci ||
              b.nome_aml ||
              ""
          ),
          "it"
        )
      );
  }, [dati, datiAml]);

async function confermaVerifica() {
  if (
    !clienteId ||
    !dati
  ) {
    return;
  }

  setSalvataggioVerifica(true);
  setErrore("");

  try {
    const response =
      await fetch(
        `/api/clienti/${clienteId}/titolari-effettivi/verifiche`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            data_riferimento:
              dati.data_riferimento,

            criterio_utilizzato:
              dati.criterio_utilizzato,

            titolari_soci:
              dati.titolari_effettivi,

            dati_aml:
              datiAml,

            righe_confronto:
              righeConfronto,

            variazione_rilevata:
              dati.alert
                .variazione_rilevata,

            data_variazione:
              dati.alert
                .data_ultima_variazione,

            note:
              null,
          }),
        }
      );

    const json =
      await response.json();

    if (!response.ok) {
      throw new Error(
        json?.error ||
          "Errore durante la conferma della verifica."
      );
    }

    setVerificaConfermata({
      id:
        json.verifica.id,

      data_verifica:
        json.verifica
          .data_verifica,

      esito_confronto:
        json.verifica
          .esito_confronto,
    });
  } catch (error: any) {
    console.error(
      "Errore conferma verifica:",
      error
    );

    setErrore(
      error?.message ||
        "Errore durante la conferma della verifica."
    );
  } finally {
    setSalvataggioVerifica(false);
  }
}

  function tornaAgliOrgani() {
    if (!clienteId) {
      router.push("/clienti");
      return;
    }

    router.push(
      `/clienti/organi-sociali?cliente_id=${clienteId}`
    );
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={loadingStyle}>
          Caricamento verifica Titolari
          Effettivi...
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={pageTitleStyle}>
            Verifica Titolari Effettivi
          </h1>

          <div style={subtitleStyle}>
            Controllo della situazione attuale
            e delle variazioni storiche risultanti
            dalla composizione sociale.
          </div>
        </div>

        <button
          type="button"
          onClick={tornaAgliOrgani}
          style={secondaryButtonStyle}
        >
          ← Torna a Soci e Organi
        </button>
      </div>

      {errore && (
        <div style={errorStyle}>
          {errore}
        </div>
      )}

      {dati && (
        <>
          <section style={cardStyle}>
            <div style={companyHeaderStyle}>
              <div>
                <div style={sectionLabelStyle}>
                  Società
                </div>

                <h2 style={companyTitleStyle}>
                  {dati.cliente
                    .ragione_sociale ||
                    "Società senza denominazione"}
                </h2>

                <div style={companyCfStyle}>
                  Codice fiscale:{" "}
                  {dati.cliente
                    .codice_fiscale ||
                    "non disponibile"}
                </div>
              </div>

              <div
                style={{
                  ...badgeStyle,

                  background:
                    dati.criterio_utilizzato ===
                    "proprieta"
                      ? "#dbeafe"
                      : "#fef3c7",

                  color:
                    dati.criterio_utilizzato ===
                    "proprieta"
                      ? "#1d4ed8"
                      : "#92400e",
                }}
              >
                {dati.criterio_utilizzato ===
                "proprieta"
                  ? "CRITERIO DI PROPRIETÀ"
                  : "CRITERIO RESIDUALE"}
              </div>
            </div>

            <div style={dateSelectorStyle}>
              <div>
                <label style={labelStyle}>
                  Data di riferimento
                </label>

                <input
                  type="date"
                  value={dataRiferimento}
                  onChange={(event) =>
                    setDataRiferimento(
                      event.target.value
                    )
                  }
                  style={inputStyle}
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  caricaDati(
                    clienteId,
                    dataRiferimento
                  )
                }
                disabled={!dataRiferimento}
                style={{
                  ...primaryButtonStyle,

                  opacity: dataRiferimento
                    ? 1
                    : 0.5,

                  cursor: dataRiferimento
                    ? "pointer"
                    : "not-allowed",
                }}
              >
                Verifica alla data
              </button>
            </div>
          </section>

          {dati.alert
            .variazione_rilevata &&
            dati.alert
              .data_ultima_variazione && (
              <section style={alertStyle}>
                <div style={alertTitleStyle}>
                  ⚠ Variazione del Titolare
                  Effettivo
                </div>

                <div style={alertTextStyle}>
                  Ultima variazione rilevata
                  in data{" "}
                  <strong>
                    {formattaData(
                      dati.alert
                        .data_ultima_variazione
                    )}
                  </strong>
                  .
                </div>
              </section>
            )}

          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}>
                  Titolari Effettivi alla data{" "}
                  {formattaData(
                    dati.data_riferimento
                  )}
                </h2>

                <div style={sectionDescriptionStyle}>
                  Numero di soggetti individuati:{" "}
                  {
                    dati.numero_titolari_effettivi
                  }
                </div>
              </div>
            </div>

            {dati.titolari_effettivi
              .length === 0 ? (
              <div style={emptyStyle}>
                Nessun Titolare Effettivo
                individuato alla data selezionata.
              </div>
            ) : (
              <div style={gridStyle}>
                {dati.titolari_effettivi.map(
                  (titolare) => (
                    <article
                      key={
                        titolare
                          .chiave_soggetto
                      }
                      style={personCardStyle}
                    >
                      <div
                        style={
                          personNameStyle
                        }
                      >
                        {
                          titolare
                            .persona_nome
                        }
                      </div>

                      <div
                        style={
                          personCfStyle
                        }
                      >
                        CF:{" "}
                        {titolare
                          .codice_fiscale ||
                          "non disponibile"}
                      </div>

                      <div
                        style={
                          detailsGridStyle
                        }
                      >
                        <div>
                          <div
                            style={
                              detailLabelStyle
                            }
                          >
                            Criterio
                          </div>

                          <div
                            style={
                              detailValueStyle
                            }
                          >
                            {formattaCriterio(
                              titolare
                                .tipo_titolarita
                            )}
                          </div>
                        </div>

                        <div>
                          <div
                            style={
                              detailLabelStyle
                            }
                          >
                            Quota complessiva
                          </div>

                          <div
                            style={
                              detailValueStyle
                            }
                          >
                            {titolare
                              .criterio_titolarita ===
                            "residuale"
                              ? "Non applicabile"
                              : formattaPercentuale(
                                  titolare
                                    .quota_complessiva
                                )}
                          </div>
                        </div>

                        <div>
                          <div
                            style={
                              detailLabelStyle
                            }
                          >
                            Valido dal
                          </div>

                          <div
                            style={
                              detailValueStyle
                            }
                          >
                            {formattaData(
                              titolare
                                .valido_dal
                            )}
                          </div>
                        </div>

                        <div>
                          <div
                            style={
                              detailLabelStyle
                            }
                          >
                            Valido fino al
                          </div>

                          <div
                            style={
                              detailValueStyle
                            }
                          >
                            {titolare
                              .valido_al
                              ? formattaData(
                                  titolare
                                    .valido_al
                                )
                              : "In corso"}
                          </div>
                        </div>
                      </div>

                      {titolare
                        .criterio_titolarita ===
                        "residuale" && (
                        <div
                          style={
                            residualStyle
                          }
                        >
                          {titolare.carica ||
                            titolare.ruolo ||
                            "Amministratore"}
                        </div>
                      )}

                      {titolare.percorsi &&
                        titolare.percorsi
                          .length > 0 && (
                          <div
                            style={
                              pathsStyle
                            }
                          >
                            {titolare.percorsi.map(
                              (
                                percorso,
                                indice
                              ) => (
                                <div
                                  key={
                                    indice
                                  }
                                  style={{
                                    marginTop:
                                      indice ===
                                      0
                                        ? 0
                                        : 7,
                                  }}
                                >
                                  {(
                                    percorso
                                      .percorso_nomi ||
                                    []
                                  ).join(
                                    " → "
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        )}
                    </article>
                  )
                )}
              </div>
            )}
          </section>

          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}>
                  Storico variazioni
                </h2>

                <div style={sectionDescriptionStyle}>
                  Variazioni effettive rilevate:{" "}
                  {
                    dati.numero_variazioni_effettive
                  }
                </div>
              </div>
            </div>

            {dati.variazioni_effettive
              .length === 0 ? (
              <div style={emptyStyle}>
                Nessuna variazione storica
                rilevata.
              </div>
            ) : (
              <div style={timelineStyle}>
                {dati.variazioni_effettive.map(
                  (variazione) => (
                    <div
                      key={
                        variazione.data
                      }
                      style={
                        timelineItemStyle
                      }
                    >
                      <div
                        style={
                          timelineDateStyle
                        }
                      >
                        {formattaData(
                          variazione.data
                        )}
                      </div>

                      <div
                        style={
                          comparisonGridStyle
                        }
                      >
                        <div
                          style={
                            previousBoxStyle
                          }
                        >
                          <div
                            style={
                              comparisonTitleStyle
                            }
                          >
                            Situazione precedente
                          </div>

                          {variazione
                            .precedenti.length ===
                          0 ? (
                            <div
                              style={
                                comparisonEmptyStyle
                              }
                            >
                              Nessun Titolare
                              Effettivo
                            </div>
                          ) : (
                            variazione.precedenti.map(
                              (
                                titolare
                              ) => (
                                <div
                                  key={
                                    titolare
                                      .chiave_soggetto
                                  }
                                  style={
                                    comparisonPersonStyle
                                  }
                                >
                                  <strong>
                                    {
                                      titolare
                                        .persona_nome
                                    }
                                  </strong>

                                  <div>
                                    {titolare
                                      .codice_fiscale ||
                                      "CF non disponibile"}
                                  </div>
                                </div>
                              )
                            )
                          )}
                        </div>

                        <div
                          style={
                            currentBoxStyle
                          }
                        >
                          <div
                            style={
                              comparisonTitleStyle
                            }
                          >
                            Nuova situazione
                          </div>

                          {variazione
                            .successivi.length ===
                          0 ? (
                            <div
                              style={
                                comparisonEmptyStyle
                              }
                            >
                              Nessun Titolare
                              Effettivo
                            </div>
                          ) : (
                            variazione.successivi.map(
                              (
                                titolare
                              ) => (
                                <div
                                  key={
                                    titolare
                                      .chiave_soggetto
                                  }
                                  style={
                                    comparisonPersonStyle
                                  }
                                >
                                  <strong>
                                    {
                                      titolare
                                        .persona_nome
                                    }
                                  </strong>

                                  <div>
                                    {titolare
                                      .codice_fiscale ||
                                      "CF non disponibile"}
                                  </div>
                                </div>
                              )
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

         <section style={cardStyle}>
  <div style={sectionHeaderStyle}>
    <div>
      <h2 style={sectionTitleStyle}>
        Confronto Soci / AML
      </h2>

      <div style={sectionDescriptionStyle}>
        Confronto tra il Titolare Effettivo
        risultante dalla composizione sociale
        e quello registrato nell’ultimo AV4.
      </div>
    </div>
  </div>

  {!datiAml?.aml_presente && (
    <div
      style={{
        ...pendingStyle,
        background: "#fff7ed",
        color: "#9a3412",
        border: "1px solid #fed7aa",
        marginBottom: 16,
      }}
    >
      Nessun modello AV4 presente per il cliente.
    </div>
  )}

  {righeConfronto.length === 0 ? (
    <div style={pendingStyle}>
      Nessun Titolare Effettivo presente
      nelle fonti confrontate.
    </div>
  ) : (
    <div
      style={{
        overflowX: "auto",
        marginTop: 18,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
        }}
      >
        <thead>
          <tr>
            <th style={comparisonThStyle}>
              Soggetto
            </th>

            <th style={comparisonThStyle}>
              Composizione sociale
            </th>

            <th style={comparisonThStyle}>
              AML
            </th>

            <th style={comparisonThStyle}>
              Esito
            </th>
          </tr>
        </thead>

        <tbody>
          {righeConfronto.map((riga) => (
            <tr key={riga.chiave_soggetto}>
              <td style={comparisonTdStyle}>
                <strong>
                  {riga.nome_soci ||
                    riga.nome_aml ||
                    "Nominativo non disponibile"}
                </strong>

                <div
                  style={{
                    marginTop: 3,
                    color: "#64748b",
                  }}
                >
                  {riga.codice_fiscale_soci ||
                    riga.codice_fiscale_aml ||
                    "CF non disponibile"}
                </div>
              </td>

              <td style={comparisonTdStyle}>
                {riga.presente_soci
                  ? "Presente"
                  : "Assente"}
              </td>

              <td style={comparisonTdStyle}>
                {riga.presente_aml
                  ? "Presente"
                  : "Assente"}
              </td>

              <td style={comparisonTdStyle}>
                <span
                  style={{
                    ...comparisonBadgeStyle,

                    background:
                      riga.esito === "ok"
                        ? "#dcfce7"
                        : riga.esito ===
                            "contrastante"
                        ? "#fee2e2"
                        : "#fef3c7",

                    color:
                      riga.esito === "ok"
                        ? "#166534"
                        : riga.esito ===
                            "contrastante"
                        ? "#991b1b"
                        : "#92400e",
                  }}
                >
                  {riga.esito === "ok"
                    ? "Dato verificato – OK"
                    : riga.esito ===
                      "solo_soci"
                    ? "Presente solo in Soci"
                    : riga.esito ===
                      "solo_aml"
                    ? "Presente solo in AML"
                    : "Dato contrastante"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}

  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 14,
      marginTop: 20,
      paddingTop: 18,
      borderTop: "1px solid #e2e8f0",
      flexWrap: "wrap",
    }}
  >
    <div>
      {verificaConfermata ? (
        <div
          style={{
            padding: "10px 13px",
            borderRadius: 8,
            background: "#dcfce7",
            color: "#166534",
            fontSize: 13,
          }}
        >
          Verifica confermata e salvata
          correttamente.
        </div>
      ) : (
        <div
          style={{
            color: "#64748b",
            fontSize: 13,
          }}
        >
          La conferma salva la situazione
          attuale e il confronto nello storico.
        </div>
      )}
    </div>

    <button
      type="button"
      onClick={confermaVerifica}
      disabled={
        salvataggioVerifica ||
        Boolean(verificaConfermata)
      }
      style={{
        padding: "10px 16px",
        borderRadius: 8,
        border: "1px solid #16a34a",

        background:
          verificaConfermata
            ? "#94a3b8"
            : "#16a34a",

        color: "#ffffff",
        fontWeight: 400,

        cursor:
          salvataggioVerifica ||
          Boolean(verificaConfermata)
            ? "not-allowed"
            : "pointer",
      }}
    >
      {salvataggioVerifica
        ? "Salvataggio..."
        : verificaConfermata
        ? "Verifica confermata"
        : "Conferma verifica"}
    </button>
  </div>
</section>
        </>
      )}
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "28px",
  background: "#f8fafc",
  color: "#0f172a",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 20,
  marginBottom: 22,
};

const pageTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 30,
  fontWeight: 800,
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 6,
  color: "#64748b",
  fontSize: 14,
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe2ea",
  borderRadius: 12,
  padding: 20,
  marginBottom: 18,
};

const companyHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
};

const sectionLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
};

const companyTitleStyle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: 23,
};

const companyCfStyle: React.CSSProperties = {
  marginTop: 5,
  color: "#64748b",
  fontSize: 13,
};

const badgeStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "7px 11px",
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const dateSelectorStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: 12,
  marginTop: 20,
  flexWrap: "wrap",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 12,
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  minWidth: 180,
  padding: "9px 11px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "10px 15px",
  border: "1px solid #2563eb",
  borderRadius: 8,
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: 400,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "10px 15px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 400,
  cursor: "pointer",
};

const alertStyle: React.CSSProperties = {
  marginBottom: 18,
  padding: 16,
  border: "1px solid #fbbf24",
  borderRadius: 10,
  background: "#fffbeb",
  color: "#92400e",
};

const alertTitleStyle: React.CSSProperties = {
  fontWeight: 800,
};

const alertTextStyle: React.CSSProperties = {
  marginTop: 5,
  fontSize: 14,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 19,
};

const sectionDescriptionStyle: React.CSSProperties = {
  marginTop: 5,
  color: "#64748b",
  fontSize: 13,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 14,
  marginTop: 18,
};

const personCardStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  borderRadius: 10,
  padding: 16,
  background: "#f8fff9",
};

const personNameStyle: React.CSSProperties = {
  color: "#166534",
  fontSize: 16,
  fontWeight: 800,
};

const personCfStyle: React.CSSProperties = {
  marginTop: 4,
  color: "#475569",
  fontSize: 13,
};

const detailsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(120px, 1fr))",
  gap: 14,
  marginTop: 15,
};

const detailLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
};

const detailValueStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 14,
  fontWeight: 700,
};

const residualStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 10,
  borderRadius: 8,
  background: "#fef3c7",
  color: "#92400e",
  fontSize: 13,
};

const pathsStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 10,
  borderRadius: 8,
  background: "#eff6ff",
  color: "#1e3a8a",
  fontSize: 12,
};

const timelineStyle: React.CSSProperties = {
  marginTop: 18,
};

const timelineItemStyle: React.CSSProperties = {
  borderLeft: "4px solid #2563eb",
  paddingLeft: 16,
  paddingBottom: 22,
};

const timelineDateStyle: React.CSSProperties = {
  fontWeight: 800,
  color: "#1d4ed8",
  marginBottom: 10,
};

const comparisonGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
};

const previousBoxStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 9,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
};

const currentBoxStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 9,
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
};

const comparisonTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
  marginBottom: 10,
};

const comparisonPersonStyle: React.CSSProperties = {
  marginTop: 8,
  paddingTop: 8,
  borderTop: "1px solid rgba(100,116,139,0.2)",
  fontSize: 13,
};

const comparisonEmptyStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
};

const pendingStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 14,
  borderRadius: 9,
  background: "#f1f5f9",
  color: "#64748b",
};

const emptyStyle: React.CSSProperties = {
  marginTop: 18,
  padding: 16,
  borderRadius: 9,
  background: "#f1f5f9",
  color: "#64748b",
};

const errorStyle: React.CSSProperties = {
  marginBottom: 18,
  padding: 15,
  borderRadius: 9,
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 700,
};

const loadingStyle: React.CSSProperties = {
  padding: 30,
  textAlign: "center",
  color: "#64748b",
};

const comparisonThStyle:
  React.CSSProperties = {
  padding: "11px 12px",
  textAlign: "left",
  borderBottom: "2px solid #cbd5e1",
  background: "#f8fafc",
  fontSize: 11,
  textTransform: "uppercase",
  color: "#475569",
};

const comparisonTdStyle:
  React.CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "middle",
};

const comparisonBadgeStyle:
  React.CSSProperties = {
  display: "inline-block",
  padding: "6px 9px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: "nowrap",
};
