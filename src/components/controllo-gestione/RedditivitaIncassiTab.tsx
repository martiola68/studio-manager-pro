import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CircleDollarSign, FileText, Plus, RefreshCw, WalletCards } from "lucide-react";

type Props = { studioId: string; anno: string };

type Contratto = {
  id: string;
  cliente_id: string;
  tipo_contratto: string;
  periodicita: string;
  totale_annuo: number | string;
  data_decorrenza?: string | null;
  giorno_scadenza?: number | null;
  stato?: string | null;
  cliente?: { id: string; ragione_sociale?: string | null; codice_fiscale?: string | null } | null;
  numero_rate?: number;
  totale_previsto?: number;
  totale_incassato?: number;
  residuo?: number;
  scaduto?: number;
};

type Scadenza = {
  id: string;
  numero_rata: number;
  data_scadenza: string;
  importo: number | string;
  stato: string;
  stato_calcolato?: string;
  data_fatturazione?: string | null;
  data_incasso?: string | null;
  importo_incassato?: number | string;
  riferimento_fattura?: string | null;
  residuo?: number | string;
};

function n(v: unknown) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function euro(v: unknown) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n(v));
}

function dataIt(v?: string | null) {
  if (!v) return "—";
  const [y, m, d] = v.split("-");
  return y && m && d ? `${d}/${m}/${y}` : v;
}

