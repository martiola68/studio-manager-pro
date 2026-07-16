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

  const [loading, setLoading] =
    useState(true);

  const [errore, setErrore] =
    useState("");

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

    void caricaDati(clienteId);
  }, [router.isReady, clienteId]);

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
                  Confronto AML
                </h2>

                <div style={sectionDescriptionStyle}>
                  Il confronto con il dato
                  registrato in AML sarà collegato
                  nel prossimo passaggio.
                </div>
              </div>
            </div>

            <div style={pendingStyle}>
              Dato AML non ancora caricato.
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
