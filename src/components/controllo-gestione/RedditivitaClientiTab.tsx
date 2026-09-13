import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";

type Props = {
  studioId: string;
  anno: string;
};

type Cliente = {
  id: string;
  ragione_sociale?: string | null;
  codice_fiscale?: string | null;
  servizi_attivi?: number;
  numero_operazioni?: number;
  ore_equivalenti?: number;
  costo_stimato?: number;
};

type Attivita = {
  id: string;
  codice: string;
  area: string;
  descrizione: string;
  driver: string;
  unita_misura: string;
  tempo_standard_minuti: number | string;
  coefficiente_base: number | string;
  attiva: boolean;
};

type Operatore = {
  id: string;
  nome?: string | null;
  cognome?: string | null;
  email?: string | null;
  costo?: { costo_orario_pieno?: number | string | null } | null;
  numero_operazioni?: number;
  ore_carico?: number;
  percentuale_operazioni_cliente?: number;
  percentuale_carico_cliente?: number;
};

type Servizio = {
  id: string;
  attivita_id: string;
  quantita_driver: number | string;
  coefficiente_complessita: number | string;
  ore_equivalenti: number | string;
  costo_stimato: number | string;
  attivita?: Attivita | null;
  ripartizione?: Array<{
    operatore_id: string;
    percentuale_ripartizione_attivita: number | string;
    numero_operazioni_attribuite: number | string;
    ore_attribuite: number | string;
    costo_attribuito: number | string;
  }>;
};

function n(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function euro(value: unknown) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n(value));
}

