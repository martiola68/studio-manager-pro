import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { Save, RefreshCw } from "lucide-react";

type ChecklistItem = {
  id?: string;

  area: string;
  domanda: string;

  risposta: string | null;
  esito: string | null;
  gravita: string | null;

  follow_up: boolean;
  data_follow_up: string | null;

  raccomandazione: string | null;
  note: string | null;

  ordine: number;

  voce_smp_id: string | null;

  asserzione: string | null;
  rischio: string | null;
  procedura: string | null;

  significativita: string | null;

  importo_rilievo: number | null;

  effetto_relazione: string | null;

  eseguito_da: string | null;
  eseguito_at: string | null;

  saldo_contabile?: number | null;
numero_conti?: number | null;
};

type SaldoContabile = {
  voce_id: string;
  codice: string;
  descrizione: string;

  sezione: string;
  macrovoce: string | null;
  natura: string;

  ordine: number;

  importo: number;
  numero_conti: number;
};

type DatiContabili = {
  import: {
    id: string;

    software_contabile:
      | string
      | null;

    data_riferimento:
      | string
      | null;

    numero_conti:
      | number
      | null;

    conti_mappati:
      | number
      | null;

    conti_da_mappare:
      | number
      | null;

    stato:
      | string
      | null;
  } | null;

  saldi: SaldoContabile[];
};

