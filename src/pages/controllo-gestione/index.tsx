import { useEffect, useState } from "react";
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

export default function ControlloGestioneIndex() {
  const [records, setRecords] = useState<any[]>([]);

  async function load() {
    const res = await fetch("/api/controllo-gestione");
    setRecords(await res.json());
  }

  async function rinnova(id: string) {
    const data = prompt("Inserisci la nuova data di esecuzione (AAAA-MM-GG)");

    if (!data) return;

    await fetch(`/api/controllo-gestione/${id}/rinnova`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data_esecuzione: data,
      }),
    });

    load();
  }

  useEffect(() => {
    load();
  }, []);

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
              <td className="p-2">{r.cliente?.ragione_sociale || r.cliente_id}</td>
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
              <td className="p-2">
                <button onClick={() => rinnova(r.id)} className="border px-2 py-1 rounded">
                  Rinnova
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
