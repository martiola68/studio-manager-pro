import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCcw, Pencil, Trash2, X } from "lucide-react";

function formatDateIT(value?: string | null) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function isControlloInRitardo(dataEsecuzione?: string | null, cadenza?: string | null) {
  if (!dataEsecuzione || !cadenza) return false;

  const [y, m, d] = dataEsecuzione.split("-").map(Number);
  const ultimaData = new Date(y, m - 1, d);
  const oggi = new Date();

  const scadenza = new Date(ultimaData);

  if (cadenza === "mensile") {
    scadenza.setMonth(scadenza.getMonth() + 1);
  } else if (cadenza === "trimestrale") {
    scadenza.setMonth(scadenza.getMonth() + 3);
  } else if (cadenza === "quadrimestrale") {
    scadenza.setMonth(scadenza.getMonth() + 4);
  } else if (cadenza === "semestrale") {
    scadenza.setMonth(scadenza.getMonth() + 6);
  }

  oggi.setHours(0, 0, 0, 0);
  scadenza.setHours(0, 0, 0, 0);

  return oggi > scadenza;
}

function utentiLabel(record: any) {
  return (
    record.utenti
      ?.map((u: any) =>
        [u.utente?.nome, u.utente?.cognome].filter(Boolean).join(" ") ||
        u.utente?.email
      )
      .filter(Boolean)
      .join(", ") || ""
  );
}

