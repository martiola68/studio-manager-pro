import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/router";

import {
  getSupabaseClient,
} from "../../../lib/supabaseClient";

type ContoMaster = {
  id: string;
  template_id: string;

  codice_conto: string;
  descrizione_conto:
    | string
    | null;

  voce_id:
    | string
    | null;

  voce_id_negativo:
    | string
    | null;

  moltiplicatore:
    | number
    | null;

  escluso: boolean;
};

type VoceSmp = {
  id: string;
  codice: string;
  descrizione: string;

  sezione:
    | string
    | null;

  macrovoce:
    | string
    | null;
};

type Template = {
  id: string;
  nome: string;
  software_contabile: string;
};

export default function ClassificazioneDatevPage() {
  const router =
    useRouter();

  const templateId =
    typeof router.query
      .template_id ===
    "string"
      ? router.query
          .template_id
      : "";

  const [studioId, setStudioId] =
    useState("");

  const [
    template,
    setTemplate,
  ] =
    useState<Template | null>(
      null
    );

  const [conti, setConti] =
    useState<ContoMaster[]>(
      []
    );

  const [voci, setVoci] =
    useState<VoceSmp[]>(
      []
    );

  const [ricerca, setRicerca] =
    useState("");

  const [
    soloDaClassificare,
    setSoloDaClassificare,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    savingId,
    setSavingId,
  ] = useState("");

  const [
    errore,
    setErrore,
  ] = useState("");

  const [
    messaggio,
    setMessaggio,
  ] = useState("");

  useEffect(() => {
    if (
      !router.isReady ||
      !templateId
    ) {
      return;
    }

    void inizializza();
  }, [
    router.isReady,
    templateId,
  ]);

  async function inizializza() {
    try {
      setLoading(true);
      setErrore("");

      const supabase =
        getSupabaseClient();

      const {
        data: { user },
        error: authError,
      } =
        await supabase.auth.getUser();

      if (
        authError ||
        !user
      ) {
        throw new Error(
          "Utente non autenticato."
        );
      }

      const {
        data: utente,
        error: utenteError,
      } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq(
          "id",
          user.id
        )
        .single();

      if (
        utenteError ||
        !utente
          ?.studio_id
      ) {
        throw new Error(
          "Impossibile determinare lo studio."
        );
      }

      const sid =
        utente.studio_id;

      setStudioId(
        sid
      );

      await carica(
        sid
      );
    } catch (
      error: any
    ) {
      console.error(
        "Errore inizializzazione classificazione:",
        error
      );

      setErrore(
        error?.message ||
          "Errore inizializzazione"
      );

      setLoading(false);
    }
  }

  async function carica(
    sid = studioId
  ) {
    if (
      !sid ||
      !templateId
    ) {
      return;
    }

    try {
      setLoading(true);

      const response =
        await fetch(
          `/api/controllo-gestione/master-conti?studio_id=${encodeURIComponent(
            sid
          )}&template_id=${encodeURIComponent(
            templateId
          )}`
        );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "Errore caricamento piano dei conti"
        );
      }

      setTemplate(
        json.template ||
          null
      );

      setConti(
        Array.isArray(
          json.conti
        )
          ? json.conti
          : []
      );

      setVoci(
        Array.isArray(
          json.voci
        )
          ? json.voci
          : []
      );
    } catch (
      error: any
    ) {
      console.error(
        "Errore caricamento:",
        error
      );

      setErrore(
        error?.message ||
          "Errore caricamento"
      );
    } finally {
      setLoading(false);
    }
  }

  function aggiornaConto(
    id: string,
    patch: Partial<ContoMaster>
  ) {
    setConti(
      (prev) =>
        prev.map(
          (conto) =>
            conto.id === id
              ? {
                  ...conto,
                  ...patch,
                }
              : conto
        )
    );
  }

  async function salva(
    conto: ContoMaster
  ) {
    try {
      setSavingId(
        conto.id
      );

      setErrore("");
      setMessaggio("");

      const response =
        await fetch(
          "/api/controllo-gestione/master-conti",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                studio_id:
                  studioId,

                template_id:
                  templateId,

                conto_id:
                  conto.id,

                voce_id:
                  conto.voce_id,

                voce_id_negativo:
                  conto
                    .voce_id_negativo,

                moltiplicatore:
                  conto.moltiplicatore ||
                  1,

                escluso:
                  conto.escluso,
              }),
          }
        );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "Errore salvataggio"
        );
      }

      /*
       * Manteniamo la riga locale
       * sincronizzata con il DB.
       */
      setConti(
        (prev) =>
          prev.map(
            (row) =>
              row.id ===
              conto.id
                ? {
                    ...row,
                    ...json.data,
                  }
                : row
          )
      );

      setMessaggio(
        `Conto ${conto.codice_conto} classificato correttamente.`
      );
    } catch (
      error: any
    ) {
      console.error(
        "Errore salvataggio classificazione:",
        error
      );

      setErrore(
        error?.message ||
          "Errore salvataggio classificazione"
      );
    } finally {
      setSavingId("");
    }
  }

  const filtrati =
    useMemo(() => {
      const q =
        ricerca
          .trim()
          .toLowerCase();

      return conti.filter(
        (conto) => {
          const classificato =
            Boolean(
              conto.voce_id
            ) ||
            conto.escluso;

          if (
            soloDaClassificare &&
            classificato
          ) {
            return false;
          }

          if (!q) {
            return true;
          }

          return (
            String(
              conto.codice_conto ||
                ""
            )
              .toLowerCase()
              .includes(q) ||
            String(
              conto.descrizione_conto ||
                ""
            )
              .toLowerCase()
              .includes(q)
          );
        }
      );
    }, [
      conti,
      ricerca,
      soloDaClassificare,
    ]);

  const classificati =
    conti.filter(
      (conto) =>
        Boolean(
          conto.voce_id
        ) ||
        conto.escluso
    ).length;

  const daClassificare =
    conti.length -
    classificati;

  const percentuale =
    conti.length > 0
      ? Math.round(
          (
            classificati /
            conti.length
          ) *
            100
        )
      : 0;

  if (loading) {
    return (
      <main
        style={{
          padding: 24,
        }}
      >
        Caricamento piano dei conti DATEV KOINOS...
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 1550,
        margin:
          "0 auto",
        padding: 24,
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "center",
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
            Classificazione DATEV KOINOS
          </h1>

          <div
            style={{
              marginTop: 6,
              color:
                "#64748b",
            }}
          >
            {template
              ?.nome ||
              "Master DATEV KOINOS"}
          </div>
        </div>

        <button
          type="button"
         
          style={
            secondaryButtonStyle
          }
        >
          Torna al piano DATEV
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

      {/* KPI */}
      <div
        style={{
          display:
            "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <Stat
          label="Conti master"
          value={
            conti.length
          }
        />

        <Stat
          label="Classificati"
          value={
            classificati
          }
        />

        <Stat
          label="Da classificare"
          value={
            daClassificare
          }
        />

        <Stat
          label="Avanzamento"
          value={`${percentuale}%`}
        />
      </div>

      <section
        style={
          cardStyle
        }
      >
        {/* FILTRI */}
        <div
          style={{
            display: "flex",
            alignItems:
              "center",
            gap: 12,
            flexWrap:
              "wrap",
            marginBottom: 16,
          }}
        >
          <input
            value={
              ricerca
            }
            onChange={(
              e
            ) =>
              setRicerca(
                e.target
                  .value
              )
            }
            placeholder="Cerca codice o descrizione conto..."
            style={{
              ...inputStyle,
              maxWidth:
                430,
            }}
          />

          <label
            style={{
              display:
                "flex",
              alignItems:
                "center",
              gap: 8,
              fontSize: 13,
              cursor:
                "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={
                soloDaClassificare
              }
              onChange={(
                e
              ) =>
                setSoloDaClassificare(
                  e.target
                    .checked
                )
              }
            />

            Solo conti da classificare
          </label>

          <div
            style={{
              marginLeft:
                "auto",
              fontSize: 13,
              color:
                "#64748b",
            }}
          >
            Visualizzati:{" "}
            <strong>
              {
                filtrati.length
              }
            </strong>
          </div>
        </div>

        <div
          style={{
            overflow:
              "auto",
            maxHeight:
              "68vh",
            border:
              "1px solid #e2e8f0",
            borderRadius: 8,
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

                <th
                  style={
                    thStyle
                  }
                >
                  Voce SMP
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Voce saldo negativo
                </th>

                <th
                  style={{
                    ...thStyle,
                    textAlign:
                      "center",
                  }}
                >
                  Escluso
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Stato
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Azione
                </th>
              </tr>
            </thead>

            <tbody>
              {filtrati.map(
                (
                  conto
                ) => {
                  const classificato =
                    Boolean(
                      conto.voce_id
                    ) ||
                    conto.escluso;

                  return (
                    <tr
                      key={
                        conto.id
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
                        {conto.descrizione_conto ||
                          "-"}
                      </td>

                      <td
                        style={{
                          ...tdStyle,
                          minWidth:
                            320,
                        }}
                      >
                        <select
                          value={
                            conto.voce_id ||
                            ""
                          }
                          disabled={
                            conto.escluso
                          }
                          onChange={(
                            e
                          ) =>
                            aggiornaConto(
                              conto.id,
                              {
                                voce_id:
                                  e
                                    .target
                                    .value ||
                                  null,
                              }
                            )
                          }
                          style={
                            inputStyle
                          }
                        >
                          <option
                            value=""
                          >
                            Seleziona voce SMP
                          </option>

                          {voci.map(
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
                                  voce.codice
                                }
                                {" · "}
                                {
                                  voce.descrizione
                                }
                              </option>
                            )
                          )}
                        </select>
                      </td>

                      <td
                        style={{
                          ...tdStyle,
                          minWidth:
                            300,
                        }}
                      >
                        <select
                          value={
                            conto.voce_id_negativo ||
                            ""
                          }
                          disabled={
                            conto.escluso
                          }
                          onChange={(
                            e
                          ) =>
                            aggiornaConto(
                              conto.id,
                              {
                                voce_id_negativo:
                                  e
                                    .target
                                    .value ||
                                  null,
                              }
                            )
                          }
                          style={
                            inputStyle
                          }
                        >
                          <option
                            value=""
                          >
                            Nessuna
                          </option>

                          {voci.map(
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
                                  voce.codice
                                }
                                {" · "}
                                {
                                  voce.descrizione
                                }
                              </option>
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
                            conto.escluso
                          }
                          onChange={(
                            e
                          ) =>
                            aggiornaConto(
                              conto.id,
                              {
                                escluso:
                                  e
                                    .target
                                    .checked,
                              }
                            )
                          }
                        />
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        <span
                          style={{
                            display:
                              "inline-flex",
                            padding:
                              "4px 8px",
                            borderRadius:
                              999,
                            fontSize:
                              11,
                            fontWeight:
                              700,

                            background:
                              classificato
                                ? "#dcfce7"
                                : "#fef3c7",

                            color:
                              classificato
                                ? "#166534"
                                : "#92400e",
                          }}
                        >
                          {conto.escluso
                            ? "Escluso"
                            : classificato
                            ? "Classificato"
                            : "Da classificare"}
                        </span>
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        <button
                          type="button"
                          disabled={
                            savingId ===
                            conto.id
                          }
                          onClick={() =>
                            void salva(
                              conto
                            )
                          }
                          style={{
                            ...primaryButtonStyle,
                            padding:
                              "8px 12px",

                            opacity:
                              savingId ===
                              conto.id
                                ? 0.5
                                : 1,
                          }}
                        >
                          {savingId ===
                          conto.id
                            ? "Salvo..."
                            : "Salva"}
                        </button>
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value:
    | number
    | string;
}) {
  return (
    <div
      style={
        statStyle
      }
    >
      <div
        style={{
          fontSize: 12,
          color:
            "#64748b",
          textTransform:
            "uppercase",
          letterSpacing:
            "0.04em",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 5,
          fontSize: 25,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const cardStyle:
  React.CSSProperties =
{
  background:
    "#ffffff",
  border:
    "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 20,
};

const statStyle:
  React.CSSProperties =
{
  background:
    "#ffffff",
  border:
    "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 16,
};

const inputStyle:
  React.CSSProperties =
{
  width: "100%",
  boxSizing:
    "border-box",
  padding:
    "9px 10px",
  border:
    "1px solid #cbd5e1",
  borderRadius: 7,
  background:
    "#ffffff",
};

const primaryButtonStyle:
  React.CSSProperties =
{
  border: 0,
  borderRadius: 8,
  padding:
    "10px 14px",
  background:
    "#0f172a",
  color:
    "#ffffff",
  fontWeight: 600,
  cursor:
    "pointer",
};

const secondaryButtonStyle:
  React.CSSProperties =
{
  border:
    "1px solid #cbd5e1",
  borderRadius: 8,
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
  marginBottom: 16,
  padding: 12,
  borderRadius: 8,
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
  marginBottom: 16,
  padding: 12,
  borderRadius: 8,
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
  width: "100%",
  borderCollapse:
    "collapse",
  fontSize: 13,
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
  top: 0,
  zIndex: 2,
  whiteSpace:
    "nowrap",
};

const tdStyle:
  React.CSSProperties =
{
  padding: 8,
  borderBottom:
    "1px solid #e2e8f0",
  verticalAlign:
    "middle",
};
