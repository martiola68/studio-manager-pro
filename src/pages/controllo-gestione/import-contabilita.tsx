import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "../../lib/supabaseClient";

type Cliente = {
  id: string;
  ragione_sociale: string | null;
  codice_fiscale: string | null;
};

type Controllo = {
  id: string;
  cliente_id: string;
  cadenza_controllo: string | null;
  data_esecuzione: string | null;
};

type VoceCdG = {
  id: string;
  codice: string;
  descrizione: string;
  sezione: string;
  macrovoce: string | null;
  natura: string;
  ordine: number;
};

type ContoDaMappare = {
  codice_conto: string;
  descrizione_conto: string;
  importo: number;
  sezione: string;
  codice_padre: string | null;
};

type ImportResult = {
  success: boolean;

  import_id: string;

  file: {
    nome: string | null;
    societa: string;
    codice_azienda: string;
    periodo_dal: string | null;
    periodo_al: string | null;
  };

  quadratura: {
    statoPatrimoniale: boolean;
    contoEconomico: boolean;
    differenzaSP: number;
    differenzaCE: number;
  };

  riepilogo: {
    righe_lette: number;
    conti_importati: number;
    conti_mappati: number;
    conti_da_mappare: number;
    conti_esclusi: number;
    anomalie: number;
  };

  stato: string;
  anomalie: string[];

  da_mappare: ContoDaMappare[];
};

function euro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dataIt(value: string | null | undefined) {
  if (!value) return "-";

  const [anno, mese, giorno] = value.split("-");

  if (!anno || !mese || !giorno) return value;

  return `${giorno}/${mese}/${anno}`;
}

function labelSezione(sezione: string) {
  switch (sezione) {
    case "SP_ATTIVO":
      return "Stato patrimoniale - Attivo";

    case "SP_PASSIVO":
      return "Stato patrimoniale - Passivo";

    case "CE_COSTI":
      return "Conto economico - Costi";

    case "CE_RICAVI":
      return "Conto economico - Ricavi";

    default:
      return sezione || "-";
  }
}

async function leggiCsvDatev(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();

  return new TextDecoder("windows-1252").decode(buffer);
}