export default function ControlloGestioneIndex() {
  const [records, setRecords] = useState<any[]>([]);
  const [rinnovoId, setRinnovoId] = useState<string | null>(null);
  const [dataRinnovo, setDataRinnovo] = useState(new Date().toISOString().slice(0, 10));
  const [noteRinnovo, setNoteRinnovo] = useState("");
  const [editRecord, setEditRecord] = useState<any | null>(null);
  const [utentiDisponibili, setUtentiDisponibili] = useState<any[]>([]);
const [utenteEditSelezionato, setUtenteEditSelezionato] = useState("");

  const [periodiModal, setPeriodiModal] = useState<any[]>([]);
const [loadingPeriodiModal, setLoadingPeriodiModal] = useState(false);
const [errorePeriodiModal, setErrorePeriodiModal] = useState("");

const [showReportModal, setShowReportModal] = useState(false);
const [reportAnno, setReportAnno] = useState(String(new Date().getFullYear()));
const [reportClienteId, setReportClienteId] = useState("");

const [riepilogoControllo, setRiepilogoControllo] = useState<any | null>(null);
const [loadingRiepilogo, setLoadingRiepilogo] = useState(false);
const [erroreRiepilogo, setErroreRiepilogo] = useState("");

const [riepiloghiByControllo, setRiepiloghiByControllo] =
  useState<Record<string, any>>({});

const [loadingRiepiloghi, setLoadingRiepiloghi] =
  useState(false);

  const [periodiElaboratiByControllo, setPeriodiElaboratiByControllo] =
  useState<Record<string, number>>({});
  
async function load() {
  const res = await fetch("/api/controllo-gestione");
  const json = await res.json();

  const elenco = Array.isArray(json)
    ? json
    : [];

  setRecords(elenco);

if (elenco.length === 0) {
  setRiepiloghiByControllo({});
  setPeriodiElaboratiByControllo({});
  return;
}

  try {
    setLoadingRiepiloghi(true);

    const risultati = await Promise.all(
      elenco.map(async (record: any) => {
        try {
          const response = await fetch(
            `/api/controllo-gestione/riepilogo-controllo?controllo_id=${encodeURIComponent(
              record.id
            )}`
          );

          const riepilogo = await response.json();

          return {
            id: record.id,
            riepilogo:
              response.ok
                ? riepilogo
                : null,
          };
        } catch (error) {
          console.error(
            "Errore riepilogo controllo:",
            record.id,
            error
          );

          return {
            id: record.id,
            riepilogo: null,
          };
        }
      })
    );

   const mappa: Record<string, any> = {};

risultati.forEach((item) => {
  mappa[item.id] = item.riepilogo;
});

setRiepiloghiByControllo(mappa);

/*
 * Carichiamo anche il numero reale dei periodi
 * contabili elaborati nell'esercizio.
 */
const periodiRisultati = await Promise.all(
  elenco.map(async (record: any) => {
    try {
      const riepilogo =
        mappa[record.id];

      const dataRiferimento =
        riepilogo?.import?.data_riferimento ||
        record.data_storico ||
        record.data_esecuzione ||
        "";

      const anno =
        String(dataRiferimento).slice(0, 4);

      if (
        !record.cliente_id ||
        !anno
      ) {
        return {
          id: record.id,
          completati: 0,
        };
      }

      const response = await fetch(
        `/api/controllo-gestione/analisi-periodi?cliente_id=${encodeURIComponent(
          record.cliente_id
        )}&anno=${encodeURIComponent(
          anno
        )}`
      );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "Errore caricamento periodi"
        );
      }

      const periodi =
        Array.isArray(json?.periodi)
          ? json.periodi
          : [];

      const completati =
        periodi.filter(
          (periodo: any) =>
            periodo?.import?.stato ===
            "elaborato"
        ).length;

      return {
        id: record.id,
        completati:
          Math.min(4, completati),
      };
    } catch (error) {
      console.error(
        "Errore conteggio periodi:",
        record.id,
        error
      );

      return {
        id: record.id,
        completati: 0,
      };
    }
  })
);

const mappaPeriodi: Record<
  string,
  number
> = {};

periodiRisultati.forEach(
  (item) => {
    mappaPeriodi[item.id] =
      item.completati;
  }
);

setPeriodiElaboratiByControllo(
  mappaPeriodi
);
  } finally {
    setLoadingRiepiloghi(false);
  }
}
  async function caricaPeriodiModal(
  clienteId: string,
  anno: string
) {
  if (!clienteId || !anno) {
    setPeriodiModal([]);
    return;
  }

  try {
    setLoadingPeriodiModal(true);
    setErrorePeriodiModal("");

    const response = await fetch(
      `/api/controllo-gestione/analisi-periodi?cliente_id=${encodeURIComponent(
        clienteId
      )}&anno=${encodeURIComponent(anno)}`
    );

    const json = await response.json();

    if (!response.ok) {
      throw new Error(
        json?.error ||
          "Errore caricamento periodi contabili"
      );
    }

    setPeriodiModal(
      Array.isArray(json?.periodi)
        ? json.periodi
        : []
    );
  } catch (error: any) {
    console.error(
      "Errore caricamento periodi modale:",
      error
    );

    setPeriodiModal([]);

    setErrorePeriodiModal(
      error?.message ||
        "Errore caricamento periodi contabili"
    );
  } finally {
    setLoadingPeriodiModal(false);
  }
}

  async function caricaRiepilogoControllo(controlloId: string) {
  if (!controlloId) return;

  try {
    setLoadingRiepilogo(true);
    setErroreRiepilogo("");
    setRiepilogoControllo(null);

    const res = await fetch(
      `/api/controllo-gestione/riepilogo-controllo?controllo_id=${encodeURIComponent(
        controlloId
      )}`
    );

    const json = await res.json();

    if (!res.ok) {
      throw new Error(
        json?.error || "Errore caricamento riepilogo controllo"
      );
    }

  setRiepilogoControllo(json);
  } catch (error: any) {
    console.error("Errore caricamento riepilogo controllo:", error);

    setErroreRiepilogo(
      error?.message || "Impossibile caricare i dati contabili"
    );
  } finally {
    setLoadingRiepilogo(false);
  }
}

  async function confermaRinnovo() {
    if (!rinnovoId) return;

    const res = await fetch(`/api/controllo-gestione/${rinnovoId}/rinnova`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
  data_esecuzione: dataRinnovo,
  note: noteRinnovo,
}),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Errore rinnovo");
      return;
    }

    setRinnovoId(null);
    load();
  }

  async function salvaModifica() {
    if (!editRecord) return;

    const res = await fetch(`/api/controllo-gestione/${editRecord.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
  cadenza_controllo: editRecord.cadenza_controllo,
  data_esecuzione: editRecord.data_esecuzione,
  note: editRecord.note,
  link: editRecord.link,
        step_1_completato: editRecord.step_1_completato,
step_1_note: editRecord.step_1_note,
step_2_completato: editRecord.step_2_completato,
step_2_note: editRecord.step_2_note,
step_3_completato: editRecord.step_3_completato,
step_3_note: editRecord.step_3_note,
step_4_completato: editRecord.step_4_completato,
step_4_note: editRecord.step_4_note,
  utenti: (editRecord.utenti || [])
    .map((u: any) => u.utente?.id || u.utente_id)
    .filter(Boolean),
}),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Errore modifica");
      return;
    }

    setEditRecord(null);
    load();
  }

  async function eliminaCliente(id: string) {
    const ok = confirm(
      "ATTENZIONE: questa operazione eliminerà il controllo corrente e TUTTO lo storico collegato a questo cliente. Operazione irreversibile. Confermi?"
    );

    if (!ok) return;

    await fetch(`/api/controllo-gestione/${id}?scope=cliente`, {
      method: "DELETE",
    });

    load();
  }

 useEffect(() => {
  load();

  fetch("/api/controllo-gestione/utenti-disponibili")
    .then((r) => r.json())
    .then((data) => setUtentiDisponibili(Array.isArray(data) ? data : []));
}, []);

  function aggiungiUtenteEdit() {
  if (!editRecord || !utenteEditSelezionato) return;

  const nuovoUtente = utentiDisponibili.find(
    (u) => u.id === utenteEditSelezionato
  );

  if (!nuovoUtente) return;

  setEditRecord({
    ...editRecord,
    utenti: [
      ...(editRecord.utenti || []),
      {
        utente_id: nuovoUtente.id,
        utente: nuovoUtente,
      },
    ],
  });

  setUtenteEditSelezionato("");
}

function rimuoviUtenteEdit(id: string) {
  if (!editRecord) return;

  setEditRecord({
    ...editRecord,
    utenti: (editRecord.utenti || []).filter(
      (u: any) => u.utente?.id !== id && u.utente_id !== id
    ),
  });
}

  function generaReportPdf() {
  if (!reportClienteId) {
    alert("Seleziona una società.");
    return;
  }

  if (!reportAnno) {
    alert("Inserisci l'anno.");
    return;
  }

window.open(
  `/api/controllo-gestione/report-pdf?cliente_id=${reportClienteId}&anno=${reportAnno}`,
  "_blank"
);
}

function avanzamentoControllo(record: any) {
  const completati = [
    record.step_1_completato,
    record.step_2_completato,
    record.step_3_completato,
    record.step_4_completato,
  ].filter(Boolean).length;

  return {
    completati,
    percentuale: completati * 25,
  };
}

function statoDatiControllo(riepilogo: any) {
  if (!riepilogo?.import) {
    return {
      label: "Da importare",
      className: "bg-gray-100 text-gray-700",
    };
  }

  if (
    Number(
      riepilogo.import.conti_da_mappare || 0
    ) > 0
  ) {
    return {
      label: "Da classificare",
      className: "bg-yellow-100 text-yellow-800",
    };
  }

  if (!riepilogo?.indici) {
    return {
      label: "Da elaborare",
      className: "bg-blue-100 text-blue-800",
    };
  }

  return {
    label: "Elaborato",
    className: "bg-green-100 text-green-700",
  };
}

return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Controllo di gestione</h1>

        <div className="flex gap-2">
  <Link href="/controllo-gestione/storico" className="border px-4 py-2 rounded">
    Storico controlli
  </Link>

  <button
    type="button"
    onClick={() => setShowReportModal(true)}
    className="border px-4 py-2 rounded"
  >
    Report PDF
  </button>

  <Link href="/controllo-gestione/nuovo" className="bg-black text-white px-4 py-2 rounded">
    Nuovo
  </Link>
</div>
      </div>

     <table className="w-full border text-sm">
  <thead className="bg-gray-100">
    <tr>
      <th className="p-2 text-left">Società</th>
      <th className="p-2 text-left">Anno</th>
      <th className="p-2 text-left">Periodo</th>
    <th className="p-2 text-left">
  Cadenza
</th>

<th className="p-2 text-left">
  Periodi
</th>

<th className="p-2 text-left">
  Checklist
</th>

<th className="p-2 text-left">
  Stato dati
</th>
      <th className="p-2 text-right">EBITDA</th>
      <th className="p-2 text-right">Risultato</th>
      <th className="p-2 text-left">Utenti</th>
      <th className="p-2 text-left">Azioni</th>
    </tr>
  </thead>

       <tbody>
  {records.map((r) => {
    const riepilogo =
      riepiloghiByControllo[r.id];

    const avanzamento =
      avanzamentoControllo(r);

      const periodiElaborati =
  periodiElaboratiByControllo[
    r.id
  ] || 0;

const percentualePeriodi =
  periodiElaborati * 25;

    const stato =
      statoDatiControllo(riepilogo);

    const dataRiferimento =
      riepilogo?.import?.data_riferimento ||
      null;

    const anno =
      dataRiferimento
        ? String(dataRiferimento).slice(0, 4)
        : "-";

    const ebitda =
      riepilogo?.indici?.ebitda;

    const risultato =
      riepilogo?.indici?.utile_netto;

    return (
      <tr
        key={r.id}
        className="border-t align-middle"
      >
        <td className="p-2">
          <div className="flex items-center gap-2">
          {periodiElaborati < 4 &&
  isControlloInRitardo(
    r.data_esecuzione,
    r.cadenza_controllo
  ) && (
    <span
      className="h-3 w-3 rounded-full bg-red-600 inline-block"
      title="Controllo di gestione con periodi ancora da completare"
    />
  )}

            <span className="font-medium">
              {r.cliente?.ragione_sociale ||
                r.cliente_id}
            </span>
          </div>
        </td>

        <td className="p-2">
          {anno}
        </td>

        <td className="p-2 whitespace-nowrap">
          {dataRiferimento
            ? formatDateIT(dataRiferimento)
            : "-"}
        </td>

        <td className="p-2">
          {r.cadenza_controllo}
        </td>

       {/* PERIODI CONTABILI */}
<td className="p-2 min-w-[125px]">
  <div className="flex justify-between text-xs mb-1">
    <span className="font-medium">
      {periodiElaborati}/4
    </span>

    <span>
      {percentualePeriodi}%
    </span>
  </div>

  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
    <div
      className="h-full bg-blue-600 rounded-full"
      style={{
        width: `${percentualePeriodi}%`,
      }}
    />
  </div>
</td>

{/* CHECKLIST OPERATIVA */}
<td className="p-2 min-w-[125px]">
  <div className="flex justify-between text-xs mb-1">
    <span className="font-medium">
      {avanzamento.completati}/4
    </span>

    <span>
      {avanzamento.percentuale}%
    </span>
  </div>

  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
    <div
      className="h-full bg-green-600 rounded-full"
      style={{
        width: `${avanzamento.percentuale}%`,
      }}
    />
  </div>
</td>
        <td className="p-2">
          {loadingRiepiloghi &&
          riepilogo === undefined ? (
            <span className="text-xs text-gray-500">
              Caricamento...
            </span>
          ) : (
            <span
              className={`inline-flex px-2 py-1 rounded text-xs font-medium ${stato.className}`}
            >
              {stato.label}
            </span>
          )}
        </td>

        <td className="p-2 text-right whitespace-nowrap font-medium">
          {ebitda == null
            ? "-"
            : Number(ebitda).toLocaleString(
                "it-IT",
                {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                }
              )}
        </td>

        <td
          className={`p-2 text-right whitespace-nowrap font-medium ${
            Number(risultato || 0) < 0
              ? "text-red-600"
              : ""
          }`}
        >
          {risultato == null
            ? "-"
            : Number(
                risultato
              ).toLocaleString(
                "it-IT",
                {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                }
              )}
        </td>

        <td className="p-2">
          {utentiLabel(r)}
        </td>

        <td className="p-2">
          <div className="flex gap-2">

    <Link
  href={`/controllo-gestione/analisi?cliente_id=${r.cliente_id}&controllo_id=${r.id}&anno=${anno}`}
  title="Gestione periodi e analisi"
  className="border px-3 py-2 rounded text-xs font-medium hover:bg-gray-50 whitespace-nowrap"
>
  Analisi
</Link>
            
            <button
              title="Rinnova"
              onClick={() => {
                setRinnovoId(r.id);
                setDataRinnovo(
                  new Date()
                    .toISOString()
                    .slice(0, 10)
                );
              }}
              className="border p-2 rounded"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>

            <button
  title="Modifica"
  onClick={() => {
    setEditRecord({ ...r });

    setPeriodiModal([]);
    setErrorePeriodiModal("");

    const riepilogo =
      riepiloghiByControllo?.[r.id];

    const dataPeriodo =
      riepilogo?.import?.data_riferimento ||
      r.data_storico ||
      r.data_esecuzione ||
      "";

    const annoControllo =
      String(dataPeriodo).slice(0, 4);

    void caricaPeriodiModal(
      r.cliente_id,
      annoControllo
    );
  }}
  className="border p-2 rounded"
>
  <Pencil className="h-4 w-4" />
</button>

            <button
              title="Elimina tutto"
              onClick={() =>
                eliminaCliente(r.id)
              }
              className="border p-2 rounded text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  })}
</tbody>
      </table>

{rinnovoId && (
  <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
    <div className="bg-white rounded p-6 space-y-4 w-[500px]">
      <div className="flex justify-between items-center">
        <h2 className="font-bold">Rinnova controllo</h2>

        <button
          onClick={() => {
            setRinnovoId(null);
            setNoteRinnovo("");
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <label className="block text-sm">Data esecuzione</label>

      <input
        type="date"
        className="border p-2 rounded w-full"
        value={dataRinnovo}
        onChange={(e) => setDataRinnovo(e.target.value)}
      />

      <label className="block text-sm">Note</label>

      <textarea
        className="border p-2 rounded w-full"
        rows={4}
        placeholder="Note del nuovo controllo"
        value={noteRinnovo}
        onChange={(e) => setNoteRinnovo(e.target.value)}
      />

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setRinnovoId(null);
            setNoteRinnovo("");
          }}
          className="border px-4 py-2 rounded"
        >
          Annulla
        </button>

        <button
          onClick={confermaRinnovo}
          className="bg-black text-white px-4 py-2 rounded"
        >
          Conferma rinnovo
        </button>
      </div>
    </div>
  </div>
)}

 {editRecord && (
<div className="fixed top-0 left-0 right-0 bottom-0 z-[9999] bg-black/40 flex items-center justify-center">
 <div className="bg-white rounded-lg w-[760px] h-[620px] flex flex-col overflow-hidden shadow-2xl">
      <div className="flex justify-between items-center border-b px-6 py-4 bg-white">
        <h2 className="font-bold">Modifica controllo</h2>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditRecord(null)}
            className="border px-4 py-2 rounded"
          >
            Annulla
          </button>

          <button
            type="button"
            onClick={salvaModifica}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Salva modifiche
          </button>

          <button onClick={() => setEditRecord(null)} className="p-2">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

   <div className="flex-1 p-6 space-y-4 overflow-y-auto">
        <input
          type="date"
          className="border p-2 rounded w-full"
          value={editRecord.data_esecuzione || ""}
          onChange={(e) =>
            setEditRecord({ ...editRecord, data_esecuzione: e.target.value })
          }
        />

        <select
          className="border p-2 rounded w-full"
          value={editRecord.cadenza_controllo || "mensile"}
          onChange={(e) =>
            setEditRecord({ ...editRecord, cadenza_controllo: e.target.value })
          }
        >
          <option value="mensile">Mensile</option>
          <option value="trimestrale">Trimestrale</option>
          <option value="quadrimestrale">Quadrimestrale</option>
          <option value="semestrale">Semestrale</option>
        </select>

        <input
          className="border p-2 rounded w-full"
          placeholder="Link"
          value={editRecord.link || ""}
          onChange={(e) => setEditRecord({ ...editRecord, link: e.target.value })}
        />

        <textarea
          className="border p-2 rounded w-full"
          rows={4}
          placeholder="Note"
          value={editRecord.note || ""}
          onChange={(e) => setEditRecord({ ...editRecord, note: e.target.value })}
        />

     <div className="border rounded p-4 bg-gray-50 space-y-3">
  <div className="flex items-center justify-between">
    <div>
      <h3 className="font-semibold text-lg">
        Situazioni contabili
      </h3>

      <p className="text-xs text-gray-500 mt-1">
        Periodi acquisiti tramite importazione contabile.
      </p>
    </div>

  {!loadingPeriodiModal && (
  <span className="text-sm font-semibold">
    {Math.min(
      4,
      periodiModal.filter(
        (p: any) =>
          p?.import?.stato ===
          "elaborato"
      ).length
    )}
    /4 acquisiti
  </span>
)}
  </div>

  {loadingPeriodiModal && (
    <div className="text-sm text-gray-500">
      Caricamento periodi...
    </div>
  )}

  {!loadingPeriodiModal &&
    errorePeriodiModal && (
      <div className="border border-red-200 bg-red-50 text-red-700 rounded p-3 text-sm">
        {errorePeriodiModal}
      </div>
    )}

  {!loadingPeriodiModal &&
    !errorePeriodiModal && (
      <div className="grid grid-cols-1 gap-2">
        {[
          {
            label: "1° trimestre",
            data: "-03-31",
          },
          {
            label: "2° trimestre",
            data: "-06-30",
          },
          {
            label: "3° trimestre",
            data: "-09-30",
          },
          {
            label: "4° trimestre",
            data: "-12-31",
          },
        ].map((trimestre) => {
          const periodo =
            periodiModal.find(
              (p: any) =>
                String(
                  p?.import
                    ?.data_riferimento || ""
                ).endsWith(
                  trimestre.data
                )
            );

          const elaborato =
            periodo?.import?.stato ===
            "elaborato";

          return (
            <div
              key={trimestre.label}
              className="border rounded bg-white px-3 py-2 flex items-center justify-between"
            >
              <div>
                <div className="font-medium text-sm">
                  {trimestre.label}
                </div>

                <div className="text-xs text-gray-500">
                  {periodo?.import
                    ?.data_riferimento
                    ? new Date(
                        periodo.import.data_riferimento
                      ).toLocaleDateString(
                        "it-IT"
                      )
                    : "Non importato"}
                </div>
              </div>

              {elaborato ? (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                  Elaborato
                </span>
              ) : periodo ? (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                  Da elaborare
                </span>
              ) : (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">
                  Da importare
                </span>
              )}
            </div>
          );
        })}
      </div>
    )}
</div>

      <div className="border rounded p-4 space-y-4 bg-gray-50">
  <h3 className="font-semibold text-lg">
    Checklist controllo di gestione
  </h3>

 {/* STEP 1 */}
<div className="border rounded-lg bg-white p-4 space-y-3">
  <label className="flex items-center gap-3">
    <input
      type="checkbox"
      checked={
        !!editRecord.step_1_completato
      }
      onChange={(e) =>
        setEditRecord({
          ...editRecord,
          step_1_completato:
            e.target.checked,
        })
      }
    />

    <span className="font-medium">
      Step 1 — Rilevamento dati
    </span>

    {editRecord.step_1_completato && (
      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
        Completato
      </span>
    )}
  </label>

  <p className="text-xs text-gray-500">
    Acquisizione e verifica delle situazioni contabili.
    I dettagli dei periodi sono disponibili nella pagina
    Analisi controllo di gestione.
  </p>

  <textarea
    className="border p-2 rounded w-full text-sm"
    rows={2}
    placeholder="Note operative sul rilevamento dati..."
    value={
      editRecord.step_1_note || ""
    }
    onChange={(e) =>
      setEditRecord({
        ...editRecord,
        step_1_note:
          e.target.value,
      })
    }
  />
</div>

  {/* STEP 2 - 4 */}
  {[
    { n: 2, titolo: "Analisi Scostamenti" },
    { n: 3, titolo: "Reporting" },
    { n: 4, titolo: "Azioni Correttive" },
  ].map((step) => (
    <div
      key={step.n}
      className="border rounded-lg bg-white p-3 space-y-2"
    >
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={!!editRecord[`step_${step.n}_completato`]}
          onChange={(e) =>
            setEditRecord({
              ...editRecord,
              [`step_${step.n}_completato`]: e.target.checked,
            })
          }
        />

        <span className="font-medium">
          Step {step.n} — {step.titolo}
        </span>

        {editRecord[`step_${step.n}_completato`] && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
            Completato
          </span>
        )}
      </label>

      <textarea
        className="border p-2 rounded w-full text-sm"
        rows={2}
        placeholder="Note operative step..."
        value={editRecord[`step_${step.n}_note`] || ""}
        onChange={(e) =>
          setEditRecord({
            ...editRecord,
            [`step_${step.n}_note`]: e.target.value,
          })
        }
      />
    </div>
  ))}
</div>

        <div className="border rounded p-3 space-y-3">
          <h3 className="font-semibold">Utenti assegnati</h3>

          <div className="flex gap-2">
            <select
              className="border p-2 rounded flex-1"
              value={utenteEditSelezionato}
              onChange={(e) => setUtenteEditSelezionato(e.target.value)}
            >
              <option value="">Seleziona utente</option>
              {utentiDisponibili
                .filter(
                  (u) =>
                    !(editRecord.utenti || []).some(
                      (eu: any) =>
                        eu.utente?.id === u.id || eu.utente_id === u.id
                    )
                )
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {[u.nome, u.cognome].filter(Boolean).join(" ") || u.email}
                  </option>
                ))}
            </select>

            <button
              type="button"
              onClick={aggiungiUtenteEdit}
              className="border px-3 py-2 rounded bg-gray-100"
            >
              Aggiungi
            </button>
          </div>

          {(editRecord.utenti || []).map((u: any) => {
            const utente = u.utente || u;

            return (
              <div
                key={utente.id || u.utente_id}
                className="flex justify-between items-center border rounded px-3 py-2 bg-white"
              >
                <span>
                  {[utente.nome, utente.cognome].filter(Boolean).join(" ") ||
                    utente.email}
                </span>

                <button
                  type="button"
                  onClick={() => rimuoviUtenteEdit(utente.id || u.utente_id)}
                  className="text-red-600 text-sm"
                >
                  Rimuovi
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </div>
)}

      {showReportModal && (
  <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center">
    <div className="bg-white rounded-lg w-[520px] shadow-2xl">
      <div className="flex justify-between items-center border-b px-6 py-4">
        <h2 className="font-bold">Report PDF controllo di gestione</h2>

        <button
          type="button"
          onClick={() => setShowReportModal(false)}
          className="p-2"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Società</label>
          <select
            className="border p-2 rounded w-full"
            value={reportClienteId}
            onChange={(e) => setReportClienteId(e.target.value)}
          >
            <option value="">Seleziona società</option>

            {records.map((r) => (
              <option key={r.cliente_id} value={r.cliente_id}>
                {r.cliente?.ragione_sociale || r.cliente_id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Anno</label>
          <input
            type="number"
            className="border p-2 rounded w-full"
            value={reportAnno}
            onChange={(e) => setReportAnno(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={() => setShowReportModal(false)}
            className="border px-4 py-2 rounded"
          >
            Annulla
          </button>

          <button
            type="button"
            onClick={generaReportPdf}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Genera PDF
          </button>
        </div>
      </div>
    </div>
  </div>
)}
      
       </div>
  );
}

      
