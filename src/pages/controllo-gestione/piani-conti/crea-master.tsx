import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/router";

import ExcelJS from "exceljs";
import Papa from "papaparse";

import {
  getSupabaseClient,
} from "../../../lib/supabaseClient";

type Software =
  | "zucchetti"
  | "teamsystem"
  | "ipsoa";

type Conto = {
  codice_conto: string;
  descrizione_conto: string;
};

function softwareLabel(
  software: string
) {
  switch (
    software
  ) {
    case "zucchetti":
      return "Zucchetti";

    case "teamsystem":
      return "TeamSystem";

    case "ipsoa":
      return "IPSOA";

    default:
      return software;
  }
}

function cellText(
  value: unknown
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (
    typeof value ===
    "object"
  ) {
    const v =
      value as any;

    if (
      typeof v.text ===
      "string"
    ) {
      return v.text;
    }

    if (
      v.result !==
      undefined
    ) {
      return String(
        v.result
      );
    }

    if (
      Array.isArray(
        v.richText
      )
    ) {
      return v.richText
        .map(
          (x: any) =>
            x?.text ||
            ""
        )
        .join("");
    }
  }

  return String(
    value
  );
}

export default function CreaMasterPage() {
  const router =
    useRouter();

  const softwareQuery =
    typeof router.query
      .software ===
    "string"
      ? router.query
          .software
      : "";

  const software =
    [
      "zucchetti",
      "teamsystem",
      "ipsoa",
    ].includes(
      softwareQuery
    )
      ? (softwareQuery as Software)
      : null;

  const [
    studioId,
    setStudioId,
  ] = useState("");

  const [
    nomeMaster,
    setNomeMaster,
  ] = useState("");

  const [
    file,
    setFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    rows,
    setRows,
  ] =
    useState<
      string[][]
    >([]);

  const [
    headerRowIndex,
    setHeaderRowIndex,
  ] = useState(0);

  const [
    codiceIndex,
    setCodiceIndex,
  ] = useState(-1);

  const [
    descrizioneIndex,
    setDescrizioneIndex,
  ] = useState(-1);

  const [
    loadingFile,
    setLoadingFile,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    errore,
    setErrore,
  ] = useState("");

  const [
    messaggio,
    setMessaggio,
  ] = useState("");

  useEffect(() => {
    void inizializza();
  }, []);

  useEffect(() => {
    if (
      software &&
      !nomeMaster
    ) {
      setNomeMaster(
        `Piano ${softwareLabel(
          software
        )}`
      );
    }
  }, [
    software,
  ]);

  async function inizializza() {
    try {
      const supabase =
        getSupabaseClient();

      const {
        data: {
          user,
        },
      } =
        await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Utente non autenticato"
        );
      }

      const {
        data: utente,
        error,
      } =
        await supabase
          .from(
            "tbutenti"
          )
          .select(
            "studio_id"
          )
          .eq(
            "id",
            user.id
          )
          .single();

      if (
        error ||
        !utente
          ?.studio_id
      ) {
        throw new Error(
          "Impossibile determinare lo studio"
        );
      }

      setStudioId(
        utente
          .studio_id
      );
    } catch (
      error: any
    ) {
      setErrore(
        error?.message ||
          "Errore inizializzazione"
      );
    }
  }

  async function leggiFile() {
    if (!file) {
      setErrore(
        "Seleziona un file."
      );

      return;
    }

    try {
      setLoadingFile(
        true
      );

      setErrore("");
      setMessaggio("");

      const nome =
        file.name
          .toLowerCase();

      let matrice:
        string[][] =
        [];

      if (
        nome.endsWith(
          ".csv"
        )
      ) {
        const buffer =
          await file.arrayBuffer();

        const text =
          new TextDecoder(
            "windows-1252"
          ).decode(
            buffer
          );

        const result =
          Papa.parse<
            string[]
          >(
            text,
            {
              skipEmptyLines:
                false,
            }
          );

        matrice =
          (
            result.data ||
            []
          ).map(
            (row) =>
              (
                row ||
                []
              ).map(
                (cell) =>
                  cellText(
                    cell
                  )
              )
          );
      } else if (
        nome.endsWith(
          ".xlsx"
        )
      ) {
        const buffer =
          await file.arrayBuffer();

        const workbook =
          new ExcelJS.Workbook();

        await workbook
          .xlsx
          .load(
            buffer
          );

        const ws =
          workbook
            .worksheets[0];

        if (!ws) {
          throw new Error(
            "Il file Excel non contiene fogli."
          );
        }

        ws.eachRow(
          {
            includeEmpty:
              true,
          },
          (row) => {
            const valori =
              Array.isArray(
                row.values
              )
                ? row.values
                    .slice(
                      1
                    )
                : [];

            matrice.push(
              valori.map(
                (value) =>
                  cellText(
                    value
                  )
              )
            );
          }
        );
      } else {
        throw new Error(
          "Formato non supportato. Utilizza CSV oppure XLSX."
        );
      }

      /*
       * Eliminiamo soltanto
       * le righe completamente vuote.
       */
      matrice =
        matrice.filter(
          (row) =>
            row.some(
              (cell) =>
                String(
                  cell
                ).trim()
            )
        );

      if (
        !matrice.length
      ) {
        throw new Error(
          "Il file non contiene dati."
        );
      }

      setRows(
        matrice
      );

      /*
       * Per impostazione iniziale
       * usiamo la prima riga.
       *
       * L'utente può cambiarla.
       */
      setHeaderRowIndex(
        0
      );

      setCodiceIndex(
        -1
      );

      setDescrizioneIndex(
        -1
      );

      setMessaggio(
        `${matrice.length} righe lette. Seleziona intestazioni e colonne.`
      );
    } catch (
      error: any
    ) {
      console.error(
        "Errore lettura file:",
        error
      );

      setRows(
        []
      );

      setErrore(
        error?.message ||
          "Errore lettura file"
      );
    } finally {
      setLoadingFile(
        false
      );
    }
  }

  const headers =
    useMemo(
      () =>
        rows[
          headerRowIndex
        ] ||
        [],
      [
        rows,
        headerRowIndex,
      ]
    );

  const anteprimaConti =
    useMemo(() => {
      if (
        codiceIndex <
          0 ||
        descrizioneIndex <
          0
      ) {
        return [];
      }

      const map =
        new Map<
          string,
          Conto
        >();

      for (
        let i =
          headerRowIndex +
          1;
        i <
        rows.length;
        i++
      ) {
        const row =
          rows[i] ||
          [];

        const codice =
          String(
            row[
              codiceIndex
            ] ??
              ""
          )
            .trim()
            .replace(
              /\s+/g,
              ""
            );

        const descrizione =
          String(
            row[
              descrizioneIndex
            ] ??
              ""
          )
            .trim()
            .replace(
              /\s+/g,
              " "
            );

        if (
          !codice ||
          !descrizione
        ) {
          continue;
        }

        map.set(
          codice,
          {
            codice_conto:
              codice,

            descrizione_conto:
              descrizione,
          }
        );
      }

      return Array.from(
        map.values()
      );
    }, [
      rows,
      headerRowIndex,
      codiceIndex,
      descrizioneIndex,
    ]);

  async function creaMaster() {
    if (!software) {
      setErrore(
        "Software non valido."
      );

      return;
    }

    if (!studioId) {
      setErrore(
        "Studio non disponibile."
      );

      return;
    }

    if (
      !nomeMaster
        .trim()
    ) {
      setErrore(
        "Inserisci il nome del master."
      );

      return;
    }

    if (
      codiceIndex <
        0 ||
      descrizioneIndex <
        0
    ) {
      setErrore(
        "Seleziona le colonne Codice e Descrizione."
      );

      return;
    }

    if (
      codiceIndex ===
      descrizioneIndex
    ) {
      setErrore(
        "Codice e descrizione devono utilizzare colonne differenti."
      );

      return;
    }

    if (
      anteprimaConti.length ===
      0
    ) {
      setErrore(
        "Nessun conto valido individuato."
      );

      return;
    }

    try {
      setSaving(
        true
      );

      setErrore("");
      setMessaggio("");

      const response =
        await fetch(
          "/api/controllo-gestione/crea-master-generico",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                studio_id:
                  studioId,

                software_contabile:
                  software,

                nome:
                  nomeMaster,

                conti:
                  anteprimaConti,
              }),
          }
        );

      const json =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          json?.error ||
            "Errore creazione master"
        );
      }

      setMessaggio(
        `Master creato correttamente con ${json.riepilogo?.conti_creati || 0} conti.`
      );

      /*
       * Dopo la creazione torniamo
       * alla pagina Piani dei conti.
       *
       * Più avanti potremo aprire
       * direttamente la classificazione.
       */
      setTimeout(
        () => {
          void router.push(
            "/controllo-gestione/piani-conti"
          );
        },
        800
      );
    } catch (
      error: any
    ) {
      console.error(
        "Errore creazione master:",
        error
      );

      setErrore(
        error?.message ||
          "Errore creazione master"
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  if (!software) {
    return (
      <main
        style={{
          padding: 24,
        }}
      >
        Software contabile non valido.
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth:
          1450,
        margin:
          "0 auto",
        padding:
          24,
      }}
    >
      <div
        style={{
          display:
            "flex",
          justifyContent:
            "space-between",
          alignItems:
            "center",
          gap: 16,
          marginBottom:
            24,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize:
                28,
              fontWeight:
                700,
            }}
          >
            Crea piano dei conti {softwareLabel(
              software
            )}
          </h1>

          <div
            style={{
              marginTop:
                6,
              color:
                "#64748b",
            }}
          >
            Crea il master contabile dello studio partendo da un file reale del gestionale.
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push(
              "/controllo-gestione/piani-conti"
            )
          }
          style={
            secondaryButtonStyle
          }
        >
          Torna ai piani dei conti
        </button>
      </div>

      {errore && (
        <div
          style={
            errorStyle
          }
        >
          {errore}
        </div>
      )}

      {messaggio && (
        <div
          style={
            successStyle
          }
        >
          {messaggio}
        </div>
      )}

      {/* MASTER */}
      <section
        style={
          cardStyle
        }
      >
        <h2
          style={
            sectionTitleStyle
          }
        >
          1. Master
        </h2>

        <div
          style={
            grid2Style
          }
        >
          <div>
            <label
              style={
                labelStyle
              }
            >
              Software
            </label>

            <input
              disabled
              value={
                softwareLabel(
                  software
                )
              }
              style={{
                ...inputStyle,
                background:
                  "#f8fafc",
              }}
            />
          </div>

          <div>
            <label
              style={
                labelStyle
              }
            >
              Nome master
            </label>

            <input
              value={
                nomeMaster
              }
              onChange={(
                e
              ) =>
                setNomeMaster(
                  e.target
                    .value
                )
              }
              style={
                inputStyle
              }
            />
          </div>
        </div>
      </section>

      {/* FILE */}
      <section
        style={
          cardStyle
        }
      >
        <h2
          style={
            sectionTitleStyle
          }
        >
          2. File piano dei conti
        </h2>

        <div
          style={{
            display:
              "flex",
            alignItems:
              "end",
            gap: 12,
            flexWrap:
              "wrap",
          }}
        >
          <div
            style={{
              flex:
                "1 1 500px",
            }}
          >
            <label
              style={
                labelStyle
              }
            >
              CSV oppure XLSX
            </label>

            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(
                e
              ) => {
                setFile(
                  e.target
                    .files?.[0] ||
                    null
                );

                setRows(
                  []
                );

                setCodiceIndex(
                  -1
                );

                setDescrizioneIndex(
                  -1
                );
              }}
              style={
                inputStyle
              }
            />
          </div>

          <button
            type="button"
            disabled={
              !file ||
              loadingFile
            }
            onClick={
              leggiFile
            }
            style={{
              ...primaryButtonStyle,

              opacity:
                !file ||
                loadingFile
                  ? 0.5
                  : 1,
            }}
          >
            {loadingFile
              ? "Lettura..."
              : "Leggi file"}
          </button>
        </div>
      </section>

      {/* COLONNE */}
      {rows.length >
        0 && (
        <section
          style={
            cardStyle
          }
        >
          <h2
            style={
              sectionTitleStyle
            }
          >
            3. Struttura del file
          </h2>

          <div
            style={
              grid3Style
            }
          >
            <div>
              <label
                style={
                  labelStyle
                }
              >
                Riga intestazioni
              </label>

              <select
                value={
                  headerRowIndex
                }
                onChange={(
                  e
                ) => {
                  setHeaderRowIndex(
                    Number(
                      e.target
                        .value
                    )
                  );

                  setCodiceIndex(
                    -1
                  );

                  setDescrizioneIndex(
                    -1
                  );
                }}
                style={
                  inputStyle
                }
              >
                {rows
                  .slice(
                    0,
                    30
                  )
                  .map(
                    (
                      row,
                      index
                    ) => (
                      <option
                        key={
                          index
                        }
                        value={
                          index
                        }
                      >
                        Riga{" "}
                        {index +
                          1}
                        {" · "}
                        {row
                          .slice(
                            0,
                            4
                          )
                          .join(
                            " | "
                          )
                          .slice(
                            0,
                            90
                          )}
                      </option>
                    )
                  )}
              </select>
            </div>

            <div>
              <label
                style={
                  labelStyle
                }
              >
                Colonna codice conto
              </label>

              <select
                value={
                  codiceIndex
                }
                onChange={(
                  e
                ) =>
                  setCodiceIndex(
                    Number(
                      e.target
                        .value
                    )
                  )
                }
                style={
                  inputStyle
                }
              >
                <option
                  value={
                    -1
                  }
                >
                  Seleziona colonna
                </option>

                {headers.map(
                  (
                    header,
                    index
                  ) => (
                    <option
                      key={
                        index
                      }
                      value={
                        index
                      }
                    >
                      {header ||
                        `Colonna ${
                          index +
                          1
                        }`}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label
                style={
                  labelStyle
                }
              >
                Colonna descrizione conto
              </label>

              <select
                value={
                  descrizioneIndex
                }
                onChange={(
                  e
                ) =>
                  setDescrizioneIndex(
                    Number(
                      e.target
                        .value
                    )
                  )
                }
                style={
                  inputStyle
                }
              >
                <option
                  value={
                    -1
                  }
                >
                  Seleziona colonna
                </option>

                {headers.map(
                  (
                    header,
                    index
                  ) => (
                    <option
                      key={
                        index
                      }
                      value={
                        index
                      }
                    >
                      {header ||
                        `Colonna ${
                          index +
                          1
                        }`}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>
        </section>
      )}

      {/* ANTEPRIMA */}
      {anteprimaConti.length >
        0 && (
        <section
          style={
            cardStyle
          }
        >
          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              marginBottom:
                16,
            }}
          >
            <h2
              style={{
                ...sectionTitleStyle,
                marginBottom:
                  0,
              }}
            >
              4. Anteprima master
            </h2>

            <strong>
              {
                anteprimaConti.length
              }{" "}
              conti
            </strong>
          </div>

          <div
            style={{
              maxHeight:
                420,
              overflow:
                "auto",
              border:
                "1px solid #e2e8f0",
              borderRadius:
                8,
            }}
          >
            <table
              style={
                tableStyle
              }
            >
              <thead>
                <tr>
                  <th
                    style={
                      thStyle
                    }
                  >
                    Codice
                  </th>

                  <th
                    style={
                      thStyle
                    }
                  >
                    Descrizione
                  </th>
                </tr>
              </thead>

              <tbody>
                {anteprimaConti
                  .slice(
                    0,
                    500
                  )
                  .map(
                    (
                      conto
                    ) => (
                      <tr
                        key={
                          conto.codice_conto
                        }
                      >
                        <td
                          style={
                            tdStyle
                          }
                        >
                          <strong>
                            {
                              conto.codice_conto
                            }
                          </strong>
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            conto.descrizione_conto
                          }
                        </td>
                      </tr>
                    )
                  )}
              </tbody>
            </table>
          </div>

          <div
            style={{
              marginTop:
                18,
              display:
                "flex",
              justifyContent:
                "flex-end",
            }}
          >
            <button
              type="button"
              disabled={
                saving
              }
              onClick={
                creaMaster
              }
              style={{
                ...primaryButtonStyle,

                opacity:
                  saving
                    ? 0.5
                    : 1,
              }}
            >
              {saving
                ? "Creazione master..."
                : `Crea Master ${softwareLabel(
                    software
                  )}`}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

const cardStyle:
  React.CSSProperties =
{
  background:
    "#ffffff",
  border:
    "1px solid #e2e8f0",
  borderRadius:
    12,
  padding:
    20,
  marginBottom:
    20,
};

const sectionTitleStyle:
  React.CSSProperties =
{
  marginTop:
    0,
  marginBottom:
    18,
  fontSize:
    18,
};

const labelStyle:
  React.CSSProperties =
{
  display:
    "block",
  marginBottom:
    6,
  fontSize:
    13,
  fontWeight:
    600,
  color:
    "#334155",
};

const inputStyle:
  React.CSSProperties =
{
  width:
    "100%",
  boxSizing:
    "border-box",
  padding:
    "10px 12px",
  border:
    "1px solid #cbd5e1",
  borderRadius:
    8,
  background:
    "#ffffff",
};

const grid2Style:
  React.CSSProperties =
{
  display:
    "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(280px, 1fr))",
  gap:
    16,
};

const grid3Style:
  React.CSSProperties =
{
  display:
    "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap:
    16,
};

const primaryButtonStyle:
  React.CSSProperties =
{
  border:
    0,
  borderRadius:
    8,
  padding:
    "11px 18px",
  background:
    "#0f172a",
  color:
    "#ffffff",
  fontWeight:
    600,
  cursor:
    "pointer",
};

const secondaryButtonStyle:
  React.CSSProperties =
{
  border:
    "1px solid #cbd5e1",
  borderRadius:
    8,
  padding:
    "10px 14px",
  background:
    "#ffffff",
  cursor:
    "pointer",
};

const errorStyle:
  React.CSSProperties =
{
  marginBottom:
    16,
  padding:
    12,
  borderRadius:
    8,
  background:
    "#fef2f2",
  border:
    "1px solid #fecaca",
  color:
    "#991b1b",
};

const successStyle:
  React.CSSProperties =
{
  marginBottom:
    16,
  padding:
    12,
  borderRadius:
    8,
  background:
    "#f0fdf4",
  border:
    "1px solid #bbf7d0",
  color:
    "#166534",
};

const tableStyle:
  React.CSSProperties =
{
  width:
    "100%",
  borderCollapse:
    "collapse",
  fontSize:
    13,
};

const thStyle:
  React.CSSProperties =
{
  padding:
    "10px 8px",
  textAlign:
    "left",
  borderBottom:
    "2px solid #e2e8f0",
  background:
    "#f8fafc",
  position:
    "sticky",
  top:
    0,
};

const tdStyle:
  React.CSSProperties =
{
  padding:
    "9px 8px",
  borderBottom:
    "1px solid #e2e8f0",
};
