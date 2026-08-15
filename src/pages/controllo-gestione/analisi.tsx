import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  RefreshCcw,
  FileText,
  ChevronDown,
  ChevronUp,
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

      {/* CONFRONTO */}
      <div className="border rounded-lg bg-white">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold text-lg">
            Confronto periodi
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            I valori economici visualizzati
            in questa fase sono cumulativi.
            Il calcolo dei trimestri puri
            sarà effettuato nello Step 2 -
            Analisi scostamenti.
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
                  ({ config }) => (
                    <th
                      key={
                        config.key
                      }
                      className="p-3 text-right"
                    >
                      {
                        config.titolo
                      }
                    </th>
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
                },
                {
                  label: "EBITDA",
                  field: "ebitda",
                  format: euro,
                },
                {
                  label: "EBIT",
                  field: "ebit",
                  format: euro,
                },
                {
                  label: "Risultato",
                  field:
                    "utile_netto",
                  format: euro,
                },
                {
                  label: "ROI",
                  field: "roi",
                  format:
                    percentuale,
                },
                {
                  label: "ROE",
                  field: "roe",
                  format:
                    percentuale,
                },
                {
                  label: "ROS",
                  field: "ros",
                  format:
                    percentuale,
                },
                {
                  label:
                    "Liquidità",
                  field:
                    "liquidita",
                  format: numero,
                },
              ].map((riga) => (
                <tr
                  key={riga.field}
                  className="border-t"
                >
                  <td className="p-3 font-medium">
                    {riga.label}
                  </td>

                  {periodiPresenti.map(
                    ({
                      config,
                      record,
                    }) => (
                      <td
                        key={
                          config.key
                        }
                        className="p-3 text-right whitespace-nowrap"
                      >
                        {record
                          ?.indici
                          ? riga.format(
                              record
                                .indici[
                                riga
                                  .field
                              ]
                            )
                          : "—"}
                      </td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
