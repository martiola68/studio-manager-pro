"use client";

import { useState } from "react";

export default function NuovaPraticaPage() {
  const [loading, setLoading] = useState(false);
  const [messaggio, setMessaggio] = useState("");

  const [form, setForm] = useState({
    studio_id: "1",
    cliente_id: "",
    tipo_pratica_id: "",
    titolo: "",
    priorita: "normale",
    assegnato_a: "",
    note: "",
  });

  function aggiornaCampo(campo: string, valore: string) {
    setForm((prev) => ({
      ...prev,
      [campo]: valore,
    }));
  }

  async function creaPratica(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessaggio("");

    try {
      const payload = {
        studio_id: Number(form.studio_id),
        cliente_id: Number(form.cliente_id),
        tipo_pratica_id: Number(form.tipo_pratica_id),
        titolo: form.titolo,
        priorita: form.priorita,
        assegnato_a: form.assegnato_a ? Number(form.assegnato_a) : null,
        note: form.note || null,
      };

      const res = await fetch("/api/pratiche", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Errore creazione pratica");
      }

      setMessaggio(`Pratica creata: ${data.pratica.numero_pratica}`);

      setForm({
        studio_id: "1",
        cliente_id: "",
        tipo_pratica_id: "",
        titolo: "",
        priorita: "normale",
        assegnato_a: "",
        note: "",
      });
    } catch (error: any) {
      setMessaggio(error.message || "Errore imprevisto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Nuova pratica</h1>
        <p className="text-sm text-gray-500">
          Crea una pratica con workflow automatico, step, checklist e scadenze.
        </p>
      </div>

      <form
        onSubmit={creaPratica}
        className="bg-white border rounded-xl p-6 space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Studio ID</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.studio_id}
              onChange={(e) => aggiornaCampo("studio_id", e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Cliente ID</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.cliente_id}
              onChange={(e) => aggiornaCampo("cliente_id", e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Tipo pratica ID
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.tipo_pratica_id}
              onChange={(e) =>
                aggiornaCampo("tipo_pratica_id", e.target.value)
              }
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Titolo</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={form.titolo}
            onChange={(e) => aggiornaCampo("titolo", e.target.value)}
            placeholder="Es. Messa in liquidazione società Rossi SRL"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Priorità</label>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={form.priorita}
              onChange={(e) => aggiornaCampo("priorita", e.target.value)}
            >
              <option value="bassa">Bassa</option>
              <option value="normale">Normale</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Assegnato a ID
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.assegnato_a}
              onChange={(e) => aggiornaCampo("assegnato_a", e.target.value)}
              placeholder="opzionale"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Note</label>
          <textarea
            className="w-full border rounded-lg px-3 py-2"
            rows={4}
            value={form.note}
            onChange={(e) => aggiornaCampo("note", e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg disabled:opacity-50"
        >
          {loading ? "Creazione in corso..." : "Crea pratica"}
        </button>

        {messaggio && (
          <div className="mt-4 rounded-lg border p-3 text-sm">
            {messaggio}
          </div>
        )}
      </form>
    </main>
  );
}
