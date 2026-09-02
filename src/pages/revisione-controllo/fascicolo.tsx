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
  CheckCircle,
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

type ImportContabile = {
  id: string;
  data_riferimento: string | null;
  software_contabile: string | null;
  stato: string | null;
  numero_conti: number | null;
  conti_mappati: number | null;
  conti_da_mappare: number | null;
};

type ControlloFascicolo = {
  id: string;
  anno: number;
  trimestre: number;

  data_scadenza: string | null;
  data_controllo: string | null;

  stato: string;
  esito: string | null;

  import_contabile:
    | ImportContabile
    | null;

  checklist_totale: number;
  checklist_compilate: number;
  checklist_percentuale: number;

  followup_aperti: number;
  rilievi_significativi: number;
};

type RiepilogoFascicolo = {
  totale_controlli: number;
  controlli_completati: number;
  percentuale_controlli: number;
  rilievi_aperti: number;
  rilievi_significativi: number;
};

type BasiMaterialita = {
  import_id: string;
  data_riferimento: string | null;
  software_contabile: string | null;

  ricavi: number | null;
  patrimonio_netto: number | null;
  costi: number | null;

  totale_attivo: number | null;
  risultato_ante_imposte: number | null;
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

  const [
  controlli,
  setControlli,
] = useState<ControlloFascicolo[]>([]);

const [
  riepilogo,
  setRiepilogo,
] = useState<RiepilogoFascicolo>({
  totale_controlli: 0,
  controlli_completati: 0,
  percentuale_controlli: 0,
  rilievi_aperti: 0,
  rilievi_significativi: 0,
});

  const [
  basiMaterialita,
  setBasiMaterialita,
] = useState<BasiMaterialita | null>(null);

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
  baseMaterialita,
  setBaseMaterialita,
] = useState("");

const [
  valoreBaseMaterialita,
  setValoreBaseMaterialita,
] = useState("");

const [
  percentualeMaterialita,
  setPercentualeMaterialita,
] = useState("1");

const [
  percentualeOperativa,
  setPercentualeOperativa,
] = useState("75");

const [
  percentualeErroreTrascurabile,
  setPercentualeErroreTrascurabile,
] = useState("5");

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
          `/api/revisione-controllo/${encodeURIComponent(String(incaricoId))}`
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

      setControlli(
  Array.isArray(json.controlli)
    ? json.controlli
    : []
);