function pct(value: unknown) {
  return `${n(value).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export default function RedditivitaClientiTab({ studioId, anno }: Props) {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [attivita, setAttivita] = useState<Attivita[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [operatori, setOperatori] = useState<Operatore[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceDraft, setServiceDraft] = useState({ attivita_id: "", quantita_driver: 0, coefficiente_complessita: 1 });
  const [savingService, setSavingService] = useState(false);
  const [ripartizioneServizio, setRipartizioneServizio] = useState<Servizio | null>(null);
  const [ripDraft, setRipDraft] = useState<Record<string, number>>({});
  const [savingRip, setSavingRip] = useState(false);

  useEffect(() => {
    if (!studioId) return;
    loadOverview();
  }, [studioId, anno]);

  async function loadOverview() {
    try {
      setLoading(true);
      const res = await fetch(`/api/controllo-gestione/redditivita-studio?studio_id=${encodeURIComponent(studioId)}&esercizio=${encodeURIComponent(anno)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Errore caricamento clienti");
      setClienti(Array.isArray(json?.clienti) ? json.clienti : []);
      setAttivita(Array.isArray(json?.attivita) ? json.attivita : []);
    } catch (error: any) {
      setMessage(error?.message || "Errore caricamento clienti");
    } finally {
      setLoading(false);
    }
  }

  async function loadCliente(clienteId: string) {
    if (!clienteId) {
      setCliente(null);
      setServizi([]);
      setOperatori([]);
      return;
    }
    try {
      setLoading(true);
      setMessage("");
      const res = await fetch(`/api/controllo-gestione/redditivita-studio?studio_id=${encodeURIComponent(studioId)}&esercizio=${encodeURIComponent(anno)}&cliente_id=${encodeURIComponent(clienteId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Errore caricamento cliente");
      setCliente(json?.cliente || null);
      setServizi(Array.isArray(json?.servizi) ? json.servizi : []);
      setAttivita(Array.isArray(json?.attivita) ? json.attivita : []);
      setOperatori(Array.isArray(json?.operatori) ? json.operatori : []);
    } catch (error: any) {
      setMessage(error?.message || "Errore caricamento cliente");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    await Promise.all([loadOverview(), selectedId ? loadCliente(selectedId) : Promise.resolve()]);
  }

  const attivitaDisponibili = useMemo(() => {
    const used = new Set(servizi.map((s) => s.attivita_id));
    return attivita.filter((a) => a.attiva && !used.has(a.id));
  }, [attivita, servizi]);

  const totali = useMemo(() => ({
    operazioni: servizi.reduce((s, x) => s + n(x.quantita_driver), 0),
    ore: servizi.reduce((s, x) => s + n(x.ore_equivalenti), 0),
    costo: servizi.reduce((s, x) => s + n(x.costo_stimato), 0),
  }), [servizi]);

  async function salvaServizio() {
    if (!selectedId || !serviceDraft.attivita_id) return;
    try {
      setSavingService(true);
      setMessage("");
      const res = await fetch("/api/controllo-gestione/redditivita-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "salva_cliente_servizio",
          studio_id: studioId,
          esercizio: Number(anno),
          cliente_id: selectedId,
          ...serviceDraft,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Errore salvataggio servizio");
      setShowServiceForm(false);
      setServiceDraft({ attivita_id: "", quantita_driver: 0, coefficiente_complessita: 1 });
      await refresh();
    } catch (error: any) {
      setMessage(error?.message || "Errore salvataggio servizio");
    } finally {
      setSavingService(false);
    }
  }

  async function aggiornaServizio(servizio: Servizio, quantita: number, coefficiente: number) {
    try {
      setMessage("");
      const res = await fetch("/api/controllo-gestione/redditivita-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "salva_cliente_servizio",
          studio_id: studioId,
          esercizio: Number(anno),
          cliente_id: selectedId,
          attivita_id: servizio.attivita_id,
          quantita_driver: quantita,
          coefficiente_complessita: coefficiente,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Errore aggiornamento servizio");
      await refresh();
    } catch (error: any) {
      setMessage(error?.message || "Errore aggiornamento servizio");
    }
  }

  function apriRipartizione(servizio: Servizio) {
    const draft: Record<string, number> = {};
    (servizio.ripartizione || []).forEach((r) => {
      draft[r.operatore_id] = n(r.percentuale_ripartizione_attivita);
    });
    setRipDraft(draft);
    setRipartizioneServizio(servizio);
  }

  async function salvaRipartizione() {
    if (!ripartizioneServizio) return;
    try {
      setSavingRip(true);
      setMessage("");
      const ripartizione = Object.entries(ripDraft)
        .map(([operatore_id, percentuale]) => ({ operatore_id, percentuale: n(percentuale) }))
        .filter((r) => r.percentuale > 0);
      const res = await fetch("/api/controllo-gestione/redditivita-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "salva_ripartizione",
          studio_id: studioId,
          esercizio: Number(anno),
          cliente_servizio_id: ripartizioneServizio.id,
          ripartizione,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Errore salvataggio ripartizione");
      setRipartizioneServizio(null);
      setRipDraft({});
      await refresh();
    } catch (error: any) {
      setMessage(error?.message || "Errore salvataggio ripartizione");
    } finally {
      setSavingRip(false);
    }
  }

  async function rimuoviServizio(servizio: Servizio) {
    if (!confirm(`Rimuovere il servizio ${servizio.attivita?.descrizione || "selezionato"} dal cliente?`)) return;
    try {
      const res = await fetch("/api/controllo-gestione/redditivita-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rimuovi_cliente_servizio",
          studio_id: studioId,
          esercizio: Number(anno),
          cliente_servizio_id: servizio.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Errore rimozione servizio");
      await refresh();
    } catch (error: any) {
      setMessage(error?.message || "Errore rimozione servizio");
    }
  }

  const totaleRip = Object.values(ripDraft).reduce((s, x) => s + n(x), 0);

  return (
    <section className="space-y-5">
      {message && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{message}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <label className="w-full max-w-2xl text-sm font-semibold text-slate-700">
            Cliente
            <select
              value={selectedId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedId(id);
                loadCliente(id);
              }}
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-600"
            >
              <option value="">Seleziona una società...</option>
              {clienti.map((c) => <option key={c.id} value={c.id}>{c.ragione_sociale || c.codice_fiscale || c.id}</option>)}
            </select>
          </label>
          <div className="text-sm text-slate-500">{loading ? "Caricamento..." : `${clienti.length} clienti disponibili`}</div>
        </div>
      </div>

      {!selectedId ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-semibold text-slate-900">Analisi economica clienti</h2>
            <p className="mt-1 text-sm text-slate-500">Seleziona un cliente per configurare servizi, carico e ripartizione tra operatori.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3 text-right">Servizi</th><th className="px-4 py-3 text-right">Operazioni</th><th className="px-4 py-3 text-right">Ore equivalenti</th><th className="px-4 py-3 text-right">Costo stimato</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clienti.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-sky-50/40" onClick={() => { setSelectedId(c.id); loadCliente(c.id); }}>
                    <td className="px-4 py-3"><div className="font-semibold text-slate-900">{c.ragione_sociale || "—"}</div><div className="text-xs text-slate-500">{c.codice_fiscale || ""}</div></td>
                    <td className="px-4 py-3 text-right">{n(c.servizi_attivi)}</td>
                    <td className="px-4 py-3 text-right">{n(c.numero_operazioni).toLocaleString("it-IT", { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right">{n(c.ore_equivalenti).toLocaleString("it-IT", { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right font-semibold">{euro(c.costo_stimato)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Summary label="Operazioni / driver" value={totali.operazioni.toLocaleString("it-IT", { maximumFractionDigits: 2 })} />
            <Summary label="Ore equivalenti" value={totali.ore.toLocaleString("it-IT", { maximumFractionDigits: 2 })} />
            <Summary label="Costo stimato" value={euro(totali.costo)} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{cliente?.ragione_sociale || "Cliente"}</h2>
                <p className="mt-1 text-sm text-slate-500">Servizi effettivamente svolti nell'esercizio {anno}.</p>
              </div>
              <button type="button" onClick={() => setShowServiceForm(true)} disabled={attivitaDisponibili.length === 0} className="flex items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" />Aggiungi servizio</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-3 py-3">Area / attività</th><th className="px-3 py-3">Driver</th><th className="px-3 py-3 text-right">Quantità</th><th className="px-3 py-3 text-right">Coeff. cliente</th><th className="px-3 py-3 text-right">Ore eq.</th><th className="px-3 py-3 text-right">Costo</th><th className="px-3 py-3">Ripartizione</th><th className="px-3 py-3"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {servizi.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">Nessun servizio configurato per questo cliente.</td></tr>
                  ) : servizi.map((s) => <ServiceRow key={s.id} servizio={s} onSave={aggiornaServizio} onRipartisci={apriRipartizione} onRemove={rimuoviServizio} />)}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <h3 className="text-lg font-semibold text-slate-900">Peso operatori sul cliente</h3>
              <p className="mt-1 text-sm text-slate-500">Separiamo la quota del numero operazioni dalla quota del carico ponderato.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Operatore</th><th className="px-4 py-3 text-right">Operazioni</th><th className="px-4 py-3 text-right">Peso operazioni</th><th className="px-4 py-3 text-right">Ore</th><th className="px-4 py-3 text-right">Peso carico</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {operatori.filter((o) => n(o.numero_operazioni) > 0 || n(o.ore_carico) > 0).map((o) => (
                    <tr key={o.id}><td className="px-4 py-3 font-semibold text-slate-900">{[o.nome, o.cognome].filter(Boolean).join(" ") || o.email}</td><td className="px-4 py-3 text-right">{n(o.numero_operazioni).toLocaleString("it-IT", { maximumFractionDigits: 2 })}</td><td className="px-4 py-3 text-right font-semibold">{pct(o.percentuale_operazioni_cliente)}</td><td className="px-4 py-3 text-right">{n(o.ore_carico).toLocaleString("it-IT", { maximumFractionDigits: 2 })}</td><td className="px-4 py-3 text-right font-semibold">{pct(o.percentuale_carico_cliente)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showServiceForm && (
        <Modal title="Aggiungi servizio" onClose={() => setShowServiceForm(false)}>
          <div className="grid gap-4 p-6 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700 md:col-span-2">Attività<select value={serviceDraft.attivita_id} onChange={(e) => setServiceDraft((p) => ({ ...p, attivita_id: e.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="">Seleziona...</option>{attivitaDisponibili.map((a) => <option key={a.id} value={a.id}>{a.area} — {a.descrizione} ({a.driver})</option>)}</select></label>
            <NumberField label="Quantità driver" value={serviceDraft.quantita_driver} onChange={(v) => setServiceDraft((p) => ({ ...p, quantita_driver: n(v) }))} />
            <NumberField label="Coefficiente complessità cliente" value={serviceDraft.coefficiente_complessita} onChange={(v) => setServiceDraft((p) => ({ ...p, coefficiente_complessita: n(v) }))} />
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4"><button type="button" onClick={() => setShowServiceForm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Annulla</button><button type="button" onClick={salvaServizio} disabled={savingService || !serviceDraft.attivita_id} className="flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{savingService ? "Salvataggio..." : "Salva"}</button></div>
        </Modal>
      )}

      {ripartizioneServizio && (
        <Modal title={`Ripartizione — ${ripartizioneServizio.attivita?.descrizione || "servizio"}`} onClose={() => setRipartizioneServizio(null)}>
          <div className="p-6">
            <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${Math.abs(totaleRip - 100) <= 0.01 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>Totale ripartizione: <strong>{totaleRip.toLocaleString("it-IT", { maximumFractionDigits: 2 })}%</strong> — deve essere 100%.</div>
            <div className="space-y-3">
              {operatori.map((o) => (
                <div key={o.id} className="grid grid-cols-[1fr_130px] items-center gap-4 rounded-lg border border-slate-200 px-4 py-3"><div><div className="font-semibold text-slate-900">{[o.nome, o.cognome].filter(Boolean).join(" ") || o.email}</div><div className="text-xs text-slate-500">Costo pieno: {euro(o.costo?.costo_orario_pieno)}/h</div></div><div className="relative"><input type="number" min="0" max="100" step="0.01" value={ripDraft[o.id] || ""} onChange={(e) => setRipDraft((p) => ({ ...p, [o.id]: n(e.target.value) }))} className="h-10 w-full rounded-lg border border-slate-300 pr-8 text-right text-sm" placeholder="0" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span></div></div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4"><button type="button" onClick={() => setRipartizioneServizio(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Annulla</button><button type="button" onClick={salvaRipartizione} disabled={savingRip || Math.abs(totaleRip - 100) > 0.01} className="flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{savingRip ? "Salvataggio..." : "Salva ripartizione"}</button></div>
        </Modal>
      )}
    </section>
  );
}

function ServiceRow({ servizio, onSave, onRipartisci, onRemove }: { servizio: Servizio; onSave: (s: Servizio, q: number, c: number) => void; onRipartisci: (s: Servizio) => void; onRemove: (s: Servizio) => void }) {
  const [q, setQ] = useState(n(servizio.quantita_driver));
  const [c, setC] = useState(n(servizio.coefficiente_complessita));
  useEffect(() => { setQ(n(servizio.quantita_driver)); setC(n(servizio.coefficiente_complessita)); }, [servizio.quantita_driver, servizio.coefficiente_complessita]);
  const rip = (servizio.ripartizione || []).reduce((s, x) => s + n(x.percentuale_ripartizione_attivita), 0);
  return <tr><td className="px-3 py-3"><div className="font-semibold text-slate-900">{servizio.attivita?.descrizione || "—"}</div><div className="text-xs text-slate-500">{servizio.attivita?.area || ""}</div></td><td className="px-3 py-3 text-slate-600">{servizio.attivita?.driver || "—"}<div className="text-xs">{servizio.attivita?.unita_misura || ""}</div></td><td className="px-3 py-3"><input type="number" min="0" step="0.01" value={q || ""} onChange={(e) => setQ(n(e.target.value))} className="h-9 w-24 rounded-md border border-slate-300 px-2 text-right" /></td><td className="px-3 py-3"><input type="number" min="0.01" step="0.01" value={c || ""} onChange={(e) => setC(n(e.target.value))} className="h-9 w-20 rounded-md border border-slate-300 px-2 text-right" /></td><td className="px-3 py-3 text-right font-semibold">{n(servizio.ore_equivalenti).toLocaleString("it-IT", { maximumFractionDigits: 2 })}</td><td className="px-3 py-3 text-right font-semibold">{euro(servizio.costo_stimato)}</td><td className="px-3 py-3"><button type="button" onClick={() => onRipartisci(servizio)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${Math.abs(rip - 100) <= 0.01 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{rip > 0 ? `${rip.toLocaleString("it-IT", { maximumFractionDigits: 2 })}%` : "Assegna"}</button></td><td className="whitespace-nowrap px-3 py-3"><button type="button" onClick={() => onSave(servizio, q, c)} className="mr-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">Salva</button><button type="button" onClick={() => onRemove(servizio)} className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700"><Trash2 className="h-4 w-4" /></button></td></tr>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-2xl font-bold text-slate-900">{value}</div></div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><h3 className="text-xl font-semibold text-slate-900">{title}</h3><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>{children}</div></div>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return <label className="text-sm font-semibold text-slate-700">{label}<input type="number" min="0" step="0.01" value={value || ""} onChange={(e) => onChange(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-600" placeholder="0" /></label>;
}