export default function ImportContabilitaPage() {
  const router = useRouter();

  const [studioId, setStudioId] = useState("");

  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState("");

  const [controllo, setControllo] =
    useState<Controllo | null>(null);

  const [voci, setVoci] = useState<VoceCdG[]>([]);

  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingCliente, setLoadingCliente] =
    useState(false);

  const [errore, setErrore] = useState("");
  const [messaggio, setMessaggio] = useState("");

  const [risultato, setRisultato] =
    useState<ImportResult | null>(null);

  /*
   * codice conto -> voce_id
   */
  const [mappature, setMappature] = useState<
    Record<string, string>
  >({});

  /*
   * codice conto -> escluso
   */
  const [esclusi, setEsclusi] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    void inizializza();
  }, []);

  /*
   * Se arriviamo dalla scheda di un controllo possiamo
   * passare cliente_id nella query string.
   */
  useEffect(() => {
    if (
      !router.isReady ||
      clienti.length === 0
    ) {
      return;
    }

    const queryClienteId =
      typeof router.query.cliente_id === "string"
        ? router.query.cliente_id
        : "";

    if (
      queryClienteId &&
      clienti.some(
        (cliente) => cliente.id === queryClienteId
      ) &&
      queryClienteId !== clienteId
    ) {
      setClienteId(queryClienteId);
    }
  }, [
    router.isReady,
    router.query.cliente_id,
    clienti,
    clienteId,
  ]);

  useEffect(() => {
    if (!studioId || !clienteId) {
      setControllo(null);
      return;
    }

    void caricaControlloAttivo();
  }, [studioId, clienteId]);

  async function inizializza() {
    try {
      setErrore("");

      const supabase = getSupabaseClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setErrore("Utente non autenticato.");
        return;
      }

      const {
        data: utente,
        error: utenteError,
      } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", user.id)
        .single();

      if (
        utenteError ||
        !utente?.studio_id
      ) {
        setErrore(
          "Impossibile determinare lo studio dell'utente."
        );
        return;
      }

      const sid = utente.studio_id;

      setStudioId(sid);

      const [
        clientiResponse,
        vociResponse,
      ] = await Promise.all([
        supabase
          .from("tbclienti")
          .select(`
            id,
            ragione_sociale,
            codice_fiscale
          `)
          .eq("studio_id", sid)
          .order("ragione_sociale", {
            ascending: true,
          }),

        fetch(
          "/api/controllo-gestione/voci"
        ).then(async (response) => {
          const json = await response.json();

          if (!response.ok) {
            throw new Error(
              json?.error ||
                "Errore caricamento voci di riclassificazione"
            );
          }

          return json;
        }),
      ]);

      if (clientiResponse.error) {
        throw clientiResponse.error;
      }

      setClienti(
        (clientiResponse.data || []) as Cliente[]
      );

      if (vociResponse?.success) {
        setVoci(vociResponse.data || []);
      }
    } catch (error: any) {
      console.error(
        "Errore inizializzazione import contabilità:",
        error
      );

      setErrore(
        error?.message ||
          "Errore inizializzazione pagina"
      );
    }
  }

  async function caricaControlloAttivo() {
    try {
      setLoadingCliente(true);
      setErrore("");
      setMessaggio("");

      setFile(null);
      setRisultato(null);
      setMappature({});
      setEsclusi({});

      const supabase = getSupabaseClient();

      const {
        data,
        error,
      } = await supabase
        .from("tbcontrollo_gestione")
        .select(`
          id,
          cliente_id,
          cadenza_controllo,
          data_esecuzione
        `)
        .eq("studio_id", studioId)
        .eq("cliente_id", clienteId)
        .eq("archiviato", false)
        .order("data_esecuzione", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setControllo(
        data
          ? (data as Controllo)
          : null
      );
    } catch (error: any) {
      console.error(
        "Errore caricamento controllo:",
        error
      );

      setControllo(null);

      setErrore(
        error?.message ||
          "Errore caricamento controllo di gestione"
      );
    } finally {
      setLoadingCliente(false);
    }
  }

  async function handleImport() {
    try {
      setErrore("");
      setMessaggio("");

      if (!studioId) {
        setErrore("Studio non disponibile.");
        return;
      }

      if (!clienteId) {
        setErrore(
          "Seleziona prima una società."
        );
        return;
      }

      if (!controllo?.id) {
        setErrore(
          "Per questa società non esiste un controllo di gestione attivo."
        );
        return;
      }

      if (!file) {
        setErrore(
          "Seleziona il file CSV esportato da DATEV KOINOS."
        );
        return;
      }

      setLoading(true);

      const contenutoCsv =
        await leggiCsvDatev(file);

      const response = await fetch(
        "/api/controllo-gestione/import-contabilita",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            studio_id: studioId,
            cliente_id: clienteId,
            controllo_id: controllo.id,

            software_contabile:
              "datev_koinos",

            nome_file: file.name,

            contenuto_csv: contenutoCsv,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "Errore durante l'importazione"
        );
      }

      setRisultato(json);

      setMappature({});
      setEsclusi({});

      if (
        json?.riepilogo?.conti_da_mappare === 0
      ) {
        setMessaggio(
          "Importazione completata. Tutti i conti risultano già classificati."
        );
      } else {
        setMessaggio(
          `Importazione completata. ${json.riepilogo.conti_da_mappare} conti devono essere classificati.`
        );
      }
    } catch (error: any) {
      console.error(
        "Errore import contabilità:",
        error
      );

      setErrore(
        error?.message ||
          "Errore durante l'importazione"
      );
    } finally {
      setLoading(false);
    }
  }

  async function salvaMappatura(
    conto: ContoDaMappare
  ) {
    try {
      setErrore("");
      setMessaggio("");

      const escluso =
        Boolean(esclusi[conto.codice_conto]);

      const voceId =
        mappature[conto.codice_conto] || "";

      if (!escluso && !voceId) {
        setErrore(
          `Seleziona una voce per il conto ${conto.codice_conto} oppure impostalo come escluso.`
        );
        return;
      }

      const response = await fetch(
        "/api/controllo-gestione/mappatura-conti",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            studio_id: studioId,
            cliente_id: clienteId,

            software_contabile:
              "datev_koinos",

            codice_conto:
              conto.codice_conto,

            descrizione_conto:
              conto.descrizione_conto,

            voce_id:
              escluso
                ? null
                : voceId,

            moltiplicatore: 1,

            escluso,
            confermato: true,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "Errore salvataggio mappatura"
        );
      }

      /*
       * Per ora aggiorniamo la schermata localmente.
       * Nel prossimo step sincronizzeremo anche la riga
       * dello staging.
       */
      setRisultato((prev) => {
        if (!prev) return prev;

        const nuoveRighe =
          prev.da_mappare.filter(
            (riga) =>
              riga.codice_conto !==
              conto.codice_conto
          );

        return {
          ...prev,

          riepilogo: {
            ...prev.riepilogo,

            conti_da_mappare:
              Math.max(
                0,
                prev.riepilogo
                  .conti_da_mappare - 1
              ),

            conti_mappati:
              escluso
                ? prev.riepilogo
                    .conti_mappati
                : prev.riepilogo
                    .conti_mappati + 1,

            conti_esclusi:
              escluso
                ? prev.riepilogo
                    .conti_esclusi + 1
                : prev.riepilogo
                    .conti_esclusi,
          },

          da_mappare: nuoveRighe,
        };
      });

      setMessaggio(
        escluso
          ? `Conto ${conto.codice_conto} escluso.`
          : `Conto ${conto.codice_conto} classificato.`
      );
    } catch (error: any) {
      console.error(
        "Errore salvataggio mappatura:",
        error
      );

      setErrore(
        error?.message ||
          "Errore salvataggio mappatura"
      );
    }
  }

  const clienteSelezionato =
    useMemo(
      () =>
        clienti.find(
          (cliente) =>
            cliente.id === clienteId
        ) || null,
      [clienti, clienteId]
    );

  const vociRaggruppate =
    useMemo(() => {
      const result: Record<
        string,
        VoceCdG[]
      > = {};

      for (const voce of voci) {
        const sezione =
          voce.sezione || "altro";

        if (!result[sezione]) {
          result[sezione] = [];
        }

        result[sezione].push(voce);
      }

      return result;
    }, [voci]);

  return (
    <main
      style={{
        maxWidth: 1500,
        margin: "0 auto",
        padding: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            Importazione contabilità
          </h1>

          <div
            style={{
              marginTop: 6,
              color: "#64748b",
            }}
          >
            Controllo di gestione · DATEV KOINOS
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push(
              "/controllo-gestione"
            )
          }
          style={secondaryButtonStyle}
        >
          Torna al controllo di gestione
        </button>
      </div>

      {errore && (
        <div style={errorStyle}>
          {errore}
        </div>
      )}

      {messaggio && (
        <div style={successStyle}>
          {messaggio}
        </div>
      )}

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>
          1. Società e controllo
        </h2>

        <div style={grid2Style}>
          <div>
            <label style={labelStyle}>
              Società
            </label>

            <select
              value={clienteId}
              onChange={(e) =>
                setClienteId(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              <option value="">
                Seleziona società
              </option>

              {clienti.map((cliente) => (
                <option
                  key={cliente.id}
                  value={cliente.id}
                >
                  {cliente.ragione_sociale ||
                    cliente.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>
              Software contabile
            </label>

            <input
              value="DATEV KOINOS"
              disabled
              style={{
                ...inputStyle,
                background: "#f8fafc",
              }}
            />
          </div>
        </div>

        {loadingCliente && (
          <div style={infoStyle}>
            Caricamento controllo...
          </div>
        )}

        {!loadingCliente &&
          clienteId &&
          !controllo && (
            <div style={warningStyle}>
              Per questa società non
              risulta un controllo di
              gestione attivo.
            </div>
          )}

        {controllo && (
          <div
            style={{
              ...infoStyle,
              marginTop: 16,
            }}
          >
            <strong>
              Controllo attivo:
            </strong>{" "}
            {dataIt(
              controllo.data_esecuzione
            )}
            {" · "}
            {controllo.cadenza_controllo ||
              "Cadenza non indicata"}

            {clienteSelezionato
              ?.codice_fiscale && (
              <>
                {" · "}
                CF{" "}
                {
                  clienteSelezionato.codice_fiscale
                }
              </>
            )}
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>
          2. Situazione contabile
        </h2>

        <div
          style={{
            display: "flex",
            alignItems: "end",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              flex: "1 1 500px",
            }}
          >
            <label style={labelStyle}>
              File CSV DATEV KOINOS
            </label>

            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setFile(
                  e.target.files?.[0] ||
                    null
                );

                setRisultato(null);
                setErrore("");
                setMessaggio("");
              }}
              style={inputStyle}
            />
          </div>

          <button
            type="button"
            onClick={handleImport}
            disabled={
              loading ||
              !file ||
              !clienteId ||
              !controllo
            }
            style={{
              ...primaryButtonStyle,

              opacity:
                loading ||
                !file ||
                !clienteId ||
                !controllo
                  ? 0.5
                  : 1,

              cursor:
                loading ||
                !file ||
                !clienteId ||
                !controllo
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {loading
              ? "Analisi in corso..."
              : "Analizza e importa"}
          </button>
        </div>
      </section>

      {risultato && (
        <>
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>
              3. Esito importazione
            </h2>

            <div style={grid4Style}>
              <Stat
                label="Conti importati"
                value={
                  risultato.riepilogo
                    .conti_importati
                }
              />

              <Stat
                label="Già mappati"
                value={
                  risultato.riepilogo
                    .conti_mappati
                }
              />

              <Stat
                label="Da classificare"
                value={
                  risultato.riepilogo
                    .conti_da_mappare
                }
              />

              <Stat
                label="Esclusi"
                value={
                  risultato.riepilogo
                    .conti_esclusi
                }
              />
            </div>

            <div
              style={{
                ...grid2Style,
                marginTop: 20,
              }}
            >
              <div style={subCardStyle}>
                <div style={smallLabelStyle}>
                  Azienda DATEV
                </div>

                <strong>
                  {risultato.file
                    .societa || "-"}
                </strong>

                <div
                  style={{
                    marginTop: 4,
                    color: "#64748b",
                  }}
                >
                  Codice azienda:{" "}
                  {risultato.file
                    .codice_azienda || "-"}
                </div>
              </div>

              <div style={subCardStyle}>
                <div style={smallLabelStyle}>
                  Periodo contabile
                </div>

                <strong>
                  {dataIt(
                    risultato.file
                      .periodo_dal
                  )}
                  {" → "}
                  {dataIt(
                    risultato.file
                      .periodo_al
                  )}
                </strong>
              </div>
            </div>

            <div
              style={{
                ...grid2Style,
                marginTop: 16,
              }}
            >
              <Quadratura
                titolo="Stato patrimoniale"
                ok={
                  risultato.quadratura
                    .statoPatrimoniale
                }
                differenza={
                  risultato.quadratura
                    .differenzaSP
                }
              />

              <Quadratura
                titolo="Conto economico"
                ok={
                  risultato.quadratura
                    .contoEconomico
                }
                differenza={
                  risultato.quadratura
                    .differenzaCE
                }
              />
            </div>

            {risultato.anomalie?.length >
              0 && (
              <div
                style={{
                  ...warningStyle,
                  marginTop: 16,
                }}
              >
                <strong>
                  Anomalie rilevate
                </strong>

                <ul
                  style={{
                    marginBottom: 0,
                  }}
                >
                  {risultato.anomalie.map(
                    (anomalia, index) => (
                      <li key={index}>
                        {anomalia}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>
              4. Mappatura conti
            </h2>

            {risultato.da_mappare
              .length === 0 ? (
              <div style={successStyle}>
                Tutti i conti risultano
                classificati. La
                mappatura della società
                è completa.
              </div>
            ) : (
              <>
                <div
                  style={{
                    marginBottom: 16,
                    color: "#64748b",
                  }}
                >
                  Classifica soltanto i
                  conti nuovi. La scelta
                  verrà memorizzata per
                  questa società e
                  riutilizzata nei
                  controlli successivi.
                </div>

                <div
                  style={{
                    overflowX: "auto",
                  }}
                >
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>
                          Codice
                        </th>

                        <th style={thStyle}>
                          Descrizione
                        </th>

                        <th style={thStyle}>
                          Sezione
                        </th>

                        <th
                          style={{
                            ...thStyle,
                            textAlign:
                              "right",
                          }}
                        >
                          Importo
                        </th>

                        <th style={thStyle}>
                          Riclassificazione
                        </th>

                        <th
                          style={{
                            ...thStyle,
                            textAlign:
                              "center",
                          }}
                        >
                          Escludi
                        </th>

                        <th style={thStyle}>
                          Azione
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {risultato.da_mappare.map(
                        (conto) => {
                          const escluso =
                            Boolean(
                              esclusi[
                                conto
                                  .codice_conto
                              ]
                            );

                          return (
                            <tr
                              key={
                                conto.codice_conto
                              }
                            >
                              <td style={tdStyle}>
                                <strong>
                                  {
                                    conto.codice_conto
                                  }
                                </strong>
                              </td>

                              <td style={tdStyle}>
                                {
                                  conto.descrizione_conto
                                }

                                {conto.codice_padre && (
                                  <div
                                    style={{
                                      marginTop: 3,
                                      fontSize: 11,
                                      color:
                                        "#94a3b8",
                                    }}
                                  >
                                    Gruppo DATEV:{" "}
                                    {
                                      conto.codice_padre
                                    }
                                  </div>
                                )}
                              </td>

                              <td style={tdStyle}>
                                {labelSezione(
                                  conto.sezione
                                )}
                              </td>

                              <td
                                style={{
                                  ...tdStyle,
                                  textAlign:
                                    "right",
                                  whiteSpace:
                                    "nowrap",
                                }}
                              >
                                {euro(
                                  conto.importo
                                )}
                              </td>

                              <td
                                style={{
                                  ...tdStyle,
                                  minWidth: 330,
                                }}
                              >
                                <select
                                  value={
                                    mappature[
                                      conto
                                        .codice_conto
                                    ] || ""
                                  }
                                  disabled={
                                    escluso
                                  }
                                  onChange={(e) =>
                                    setMappature(
                                      (prev) => ({
                                        ...prev,
                                        [conto.codice_conto]:
                                          e.target
                                            .value,
                                      })
                                    )
                                  }
                                  style={
                                    inputStyle
                                  }
                                >
                                  <option value="">
                                    Seleziona voce...
                                  </option>

                                  {Object.entries(
                                    vociRaggruppate
                                  ).map(
                                    ([
                                      sezione,
                                      elenco,
                                    ]) => (
                                      <optgroup
                                        key={
                                          sezione
                                        }
                                        label={
                                          sezione
                                        }
                                      >
                                        {elenco.map(
                                          (
                                            voce
                                          ) => (
                                            <option
                                              key={
                                                voce.id
                                              }
                                              value={
                                                voce.id
                                              }
                                            >
                                              {
                                                voce.descrizione
                                              }
                                            </option>
                                          )
                                        )}
                                      </optgroup>
                                    )
                                  )}
                                </select>
                              </td>

                              <td
                                style={{
                                  ...tdStyle,
                                  textAlign:
                                    "center",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    escluso
                                  }
                                  onChange={(e) =>
                                    setEsclusi(
                                      (prev) => ({
                                        ...prev,
                                        [conto.codice_conto]:
                                          e.target
                                            .checked,
                                      })
                                    )
                                  }
                                />
                              </td>

                              <td style={tdStyle}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    salvaMappatura(
                                      conto
                                    )
                                  }
                                  style={
                                    smallButtonStyle
                                  }
                                >
                                  Salva
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div style={subCardStyle}>
      <div style={smallLabelStyle}>
        {label}
      </div>

      <div
        style={{
          marginTop: 5,
          fontSize: 26,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Quadratura({
  titolo,
  ok,
  differenza,
}: {
  titolo: string;
  ok: boolean;
  differenza: number;
}) {
  return (
    <div
      style={{
        ...subCardStyle,
        borderColor: ok
          ? "#bbf7d0"
          : "#fecaca",

        background: ok
          ? "#f0fdf4"
          : "#fef2f2",
      }}
    >
      <div
        style={{
          fontWeight: 700,
        }}
      >
        {ok ? "✓" : "⚠"} {titolo}
      </div>

      <div
        style={{
          marginTop: 5,
          fontSize: 13,
          color: "#475569",
        }}
      >
        {ok
          ? "Quadratura corretta"
          : `Differenza: ${euro(
              differenza
            )}`}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 20,
  marginBottom: 20,
};

const subCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 16,
  background: "#ffffff",
};

const sectionTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 18,
  fontSize: 18,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 13,
  fontWeight: 600,
  color: "#334155",
};

const smallLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
};

const grid2Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
};

const grid4Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
};

const primaryButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 8,
  padding: "11px 18px",
  background: "#0f172a",
  color: "#ffffff",
  fontWeight: 600,
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "10px 14px",
  background: "#ffffff",
  cursor: "pointer",
};

const smallButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 7,
  padding: "8px 12px",
  background: "#0f172a",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 600,
};

const errorStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 8,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
};

const successStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 8,
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
};

const warningStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 8,
  background: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#92400e",
};

const infoStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 8,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#334155",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  padding: "10px 8px",
  textAlign: "left",
  borderBottom: "2px solid #e2e8f0",
  color: "#475569",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "middle",
};
