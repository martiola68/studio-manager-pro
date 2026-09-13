import { useEffect, useMemo, useState } from "react";
import { Plus, Save, X } from "lucide-react";

type Props = { studioId: string; anno: string };

type ClienteRow = {
  id: string;
  ragione_sociale?: string | null;
  codice_fiscale?: string | null;
  ore_equivalenti?: number;
  costo_pieno?: number;
  compenso_minimo?: number;
  compenso_obiettivo?: number;
  compenso_attuale?: number;
  margine_attuale_percentuale?: number;
  scostamento_obiettivo?: number;
  contratto?: any;
};

type Servizio = {
  id: string;
  attivita_id: string;
  ore_equivalenti: number | string;
  costo_stimato: number | string;
  attivita?: { descrizione?: string | null; area?: string | null } | null;
};

type Voce = {
  attivita_id?: string | null;
  descrizione: string;
  quantita: number;
  prezzo_unitario: number;
  importo_annuo: number;
  incluso_nel_forfait: boolean;
};

function n(v: unknown) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function euro(v: unknown) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n(v));
}

function pct(v: unknown) {
  return `${n(v).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export default function RedditivitaCompensiTab({ studioId, anno }: Props) {
  const [clienti, setClienti] = useState<ClienteRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [draft, setDraft] = useState({
    id: "",
    tipo_contratto: "forfettario",
    totale_annuo: 0,
    periodicita: "mensile",
    giorno_scadenza: 5,
    data_decorrenza: `${anno}-01-01`,
    data_scadenza: `${anno}-12-31`,
    stato: "bozza",
    note: "",
  });
  const [voci, setVoci] = useState<Voce[]>([]);

  useEffect(() => {
    if (studioId) loadOverview();
  }, [studioId, anno]);

  async function loadOverview() {
    try {
      setLoading(true);
      const r = await fetch(`/api/controllo-gestione/redditivita-compensi?studio_id=${encodeURIComponent(studioId)}&esercizio=${encodeURIComponent(anno)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Errore caricamento compensi");
      setClienti(Array.isArray(j?.clienti) ? j.clienti : []);
    } catch (e: any) {
      setMessage(e?.message || "Errore caricamento compensi");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    if (!id) return;
    try {
      setLoading(true);
      setMessage("");
      const r = await fetch(`/api/controllo-gestione/redditivita-compensi?studio_id=${encodeURIComponent(studioId)}&esercizio=${encodeURIComponent(anno)}&cliente_id=${encodeURIComponent(id)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Errore caricamento cliente");
      setDetail(j);
      setSelectedId(id);
    } catch (e: any) {
      setMessage(e?.message || "Errore caricamento cliente");
    } finally {
      setLoading(false);
    }
  }

  async function salvaSnapshot() {
    if (!selectedId) return;
    try {
      setSaving(true);
      const r = await fetch("/api/controllo-gestione/redditivita-compensi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "salva_calcolo_compenso", studio_id: studioId, esercizio: Number(anno), cliente_id: selectedId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Errore salvataggio calcolo");
      setMessage(`Calcolo salvato come versione ${j?.data?.versione || ""}.`);
      await loadDetail(selectedId);
    } catch (e: any) {
      setMessage(e?.message || "Errore salvataggio calcolo");
    } finally {
      setSaving(false);
    }
  }

  function apriContratto() {
    const c = detail?.contratto;
    setDraft({
      id: c?.id || "",
      tipo_contratto: c?.tipo_contratto || "forfettario",
      totale_annuo: n(c?.totale_annuo || detail?.economia?.compenso_obiettivo),
      periodicita: c?.periodicita || "mensile",
      giorno_scadenza: n(c?.giorno_scadenza || 5),
      data_decorrenza: c?.data_decorrenza || `${anno}-01-01`,
      data_scadenza: c?.data_scadenza || `${anno}-12-31`,
      stato: c?.stato || "bozza",
      note: c?.note || "",
    });
    const existing = Array.isArray(detail?.voci_contratto) ? detail.voci_contratto : [];
    if (existing.length) {
      setVoci(existing.map((v: any) => ({
        attivita_id: v.attivita_id || null,
        descrizione: v.descrizione || "",
        quantita: n(v.quantita || 1),
        prezzo_unitario: n(v.prezzo_unitario),
        importo_annuo: n(v.importo_annuo),
        incluso_nel_forfait: v.incluso_nel_forfait !== false,
      })));
    } else {
      setVoci((detail?.servizi || []).map((s: Servizio) => ({
        attivita_id: s.attivita_id,
        descrizione: s.attivita?.descrizione || "Prestazione",
        quantita: 1,
        prezzo_unitario: 0,
        importo_annuo: 0,
        incluso_nel_forfait: true,
      })));
    }
    setShowContract(true);
  }

  const sommaVoci = useMemo(() => voci.reduce((s, v) => s + n(v.importo_annuo), 0), [voci]);

  async function salvaContratto() {
    if (!selectedId) return;
    try {
      setSaving(true);
      const r = await fetch("/api/controllo-gestione/redditivita-compensi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "salva_contratto",
          studio_id: studioId,
          esercizio: Number(anno),
          cliente_id: selectedId,
          ...draft,
          voci,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Errore salvataggio contratto");
      setShowContract(false);
      setMessage("Contratto salvato.");
      await Promise.all([loadDetail(selectedId), loadOverview()]);
    } catch (e: any) {
      setMessage(e?.message || "Errore salvataggio contratto");
    } finally {
      setSaving(false);
    }
  }

  function aggiornaVoce(index: number, key: keyof Voce, value: any) {
    setVoci((prev) => prev.map((v, i) => i === index ? { ...v, [key]: value } : v));
  }

  return (
    <section className="space-y-5">
      {message && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{message}</div>}

      {!selectedId ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-semibold text-slate-900">Compensi e contratti</h2>
            <p className="mt-1 text-sm text-slate-500">Confronto tra costo pieno, compenso tecnico, contratto attuale e marginalità.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 text-right">Costo pieno</th>
                  <th className="px-4 py-3 text-right">Compenso obiettivo</th>
                  <th className="px-4 py-3 text-right">Compenso attuale</th>
                  <th className="px-4 py-3 text-right">Margine attuale</th>
                  <th className="px-4 py-3 text-right">Scostamento</th>
                  <th className="px-4 py-3">Contratto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clienti.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-sky-50/40" onClick={() => loadDetail(c.id)}>
                    <td className="px-4 py-3"><div className="font-semibold text-slate-900">{c.ragione_sociale || "—"}</div><div className="text-xs text-slate-500">{c.codice_fiscale || ""}</div></td>
                    <td className="px-4 py-3 text-right">{euro(c.costo_pieno)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{euro(c.compenso_obiettivo)}</td>
                    <td className="px-4 py-3 text-right">{euro(c.compenso_attuale)}</td>
                    <td className="px-4 py-3 text-right">{pct(c.margine_attuale_percentuale)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${n(c.scostamento_obiettivo) < 0 ? "text-rose-700" : "text-emerald-700"}`}>{euro(c.scostamento_obiettivo)}</td>
                    <td className="px-4 py-3">{c.contratto ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{c.contratto.tipo_contratto}</span> : <span className="text-slate-400">—</span>}</td>
                  </tr>
                ))}
                {!clienti.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Nessun cliente disponibile.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          <button type="button" onClick={() => { setSelectedId(""); setDetail(null); }} className="text-sm font-semibold text-sky-700">← Torna all’elenco clienti</button>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Summary label="Costo pieno" value={euro(detail?.economia?.costo_pieno)} />
            <Summary label="Compenso minimo" value={euro(detail?.economia?.compenso_minimo)} />
            <Summary label="Compenso obiettivo" value={euro(detail?.economia?.compenso_obiettivo)} />
            <Summary label="Compenso attuale" value={euro(detail?.economia?.compenso_attuale)} />
            <Summary label="Margine attuale" value={pct(detail?.economia?.margine_attuale_percentuale)} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{detail?.cliente?.ragione_sociale || "Cliente"}</h2>
                <p className="mt-1 text-sm text-slate-500">Margine obiettivo studio: {pct(detail?.margine_obiettivo)} · Ore equivalenti: {n(detail?.economia?.ore_equivalenti_totali).toLocaleString("it-IT", { maximumFractionDigits: 2 })}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={salvaSnapshot} disabled={saving} className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 disabled:opacity-50">Salva calcolo</button>
                <button type="button" onClick={apriContratto} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white">{detail?.contratto ? "Modifica contratto" : "Crea contratto"}</button>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-3">Area</th><th className="px-4 py-3">Prestazione</th><th className="px-4 py-3 text-right">Ore</th><th className="px-4 py-3 text-right">Costo</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(detail?.servizi || []).map((s: Servizio) => (
                    <tr key={s.id}><td className="px-4 py-3">{s.attivita?.area || "—"}</td><td className="px-4 py-3 font-semibold text-slate-900">{s.attivita?.descrizione || "Prestazione"}</td><td className="px-4 py-3 text-right">{n(s.ore_equivalenti).toLocaleString("it-IT", { maximumFractionDigits: 2 })}</td><td className="px-4 py-3 text-right">{euro(s.costo_stimato)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div><h3 className="text-xl font-semibold text-slate-900">Contratto cliente</h3><p className="mt-1 text-sm text-slate-500">Il compenso commerciale può differire dal compenso tecnico suggerito.</p></div>
              <button type="button" onClick={() => setShowContract(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
              <SelectField label="Tipo contratto" value={draft.tipo_contratto} onChange={(v) => setDraft((p) => ({ ...p, tipo_contratto: v }))} options={[['forfettario','Forfettario'],['analitico','Analitico'],['misto','Misto'],['ore','A ore']]} />
              <MoneyInput label="Totale annuo" value={draft.totale_annuo} onChange={(v) => setDraft((p) => ({ ...p, totale_annuo: n(v) }))} />
              <SelectField label="Periodicità" value={draft.periodicita} onChange={(v) => setDraft((p) => ({ ...p, periodicita: v }))} options={[['mensile','Mensile'],['bimestrale','Bimestrale'],['trimestrale','Trimestrale'],['semestrale','Semestrale'],['annuale','Annuale'],['personalizzata','Personalizzata']]} />
              <NumberInput label="Giorno scadenza" value={draft.giorno_scadenza} onChange={(v) => setDraft((p) => ({ ...p, giorno_scadenza: n(v) }))} />
              <DateInput label="Decorrenza" value={draft.data_decorrenza} onChange={(v) => setDraft((p) => ({ ...p, data_decorrenza: v }))} />
              <DateInput label="Scadenza" value={draft.data_scadenza} onChange={(v) => setDraft((p) => ({ ...p, data_scadenza: v }))} />
              <SelectField label="Stato" value={draft.stato} onChange={(v) => setDraft((p) => ({ ...p, stato: v }))} options={[['bozza','Bozza'],['attivo','Attivo'],['cessato','Cessato'],['archiviato','Archiviato']]} />
              <TextInput label="Note" value={draft.note} onChange={(v) => setDraft((p) => ({ ...p, note: v }))} />
            </div>

            <div className="border-t border-slate-200 px-6 py-5">
              <div className="mb-3 flex items-center justify-between gap-3"><div><h4 className="font-semibold text-slate-900">Ripartizione interna del compenso</h4><p className="text-xs text-slate-500">Serve al controllo di gestione anche nei contratti forfettari.</p></div><button type="button" onClick={() => setVoci((p) => [...p, { descrizione: "", quantita: 1, prezzo_unitario: 0, importo_annuo: 0, incluso_nel_forfait: true }])} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"><Plus className="h-3.5 w-3.5" />Voce</button></div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Descrizione</th><th className="px-3 py-2 text-right">Quantità</th><th className="px-3 py-2 text-right">Prezzo unit.</th><th className="px-3 py-2 text-right">Importo annuo</th><th className="px-3 py-2">Nel forfait</th><th></th></tr></thead><tbody className="divide-y divide-slate-100">{voci.map((v, i) => <tr key={i}><td className="px-3 py-2"><input value={v.descrizione} onChange={(e) => aggiornaVoce(i,'descrizione',e.target.value)} className="h-9 min-w-[240px] rounded-md border border-slate-300 px-2" /></td><td className="px-3 py-2"><input type="number" value={v.quantita || ''} onChange={(e) => aggiornaVoce(i,'quantita',n(e.target.value))} className="h-9 w-24 rounded-md border border-slate-300 px-2 text-right" /></td><td className="px-3 py-2"><input type="number" value={v.prezzo_unitario || ''} onChange={(e) => aggiornaVoce(i,'prezzo_unitario',n(e.target.value))} className="h-9 w-28 rounded-md border border-slate-300 px-2 text-right" /></td><td className="px-3 py-2"><input type="number" value={v.importo_annuo || ''} onChange={(e) => aggiornaVoce(i,'importo_annuo',n(e.target.value))} className="h-9 w-28 rounded-md border border-slate-300 px-2 text-right" /></td><td className="px-3 py-2 text-center"><input type="checkbox" checked={v.incluso_nel_forfait} onChange={(e) => aggiornaVoce(i,'incluso_nel_forfait',e.target.checked)} /></td><td className="px-3 py-2"><button type="button" onClick={() => setVoci((p) => p.filter((_,x) => x !== i))} className="text-xs font-semibold text-rose-700">Rimuovi</button></td></tr>)}</tbody></table>
              </div>
              <div className="mt-3 text-right text-sm text-slate-600">Totale voci: <span className="font-semibold text-slate-900">{euro(sommaVoci)}</span> · Contratto: <span className="font-semibold text-slate-900">{euro(draft.totale_annuo)}</span></div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4"><button type="button" onClick={() => setShowContract(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Annulla</button><button type="button" onClick={salvaContratto} disabled={saving} className="flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Salvataggio..." : "Salva contratto"}</button></div>
          </div>
        </div>
      )}
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-xl font-bold text-slate-900">{value}</div></div>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) { return <label className="text-sm font-semibold text-slate-700">{label}<select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3">{options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>; }
function MoneyInput({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) { return <label className="text-sm font-semibold text-slate-700">{label}<input type="number" min="0" step="0.01" value={value || ''} onChange={(e) => onChange(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-right" /></label>; }
function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) { return <label className="text-sm font-semibold text-slate-700">{label}<input type="number" min="1" max="31" value={value || ''} onChange={(e) => onChange(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3" /></label>; }
function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) { return <label className="text-sm font-semibold text-slate-700">{label}<input type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3" /></label>; }
function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) { return <label className="text-sm font-semibold text-slate-700">{label}<input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3" /></label>; }
