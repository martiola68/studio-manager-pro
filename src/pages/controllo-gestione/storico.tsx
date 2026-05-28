import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import Link from "next/link";

function formatDateIT(value?: string | null) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
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

export default function StoricoControlliGestione() {
  const [records, setRecords] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [clienti, setClienti] = useState<any[]>([]);

  async function load() {
    const url = clienteId
      ? `/api/controllo-gestione?storico=true&cliente_id=${clienteId}`
      : "/api/controllo-gestione?storico=true";

    const res = await fetch(url);
    setRecords(await res.json());
  }

async function elimina(id: string) {
  if (
    !confirm(
      "Eliminare definitivamente questo record storico?\n\nVerrà eliminato SOLO questo controllo storico, non l'intero cliente."
    )
  ) {
    return;
  }

  const res = await fetch(`/api/controllo-gestione/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    alert(data?.error || "Errore durante l'eliminazione dello storico");
    return;
  }

  await load();
}

  async function download(allegatoId: string) {
    const res = await fetch(`/api/controllo-gestione/x/allegati/${allegatoId}`);
    const data = await res.json();
    window.open(data.url, "_blank");
  }

  useEffect(() => {
    fetch("/api/clienti").then((r) => r.json()).then(setClienti);
  }, []);

  useEffect(() => {
    load();
  }, [clienteId]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Storico controlli</h1>
        <Link href="/controllo-gestione" className="border px-4 py-2 rounded">
          Elenco generale
        </Link>
      </div>

      <select
        className="border p-2 rounded"
        value={clienteId}
        onChange={(e) => setClienteId(e.target.value)}
      >
        <option value="">Tutte le società</option>
        {clienti.map((c) => (
          <option key={c.id} value={c.id}>
            {c.ragione_sociale || c.nome}
          </option>
        ))}
      </select>

      <table className="w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
           <th className="p-2 text-left">Società</th>
            <th className="p-2 text-left">Cadenza</th>
            <th className="p-2 text-left">Data storico</th>
            <th className="p-2 text-left">Utenti</th>
            <th className="p-2 text-left">Note</th>
            <th className="p-2 text-left">Allegati</th>
            <th className="p-2 text-left">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-t align-top">
              <td className="p-2">{r.cliente?.ragione_sociale || r.cliente_id}</td>
              <td className="p-2">{r.cadenza_controllo}</td>
              <td className="p-2">{formatDateIT(r.data_storico)}</td>
              <td className="p-2">{utentiLabel(r)}</td>
              <td className="p-2 whitespace-pre-wrap">{r.note}</td>
           
              <td className="p-2 space-y-1">
                {r.allegati?.map((a: any) => (
                  <button
                    key={a.id}
                    onClick={() => download(a.id)}
                    className="block underline"
                  >
                    {a.nome_file}
                  </button>
                ))}
              </td>
              <td className="p-2">
                <button
  onClick={() => elimina(r.id)}
  className="inline-flex items-center justify-center rounded-md p-2 text-red-600 hover:bg-red-50"
  title="Elimina storico"
>
  <Trash2 size={18} />
</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
