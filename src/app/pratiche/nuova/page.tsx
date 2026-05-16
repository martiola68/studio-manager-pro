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
    setForm((prev) => ({ ...prev, [campo]: valore }));
  }

  async function creaPratica(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessaggio("");

    const payload = {
      studio_id: Number(form.studio_id),
      cliente_id: Number(form.cliente_id),
      tipo_pratica_id: Number(form.tipo_pratica_id),
      titolo: form.titolo,
      priorita: form.priorita,
      assegnato_a: form.assegnato_a ? Number(form.assegnato_a) : null,
      note: form.note || null,
    };

    try {
      const res = await fetch("/api/pratiche", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Errore creazione pratica");

      setMessaggio(`Pratica creata correttamente: ${data.pratica.numero_pratica}`);
    } catch (error: any) {
      setMessaggio(error.message || "Errore imprevisto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Nuova pratica</h1>
            <p className="mt-1 text-sm text-slate-500">
              Crea una pratica guidata con workflow automatico, step, checklist e scadenze.
            </p>
          </div>

          <a
            href="/pratiche"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Torna alle pratiche
          </a>
        </div>

        <form onSubmit={creaPratica} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Dati pratica</h2>
              <p className="text-sm text-slate-500">
                Seleziona cliente, tipo pratica e informazioni principali.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Studio ID
                </label>
                <input
                  value={form.studio_id}
                  onChange={(e) => aggiornaCampo("studio_id", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Cliente ID
                </label>
                <input
                  value={form.cliente_id}
                  onChange={(e) => aggiornaCampo("cliente_id", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Tipo pratica ID
                </label>
                <input
                  value={form.tipo_pratica_id}
                  onChange={(e) => aggiornaCampo("tipo_pratica_id", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Priorità
                </label>
                <select
                  value={form.priorita}
                  onChange={(e) => aggiornaCampo("priorita", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="bassa">Bassa</option>
                  <option value="normale">Normale</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Titolo pratica
                </label>
                <input
                  value={form.titolo}
                  onChange={(e) => aggiornaCampo("titolo", e.target.value)}
                  placeholder="Es. Messa in liquidazione Rossi SRL"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Assegnato a ID
                </label>
                <input
                  value={form.assegnato_a}
                  onChange={(e) => aggiornaCampo("assegnato_a", e.target.value)}
                  placeholder="Opzionale"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Note interne
                </label>
                <textarea
                  rows={4}
                  value={form.note}
                  onChange={(e) => aggiornaCampo("note", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Workflow automatico</h2>
              <p className="text-sm text-slate-500">Alla creazione verranno generati:</p>
            </div>

            <div className="space-y-3 p-6 text-sm text-slate-700">
              <div className="rounded-lg bg-slate-50 p-3">Step operativi da template</div>
              <div className="rounded-lg bg-slate-50 p-3">Checklist pratica</div>
              <div className="rounded-lg bg-slate-50 p-3">Scadenze automatiche</div>
              <div className="rounded-lg bg-slate-50 p-3">Log iniziale</div>
              <div className="rounded-lg bg-slate-50 p-3">Documenti modello collegati</div>
            </div>

            <div className="border-t border-slate-200 p-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Creazione in corso..." : "Crea pratica"}
              </button>

              {messaggio && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  {messaggio}
                </div>
              )}
            </div>
          </aside>
        </form>
      </div>
    </main>
  );
}
