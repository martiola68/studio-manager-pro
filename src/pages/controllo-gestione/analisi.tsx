import {
  Fragment,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  RefreshCcw,
  FileText,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  BarChart3,
  Target,
} from "lucide-react";

function formatDateIT(value?: string | null) {
  if (!value) return "—";

  const [y, m, d] =
    String(value)
      .slice(0, 10)
      .split("-");

  if (!y || !m || !d) {
    return String(value);
  }

  return `${d}/${m}/${y}`;
}

function euro(value: any) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return Number(value).toLocaleString(
    "it-IT",
    {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }
  );
}

function percentuale(value: any) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return `${Number(value).toLocaleString(
    "it-IT",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}%`;
}

function numero(value: any) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return Number(value).toLocaleString(
    "it-IT",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function valoreNumerico(value: any) {
  const numero = Number(value);

  return Number.isFinite(numero)
    ? numero
    : null;
}

function variazionePercentuale(
  attuale: number | null,
  precedente: number | null
) {
  if (
    attuale === null ||
    precedente === null ||
    precedente === 0
  ) {
    return null;
  }

  return (
    ((attuale - precedente) /
      Math.abs(precedente)) *
    100
  );
}

function variazioneAssoluta(
  attuale: number | null,
  precedente: number | null
) {
  if (
    attuale === null ||
    precedente === null
  ) {
    return null;
  }

  return attuale - precedente;
}

function trimestrePuro(
  attuale: number | null,
  precedente: number | null,
  indice: number
) {
  if (attuale === null) {
    return null;
  }

  /*
   * Il primo trimestre coincide
   * con il cumulativo Q1.
   */
  if (indice === 0) {
    return attuale;
  }

  if (precedente === null) {
    return null;
  }

  return attuale - precedente;
}

function percentualeSu(
  valore: number | null,
  base: number | null
) {
  if (
    valore === null ||
    base === null ||
    base === 0
  ) {
    return null;
  }

  return (valore / base) * 100;
}

function formatDeltaPercentuale(
  value: number | null
) {
  if (value === null) return "—";

  const segno =
    value > 0 ? "+" : "";

  return `${segno}${value.toLocaleString(
    "it-IT",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }
  )}%`;
}

function formatDeltaPunti(
  value: number | null
) {
  if (value === null) return "—";

  const segno =
    value > 0 ? "+" : "";

  return `${segno}${value.toLocaleString(
    "it-IT",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )} p.p.`;
}

function formatDeltaNumero(
  value: number | null
) {
  if (value === null) return "—";

  const segno =
    value > 0 ? "+" : "";

  return `${segno}${value.toLocaleString(
    "it-IT",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function classeDelta(
  value: number | null,
  direzione:
    | "up"
    | "down"
    | "neutral" = "up"
) {
  if (
    value === null ||
    Math.abs(value) < 0.0001 ||
    direzione === "neutral"
  ) {
    return {
      className:
        "bg-gray-100 text-gray-700",
      icona: "neutral",
    };
  }

  const positivo =
    direzione === "up"
      ? value > 0
      : value < 0;

  if (positivo) {
    return {
      className:
        "bg-green-100 text-green-700",
      icona: "up",
    };
  }

  return {
    className:
      "bg-red-100 text-red-700",
    icona: "down",
  };
}

type PeriodoConfig = {
  key: string;
  trimestre: number;
  titolo: string;
  dal: string;
  al: string;
};

export default function AnalisiControlloGestione() {
  const router = useRouter();

  const clienteId =
    typeof router.query.cliente_id ===
    "string"
      ? router.query.cliente_id
      : "";

  const controlloId =
    typeof router.query.controllo_id ===
    "string"
      ? router.query.controllo_id
      : "";

  const anno =
    typeof router.query.anno === "string"
      ? router.query.anno
      : "";

  const [data, setData] =
    useState<any | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [errore, setErrore] =
    useState("");

  const [
    dettaglioAperto,
    setDettaglioAperto,
  ] = useState<string | null>(null);

  const [
    creandoPeriodo,
    setCreandoPeriodo,
  ] = useState(false);

  const periodiConfig =
    useMemo<PeriodoConfig[]>(() => {
      if (!anno) return [];

      return [
        {
          key: "q1",
          trimestre: 1,
          titolo: "1° trimestre",
          dal: `${anno}-01-01`,
          al: `${anno}-03-31`,
        },
        {
          key: "q2",
          trimestre: 2,
          titolo: "2° trimestre",
          dal: `${anno}-04-01`,
          al: `${anno}-06-30`,
        },
        {
          key: "q3",
          trimestre: 3,
          titolo: "3° trimestre",
          dal: `${anno}-07-01`,
          al: `${anno}-09-30`,
        },
        {
          key: "q4",
          trimestre: 4,
          titolo: "4° trimestre",
          dal: `${anno}-10-01`,
          al: `${anno}-12-31`,
        },
      ];
    }, [anno]);

  async function carica() {
    if (
      !clienteId ||
      !anno
    ) {
      return;
    }

    try {
      setLoading(true);
      setErrore("");

      const res = await fetch(
        `/api/controllo-gestione/analisi-periodi?cliente_id=${encodeURIComponent(
          clienteId
        )}&anno=${encodeURIComponent(
          anno
        )}`
      );

      const json =
        await res.json();

      if (!res.ok) {
        throw new Error(
          json?.error ||
            "Errore caricamento analisi"
        );
      }

      setData(json);
    } catch (error: any) {
      console.error(
        "Errore analisi controllo:",
        error
      );

      setErrore(
        error?.message ||
          "Impossibile caricare l'analisi"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    void carica();
  }, [
    router.isReady,
    clienteId,
    anno,
  ]);

  function trovaPeriodo(
    config: PeriodoConfig
  ) {
    return (
      data?.periodi?.find(
        (item: any) =>
          String(
            item?.import
              ?.data_riferimento || ""
          ).slice(0, 10) ===
          config.al
      ) || null
    );
  }

  const periodiPresenti =
    periodiConfig
      .map((config) => ({
        config,
        record:
          trovaPeriodo(config),
      }));

  /*
 * =====================================================
 * ANALISI COMPARATIVA
 * =====================================================
 */

const datiPeriodi =
  periodiPresenti.map(
    ({ config, record }, index) => ({
      config,
      record,
      index,
      indici:
        record?.indici || null,
    })
  );

function valoreIndice(
  index: number,
  campo: string
) {
  return valoreNumerico(
    datiPeriodi[index]
      ?.indici?.[campo]
  );
}

/*
 * Flussi economici cumulativi.
 */
const ricaviCumulativi =
  datiPeriodi.map(
    (_, index) =>
      valoreIndice(
        index,
        "ricavi"
      )
  );

const costiCumulativi =
  datiPeriodi.map(
    (_, index) =>
      valoreIndice(
        index,
        "costi_operativi"
      )
  );

const ebitdaCumulativo =
  datiPeriodi.map(
    (_, index) =>
      valoreIndice(
        index,
        "ebitda"
      )
  );

const ebitCumulativo =
  datiPeriodi.map(
    (_, index) =>
      valoreIndice(
        index,
        "ebit"
      )
  );

const risultatoCumulativo =
  datiPeriodi.map(
    (_, index) =>
      valoreIndice(
        index,
        "utile_netto"
      )
  );

const oneriFinanziariCumulativi =
  datiPeriodi.map(
    (_, index) =>
      valoreIndice(
        index,
        "oneri_finanziari"
      )
  );

const imposteCumulative =
  datiPeriodi.map(
    (_, index) =>
      valoreIndice(
        index,
        "imposte"
      )
  );

/*
 * Trimestri puri:
 * Q1 = Q1
 * Q2 = cumulativo Q2 - cumulativo Q1
 * ecc.
 */
function creaTrimestriPuri(
  valori: Array<number | null>
) {
  return valori.map(
    (valore, index) =>
      trimestrePuro(
        valore,
        index > 0
          ? valori[index - 1]
          : null,
        index
      )
  );
}

const ricaviPuri =
  creaTrimestriPuri(
    ricaviCumulativi
  );

const costiPuri =
  creaTrimestriPuri(
    costiCumulativi
  );

const ebitdaPuro =
  creaTrimestriPuri(
    ebitdaCumulativo
  );

const ebitPuro =
  creaTrimestriPuri(
    ebitCumulativo
  );

const risultatoPuro =
  creaTrimestriPuri(
    risultatoCumulativo
  );

const oneriFinanziariPuri =
  creaTrimestriPuri(
    oneriFinanziariCumulativi
  );

const impostePure =
  creaTrimestriPuri(
    imposteCumulative
  );

const margineEbitdaCumulativo =
  ebitdaCumulativo.map(
    (value, index) =>
      percentualeSu(
        value,
        ricaviCumulativi[index]
      )
  );

const margineNettoCumulativo =
  risultatoCumulativo.map(
    (value, index) =>
      percentualeSu(
        value,
        ricaviCumulativi[index]
      )
  );

const margineEbitdaPuro =
  ebitdaPuro.map(
    (value, index) =>
      percentualeSu(
        value,
        ricaviPuri[index]
      )
  );

const margineNettoPuro =
  risultatoPuro.map(
    (value, index) =>
      percentualeSu(
        value,
        ricaviPuri[index]
      )
  );

/*
 * Ultimo periodo disponibile.
 */
const ultimoIndiceDisponibile =
  [...datiPeriodi]
    .reverse()
    .find(
      (item) =>
        Boolean(item.indici)
    )?.index ?? -1;

const ultimoIndici =
  ultimoIndiceDisponibile >= 0
    ? datiPeriodi[
        ultimoIndiceDisponibile
      ]?.indici
    : null;

  const primoMancante =
    periodiPresenti.find(
      (item) => !item.record
    ) || null;

  const ultimoPeriodoPresente =
    [...periodiPresenti]
      .reverse()
      .find(
        (item) => item.record
      ) || null;

  async function creaPeriodo(
    config: PeriodoConfig
  ) {
    if (
      !ultimoPeriodoPresente
        ?.record?.controllo?.id
    ) {
      alert(
        "Non è disponibile un controllo precedente da rinnovare."
      );
      return;
    }

    const precedenteId =
      ultimoPeriodoPresente
        .record.controllo.id;

    try {
      setCreandoPeriodo(true);

      const res = await fetch(
        `/api/controllo-gestione/${precedenteId}/rinnova`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            /*
             * Usiamo la chiusura del periodo
             * come data del nuovo controllo.
             */
            data_esecuzione:
              config.al,

            note:
              `Controllo ${config.titolo} ${anno}`,
          }),
        }
      );

      const json =
        await res.json();

      if (!res.ok) {
        throw new Error(
          json?.error ||
            "Errore creazione periodo"
        );
      }

      const nuovoControlloId =
        typeof json === "string"
          ? json
          : json?.id ||
            json?.controllo_id ||
            json?.data;

      if (!nuovoControlloId) {
        throw new Error(
          "Il nuovo controllo è stato creato ma non è stato restituito il relativo ID."
        );
      }

      /*
       * Appena creato il periodo,
       * apriamo direttamente l'import.
       */
      await router.push(
        `/controllo-gestione/import-contabilita?cliente_id=${encodeURIComponent(
          clienteId
        )}&controllo_id=${encodeURIComponent(
          String(
            nuovoControlloId
          )
        )}`
      );
    } catch (error: any) {
      console.error(
        "Errore creazione periodo:",
        error
      );

      alert(
        error?.message ||
          "Errore creazione periodo"
      );
    } finally {
      setCreandoPeriodo(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        Caricamento analisi...
      </div>
    );
  }

  if (errore) {
    return (
      <div className="p-8 space-y-4">
        <Link
          href="/controllo-gestione"
          className="inline-flex items-center gap-2 border px-4 py-2 rounded"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna al controllo di gestione
        </Link>

        <div className="border border-red-200 bg-red-50 text-red-700 rounded p-4">
          {errore}
        </div>
      </div>
    );
  }

  const societa =
    data?.cliente
      ?.ragione_sociale ||
    "Società";

  const cf =
    data?.cliente
      ?.codice_fiscale ||
    "—";

  return (
    <div className="p-8 space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/controllo-gestione"
              className="border rounded p-2 hover:bg-gray-50"
              title="Torna al controllo di gestione"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div>
              <h1 className="text-2xl font-bold">
                Analisi controllo di gestione
              </h1>

              <div className="text-sm text-gray-500 mt-1">
                {societa}
                {" · "}
                Esercizio {anno}
                {" · "}
                CF {cf}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              window.open(
                `/api/controllo-gestione/report-pdf?cliente_id=${encodeURIComponent(
                  clienteId
                )}&anno=${encodeURIComponent(
                  anno
                )}`,
                "_blank"
              )
            }
            className="border px-4 py-2 rounded inline-flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Report annuale PDF
          </button>
        </div>
      </div>

      {/* PERIODI */}
      <div className="border rounded-lg bg-white">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold text-lg">
            Periodi contabili
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Situazioni contabili cumulative
            importate da DATEV KOINOS.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {periodiPresenti.map(
            ({
              config,
              record,
            }) => {
              const imp =
                record?.import;

              const indici =
                record?.indici;

              const integrazione =
                record?.integrazione;

              const controllo =
                record?.controllo;

              const aperto =
                dettaglioAperto ===
                config.key;

              const elaborato =
                Boolean(indici);

              const daClassificare =
                Number(
                  imp
                    ?.conti_da_mappare ||
                    0
                );

              return (
                <div
                  key={config.key}
                  className="border rounded-lg overflow-hidden"
                >
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-semibold text-base">
                          {config.titolo}
                        </span>

                        <span className="text-sm text-gray-500">
                          {formatDateIT(
                            config.dal
                          )}
                          {" → "}
                          {formatDateIT(
                            config.al
                          )}
                        </span>

                        {record ? (
                          elaborato ? (
                            <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                              Elaborato
                            </span>
                          ) : daClassificare >
                            0 ? (
                            <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                              Da classificare
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                              Da elaborare
                            </span>
                          )
                        ) : (
                          <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                            Da importare
                          </span>
                        )}
                      </div>

                      {record && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                          <div>
                            <div className="text-xs text-gray-500">
                              Conti
                            </div>
                            <div className="font-medium">
                              {imp
                                ?.conti_mappati ??
                                0}
                              /
                              {imp
                                ?.numero_conti ??
                                0}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-gray-500">
                              Ricavi
                            </div>
                            <div className="font-medium">
                              {euro(
                                indici?.ricavi
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-gray-500">
                              EBITDA
                            </div>
                            <div className="font-semibold">
                              {euro(
                                indici?.ebitda
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-gray-500">
                              Risultato
                            </div>
                            <div
                              className={`font-semibold ${
                                Number(
                                  indici?.utile_netto ||
                                    0
                                ) < 0
                                  ? "text-red-600"
                                  : ""
                              }`}
                            >
                              {euro(
                                indici
                                  ?.utile_netto
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-gray-500">
                              ROI
                            </div>
                            <div className="font-medium">
                              {percentuale(
                                indici?.roi
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {record ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setDettaglioAperto(
                                aperto
                                  ? null
                                  : config.key
                              )
                            }
                            className="border px-3 py-2 rounded text-sm inline-flex items-center gap-2"
                          >
                            {aperto ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}

                            {aperto
                              ? "Chiudi"
                              : "Visualizza"}
                          </button>

                          <Link
                            href={`/controllo-gestione/import-contabilita?cliente_id=${encodeURIComponent(
                              clienteId
                            )}&controllo_id=${encodeURIComponent(
                              controllo?.id ||
                                ""
                            )}`}
                            className="border px-3 py-2 rounded text-sm inline-flex items-center gap-2"
                          >
                            <RefreshCcw className="h-4 w-4" />
                            Reimporta
                          </Link>
                        </>
                      ) : primoMancante
                          ?.config
                          .key ===
                        config.key ? (
                        <button
                          type="button"
                          disabled={
                            creandoPeriodo
                          }
                          onClick={() =>
                            void creaPeriodo(
                              config
                            )
                          }
                          className="bg-black text-white px-4 py-2 rounded text-sm inline-flex items-center gap-2 disabled:opacity-50"
                        >
                          <Upload className="h-4 w-4" />

                          {creandoPeriodo
                            ? "Creazione..."
                            : "Importa situazione"}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">
                          Completa prima il
                          periodo precedente
                        </span>
                      )}
                    </div>
                  </div>

                  {/* DETTAGLIO PERIODO */}
                  {record && aperto && (
                    <div className="border-t bg-gray-50 p-5 space-y-5">
                      <div>
                        <h3 className="font-semibold mb-3">
                          Conto economico
                        </h3>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          {[
                            [
                              "Ricavi",
                              euro(
                                indici
                                  ?.ricavi
                              ),
                            ],
                            [
                              "Costi operativi",
                              euro(
                                indici
                                  ?.costi_operativi
                              ),
                            ],
                            [
                              "EBITDA",
                              euro(
                                indici
                                  ?.ebitda
                              ),
                            ],
                            [
                              "EBIT",
                              euro(
                                indici
                                  ?.ebit
                              ),
                            ],
                            [
                              "EBT",
                              euro(
                                indici
                                  ?.ebt
                              ),
                            ],
                            [
                              "Imposte",
                              euro(
                                indici
                                  ?.imposte
                              ),
                            ],
                            [
                              "Risultato",
                              euro(
                                indici
                                  ?.utile_netto
                              ),
                            ],
                          ].map(
                            ([
                              label,
                              value,
                            ]) => (
                              <div
                                key={label}
                                className="border rounded bg-white p-3"
                              >
                                <div className="text-xs text-gray-500">
                                  {
                                    label
                                  }
                                </div>

                                <div className="font-semibold mt-1">
                                  {
                                    value
                                  }
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold mb-3">
                          Stato patrimoniale
                        </h3>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            [
                              "Totale attivo",
                              euro(
                                indici
                                  ?.totale_attivo
                              ),
                            ],
                            [
                              "Attivo corrente",
                              euro(
                                indici
                                  ?.attivo_corrente
                              ),
                            ],
                            [
                              "Patrimonio netto",
                              euro(
                                indici
                                  ?.patrimonio_netto
                              ),
                            ],
                            [
                              "Debiti totali",
                              euro(
                                indici
                                  ?.debiti_totali
                              ),
                            ],
                            [
                              "Passivo corrente",
                              euro(
                                indici
                                  ?.passivo_corrente
                              ),
                            ],
                            [
                              "Debiti finanziari BT",
                              euro(
                                integrazione
                                  ?.debiti_finanziari_bt
                              ),
                            ],
                            [
                              "Debiti finanziari M/L",
                              euro(
                                integrazione
                                  ?.debiti_finanziari_mlt
                              ),
                            ],
                          ].map(
                            ([
                              label,
                              value,
                            ]) => (
                              <div
                                key={label}
                                className="border rounded bg-white p-3"
                              >
                                <div className="text-xs text-gray-500">
                                  {
                                    label
                                  }
                                </div>

                                <div className="font-semibold mt-1">
                                  {
                                    value
                                  }
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold mb-3">
                          Indicatori
                        </h3>

                        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                          {[
                            [
                              "ROI",
                              percentuale(
                                indici?.roi
                              ),
                            ],
                            [
                              "ROE",
                              percentuale(
                                indici?.roe
                              ),
                            ],
                            [
                              "ROS",
                              percentuale(
                                indici?.ros
                              ),
                            ],
                            [
                              "ROA",
                              percentuale(
                                indici?.roa
                              ),
                            ],
                            [
                              "Indebitamento",
                              numero(
                                indici
                                  ?.indebitamento
                              ),
                            ],
                            [
                              "Liquidità",
                              numero(
                                indici
                                  ?.liquidita
                              ),
                            ],
                            [
                              "DSCR",
                              numero(
                                indici?.dscr
                              ),
                            ],
                          ].map(
                            ([
                              label,
                              value,
                            ]) => (
                              <div
                                key={label}
                                className="border rounded bg-white p-3"
                              >
                                <div className="text-xs text-gray-500">
                                  {
                                    label
                                  }
                                </div>

                                <div className="font-bold mt-1">
                                  {
                                    value
                                  }
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      </div>

{/* =====================================================
    DASHBOARD ECONOMICO-FINANZIARIA
===================================================== */}

<div className="space-y-6">

  {/* KPI ANNUALI */}
  {ultimoIndici && (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* RICAVI */}
      <div className="border rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            Ricavi
          </div>

          <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-blue-700" />
          </div>
        </div>

        <div className="text-2xl font-bold mt-3">
          {euro(
            ultimoIndici.ricavi
          )}
        </div>

        {ultimoIndiceDisponibile >= 0 && (
          <div className="text-xs text-gray-500 mt-2">
            Q
            {ultimoIndiceDisponibile + 1}
            {" puro: "}
            <span className="font-medium text-gray-800">
              {euro(
                ricaviPuri[
                  ultimoIndiceDisponibile
                ]
              )}
            </span>
          </div>
        )}
      </div>

      {/* EBITDA */}
      <div className="border rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            EBITDA
          </div>

          <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center">
            <Activity className="h-5 w-5 text-green-700" />
          </div>
        </div>

        <div className="text-2xl font-bold mt-3">
          {euro(
            ultimoIndici.ebitda
          )}
        </div>

        <div className="text-xs text-gray-500 mt-2">
          EBITDA margin{" "}
          <span className="font-semibold text-gray-800">
            {percentuale(
              margineEbitdaCumulativo[
                ultimoIndiceDisponibile
              ]
            )}
          </span>
        </div>
      </div>

      {/* RISULTATO */}
      <div className="border rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            Risultato netto
          </div>

          <div
            className={`h-9 w-9 rounded-lg flex items-center justify-center ${
              Number(
                ultimoIndici.utile_netto ||
                  0
              ) >= 0
                ? "bg-green-50"
                : "bg-red-50"
            }`}
          >
            <Target
              className={`h-5 w-5 ${
                Number(
                  ultimoIndici.utile_netto ||
                    0
                ) >= 0
                  ? "text-green-700"
                  : "text-red-700"
              }`}
            />
          </div>
        </div>

        <div
          className={`text-2xl font-bold mt-3 ${
            Number(
              ultimoIndici.utile_netto ||
                0
            ) < 0
              ? "text-red-600"
              : ""
          }`}
        >
          {euro(
            ultimoIndici.utile_netto
          )}
        </div>

        <div className="text-xs text-gray-500 mt-2">
          Margine netto{" "}
          <span className="font-semibold text-gray-800">
            {percentuale(
              margineNettoCumulativo[
                ultimoIndiceDisponibile
              ]
            )}
          </span>
        </div>
      </div>

      {/* ROI */}
      <div className="border rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            ROI
          </div>

          <div className="h-9 w-9 rounded-lg bg-violet-50 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-violet-700" />
          </div>
        </div>

        <div className="text-2xl font-bold mt-3">
          {percentuale(
            ultimoIndici.roi
          )}
        </div>

        {ultimoIndiceDisponibile > 0 && (
          <div className="text-xs text-gray-500 mt-2">
            vs periodo precedente{" "}
            <span
              className={
                Number(
                  ultimoIndici.roi
                ) -
                  Number(
                    datiPeriodi[
                      ultimoIndiceDisponibile -
                        1
                    ]?.indici?.roi ||
                      0
                  ) >=
                0
                  ? "font-semibold text-green-700"
                  : "font-semibold text-red-700"
              }
            >
              {formatDeltaPunti(
                variazioneAssoluta(
                  valoreNumerico(
                    ultimoIndici.roi
                  ),
                  valoreNumerico(
                    datiPeriodi[
                      ultimoIndiceDisponibile -
                        1
                    ]?.indici?.roi
                  )
                )
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  )}

  {/* ===================================================
      ANDAMENTO CUMULATIVO
  =================================================== */}
  <div className="border rounded-xl bg-white overflow-hidden">
    <div className="px-5 py-4 border-b">
      <h2 className="font-semibold text-lg">
        Andamento cumulativo
      </h2>

      <p className="text-sm text-gray-500 mt-1">
        Valori progressivi dall'inizio dell'esercizio.
        Le colonne Δ evidenziano la variazione rispetto
        alla situazione contabile precedente.
      </p>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-3 text-left">
              Indicatore
            </th>

            {periodiPresenti.map(
              ({ config }, index) => (
                <Fragment
                  key={config.key}
                >
                  <th className="p-3 text-right whitespace-nowrap">
                    Q{index + 1}
                  </th>

                  {index > 0 && (
                    <th className="p-3 text-center whitespace-nowrap text-gray-500">
                      Δ
                    </th>
                  )}
                </Fragment>
              )
            )}
          </tr>
        </thead>

        <tbody>
          {[
            {
              label: "Ricavi",
              field: "ricavi",
              format: euro,
              delta: "percent",
              direzione: "up",
            },
            {
              label: "EBITDA",
              field: "ebitda",
              format: euro,
              delta: "percent",
              direzione: "up",
            },
            {
              label: "EBIT",
              field: "ebit",
              format: euro,
              delta: "percent",
              direzione: "up",
            },
            {
              label: "Risultato netto",
              field: "utile_netto",
              format: euro,
              delta: "percent",
              direzione: "up",
            },
            {
              label: "EBITDA margin",
              custom:
                margineEbitdaCumulativo,
              format: percentuale,
              delta: "pp",
              direzione: "up",
            },
            {
              label: "Margine netto",
              custom:
                margineNettoCumulativo,
              format: percentuale,
              delta: "pp",
              direzione: "up",
            },
            {
              label: "ROI",
              field: "roi",
              format: percentuale,
              delta: "pp",
              direzione: "up",
            },
            {
              label: "ROE",
              field: "roe",
              format: percentuale,
              delta: "pp",
              direzione: "up",
            },
            {
              label: "ROS",
              field: "ros",
              format: percentuale,
              delta: "pp",
              direzione: "up",
            },
            {
              label: "ROA",
              field: "roa",
              format: percentuale,
              delta: "pp",
              direzione: "up",
            },
            {
              label:
                "Indice indebitamento",
              field:
                "indebitamento",
              format: numero,
              delta: "number",
              direzione: "down",
            },
            {
              label:
                "Indice liquidità",
              field: "liquidita",
              format: numero,
              delta: "number",
              direzione: "neutral",
            },
          ].map((riga: any) => (
            <tr
              key={riga.label}
              className="border-t hover:bg-gray-50/60"
            >
              <td className="p-3 font-medium whitespace-nowrap">
                {riga.label}
              </td>

              {periodiPresenti.map(
                (
                  { record, config },
                  index
                ) => {
                  const attuale =
                    riga.custom
                      ? valoreNumerico(
                          riga.custom[
                            index
                          ]
                        )
                      : valoreNumerico(
                          record
                            ?.indici?.[
                            riga.field
                          ]
                        );

                  const precedente =
                    index > 0
                      ? riga.custom
                        ? valoreNumerico(
                            riga.custom[
                              index - 1
                            ]
                          )
                        : valoreNumerico(
                            periodiPresenti[
                              index - 1
                            ]?.record
                              ?.indici?.[
                              riga.field
                            ]
                          )
                      : null;

                  let delta:
                    | number
                    | null = null;

                  if (index > 0) {
                    if (
                      riga.delta ===
                      "percent"
                    ) {
                      delta =
                        variazionePercentuale(
                          attuale,
                          precedente
                        );
                    } else {
                      delta =
                        variazioneAssoluta(
                          attuale,
                          precedente
                        );
                    }
                  }

                  const stato =
                    classeDelta(
                      delta,
                      riga.direzione
                    );

                  return (
                    <Fragment
                      key={
                        config.key
                      }
                    >
                      <td className="p-3 text-right font-medium whitespace-nowrap">
                        {attuale === null
                          ? "—"
                          : riga.format(
                              attuale
                            )}
                      </td>

                      {index > 0 && (
                        <td className="p-3 text-center whitespace-nowrap">
                          {delta ===
                          null ? (
                            <span className="text-gray-400">
                              —
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${stato.className}`}
                            >
                              {stato.icona ===
                              "up" ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : stato.icona ===
                                "down" ? (
                                <TrendingDown className="h-3 w-3" />
                              ) : (
                                <Minus className="h-3 w-3" />
                              )}

                              {riga.delta ===
                              "percent"
                                ? formatDeltaPercentuale(
                                    delta
                                  )
                                : riga.delta ===
                                  "pp"
                                ? formatDeltaPunti(
                                    delta
                                  )
                                : formatDeltaNumero(
                                    delta
                                  )}
                            </span>
                          )}
                        </td>
                      )}
                    </Fragment>
                  );
                }
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>

  {/* ===================================================
      TRIMESTRI PURI
  =================================================== */}
  <div className="border rounded-xl bg-white overflow-hidden">
    <div className="px-5 py-4 border-b">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-lg">
            Performance trimestrale
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Dati del solo trimestre,
            determinati per differenza tra
            situazioni contabili cumulative.
          </p>
        </div>

        <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-medium">
          Trimestri puri
        </span>
      </div>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-3 text-left">
              Indicatore
            </th>

            {periodiPresenti.map(
              ({ config }, index) => (
                <Fragment
                  key={config.key}
                >
                  <th className="p-3 text-right whitespace-nowrap">
                    Q{index + 1}
                  </th>

                  {index > 0 && (
                    <th className="p-3 text-center whitespace-nowrap text-gray-500">
                      Δ vs Q{index}
                    </th>
                  )}
                </Fragment>
              )
            )}
          </tr>
        </thead>

        <tbody>
          {[
            {
              label: "Ricavi",
              valori: ricaviPuri,
              format: euro,
              direzione: "up",
            },
            {
              label: "Costi operativi",
              valori: costiPuri,
              format: euro,
              direzione: "down",
            },
            {
              label: "EBITDA",
              valori: ebitdaPuro,
              format: euro,
              direzione: "up",
            },
            {
              label: "EBIT",
              valori: ebitPuro,
              format: euro,
              direzione: "up",
            },
            {
              label:
                "Oneri finanziari",
              valori:
                oneriFinanziariPuri,
              format: euro,
              direzione: "down",
            },
            {
              label: "Imposte",
              valori: impostePure,
              format: euro,
              direzione:
                "neutral",
            },
            {
              label:
                "Risultato netto",
              valori:
                risultatoPuro,
              format: euro,
              direzione: "up",
            },
            {
              label:
                "EBITDA margin",
              valori:
                margineEbitdaPuro,
              format: percentuale,
              direzione: "up",
              deltaMode: "pp",
            },
            {
              label:
                "Margine netto",
              valori:
                margineNettoPuro,
              format: percentuale,
              direzione: "up",
              deltaMode: "pp",
            },
          ].map((riga: any) => (
            <tr
              key={riga.label}
              className="border-t hover:bg-gray-50/60"
            >
              <td className="p-3 font-medium whitespace-nowrap">
                {riga.label}
              </td>

              {riga.valori.map(
                (
                  valore: number | null,
                  index: number
                ) => {
                  const precedente =
                    index > 0
                      ? riga.valori[
                          index - 1
                        ]
                      : null;

                  const delta =
                    index === 0
                      ? null
                      : riga.deltaMode ===
                        "pp"
                      ? variazioneAssoluta(
                          valore,
                          precedente
                        )
                      : variazionePercentuale(
                          valore,
                          precedente
                        );

                  const stato =
                    classeDelta(
                      delta,
                      riga.direzione
                    );

                  return (
                    <Fragment
                      key={index}
                    >
                      <td className="p-3 text-right font-semibold whitespace-nowrap">
                        {valore === null
                          ? "—"
                          : riga.format(
                              valore
                            )}
                      </td>

                      {index > 0 && (
                        <td className="p-3 text-center whitespace-nowrap">
                          {delta ===
                          null ? (
                            "—"
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${stato.className}`}
                            >
                              {stato.icona ===
                              "up" ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : stato.icona ===
                                "down" ? (
                                <TrendingDown className="h-3 w-3" />
                              ) : (
                                <Minus className="h-3 w-3" />
                              )}

                              {riga.deltaMode ===
                              "pp"
                                ? formatDeltaPunti(
                                    delta
                                  )
                                : formatDeltaPercentuale(
                                    delta
                                  )}
                            </span>
                          )}
                        </td>
                      )}
                    </Fragment>
                  );
                }
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>

  {/* ===================================================
      SINTESI GESTIONALE
  =================================================== */}
  {ultimoIndiceDisponibile >= 1 && (
    <div className="border rounded-xl bg-slate-50 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-5 w-5" />

        <h2 className="font-semibold text-lg">
          Sintesi gestionale
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* RICAVI ULTIMO TRIMESTRE */}
        {(() => {
          const indice =
            ultimoIndiceDisponibile;

          const crescita =
            variazionePercentuale(
              ricaviPuri[indice],
              ricaviPuri[
                indice - 1
              ]
            );

          const stato =
            classeDelta(
              crescita,
              "up"
            );

          return (
            <div className="bg-white border rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase">
                Andamento ricavi
              </div>

              <div className="font-semibold mt-1">
                Q{indice + 1}:{" "}
                {euro(
                  ricaviPuri[
                    indice
                  ]
                )}
              </div>

              <div className="mt-2">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${stato.className}`}
                >
                  {formatDeltaPercentuale(
                    crescita
                  )}{" "}
                  vs Q{indice}
                </span>
              </div>
            </div>
          );
        })()}

        {/* EBITDA MARGIN */}
        {(() => {
          const indice =
            ultimoIndiceDisponibile;

          const delta =
            variazioneAssoluta(
              margineEbitdaPuro[
                indice
              ],
              margineEbitdaPuro[
                indice - 1
              ]
            );

          const stato =
            classeDelta(
              delta,
              "up"
            );

          return (
            <div className="bg-white border rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase">
                Marginalità EBITDA
              </div>

              <div className="font-semibold mt-1">
                {percentuale(
                  margineEbitdaPuro[
                    indice
                  ]
                )}
              </div>

              <div className="mt-2">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${stato.className}`}
                >
                  {formatDeltaPunti(
                    delta
                  )}{" "}
                  vs Q{indice}
                </span>
              </div>
            </div>
          );
        })()}

        {/* RISULTATO */}
        {(() => {
          const indice =
            ultimoIndiceDisponibile;

          const valore =
            risultatoPuro[indice];

          return (
            <div className="bg-white border rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase">
                Risultato ultimo trimestre
              </div>

              <div
                className={`font-bold text-lg mt-1 ${
                  Number(
                    valore || 0
                  ) < 0
                    ? "text-red-600"
                    : "text-green-700"
                }`}
              >
                {euro(valore)}
              </div>

              {Number(
                valore || 0
              ) < 0 && (
                <div className="text-xs text-red-600 mt-2">
                  Il trimestre evidenzia
                  una perdita economica.
                </div>
              )}
            </div>
          );
        })()}

        {/* ROI */}
        {(() => {
          const indice =
            ultimoIndiceDisponibile;

          const roiAttuale =
            valoreIndice(
              indice,
              "roi"
            );

          const roiPrecedente =
            valoreIndice(
              indice - 1,
              "roi"
            );

          const delta =
            variazioneAssoluta(
              roiAttuale,
              roiPrecedente
            );

          const stato =
            classeDelta(
              delta,
              "up"
            );

          return (
            <div className="bg-white border rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase">
                Redditività capitale
              </div>

              <div className="font-semibold mt-1">
                ROI{" "}
                {percentuale(
                  roiAttuale
                )}
              </div>

              <div className="mt-2">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${stato.className}`}
                >
                  {formatDeltaPunti(
                    delta
                  )}{" "}
                  vs Q{indice}
                </span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  )}
</div>

      {/* CHECKLIST */}
      <div className="border rounded-lg bg-white p-5">
        <h2 className="font-semibold text-lg mb-4">
          Stato del controllo
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            {
              n: 1,
              titolo:
                "Rilevamento dati",
            },
            {
              n: 2,
              titolo:
                "Analisi scostamenti",
            },
            {
              n: 3,
              titolo:
                "Reporting",
            },
            {
              n: 4,
              titolo:
                "Azioni correttive",
            },
          ].map((step) => {
            /*
             * Per ora utilizziamo il
             * controllo passato dalla
             * dashboard come riferimento
             * della checklist.
             */
            const riferimento =
              data?.periodi?.find(
                (p: any) =>
                  p?.controllo?.id ===
                  controlloId
              )?.controllo ||
              data?.periodi?.[
                data.periodi
                  .length - 1
              ]?.controllo;

            const completato =
              Boolean(
                riferimento?.[
                  `step_${step.n}_completato`
                ]
              );

            return (
              <div
                key={step.n}
                className={`border rounded p-4 ${
                  completato
                    ? "bg-green-50 border-green-200"
                    : "bg-gray-50"
                }`}
              >
                <div className="text-xs text-gray-500">
                  Step {step.n}
                </div>

                <div className="font-semibold mt-1">
                  {step.titolo}
                </div>

                <div
                  className={`text-sm mt-2 ${
                    completato
                      ? "text-green-700"
                      : "text-gray-500"
                  }`}
                >
                  {completato
                    ? "Completato"
                    : "Da completare"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
