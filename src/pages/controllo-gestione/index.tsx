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

  async function load() {
    const res = await fetch("/api/controllo-gestione");
    setRecords(await res.json());
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Controllo di gestione</h1>

        <div className="flex gap-2">
          <Link href="/controllo-gestione/storico" className="border px-4 py-2 rounded">
            Storico controlli
          </Link>
          <Link href="/controllo-gestione/nuovo" className="bg-black text-white px-4 py-2 rounded">
            Nuovo
          </Link>
        </div>
      </div>

      <table className="w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Società</th>
            <th className="p-2 text-left">Cadenza</th>
            <th className="p-2 text-left">Data esecuzione</th>
            <th className="p-2 text-left">Utenti</th>
            <th className="p-2 text-left">Note</th>
            <th className="p-2 text-left">Link</th>
            <th className="p-2 text-left">Azioni</th>
          </tr>
        </thead>

        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-t align-top">
              <td className="p-2">
  <div className="flex items-center gap-2">
    {isControlloInRitardo(r.data_esecuzione, r.cadenza_controllo) && (
      <span
        className="h-3 w-3 rounded-full bg-red-600 inline-block"
        title="Controllo di gestione in ritardo"
      />
    )}

    <span>{r.cliente?.ragione_sociale || r.cliente_id}</span>
  </div>
</td>
              <td className="p-2">{r.cadenza_controllo}</td>
              <td className="p-2">{formatDateIT(r.data_esecuzione)}</td>
              <td className="p-2">{utentiLabel(r)}</td>
              <td className="p-2 whitespace-pre-wrap">{r.note}</td>
              <td className="p-2">
                {r.link && (
                  <a
                    href={
                      r.link.startsWith("http://") || r.link.startsWith("https://")
                        ? r.link
                        : `https://${r.link}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Apri
                  </a>
                )}
              </td>
              <td className="p-2 flex gap-2">
                <button
                  title="Rinnova"
                  onClick={() => {
                    setRinnovoId(r.id);
                    setDataRinnovo(new Date().toISOString().slice(0, 10));
                  }}
                  className="border p-2 rounded"
                >
                  <RefreshCcw className="h-4 w-4" />
                </button>

                <button
                  title="Modifica"
                  onClick={() => setEditRecord({ ...r })}
                  className="border p-2 rounded"
                >
                  <Pencil className="h-4 w-4" />
                </button>

                <button
                  title="Elimina tutto"
                  onClick={() => eliminaCliente(r.id)}
                  className="border p-2 rounded text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
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
  <div className="fixed inset-0 bg-black/30 flex items-start justify-center pt-20">
    <div className="bg-white rounded w-[900px] max-h-[calc(100vh-110px)] flex flex-col overflow-hidden">
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

      <div className="p-6 space-y-4 overflow-y-auto">
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

        <div className="border rounded p-4 space-y-4 bg-gray-50">
          <h3 className="font-semibold text-lg">
            Checklist controllo di gestione
          </h3>

          {[
            { n: 1, titolo: "Rilevamento Dati" },
            { n: 2, titolo: "Analisi Scostamenti" },
            { n: 3, titolo: "Reporting" },
            { n: 4, titolo: "Azioni Correttive" },
          ].map((step) => (
            <div key={step.n} className="border rounded-lg bg-white p-3 space-y-2">
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
