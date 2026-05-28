import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function NuovoControlloGestione() {
  const router = useRouter();

  const [clienti, setClienti] = useState<any[]>([]);
  const [utenti, setUtenti] = useState<any[]>([]);
  const [files, setFiles] = useState<FileList | null>(null);

  const [form, setForm] = useState({
    studio_id: "",
    cliente_id: "",
    cadenza_controllo: "mensile",
    data_esecuzione: new Date().toISOString().slice(0, 10),
    prossima_scadenza: "",
    note: "",
    link: "",
    utenti: [] as string[],
  });

  useEffect(() => {
   fetch("/api/controllo-gestione/clienti-disponibili")
  .then((r) => r.json())
  .then(setClienti);
    fetch("/api/utenti").then((r) => r.json()).then(setUtenti);
  }, []);

  async function salva() {
    const res = await fetch("/api/controllo-gestione", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const controllo = await res.json();

    if (files?.length) {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));

      await fetch(`/api/controllo-gestione/${controllo.id}/allegati`, {
        method: "POST",
        body: fd,
      });
    }

    router.push("/controllo-gestione");
  }

  function toggleUtente(id: string) {
    setForm((f) => ({
      ...f,
      utenti: f.utenti.includes(id)
        ? f.utenti.filter((x) => x !== id)
        : [...f.utenti, id],
    }));
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Nuovo controllo di gestione</h1>

      <div className="grid grid-cols-2 gap-4">
        <select
          className="border p-2 rounded"
          value={form.cliente_id}
          onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
        >
          <option value="">Seleziona società</option>
          {clienti.map((c) => (
            <option key={c.id} value={c.id}>
              {c.ragione_sociale || c.nome}
            </option>
          ))}
        </select>

        <select
          className="border p-2 rounded"
          value={form.cadenza_controllo}
          onChange={(e) => setForm({ ...form, cadenza_controllo: e.target.value })}
        >
          <option value="mensile">Mensile</option>
          <option value="trimestrale">Trimestrale</option>
          <option value="quadrimestrale">Quadrimestrale</option>
          <option value="semestrale">Semestrale</option>
        </select>

        <input
          type="date"
          className="border p-2 rounded"
          value={form.data_esecuzione}
          onChange={(e) => setForm({ ...form, data_esecuzione: e.target.value })}
        />

        <input
          type="date"
          className="border p-2 rounded"
          value={form.prossima_scadenza}
          onChange={(e) => setForm({ ...form, prossima_scadenza: e.target.value })}
        />

        <input
          className="border p-2 rounded col-span-2"
          placeholder="Link"
          value={form.link}
          onChange={(e) => setForm({ ...form, link: e.target.value })}
        />

        <textarea
          className="border p-2 rounded col-span-2"
          placeholder="Note"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />

        <input
          type="file"
          multiple
          className="border p-2 rounded col-span-2"
          onChange={(e) => setFiles(e.target.files)}
        />
      </div>

      <div>
        <h2 className="font-semibold mb-2">Utenti assegnati</h2>
        <div className="grid grid-cols-2 gap-2">
          {utenti.map((u) => (
            <label key={u.id} className="border rounded p-2 flex gap-2">
              <input
                type="checkbox"
                checked={form.utenti.includes(u.id)}
                onChange={() => toggleUtente(u.id)}
              />
              {u.nome || u.email}
            </label>
          ))}
        </div>
      </div>

      <button onClick={salva} className="bg-black text-white px-4 py-2 rounded">
        Salva controllo
      </button>
    </div>
  );
}
