import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Head from "next/head";
import { useRouter } from "next/router";

import {
  ArrowLeft,
  Save,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

import { getSupabaseClient } from "@/lib/supabase/client";

type ChecklistItem = {
  id: string;
  codice: string;
  area: string;
  domanda: string;
  risposta: string | null;
  esito: string | null;
  note: string | null;
  ordine: number;
};

type RilievoSnapshot = {
  id: string;
  followup_id: string | null;
  controllo_id: string | null;
  checklist_id: string | null;

  anno: number | null;
  trimestre: number | null;

  area: string | null;
  descrizione: string;

  gravita: string | null;
  importo: number | null;

  significativo: boolean;
  corretto: boolean;

  stato: string | null;
  effetto_relazione: string | null;
  note: string | null;
};

type VerificaFinale = {
  id: string;

  studio_id: string;
  incarico_id: string;

  anno: number;
  stato: string;

  data_verifica: string | null;

  materialita: number | null;
  materialita_operativa: number | null;
  errore_chiaramente_trascurabile:
    | number
    | null;

  rischio_complessivo:
    | string
    | null;

  controlli_previsti: number;
  controlli_completati: number;

  rilievi_totali: number;
  rilievi_risolti: number;
  rilievi_aperti: number;
  rilievi_significativi_aperti: number;

  importo_rilievi_totale: number;
  importo_errori_corretti: number;
  importo_errori_non_corretti: number;

  errori_non_corretti_superano_materialita:
    | boolean
    | null;

  errori_non_corretti_superano_materialita_operativa:
    | boolean
    | null;

  continuita_aziendale: string | null;
  eventi_successivi: string | null;
  parti_correlate: string | null;
  contenziosi: string | null;

  bilancio_definitivo_acquisito: boolean;
  nota_integrativa_verificata: boolean;
  relazione_gestione_verificata: boolean;
  lettera_attestazione_acquisita: boolean;

  richiami_informativa: boolean;
  testo_richiamo_informativa:
    | string
    | null;

  incertezza_continuita: boolean;
  testo_incertezza_continuita:
    | string
    | null;

  giudizio_proposto: string | null;
  motivazione_giudizio:
    | string
    | null;

  conclusione_finale:
    | string
    | null;
};

function formatEuro(
  value?: number | null
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "-";
  }

  return Number(value).toLocaleString(
    "it-IT",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

export default function VerificaFinalePage() {
  const router = useRouter();

  const incaricoId =
    typeof router.query.incarico_id ===
    "string"
      ? router.query.incarico_id
      : "";

  const anno =
    typeof router.query.anno === "string"
      ? Number(router.query.anno)
      : null;

  const [
    verifica,
    setVerifica,
  ] =
    useState<VerificaFinale | null>(
      null
    );

  const [
    checklist,
    setChecklist,
  ] = useState<ChecklistItem[]>([]);

  const [
    rilievi,
    setRilievi,
  ] =
    useState<RilievoSnapshot[]>([]);

  const [
    currentUserId,
    setCurrentUserId,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    inizializzando,
    setInizializzando,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  async function loadCurrentUser() {
    const supabase =
      getSupabaseClient();

    const {
      data: { session },
    } =
      await supabase.auth.getSession();

    const email =
      session?.user?.email;

    if (!email) {
      throw new Error(
        "Sessione non trovata."
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from("tbutenti")
      .select("id")
      .eq("email", email)
      .single();

    if (error) {
      throw error;
    }

    setCurrentUserId(
      data?.id || ""
    );

    return data?.id || "";
  }

  async function loadVerifica() {
    if (
      !incaricoId ||
      !anno
    ) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const params =
        new URLSearchParams();

      params.set(
        "incarico_id",
        incaricoId
      );

      params.set(
        "anno",
        String(anno)
      );

      const res =
        await fetch(
          `/api/revisione-controllo/verifica-finale?${params.toString()}`
        );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.error ||
            "Errore caricamento verifica finale."
        );
      }

      if (!json.exists) {
        setVerifica(null);
        setChecklist([]);
        setRilievi([]);
        return;
      }

      setVerifica(
        json.data || null
      );

      setChecklist(
        json.checklist || []
      );

      setRilievi(
        json.rilievi || []
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Errore caricamento verifica finale."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (
      router.isReady &&
      incaricoId &&
      anno
    ) {
      void loadCurrentUser();
      void loadVerifica();
    }
  }, [
    router.isReady,
    incaricoId,
    anno,
  ]);

  async function avviaVerifica() {
    if (
      !incaricoId ||
      !anno
    ) {
      return;
    }

    try {
      setInizializzando(true);
      setError("");
      setSuccess("");

      const res =
        await fetch(
          "/api/revisione-controllo/verifica-finale",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                incarico_id:
                  incaricoId,

                anno,
              }),
          }
        );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.error ||
            "Errore inizializzazione verifica finale."
        );
      }

      setVerifica(
        json.data || null
      );

      setChecklist(
        json.checklist || []
      );

      setRilievi(
        json.rilievi || []
      );

      setSuccess(
        json.already_exists
          ? "Verifica finale già esistente."
          : "Verifica finale inizializzata."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Errore inizializzazione verifica finale."
      );
    } finally {
      setInizializzando(false);
    }
  }

  function updateVerifica(
    field: keyof VerificaFinale,
    value: any
  ) {
    setVerifica((prev) =>
      prev
        ? {
            ...prev,
            [field]: value,
          }
        : prev
    );
  }

  function updateChecklist(
    id: string,
    field: keyof ChecklistItem,
    value: any
  ) {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  async function salva(
    stato?: string
  ) {
    if (!verifica) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const res =
        await fetch(
          "/api/revisione-controllo/verifica-finale",
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                id:
                  verifica.id,

                data_verifica:
                  verifica.data_verifica,

                continuita_aziendale:
                  verifica.continuita_aziendale,

                eventi_successivi:
                  verifica.eventi_successivi,

                parti_correlate:
                  verifica.parti_correlate,

                contenziosi:
                  verifica.contenziosi,

                bilancio_definitivo_acquisito:
                  verifica.bilancio_definitivo_acquisito,

                nota_integrativa_verificata:
                  verifica.nota_integrativa_verificata,

                relazione_gestione_verificata:
                  verifica.relazione_gestione_verificata,

                lettera_attestazione_acquisita:
                  verifica.lettera_attestazione_acquisita,

                richiami_informativa:
                  verifica.richiami_informativa,

                testo_richiamo_informativa:
                  verifica.testo_richiamo_informativa,

                incertezza_continuita:
                  verifica.incertezza_continuita,

                testo_incertezza_continuita:
                  verifica.testo_incertezza_continuita,

                giudizio_proposto:
                  verifica.giudizio_proposto,

                motivazione_giudizio:
                  verifica.motivazione_giudizio,

                conclusione_finale:
                  verifica.conclusione_finale,

                stato:
                  stato ||
                  verifica.stato,

                utente_id:
                  currentUserId ||
                  null,

                checklist,
              }),
          }
        );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.error ||
            "Errore salvataggio verifica finale."
        );
      }

      setVerifica(
        json.data || null
      );

      setChecklist(
        json.checklist || []
      );

      setRilievi(
        json.rilievi || []
      );

      setSuccess(
        stato === "COMPLETATA"
          ? "Verifica finale completata."
          : stato === "CHIUSA"
          ? "Verifica finale chiusa."
          : "Verifica finale salvata."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Errore salvataggio verifica finale."
      );
    } finally {
      setSaving(false);
    }
  }

  const importoNonCorretti =
    useMemo(
      () =>
        rilievi
          .filter(
            (item) =>
              item.corretto !== true
          )
          .reduce(
            (totale, item) =>
              totale +
              Number(
                item.importo || 0
              ),
            0
          ),
      [rilievi]
    );

  return (
    <>
      <Head>
        <title>
          Verifica finale revisione
        </title>
      </Head>

      <div className="mx-auto max-w-[1600px] p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              Verifica finale
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Esercizio{" "}
              {anno || "-"}
            </p>
          </div>

          <button
            onClick={() =>
              router.push(
                `/revisione-controllo/fascicolo?incarico_id=${incaricoId}`
              )
            }
            className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            <ArrowLeft size={16} />
            Fascicolo
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {loading ? (
          <div className="rounded-lg border bg-white p-10 text-center text-sm text-gray-500">
            Caricamento verifica finale...
          </div>
        ) : !verifica ? (
          <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
            <AlertTriangle
              size={32}
              className="mx-auto mb-3 text-amber-500"
            />

            <h2 className="text-lg font-semibold">
              Verifica finale non ancora avviata
            </h2>

            <p className="mx-auto mt-2 max-w-2xl text-sm text-gray-500">
              L'inizializzazione fotografa i parametri di revisione,
              lo stato dei controlli periodici e i rilievi presenti
              nell'esercizio.
            </p>

            <button
              onClick={
                avviaVerifica
              }
              disabled={
                inizializzando
              }
              className="mt-5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {inizializzando
                ? "Inizializzazione..."
                : "Avvia verifica finale"}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-xs text-gray-500">
                  Materialità
                </div>

                <div className="mt-1 text-xl font-bold">
                  {formatEuro(
                    verifica.materialita
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-xs text-gray-500">
                  Materialità operativa
                </div>

                <div className="mt-1 text-xl font-bold">
                  {formatEuro(
                    verifica.materialita_operativa
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-xs text-gray-500">
                  Errore trascurabile
                </div>

                <div className="mt-1 text-xl font-bold">
                  {formatEuro(
                    verifica.errore_chiaramente_trascurabile
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-xs text-gray-500">
                  Rischio complessivo
                </div>

                <div className="mt-1 text-xl font-bold">
                  {verifica.rischio_complessivo ||
                    "-"}
                </div>
              </div>
            </section>

            <section className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">
                Controlli e rilievi
              </h2>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                <div>
                  <div className="text-xs text-gray-500">
                    Controlli
                  </div>

                  <div className="mt-1 text-xl font-bold">
                    {verifica.controlli_completati}/
                    {verifica.controlli_previsti}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">
                    Rilievi totali
                  </div>

                  <div className="mt-1 text-xl font-bold">
                    {verifica.rilievi_totali}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">
                    Rilievi aperti
                  </div>

                  <div className="mt-1 text-xl font-bold">
                    {verifica.rilievi_aperti}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">
                    Significativi aperti
                  </div>

                  <div className="mt-1 text-xl font-bold text-red-700">
                    {
                      verifica.rilievi_significativi_aperti
                    }
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">
                    Errori non corretti
                  </div>

                  <div className="mt-1 text-xl font-bold">
                    {formatEuro(
                      importoNonCorretti
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">
                Checklist conclusiva
              </h2>

              <div className="overflow-auto">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-left">
                        Area
                      </th>

                      <th className="p-3 text-left">
                        Verifica
                      </th>

                      <th className="p-3 text-center">
                        Risposta
                      </th>

                      <th className="p-3 text-center">
                        Esito
                      </th>

                      <th className="p-3 text-left">
                        Note
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {checklist.map(
                      (item) => (
                        <tr
                          key={item.id}
                          className="border-t"
                        >
                          <td className="p-3 font-medium">
                            {item.area}
                          </td>

                          <td className="p-3">
                            {item.domanda}
                          </td>

                          <td className="p-3 text-center">
                            <select
                              value={
                                item.risposta ||
                                ""
                              }
                              onChange={(e) =>
                                updateChecklist(
                                  item.id,
                                  "risposta",
                                  e.target
                                    .value ||
                                    null
                                )
                              }
                              className="rounded border px-2 py-1"
                            >
                              <option value="">
                                --
                              </option>

                              <option value="SI">
                                SI
                              </option>

                              <option value="NO">
                                NO
                              </option>

                              <option value="N_A">
                                N/A
                              </option>
                            </select>
                          </td>

                          <td className="p-3 text-center">
                            <select
                              value={
                                item.esito ||
                                ""
                              }
                              onChange={(e) =>
                                updateChecklist(
                                  item.id,
                                  "esito",
                                  e.target
                                    .value ||
                                    null
                                )
                              }
                              className="rounded border px-2 py-1"
                            >
                              <option value="">
                                --
                              </option>

                              <option value="REGOLARE">
                                Regolare
                              </option>

                              <option value="DA_MONITORARE">
                                Da monitorare
                              </option>

                              <option value="IRREGOLARE">
                                Irregolare
                              </option>
                            </select>
                          </td>

                          <td className="p-3">
                            <input
                              value={
                                item.note ||
                                ""
                              }
                              onChange={(e) =>
                                updateChecklist(
                                  item.id,
                                  "note",
                                  e.target
                                    .value
                                )
                              }
                              className="w-full rounded border px-2 py-1"
                            />
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">
                Valutazioni finali
              </h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  [
                    "continuita_aziendale",
                    "Continuità aziendale",
                  ],
                  [
                    "eventi_successivi",
                    "Eventi successivi",
                  ],
                  [
                    "parti_correlate",
                    "Parti correlate",
                  ],
                  [
                    "contenziosi",
                    "Contenziosi",
                  ],
                ].map(
                  ([field, label]) => (
                    <div key={field}>
                      <label className="mb-1 block text-xs font-medium text-gray-500">
                        {label}
                      </label>

                      <textarea
                        rows={3}
                        value={
                          String(
                            verifica[
                              field as keyof VerificaFinale
                            ] || ""
                          )
                        }
                        onChange={(e) =>
                          updateVerifica(
                            field as keyof VerificaFinale,
                            e.target.value
                          )
                        }
                        className="w-full rounded-md border px-3 py-2 text-sm"
                      />
                    </div>
                  )
                )}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  [
                    "bilancio_definitivo_acquisito",
                    "Bilancio definitivo acquisito",
                  ],
                  [
                    "nota_integrativa_verificata",
                    "Nota integrativa verificata",
                  ],
                  [
                    "relazione_gestione_verificata",
                    "Relazione sulla gestione verificata",
                  ],
                  [
                    "lettera_attestazione_acquisita",
                    "Lettera di attestazione acquisita",
                  ],
                ].map(
                  ([field, label]) => (
                    <label
                      key={field}
                      className="flex items-center gap-3 rounded-md border p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={
                          Boolean(
                            verifica[
                              field as keyof VerificaFinale
                            ]
                          )
                        }
                        onChange={(e) =>
                          updateVerifica(
                            field as keyof VerificaFinale,
                            e.target.checked
                          )
                        }
                      />

                      {label}
                    </label>
                  )
                )}
              </div>
            </section>

            <section className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">
                Relazione e giudizio
              </h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-md border p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={
                      verifica.richiami_informativa
                    }
                    onChange={(e) =>
                      updateVerifica(
                        "richiami_informativa",
                        e.target.checked
                      )
                    }
                  />

                  Richiami di informativa
                </label>

                <label className="flex items-center gap-3 rounded-md border p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={
                      verifica.incertezza_continuita
                    }
                    onChange={(e) =>
                      updateVerifica(
                        "incertezza_continuita",
                        e.target.checked
                      )
                    }
                  />

                  Incertezza sulla continuità aziendale
                </label>
              </div>

              {verifica.richiami_informativa && (
                <textarea
                  rows={3}
                  value={
                    verifica.testo_richiamo_informativa ||
                    ""
                  }
                  onChange={(e) =>
                    updateVerifica(
                      "testo_richiamo_informativa",
                      e.target.value
                    )
                  }
                  className="mt-4 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Testo del richiamo di informativa..."
                />
              )}

              {verifica.incertezza_continuita && (
                <textarea
                  rows={3}
                  value={
                    verifica.testo_incertezza_continuita ||
                    ""
                  }
                  onChange={(e) =>
                    updateVerifica(
                      "testo_incertezza_continuita",
                      e.target.value
                    )
                  }
                  className="mt-4 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Descrizione dell'incertezza sulla continuità..."
                />
              )}

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Giudizio proposto
                </label>

                <select
                  value={
                    verifica.giudizio_proposto ||
                    ""
                  }
                  onChange={(e) =>
                    updateVerifica(
                      "giudizio_proposto",
                      e.target.value ||
                        null
                    )
                  }
                  className="h-10 w-full rounded-md border px-3 text-sm"
                >
                  <option value="">
                    --
                  </option>

                  <option value="SENZA_MODIFICA">
                    Senza modifica
                  </option>

                  <option value="CON_RILIEVI">
                    Con rilievi
                  </option>

                  <option value="NEGATIVO">
                    Negativo
                  </option>

                  <option value="IMPOSSIBILITA_ESPRIMERE">
                    Impossibilità di esprimere giudizio
                  </option>
                </select>
              </div>

              <textarea
                rows={4}
                value={
                  verifica.motivazione_giudizio ||
                  ""
                }
                onChange={(e) =>
                  updateVerifica(
                    "motivazione_giudizio",
                    e.target.value
                  )
                }
                className="mt-4 w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Motivazione del giudizio..."
              />

              <textarea
                rows={4}
                value={
                  verifica.conclusione_finale ||
                  ""
                }
                onChange={(e) =>
                  updateVerifica(
                    "conclusione_finale",
                    e.target.value
                  )
                }
                className="mt-4 w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Conclusione finale della verifica..."
              />
            </section>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() =>
                  void loadVerifica()
                }
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md border bg-white px-4 py-2 text-sm hover:bg-gray-50"
              >
                <RefreshCw size={16} />
                Aggiorna
              </button>

              <button
                onClick={() =>
                  void salva()
                }
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                <Save size={16} />
                Salva
              </button>

              <button
                onClick={() =>
                  void salva(
                    "COMPLETATA"
                  )
                }
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle size={16} />
                Completa verifica
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
