"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Pratica = {
  id: string;
  numero_pratica?: string | null;
  titolo?: string | null;
  cliente_nome?: string | null;
  tipo_nome?: string | null;
  stato?: string | null;
  priorita?: string | null;
  assegnatario_nome?: string | null;
  avanzamento?: number | null;
  prossima_scadenza?: string | null;
  created_at?: string | null;
};

const stati = ["Tutti", "aperta", "in_corso", "sospesa", "completata", "archiviata"];
const priorita = ["Tutte", "bassa", "media", "alta", "urgente"];

function statoLabel(stato?: string | null) {
  return (stato || "aperta").replaceAll("_", " ");
}

function badgeStato(stato?: string | null) {
  const value = stato || "aperta";

  const cls: Record<string, string> = {
    aperta: "bg-blue-50 text-blue-700 ring-blue-200",
    in_corso: "bg-amber-50 text-amber-700 ring-amber-200",
    sospesa: "bg-zinc-100 text-zinc-700 ring-zinc-200",
    completata: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    archiviata: "bg-slate-100 text-slate-600 ring-slate-200",
  };

  return cls[value] || "bg-slate-100 text-slate-700 ring-slate-200";
}

function badgePriorita(priorita?: string | null) {
  const value = priorita || "media";

  const cls: Record<string, string> = {
    bassa: "bg-slate-50 text-slate-600 ring-slate-200",
    media: "bg-blue-50 text-blue-700 ring-blue-200",
    alta: "bg-orange-50 text-orange-700 ring-orange-200",
    urgente: "bg-red-50 text-red-700 ring-red-200",
  };

  return cls[value] || "bg-slate-50 text-slate-600 ring-slate-200";
}

function formatDate(date?: string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export default function PratichePage() {
  const router = useRouter();

  const [pratiche, setPratiche] = useState<Pratica[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  const [ricerca, setRicerca] = useState("");
  const [filtroStato, setFiltroStato] = useState("Tutti");
  const [filtroPriorita, setFiltroPriorita] = useState("Tutte");

  useEffect(() => {
    async function loadPratiche() {
      try {
        setLoading(true);
        setErrore(null);

        const res = await fetch("/api/pratiche", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Errore nel caricamento delle pratiche");
        }

        const data = await res.json();
        setPratiche(Array.isArray(data) ? data : data.pratiche || []);
      } catch (error) {
        console.error(error);
        setErrore("Impossibile caricare le pratiche.");
      } finally {
        setLoading(false);
      }
    }

    loadPratiche();
  }, []);

  const praticheFiltrate = useMemo(() => {
    const q = ricerca.trim().toLowerCase();

    return pratiche.filter((p) => {
      const matchRicerca =
        !q ||
        [
          p.numero_pratica,
          p.titolo,
          p.cliente_nome,
          p.tipo_nome,
          p.assegnatario_nome,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);

      const matchStato =
        filtroStato === "Tutti" || (p.stato || "aperta") === filtroStato;

      const matchPriorita =
        filtroPriorita === "Tutte" || (p.priorita || "media") === filtroPriorita;

      return matchRicerca && matchStato && matchPriorita;
    });
  }, [pratiche, ricerca, filtroStato, filtroPriorita]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Pratiche
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Gestione pratiche, workflow, assegnazioni e scadenze operative.
            </p>
          </div>

          <button
            onClick={() => router.push("/pratiche/nuova")}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            Nuova pratica
          </button>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <input
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
              placeholder="Cerca per numero, cliente, titolo, tipo o assegnatario..."
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            />

            <select
              value={filtroStato}
              onChange={(e) => setFiltroStato(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            >
              {stati.map((s) => (
                <option key={s} value={s}>
                  {s === "Tutti" ? "Tutti gli stati" : statoLabel(s)}
                </option>
              ))}
            </select>

            <select
              value={filtroPriorita}
              onChange={(e) => setFiltroPriorita(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            >
              {priorita.map((p) => (
                <option key={p} value={p}>
                  {p === "Tutte" ? "Tutte le priorità" : p}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Elenco pratiche
              </h2>
              <p className="text-xs text-slate-500">
                {praticheFiltrate.length} pratiche trovate
              </p>
            </div>
          </div>

          {loading ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              Caricamento pratiche...
            </div>
          ) : errore ? (
            <div className="px-5 py-12 text-center text-sm text-red-600">
              {errore}
            </div>
          ) : praticheFiltrate.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">
                Nessuna pratica trovata
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Modifica i filtri oppure crea una nuova pratica.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Pratica
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Cliente
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Stato
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Priorità
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Assegnatario
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Avanzamento
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Prossima scadenza
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {praticheFiltrate.map((p) => {
                    const progress = Math.max(
                      0,
                      Math.min(100, Number(p.avanzamento || 0))
                    );

                    return (
                      <tr
                        key={p.id}
                        onClick={() => router.push(`/pratiche/${p.id}`)}
                        className="cursor-pointer transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-900">
                            {p.numero_pratica || "—"}
                          </div>
                          <div className="mt-0.5 text-sm text-slate-500">
                            {p.titolo || p.tipo_nome || "Pratica senza titolo"}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {p.cliente_nome || "—"}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${badgeStato(
                              p.stato
                            )}`}
                          >
                            {statoLabel(p.stato)}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${badgePriorita(
                              p.priorita
                            )}`}
                          >
                            {p.priorita || "media"}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {p.assegnatario_nome || "Non assegnata"}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-slate-900"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-600">
                              {progress}%
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {formatDate(p.prossima_scadenza)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