type FascicoloRevisione = {
  id: string;

  esercizio:
    | number
    | null;

  materialita:
    | number
    | null;

  materialita_operativa:
    | number
    | null;

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

export default function ChecklistRevisionePage() {
  const router = useRouter();

  const controlloId =
    typeof router.query.controllo_id === "string"
      ? router.query.controllo_id
      : "";

  const mancaControlloId = router.isReady && !controlloId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  const [
  datiContabili,
  setDatiContabili,
] = useState<DatiContabili | null>(
  null
);

  const [
  fascicolo,
  setFascicolo,
] = useState<FascicoloRevisione | null>(
  null
);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadChecklist() {
    try {
      setLoading(true);
      setError("");

   if (!controlloId) {
  setLoading(false);
  return;
}

      const res = await fetch(
        `/api/revisione-controllo/checklist?controllo_id=${controlloId}&crea_default=true`
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore caricamento checklist");
      }

      setChecklist(json.data || []);
    setFascicolo(
  json.fascicolo || null
);
    } catch (err: any) {
      setError(err?.message || "Errore caricamento checklist");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (router.isReady && controlloId) {
      loadChecklist();
    }
  }, [router.isReady, controlloId]);

  async function salvaChecklist() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/revisione-controllo/checklist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          controllo_id: controlloId,
          checklist,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Errore salvataggio checklist");
      }

      setSuccess("Checklist salvata correttamente");
    } catch (err: any) {
      setError(err?.message || "Errore salvataggio checklist");
    } finally {
      setSaving(false);
    }
  }

  function updateItem(
    index: number,
    field: keyof ChecklistItem,
    value: any
  ) {
    setChecklist((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  }

  function getSaldoChecklist(
  item: ChecklistItem
) {
  if (
    !item.voce_smp_id ||
    !datiContabili?.saldi
  ) {
    return null;
  }

  return (
    datiContabili.saldi.find(
      (saldo) =>
        saldo.voce_id ===
        item.voce_smp_id
    ) || null
  );
}

  const grouped = checklist.reduce(
    (acc: Record<string, ChecklistItem[]>, item) => {
      if (!acc[item.area]) acc[item.area] = [];
      acc[item.area].push(item);
      return acc;
    },
    {}
  );

  return (
    <>
      <Head>
        <title>Checklist Revisione</title>
      </Head>

     <div className="w-full max-w-none px-3 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Checklist controllo trimestrale
            </h1>

            <p className="text-sm text-gray-500">
              Verifica operativa di revisione e controllo.
            </p>
          </div>

         <div className="flex gap-2">
  <button
    onClick={() => router.push("/revisione-controllo/controlli")}
    className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50"
  >
    ← Indietro
  </button>

  <button
    onClick={loadChecklist}
    className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
  >
    <RefreshCw size={16} />
    Aggiorna
  </button>

  <button
    onClick={salvaChecklist}
    disabled={saving}
    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm text-white"
  >
    <Save size={16} />
    {saving ? "Salvataggio..." : "Salva"}
  </button>
</div>
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-green-700">
            {success}
          </div>
        )}

        {datiContabili?.import && (
  <div className="mb-6 overflow-hidden rounded-xl border bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-slate-50 px-5 py-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Situazione contabile collegata
        </div>

        <div className="mt-1 text-lg font-semibold text-slate-900">
          {datiContabili.import
            .software_contabile ||
            "Software contabile"}
        </div>
      </div>

      <div className="text-right">
        <div className="text-xs text-slate-500">
          Data riferimento
        </div>

        <div className="font-semibold">
          {datiContabili.import
            .data_riferimento
            ? new Date(
                `${datiContabili.import.data_riferimento}T00:00:00`
              ).toLocaleDateString(
                "it-IT"
              )
            : "-"}
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
      <div>
        <div className="text-xs text-slate-500">
          Conti
        </div>

        <div className="text-xl font-bold">
          {datiContabili.import
            .numero_conti || 0}
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-500">
          Classificati
        </div>

        <div className="text-xl font-bold text-green-700">
          {datiContabili.import
            .conti_mappati || 0}
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-500">
          Da classificare
        </div>

        <div
          className={`text-xl font-bold ${
            Number(
              datiContabili.import
                .conti_da_mappare || 0
            ) === 0
              ? "text-green-700"
              : "text-red-700"
          }`}
        >
          {datiContabili.import
            .conti_da_mappare || 0}
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-500">
          Voci SMP
        </div>

        <div className="text-xl font-bold">
          {datiContabili.saldi.length}
        </div>
      </div>
    </div>
  </div>
)}

        {fascicolo && (
  <div className="mb-6 overflow-hidden rounded-xl border bg-white shadow-sm">
    <div className="border-b bg-slate-50 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Parametri di revisione
          </div>

          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            Materialità e rischio
          </h2>
        </div>

        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {fascicolo.stato_fascicolo ||
            "PIANIFICAZIONE"}
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-5">
      <div>
        <div className="text-xs text-slate-500">
          Esercizio
        </div>

        <div className="text-lg font-bold">
          {fascicolo.esercizio || "-"}
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-500">
          Materialità
        </div>

        <div className="text-lg font-bold">
          {fascicolo.materialita != null
            ? Number(
                fascicolo.materialita
              ).toLocaleString(
                "it-IT",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )
            : "-"}
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-500">
          Materialità operativa
        </div>

        <div className="text-lg font-bold">
          {fascicolo.materialita_operativa != null
            ? Number(
                fascicolo.materialita_operativa
              ).toLocaleString(
                "it-IT",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )
            : "-"}
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-500">
          Errore trascurabile
        </div>

        <div className="text-lg font-bold">
          {fascicolo.errore_chiaramente_trascurabile != null
            ? Number(
                fascicolo.errore_chiaramente_trascurabile
              ).toLocaleString(
                "it-IT",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )
            : "-"}
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-500">
          Rischio complessivo
        </div>

        <div className="text-lg font-bold">
          {fascicolo.rischio_complessivo ||
            "-"}
        </div>
      </div>
    </div>
  </div>
)}

        {datiContabili?.saldi &&
  datiContabili.saldi.length > 0 && (
    <div className="mb-6 overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="border-b bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Aree di bilancio
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Saldi riclassificati della situazione contabile collegata al controllo.
            </p>
          </div>

          <div className="text-sm text-slate-500">
            {datiContabili.saldi.length} voci SMP
          </div>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="bg-white">
            <tr className="border-b">
              <th className="p-3 text-left">
                Codice
              </th>

              <th className="p-3 text-left">
                Area
              </th>

              <th className="p-3 text-left">
                Sezione
              </th>

              <th className="p-3 text-left">
                Macrovoce
              </th>

              <th className="p-3 text-right">
                Saldo
              </th>

              <th className="p-3 text-right">
                Incidenza
              </th>

              <th className="p-3 text-right">
                  Vs materialità
                </th>

                <th className="p-3 text-center">
                  Significativa
                  </th>

              <th className="p-3 text-center">
                Conti
              </th>

              <th className="p-3 text-center">
                Azione
              </th>
            </tr>
          </thead>

          <tbody>
            {datiContabili.saldi.map(
              (saldo) => {
                const totaleRiferimento =
                  saldo.sezione ===
                  "stato_patrimoniale_attivo"
                    ? datiContabili.saldi
                        .filter(
                          (x) =>
                            x.sezione ===
                            "stato_patrimoniale_attivo"
                        )
                        .reduce(
                          (tot, x) =>
                            tot +
                            Number(
                              x.importo || 0
                            ),
                          0
                        )
                    : saldo.sezione ===
                      "stato_patrimoniale_passivo"
                    ? datiContabili.saldi
                        .filter(
                          (x) =>
                            x.sezione ===
                            "stato_patrimoniale_passivo"
                        )
                        .reduce(
                          (tot, x) =>
                            tot +
                            Number(
                              x.importo || 0
                            ),
                          0
                        )
                    : datiContabili.saldi
                        .filter(
                          (x) =>
                            x.sezione ===
                            "conto_economico"
                        )
                        .reduce(
                          (tot, x) =>
                            tot +
                            Math.abs(
                              Number(
                                x.importo || 0
                              )
                            ),
                          0
                        );

                const incidenza =
                  totaleRiferimento !== 0
                    ? (
                        (
                          Math.abs(
                            Number(
                              saldo.importo ||
                                0
                            )
                          ) /
                          Math.abs(
                            totaleRiferimento
                          )
                        ) *
                        100
                      )
                    : 0;

                const materialita =
  Number(
    fascicolo?.materialita || 0
  );

const rapportoMaterialita =
  materialita > 0
    ? (
        Math.abs(
          Number(
            saldo.importo || 0
          )
        ) /
        materialita
      ) * 100
    : 0;

const superaMaterialita =
  materialita > 0 &&
  Math.abs(
    Number(
      saldo.importo || 0
    )
  ) >= materialita;

                return (
                  <tr
                    key={saldo.voce_id}
                    className="border-b hover:bg-slate-50"
                  >
                    <td className="p-3 font-mono text-xs text-slate-600">
                      {saldo.codice}
                    </td>

                    <td className="p-3 font-medium">
                      {saldo.descrizione}
                    </td>

                    <td className="p-3 text-slate-600">
                      {saldo.sezione ===
                      "stato_patrimoniale_attivo"
                        ? "SP Attivo"
                        : saldo.sezione ===
                          "stato_patrimoniale_passivo"
                        ? "SP Passivo"
                        : "Conto economico"}
                    </td>

                    <td className="p-3 text-slate-600">
                      {saldo.macrovoce ||
                        "-"}
                    </td>

                    <td className="p-3 text-right font-semibold">
                      {Number(
                        saldo.importo || 0
                      ).toLocaleString(
                        "it-IT",
                        {
                          minimumFractionDigits:
                            2,
                          maximumFractionDigits:
                            2,
                        }
                      )}
                    </td>

                    <td className="p-3 text-right">
                      {incidenza.toLocaleString(
                        "it-IT",
                        {
                          minimumFractionDigits:
                            1,
                          maximumFractionDigits:
                            1,
                        }
                      )}
                      %
                    </td>

                    <td className="p-3 text-right">
  {materialita > 0
    ? `${rapportoMaterialita.toLocaleString(
        "it-IT",
        {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }
      )}%`
    : "-"}
</td>

<td className="p-3 text-center">
  {materialita <= 0 ? (
    <span className="text-xs text-gray-400">
      N/D
    </span>
  ) : superaMaterialita ? (
    <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
      SI
    </span>
  ) : (
    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
      NO
    </span>
  )}
</td>

                    <td className="p-3 text-center">
                      {saldo.numero_conti}
                    </td>

                    <td className="p-3 text-center">
                     <button
  type="button"
  onClick={() => {
    const indice =
      checklist.findIndex(
        (item) =>
          item.voce_smp_id ===
          saldo.voce_id
      );

    if (indice < 0) {
      setError(
        `Non esiste ancora una procedura collegata alla voce ${saldo.descrizione}.`
      );
      return;
    }

    const voceChecklist =
      checklist[indice];

    const materialita =
      Number(
        fascicolo?.materialita || 0
      );

    const saldoAssoluto =
      Math.abs(
        Number(
          saldo.importo || 0
        )
      );

    const significativitaProposta =
      materialita > 0
        ? saldoAssoluto >= materialita
          ? "SIGNIFICATIVO"
          : "NON_SIGNIFICATIVO"
        : null;

    const rischioProposto =
      fascicolo?.rischio_complessivo ||
      null;

    setChecklist((prev) =>
      prev.map((item, i) => {
        if (i !== indice) {
          return item;
        }

        return {
          ...item,

          significativita:
            item.significativita ||
            significativitaProposta,

          rischio:
            item.rischio ||
            rischioProposto,
        };
      })
    );

    setTimeout(() => {
      const element =
        document.getElementById(
          `checklist-${voceChecklist.id}`
        );

      element?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
  }}
  className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
>
  Apri verifica
</button>
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>
      </div>
    </div>
  )}

      {mancaControlloId ? (
  <div className="rounded border border-amber-300 bg-amber-50 p-8 text-center text-amber-900">
    Seleziona un controllo trimestrale dalla pagina “Controlli trimestrali” e apri la checklist dall’icona dedicata.
  </div>
) : loading ? (
  <div className="rounded border bg-white p-8 text-center">
    Caricamento checklist...
  </div>
) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([area, items]) => (
              <div
                key={area}
                className="overflow-hidden rounded-lg border bg-white"
              >
                <div className="border-b bg-gray-50 px-4 py-3">
                  <h2 className="font-semibold">{area}</h2>
                </div>

                <div className="overflow-auto">
                  <table className="w-full min-w-[2200px] text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-3 text-left w-[55%]">
                          Verifica
                        </th>
                        <th className="p-3 text-right">
                          Saldo
                        </th>
                        <th className="p-3 text-center">
                        Asserzione
                        </th>

                          <th className="p-3 text-center">
                            Rischio
                            </th>

                        <th className="p-3 text-left">
                        Procedura
                          </th>

                       <th className="p-3 text-center">Risposta</th>
<th className="p-3 text-center">Esito</th>
<th className="p-3 text-center">Gravità</th>
                        <th className="p-3 text-center">
  Significatività
</th>

<th className="p-3 text-right">
  Importo rilievo
</th>

<th className="p-3 text-left">
  Effetto relazione
</th>
<th className="p-3 text-center">Follow-up</th>
<th className="p-3 text-center">Data follow-up</th>
<th className="p-3 text-left">Raccomandazione</th>
<th className="p-3 text-left">Note</th>
                      </tr>
                    </thead>

                    <tbody>
                      {items.map((item) => {
                        const index = checklist.findIndex(
                          (x) => x.id === item.id
                        );

                        return (
                         <tr
  key={item.id}
  id={
    item.id
      ? `checklist-${item.id}`
      : undefined
  }
  className={`border-b transition-colors ${
    item.significativita ===
    "SIGNIFICATIVO"
      ? "bg-amber-50"
      : ""
  }`}
>
                            <td className="p-3">
                              {item.domanda}
                            </td>

                            <td className="p-3 text-right whitespace-nowrap">
  {(() => {
    const saldo =
      getSaldoChecklist(item);

    if (!saldo) {
      return (
        <span className="text-gray-400">
          -
        </span>
      );
    }

    return (
      <div>
        <div className="font-semibold">
          {Number(
            saldo.importo || 0
          ).toLocaleString(
            "it-IT",
            {
              minimumFractionDigits:
                2,
              maximumFractionDigits:
                2,
            }
          )}
        </div>

        <div className="text-[10px] text-gray-400">
          {saldo.numero_conti}{" "}
          {saldo.numero_conti === 1
            ? "conto"
            : "conti"}
        </div>
      </div>
    );
  })()}
</td>
                            
   <td className="p-3 text-center">
  <select
    value={item.asserzione || ""}
    onChange={(e) =>
      updateItem(
        index,
        "asserzione",
        e.target.value || null
      )
    }
    className="rounded border px-2 py-1"
  >
    <option value="">--</option>
    <option value="ESISTENZA">Esistenza</option>
    <option value="COMPLETEZZA">Completezza</option>
    <option value="ACCURATEZZA">Accuratezza</option>
    <option value="VALUTAZIONE">Valutazione</option>
    <option value="COMPETENZA">Competenza</option>
    <option value="DIRITTI_OBBLIGHI">
      Diritti / obblighi
    </option>
    <option value="PRESENTAZIONE">
      Presentazione
    </option>
  </select>
</td>

<td className="p-3 text-center">
  <select
    value={item.rischio || ""}
    onChange={(e) =>
      updateItem(
        index,
        "rischio",
        e.target.value || null
      )
    }
    className="rounded border px-2 py-1"
  >
    <option value="">--</option>
    <option value="BASSO">Basso</option>
    <option value="MEDIO">Medio</option>
    <option value="ALTO">Alto</option>
  </select>
  {item.voce_smp_id &&
  item.rischio && (
    <div className="mt-1 text-[10px] text-gray-400">
      Valutazione area
    </div>
  )}
</td>

<td className="p-3">
  <input
    value={item.procedura || ""}
    onChange={(e) =>
      updateItem(
        index,
        "procedura",
        e.target.value
      )
    }
    className="min-w-[220px] w-full rounded border px-2 py-1"
    placeholder="Procedura di revisione..."
  />
</td>

                            <td className="p-3 text-center">
                              <select
                                value={item.risposta || ""}
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    "risposta",
                                    e.target.value || null
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
    value={item.esito || ""}
    onChange={(e) => updateItem(index, "esito", e.target.value || null)}
    className="rounded border px-2 py-1"
  >
    <option value="">--</option>
    <option value="REGOLARE">Regolare</option>
    <option value="DA_MONITORARE">Da monitorare</option>
    <option value="IRREGOLARE">Irregolare</option>
  </select>
</td>

<td className="p-3 text-center">
  <select
    value={item.gravita || ""}
    onChange={(e) => updateItem(index, "gravita", e.target.value || null)}
    className="rounded border px-2 py-1"
  >
    <option value="">--</option>
    <option value="BASSA">Bassa</option>
    <option value="MEDIA">Media</option>
    <option value="ALTA">Alta</option>
  </select>
</td>

                            {/* NUOVO — SIGNIFICATIVITÀ */}
<td className="p-3 text-center">
  <select
    value={item.significativita || ""}
    onChange={(e) =>
      updateItem(
        index,
        "significativita",
        e.target.value || null
      )
    }
    className="rounded border px-2 py-1"
  >
    <option value="">--</option>

    <option value="NON_SIGNIFICATIVO">
      Non significativo
    </option>

    <option value="SIGNIFICATIVO">
      Significativo
    </option>
  </select>
   {item.voce_smp_id &&
    item.significativita && (
      <div className="mt-1 text-[10px] text-gray-400">
        Modificabile dal revisore
      </div>
    )}
</td>

{/* NUOVO — IMPORTO RILIEVO */}
<td className="p-3">
  <input
    type="number"
    step="0.01"
    value={item.importo_rilievo ?? ""}
    onChange={(e) =>
      updateItem(
        index,
        "importo_rilievo",
        e.target.value === ""
          ? null
          : Number(e.target.value)
      )
    }
    className="w-32 rounded border px-2 py-1 text-right"
    placeholder="0,00"
  />
</td>

{/* NUOVO — EFFETTO RELAZIONE */}
<td className="p-3">
  <input
    value={item.effetto_relazione || ""}
    onChange={(e) =>
      updateItem(
        index,
        "effetto_relazione",
        e.target.value
      )
    }
    className="min-w-[220px] w-full rounded border px-2 py-1"
    placeholder="Effetto sulla relazione..."
  />
</td>

{/* QUESTO ESISTE GIÀ — FOLLOW-UP */}

<td className="p-3 text-center">
  <input
    type="checkbox"
    checked={item.follow_up === true}
    onChange={(e) => updateItem(index, "follow_up", e.target.checked)}
  />
</td>

<td className="p-3 text-center">
  <input
    type="date"
    value={item.data_follow_up || ""}
    onChange={(e) => updateItem(index, "data_follow_up", e.target.value || null)}
    className="rounded border px-2 py-1"
  />
</td>

<td className="p-3">
  <input
    value={item.raccomandazione || ""}
    onChange={(e) => updateItem(index, "raccomandazione", e.target.value)}
    className="w-full rounded border px-2 py-1"
  />
</td>

                            <td className="p-3">
                              <input
                                value={item.note || ""}
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    "note",
                                    e.target.value
                                  )
                                }
                                className="w-full rounded border px-2 py-1"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
