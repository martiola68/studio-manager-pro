import {
  useEffect,
  useState,
} from "react";

import Head from "next/head";
import { useRouter } from "next/router";

import {
  ArrowLeft,
  Save,
  ClipboardCheck,
  FileText,
  AlertTriangle,
  FolderOpen,
} from "lucide-react";

type Fascicolo = {
  id: string;

  ragione_sociale: string | null;

  tipo_incarico: string;

  esercizio: number | null;

  materialita: number | null;
  materialita_operativa: number | null;
  errore_chiaramente_trascurabile:
    | number
    | null;

  rischio_complessivo:
    | string
    | null;

  stato_fascicolo:
    | string
    | null;

  conclusione_finale:
    | string
    | null;
};

export default function FascicoloRevisionePage() {
  const router = useRouter();

  const incaricoId =
    typeof router.query.incarico_id ===
    "string"
      ? router.query.incarico_id
      : "";

  const [fascicolo, setFascicolo] =
    useState<Fascicolo | null>(null);

  const [esercizio, setEsercizio] =
    useState("");

  const [
    materialita,
    setMaterialita,
  ] = useState("");

  const [
    materialitaOperativa,
    setMaterialitaOperativa,
  ] = useState("");

  const [
    erroreTrascurabile,
    setErroreTrascurabile,
  ] = useState("");

  const [
    rischioComplessivo,
    setRischioComplessivo,
  ] = useState("");

  const [
    statoFascicolo,
    setStatoFascicolo,
  ] = useState("PIANIFICAZIONE");

  const [
    conclusioneFinale,
    setConclusioneFinale,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  async function loadFascicolo() {
    if (!incaricoId) return;

    try {
      setLoading(true);
      setError("");

      const res =
        await fetch(
          `/api/revisione-controllo/${incaricoId}`
        );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.error ||
            "Errore caricamento fascicolo"
        );
      }

      const item =
        json.data;

      setFascicolo(item);

      setEsercizio(
        item.esercizio != null
          ? String(item.esercizio)
          : ""
      );

      setMaterialita(
        item.materialita != null
          ? String(item.materialita)
          : ""
      );

      setMaterialitaOperativa(
        item.materialita_operativa != null
          ? String(
              item.materialita_operativa
            )
          : ""
      );

      setErroreTrascurabile(
        item.errore_chiaramente_trascurabile !=
          null
          ? String(
              item.errore_chiaramente_trascurabile
            )
          : ""
      );

      setRischioComplessivo(
        item.rischio_complessivo ||
          ""
      );

      setStatoFascicolo(
        item.stato_fascicolo ||
          "PIANIFICAZIONE"
      );

      setConclusioneFinale(
        item.conclusione_finale ||
          ""
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Errore caricamento fascicolo"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (
      router.isReady &&
      incaricoId
    ) {
      void loadFascicolo();
    }
  }, [
    router.isReady,
    incaricoId,
  ]);

  async function salva() {
    if (!incaricoId) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const res =
        await fetch(
          `/api/revisione-controllo/${incaricoId}`,
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                esercizio:
                  esercizio
                    ? Number(
                        esercizio
                      )
                    : null,

                materialita:
                  materialita
                    ? Number(
                        materialita
                      )
                    : null,

                materialita_operativa:
                  materialitaOperativa
                    ? Number(
                        materialitaOperativa
                      )
                    : null,

                errore_chiaramente_trascurabile:
                  erroreTrascurabile
                    ? Number(
                        erroreTrascurabile
                      )
                    : null,

                rischio_complessivo:
                  rischioComplessivo ||
                  null,

                stato_fascicolo:
                  statoFascicolo,

                conclusione_finale:
                  conclusioneFinale ||
                  null,
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
            "Errore salvataggio fascicolo"
        );
      }

      setSuccess(
        "Fascicolo aggiornato correttamente."
      );

      await loadFascicolo();
    } catch (err: any) {
      setError(
        err?.message ||
          "Errore salvataggio fascicolo"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Head>
        <title>
          Fascicolo revisione
        </title>
      </Head>

      <div className="mx-auto max-w-[1500px] p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <FolderOpen size={24} />
              Fascicolo di revisione
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              {fascicolo?.ragione_sociale ||
                "Incarico di revisione"}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/revisione-controllo"
              )
            }
            className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            <ArrowLeft size={16} />
            Indietro
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
            Caricamento fascicolo...
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">
                Pianificazione
              </h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Esercizio
                  </label>

                  <input
                    type="number"
                    value={esercizio}
                    onChange={(e) =>
                      setEsercizio(
                        e.target.value
                      )
                    }
                    className="h-10 w-full rounded-md border px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Materialità
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    value={materialita}
                    onChange={(e) =>
                      setMaterialita(
                        e.target.value
                      )
                    }
                    className="h-10 w-full rounded-md border px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Materialità operativa
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    value={
                      materialitaOperativa
                    }
                    onChange={(e) =>
                      setMaterialitaOperativa(
                        e.target.value
                      )
                    }
                    className="h-10 w-full rounded-md border px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Errore chiaramente trascurabile
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    value={
                      erroreTrascurabile
                    }
                    onChange={(e) =>
                      setErroreTrascurabile(
                        e.target.value
                      )
                    }
                    className="h-10 w-full rounded-md border px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Rischio complessivo
                  </label>

                  <select
                    value={
                      rischioComplessivo
                    }
                    onChange={(e) =>
                      setRischioComplessivo(
                        e.target.value
                      )
                    }
                    className="h-10 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="">
                      --
                    </option>
                    <option value="BASSO">
                      Basso
                    </option>
                    <option value="MEDIO">
                      Medio
                    </option>
                    <option value="ALTO">
                      Alto
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Stato fascicolo
                  </label>

                  <select
                    value={
                      statoFascicolo
                    }
                    onChange={(e) =>
                      setStatoFascicolo(
                        e.target.value
                      )
                    }
                    className="h-10 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="PIANIFICAZIONE">
                      Pianificazione
                    </option>

                    <option value="IN_CORSO">
                      In corso
                    </option>

                    <option value="VERIFICA_FINALE">
                      Verifica finale
                    </option>

                    <option value="RELAZIONE">
                      Relazione
                    </option>

                    <option value="CHIUSO">
                      Chiuso
                    </option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Conclusione finale
                </label>

                <textarea
                  rows={4}
                  value={
                    conclusioneFinale
                  }
                  onChange={(e) =>
                    setConclusioneFinale(
                      e.target.value
                    )
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Conclusioni finali del fascicolo..."
                />
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={salva}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save size={16} />

                  {saving
                    ? "Salvataggio..."
                    : "Salva pianificazione"}
                </button>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/revisione-controllo/controlli?incarico_id=${incaricoId}`
                  )
                }
                className="rounded-xl border bg-white p-5 text-left shadow-sm hover:bg-blue-50"
              >
                <ClipboardCheck className="mb-3 text-blue-600" />

                <div className="font-semibold">
                  Controlli periodici
                </div>

                <div className="mt-1 text-xs text-gray-500">
                  Q1, Q2, Q3 e Q4
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/revisione-controllo/followup"
                  )
                }
                className="rounded-xl border bg-white p-5 text-left shadow-sm hover:bg-amber-50"
              >
                <AlertTriangle className="mb-3 text-amber-600" />

                <div className="font-semibold">
                  Rilievi e follow-up
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/revisione-controllo/documenti"
                  )
                }
                className="rounded-xl border bg-white p-5 text-left shadow-sm hover:bg-slate-50"
              >
                <FolderOpen className="mb-3 text-slate-600" />

                <div className="font-semibold">
                  Carte di lavoro
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/revisione-controllo/relazioni?incarico_id=${incaricoId}`
                  )
                }
                className="rounded-xl border bg-white p-5 text-left shadow-sm hover:bg-purple-50"
              >
                <FileText className="mb-3 text-purple-600" />

                <div className="font-semibold">
                  Relazione annuale
                </div>

                <div className="mt-1 text-xs text-gray-500">
                  Predisposizione relazione finale
                </div>
              </button>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