setRiepilogo({
  totale_controlli:
    Number(
      json.riepilogo?.totale_controlli
    ) || 0,

  controlli_completati:
    Number(
      json.riepilogo?.controlli_completati
    ) || 0,

  percentuale_controlli:
    Number(
      json.riepilogo?.percentuale_controlli
    ) || 0,

  rilievi_aperti:
    Number(
      json.riepilogo?.rilievi_aperti
    ) || 0,

  rilievi_significativi:
    Number(
      json.riepilogo?.rilievi_significativi
    ) || 0,
});

      setBasiMaterialita(
  json.basi_materialita || null
);

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

  function getValoreBaseAutomatico(
  base: string
) {
  if (!basiMaterialita) {
    return null;
  }

  switch (base) {
    case "RICAVI":
      return basiMaterialita.ricavi;

    case "PATRIMONIO_NETTO":
      return basiMaterialita.patrimonio_netto;

    case "COSTI":
      return basiMaterialita.costi;

    case "TOTALE_ATTIVO":
      return basiMaterialita.totale_attivo;

    case "RISULTATO_ANTE_IMPOSTE":
      return basiMaterialita.risultato_ante_imposte;

    default:
      return null;
  }
}

  function calcolaMaterialita() {
  const valoreBase = Number(valoreBaseMaterialita || 0);
  const percMaterialita = Number(percentualeMaterialita || 0);
  const percOperativa = Number(percentualeOperativa || 0);
  const percErrore = Number(percentualeErroreTrascurabile || 0);

 if (!baseMaterialita) {
  setError(
    "Seleziona la base di calcolo della materialità."
  );
  return;
}

if (valoreBase <= 0) {
  setError(
    "La base selezionata non contiene un valore contabile valido."
  );
  return;
}

  if (percMaterialita <= 0) {
    setError("Inserisci una percentuale valida per la materialità.");
    return;
  }

  const materialitaCalcolata =
    valoreBase * (percMaterialita / 100);

  const materialitaOperativaCalcolata =
    materialitaCalcolata * (percOperativa / 100);

  const erroreTrascurabileCalcolato =
    materialitaCalcolata * (percErrore / 100);

  setMaterialita(
    materialitaCalcolata.toFixed(2)
  );

  setMaterialitaOperativa(
    materialitaOperativaCalcolata.toFixed(2)
  );

  setErroreTrascurabile(
    erroreTrascurabileCalcolato.toFixed(2)
  );

  setError("");
}

  async function salva() {
    if (!incaricoId) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const res =
        await fetch(
          `/api/revisione-controllo/${encodeURIComponent(String(incaricoId))}`,
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

  <div className="mt-3 flex flex-wrap items-center gap-3">
    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
      Società
    </span>

    <span className="text-xl font-bold text-gray-900">
      {fascicolo?.ragione_sociale ||
        "Incarico di revisione"}
    </span>

    {fascicolo?.esercizio && (
      <span className="rounded-md border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
        Esercizio {fascicolo.esercizio}
      </span>
    )}
  </div>
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

               <div className="md:col-span-3 rounded-lg border bg-slate-50 p-4">
  <div className="mb-4">
    <h3 className="font-semibold text-slate-900">
      Calcolo guidato della materialità
    </h3>

    <p className="mt-1 text-xs text-gray-500">
      Seleziona la base di riferimento e le percentuali.
      I valori calcolati restano modificabili dal revisore.
    </p>
  </div>

  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">
        Base di calcolo
      </label>

     <select
  value={baseMaterialita}
  onChange={(e) => {
    const nuovaBase =
      e.target.value;

    setBaseMaterialita(
      nuovaBase
    );

    const valore =
      getValoreBaseAutomatico(
        nuovaBase
      );

    if (
      valore !== null &&
      valore !== undefined
    ) {
      setValoreBaseMaterialita(
        String(valore)
      );
    } else {
      setValoreBaseMaterialita("");
    }
  }}
  className="h-10 w-full rounded-md border bg-white px-3 text-sm"
>
  <option value="">
    Seleziona base
  </option>

  <option value="RICAVI">
    Ricavi
  </option>

  <option
    value="TOTALE_ATTIVO"
    disabled={
      basiMaterialita?.totale_attivo ==
      null
    }
  >
    Totale attivo
    {basiMaterialita?.totale_attivo ==
    null
      ? " - non disponibile"
      : ""}
  </option>

  <option value="PATRIMONIO_NETTO">
    Patrimonio netto
  </option>

  <option
    value="RISULTATO_ANTE_IMPOSTE"
    disabled={
      basiMaterialita?.risultato_ante_imposte ==
      null
    }
  >
    Risultato ante imposte
    {basiMaterialita?.risultato_ante_imposte ==
    null
      ? " - non disponibile"
      : ""}
  </option>

  <option value="COSTI">
    Costi
  </option>
</select>
    </div>

    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">
        Valore base
      </label>

     <input
  type="text"
  value={
    valoreBaseMaterialita
      ? Number(
          valoreBaseMaterialita
        ).toLocaleString(
          "it-IT",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )
      : ""
  }
  readOnly
  className="h-10 w-full rounded-md border bg-gray-100 px-3 text-sm text-right font-semibold text-gray-700"
  placeholder="Seleziona una base"
/>

      {basiMaterialita && (
  <div className="mt-1 text-[11px] text-gray-500">
    Fonte:{" "}
    {basiMaterialita.software_contabile
      ? String(
          basiMaterialita.software_contabile
        )
          .replace(/_/g, " ")
          .toUpperCase()
      : "Contabilità"}

    {basiMaterialita.data_riferimento && (
      <>
        {" "}
        · situazione al{" "}
        {new Date(
          `${basiMaterialita.data_riferimento}T00:00:00`
        ).toLocaleDateString(
          "it-IT"
        )}
      </>
    )}
  </div>
)}
    </div>

    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">
        % Materialità
      </label>

      <input
        type="number"
        step="0.01"
        value={percentualeMaterialita}
        onChange={(e) =>
          setPercentualeMaterialita(
            e.target.value
          )
        }
        className="h-10 w-full rounded-md border bg-white px-3 text-sm text-right"
      />
    </div>

    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">
        % Materialità operativa
      </label>

      <input
        type="number"
        step="0.01"
        value={percentualeOperativa}
        onChange={(e) =>
          setPercentualeOperativa(
            e.target.value
          )
        }
        className="h-10 w-full rounded-md border bg-white px-3 text-sm text-right"
      />
    </div>

    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">
        % Errore trascurabile
      </label>

      <input
        type="number"
        step="0.01"
        value={percentualeErroreTrascurabile}
        onChange={(e) =>
          setPercentualeErroreTrascurabile(
            e.target.value
          )
        }
        className="h-10 w-full rounded-md border bg-white px-3 text-sm text-right"
      />
    </div>

    <div className="flex items-end">
      <button
        type="button"
        onClick={calcolaMaterialita}
        className="h-10 w-full rounded-md border border-blue-200 bg-blue-50 px-4 text-sm font-medium text-blue-700 hover:bg-blue-100"
      >
        Calcola materialità
      </button>
    </div>
  </div>
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
      setMaterialita(e.target.value)
    }
    className="h-10 w-full rounded-md border px-3 text-sm text-right"
  />
</div>

<div>
  <label className="mb-1 block text-xs font-medium text-gray-500">
    Materialità operativa
  </label>

  <input
    type="number"
    step="0.01"
    value={materialitaOperativa}
    onChange={(e) =>
      setMaterialitaOperativa(
        e.target.value
      )
    }
    className="h-10 w-full rounded-md border px-3 text-sm text-right"
  />
</div>

<div>
  <label className="mb-1 block text-xs font-medium text-gray-500">
    Errore chiaramente trascurabile
  </label>

  <input
    type="number"
    step="0.01"
    value={erroreTrascurabile}
    onChange={(e) =>
      setErroreTrascurabile(
        e.target.value
      )
    }
    className="h-10 w-full rounded-md border px-3 text-sm text-right"
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

            <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
  <div className="border-b bg-slate-50 px-5 py-4">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Avanzamento annuale
        </div>

        <h2 className="mt-1 text-lg font-semibold">
          Controlli periodici
        </h2>
      </div>

      <div className="text-right">
        <div className="text-2xl font-bold">
          {riepilogo.percentuale_controlli}%
        </div>

        <div className="text-xs text-gray-500">
          {riepilogo.controlli_completati} di{" "}
          {riepilogo.totale_controlli} controlli completati
        </div>
      </div>
    </div>

    <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
      <div
        className="h-full bg-blue-600 transition-all"
        style={{
          width: `${Math.min(
            100,
            Math.max(
              0,
              riepilogo.percentuale_controlli
            )
          )}%`,
        }}
      />
    </div>
  </div>

  <div className="grid grid-cols-2 gap-px bg-gray-200 md:grid-cols-4">
    <div className="bg-white p-4">
      <div className="text-xs text-gray-500">
        Controlli previsti
      </div>

      <div className="mt-1 text-2xl font-bold">
        {riepilogo.totale_controlli}
      </div>
    </div>

    <div className="bg-white p-4">
      <div className="text-xs text-gray-500">
        Completati
      </div>

      <div className="mt-1 text-2xl font-bold text-green-700">
        {riepilogo.controlli_completati}
      </div>
    </div>

    <div className="bg-white p-4">
      <div className="text-xs text-gray-500">
        Rilievi aperti
      </div>

      <div className="mt-1 text-2xl font-bold">
        {riepilogo.rilievi_aperti}
      </div>
    </div>

    <div className="bg-white p-4">
      <div className="text-xs text-gray-500">
        Rilievi significativi
      </div>

      <div
        className={`mt-1 text-2xl font-bold ${
          riepilogo.rilievi_significativi > 0
            ? "text-red-700"
            : "text-green-700"
        }`}
      >
        {riepilogo.rilievi_significativi}
      </div>
    </div>
  </div>
</section>

            <section>
  <div className="mb-3 flex items-center justify-between">
    <div>
      <h2 className="text-lg font-semibold">
        Verifiche dell'esercizio
      </h2>

      <p className="text-xs text-gray-500">
        Stato dei controlli periodici e delle relative carte di lavoro.
      </p>
    </div>
  </div>

  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
    {[1, 2, 3, 4].map((trimestre) => {
      const controllo =
        controlli.find(
          (item) =>
            item.trimestre === trimestre &&
            (
              !fascicolo?.esercizio ||
              item.anno === fascicolo.esercizio
            )
        ) || null;

      const completato =
        controllo?.stato === "COMPLETATO";

      const inLavorazione =
        controllo?.stato === "IN_LAVORAZIONE";

      const scaduto =
        controllo?.stato === "SCADUTO";

      return (
        <div
          key={trimestre}
          className="overflow-hidden rounded-xl border bg-white shadow-sm"
        >
          <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
            <div className="text-lg font-bold">
              Q{trimestre}
            </div>

            {!controllo ? (
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-500">
                Non creato
              </span>
            ) : (
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                  completato
                    ? "bg-green-100 text-green-700"
                    : inLavorazione
                    ? "bg-blue-100 text-blue-700"
                    : scaduto
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {completato
                  ? "Completato"
                  : inLavorazione
                  ? "In lavorazione"
                  : scaduto
                  ? "Scaduto"
                  : "Da fare"}
              </span>
            )}
          </div>

          <div className="space-y-4 p-4">
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-gray-500">
                  Checklist
                </span>

                <span className="font-semibold">
                  {controllo
                    ? `${controllo.checklist_compilate}/${controllo.checklist_totale}`
                    : "-"}
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-blue-600"
                  style={{
                    width: `${
                      controllo?.checklist_percentuale || 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-gray-500">
                  Contabilità
                </div>

                <div className="mt-1 font-semibold">
                  {controllo?.import_contabile
                    ? "Collegata"
                    : "Non collegata"}
                </div>
              </div>

              <div>
                <div className="text-gray-500">
                  Rilievi aperti
                </div>

                <div
                  className={`mt-1 font-semibold ${
                    (controllo?.followup_aperti || 0) > 0
                      ? "text-amber-700"
                      : "text-green-700"
                  }`}
                >
                  {controllo?.followup_aperti || 0}
                </div>
              </div>
            </div>

            {controllo?.import_contabile?.data_riferimento && (
              <div className="text-xs text-gray-500">
                Situazione al{" "}
                {new Date(
                  `${controllo.import_contabile.data_riferimento}T00:00:00`
                ).toLocaleDateString("it-IT")}
              </div>
            )}

            {controllo ? (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/revisione-controllo/checklist?controllo_id=${controllo.id}`
                  )
                }
                className="w-full rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
              >
                Apri verifica
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/revisione-controllo/controlli?incarico_id=${incaricoId}`
                  )
                }
                className="w-full rounded-md border px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Gestisci controlli
              </button>
            )}
          </div>
        </div>
      );
    })}
  </div>
</section>

           <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
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
    router.push({
      pathname: "/revisione-controllo/verifica-finale",
      query: {
        incarico_id: incaricoId,
        anno: fascicolo?.esercizio || esercizio,
      },
    })
  }
  className="rounded-xl border bg-white p-5 text-left shadow-sm hover:bg-green-50"
>
  <CheckCircle className="mb-3 text-green-600" />

  <div className="font-semibold">
    Verifica finale
  </div>

  <div className="mt-1 text-xs text-gray-500">
    Chiusura dell'esercizio e valutazioni conclusive
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