export default function RedditivitaIncassiTab({ studioId, anno }: Props) {
  const [contratti, setContratti] = useState<Contratto[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [contratto, setContratto] = useState<Contratto | null>(null);
  const [scadenze, setScadenze] = useState<Scadenza[]>([]);
  const [riepilogo, setRiepilogo] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [manuale, setManuale] = useState({ data_scadenza: `${anno}-01-31`, importo: 0, note: "" });

  useEffect(() => {
    if (!studioId) return;
    loadOverview();
  }, [studioId, anno]);

  async function loadOverview() {
    try {
      setLoading(true);
      const res = await fetch(`/api/controllo-gestione/redditivita-incassi?studio_id=${encodeURIComponent(studioId)}&esercizio=${encodeURIComponent(anno)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Errore caricamento incassi");
      setContratti(Array.isArray(json?.contratti) ? json.contratti : []);
      setRiepilogo(json?.riepilogo || {});
    } catch (error: any) {
      setMessage(error?.message || "Errore caricamento incassi");
    } finally {
      setLoading(false);
    }
  }

  async function loadContratto(id: string) {
    setSelectedId(id);
    if (!id) {
      setContratto(null);
      setScadenze([]);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/controllo-gestione/redditivita-incassi?studio_id=${encodeURIComponent(studioId)}&esercizio=${encodeURIComponent(anno)}&contratto_id=${encodeURIComponent(id)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Errore caricamento piano incassi");
      setContratto(json?.contratto || null);
      setScadenze(Array.isArray(json?.scadenze) ? json.scadenze : []);
    } catch (error: any) {
      setMessage(error?.message || "Errore caricamento piano incassi");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    await Promise.all([loadOverview(), selectedId ? loadContratto(selectedId) : Promise.resolve()]);
  }

  async function post(body: any) {
    const res = await fetch("/api/controllo-gestione/redditivita-incassi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studio_id: studioId, esercizio: Number(anno), ...body }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Operazione non riuscita");
    return json;
  }

  async function generaRate() {
    if (!selectedId) return;
    try {
      setMessage("");
      await post({ action: "genera_rate", contratto_id: selectedId });
      setMessage("Piano rate generato.");
      await refresh();
    } catch (error: any) {
      setMessage(error?.message || "Errore generazione rate");
    }
  }

  async function aggiungiManuale() {
    if (!selectedId || !manuale.data_scadenza || n(manuale.importo) <= 0) return;
    try {
      await post({ action: "aggiungi_scadenza", contratto_id: selectedId, ...manuale });
      setManuale({ data_scadenza: `${anno}-01-31`, importo: 0, note: "" });
      await refresh();
    } catch (error: any) {
      setMessage(error?.message || "Errore aggiunta scadenza");
    }
  }

  async function cambiaStato(s: Scadenza, stato: string) {
    try {
      setMessage("");
      await post({ action: "aggiorna_scadenza", scadenza_id: s.id, stato });
      await refresh();
    } catch (error: any) {
      setMessage(error?.message || "Errore aggiornamento scadenza");
    }
  }

  async function salvaFattura(s: Scadenza, riferimento: string) {
    try {
      await post({ action: "aggiorna_scadenza", scadenza_id: s.id, stato: "fatturato", riferimento_fattura: riferimento });
      await refresh();
    } catch (error: any) {
      setMessage(error?.message || "Errore salvataggio fattura");
    }
  }

  const totalsSelected = useMemo(() => ({
    previsto: scadenze.filter((s) => s.stato_calcolato !== "annullato").reduce((a, s) => a + n(s.importo), 0),
    incassato: scadenze.reduce((a, s) => a + n(s.importo_incassato), 0),
    residuo: scadenze.filter((s) => s.stato_calcolato !== "annullato").reduce((a, s) => a + Math.max(0, n(s.importo) - n(s.importo_incassato)), 0),
    scaduto: scadenze.filter((s) => s.stato_calcolato === "scaduto").reduce((a, s) => a + Math.max(0, n(s.importo) - n(s.importo_incassato)), 0),
  }), [scadenze]);

  return (
    <section className="space-y-5">
      {message && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{message}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Kpi icon={WalletCards} label="Contrattuale annuo" value={euro(riepilogo.contrattuale_annuo)} />
        <Kpi icon={CalendarDays} label="Piano rate" value={euro(riepilogo.piano_rate)} />
        <Kpi icon={CircleDollarSign} label="Incassato" value={euro(riepilogo.incassato)} />
        <Kpi icon={RefreshCw} label="Residuo" value={euro(riepilogo.residuo)} />
        <Kpi icon={FileText} label="Scaduto" value={euro(riepilogo.scaduto)} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block max-w-3xl text-sm font-semibold text-slate-700">
          Cliente / contratto
          <select value={selectedId} onChange={(e) => loadContratto(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-600">
            <option value="">Seleziona un contratto...</option>
            {contratti.map((c) => <option key={c.id} value={c.id}>{c.cliente?.ragione_sociale || c.cliente?.codice_fiscale || c.cliente_id} · {euro(c.totale_annuo)}</option>)}
          </select>
        </label>
      </div>

      {!selectedId ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-semibold text-slate-900">Piano fatturazione e incassi</h2>
            <p className="mt-1 text-sm text-slate-500">Seleziona un contratto per generare o gestire lo scadenzario di incasso.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Periodicità</th><th className="px-4 py-3 text-right">Contratto</th><th className="px-4 py-3 text-right">Rate</th><th className="px-4 py-3 text-right">Incassato</th><th className="px-4 py-3 text-right">Residuo</th><th className="px-4 py-3 text-right">Scaduto</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contratti.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-sky-50/40" onClick={() => loadContratto(c.id)}>
                    <td className="px-4 py-3"><div className="font-semibold text-slate-900">{c.cliente?.ragione_sociale || "—"}</div><div className="text-xs text-slate-500">{c.cliente?.codice_fiscale || ""}</div></td>
                    <td className="px-4 py-3 capitalize">{c.periodicita}</td>
                    <td className="px-4 py-3 text-right">{euro(c.totale_annuo)}</td>
                    <td className="px-4 py-3 text-right">{n(c.numero_rate)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{euro(c.totale_incassato)}</td>
                    <td className="px-4 py-3 text-right">{euro(c.residuo)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-700">{euro(c.scaduto)}</td>
                  </tr>
                ))}
                {contratti.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Nessun contratto presente per l'esercizio.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Kpi icon={CalendarDays} label="Piano selezionato" value={euro(totalsSelected.previsto)} />
            <Kpi icon={CircleDollarSign} label="Incassato" value={euro(totalsSelected.incassato)} />
            <Kpi icon={RefreshCw} label="Residuo" value={euro(totalsSelected.residuo)} />
            <Kpi icon={FileText} label="Scaduto" value={euro(totalsSelected.scaduto)} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{contratto?.cliente?.ragione_sociale || "Piano incassi"}</h2>
                <p className="mt-1 text-sm text-slate-500">{contratto?.periodicita} · contratto {euro(contratto?.totale_annuo)}</p>
              </div>
              {contratto?.periodicita !== "personalizzata" && (
                <button type="button" onClick={generaRate} className="flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" />Genera / rigenera rate</button>
              )}
            </div>

            {contratto?.periodicita === "personalizzata" && (
              <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-5 md:grid-cols-[180px_180px_1fr_auto]">
                <input type="date" value={manuale.data_scadenza} onChange={(e) => setManuale((p) => ({ ...p, data_scadenza: e.target.value }))} className="h-10 rounded-lg border border-slate-300 px-3 text-sm" />
                <input type="number" min="0" step="0.01" value={manuale.importo || ""} onChange={(e) => setManuale((p) => ({ ...p, importo: n(e.target.value) }))} placeholder="Importo" className="h-10 rounded-lg border border-slate-300 px-3 text-right text-sm" />
                <input type="text" value={manuale.note} onChange={(e) => setManuale((p) => ({ ...p, note: e.target.value }))} placeholder="Nota facoltativa" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" />
                <button type="button" onClick={aggiungiManuale} className="flex items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Aggiungi</button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-3">Rata</th><th className="px-4 py-3">Scadenza</th><th className="px-4 py-3 text-right">Importo</th><th className="px-4 py-3">Stato</th><th className="px-4 py-3">Fattura</th><th className="px-4 py-3 text-right">Incassato</th><th className="px-4 py-3 text-right">Residuo</th><th className="px-4 py-3"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scadenze.map((s) => <ScadenzaRow key={s.id} s={s} onState={cambiaStato} onInvoice={salvaFattura} />)}
                  {scadenze.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">Nessuna rata generata.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {loading && <div className="text-center text-sm text-slate-400">Aggiornamento dati...</div>}
    </section>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-xl font-bold text-slate-900">{value}</div></div><div className="rounded-lg bg-sky-50 p-2 text-sky-700"><Icon className="h-5 w-5" /></div></div></div>;
}

function ScadenzaRow({ s, onState, onInvoice }: { s: Scadenza; onState: (s: Scadenza, stato: string) => void; onInvoice: (s: Scadenza, ref: string) => void }) {
  const [fattura, setFattura] = useState(s.riferimento_fattura || "");
  useEffect(() => setFattura(s.riferimento_fattura || ""), [s.riferimento_fattura]);
  const stato = s.stato_calcolato || s.stato;
  const badge = stato === "incassato" ? "bg-emerald-50 text-emerald-700" : stato === "scaduto" ? "bg-rose-50 text-rose-700" : stato === "fatturato" ? "bg-amber-50 text-amber-700" : stato === "annullato" ? "bg-slate-200 text-slate-600" : "bg-sky-50 text-sky-700";
  return (
    <tr>
      <td className="px-4 py-3 font-semibold">{s.numero_rata}</td>
      <td className="px-4 py-3">{dataIt(s.data_scadenza)}</td>
      <td className="px-4 py-3 text-right font-semibold">{euro(s.importo)}</td>
      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge}`}>{stato}</span></td>
      <td className="px-4 py-3"><div className="flex min-w-[210px] gap-2"><input type="text" value={fattura} onChange={(e) => setFattura(e.target.value)} placeholder="Rif. fattura" className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 px-2 text-sm" /><button type="button" onClick={() => onInvoice(s, fattura)} className="rounded-md border border-slate-300 px-2 text-xs font-semibold">Salva</button></div></td>
      <td className="px-4 py-3 text-right text-emerald-700">{euro(s.importo_incassato)}</td>
      <td className="px-4 py-3 text-right">{euro(s.residuo ?? Math.max(0, n(s.importo) - n(s.importo_incassato)))}</td>
      <td className="whitespace-nowrap px-4 py-3 text-right"><select value={s.stato === "scaduto" ? "scaduto" : s.stato} onChange={(e) => onState(s, e.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold"><option value="previsto">Previsto</option><option value="fatturato">Fatturato</option><option value="incassato">Incassato</option><option value="scaduto">Scaduto</option><option value="annullato">Annullato</option></select></td>
    </tr>
  );
}
