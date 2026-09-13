import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  Clock3,
  Euro,
  Gauge,
  History,
  ListChecks,
  Percent,
  ReceiptText,
  Save,
  Users,
  WalletCards,
} from "lucide-react";
import { getStudioId } from "@/lib/getStudioId";

type TabKey =
  | "dashboard"
  | "costi"
  | "operatori"
  | "attivita"
  | "clienti"
  | "contratti"
  | "incassi"
  | "consuntivo";

type CostiStudio = {
  personale: number;
  affitto: number;
  software: number;
  assicurazioni: number;
  utenze: number;
  altri: number;
  oreProduttive: number;
  margineObiettivo: number;
};

type Operatore = {
  id: string;
  nome?: string | null;
  cognome?: string | null;
  email?: string | null;
  tipo_rapporto?: string | null;
  settore?: string | null;
  costo?: {
    costo_annuo?: number | string | null;
    ore_teoriche?: number | string | null;
    ore_non_produttive?: number | string | null;
    ore_produttive?: number | string | null;
    costo_orario_diretto?: number | string | null;
    quota_costi_generali?: number | string | null;
    costo_orario_pieno?: number | string | null;
  } | null;
  numero_operazioni?: number;
  ore_carico?: number;
  percentuale_operazioni_studio?: number;
  percentuale_carico_studio?: number;
  saturazione_percentuale?: number;
};

type OperatoreDraft = {
  costo_annuo: number;
  ore_teoriche: number;
  ore_non_produttive: number;
  ore_produttive: number;
};

const tabs: { key: TabKey; label: string; icon: any }[] = [
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
  { key: "costi", label: "Costi Studio", icon: Building2 },
  { key: "operatori", label: "Operatori", icon: Users },
  { key: "attivita", label: "Attività e parametri", icon: ListChecks },
  { key: "clienti", label: "Clienti", icon: BriefcaseBusiness },
  { key: "contratti", label: "Compensi & Contratti", icon: WalletCards },
  { key: "incassi", label: "Incassi", icon: ReceiptText },
  { key: "consuntivo", label: "Consuntivo", icon: History },
];

const initialCosts: CostiStudio = {
  personale: 0,
  affitto: 0,
  software: 0,
  assicurazioni: 0,
  utenze: 0,
  altri: 0,
  oreProduttive: 0,
  margineObiettivo: 30,
};

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function euro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function euro2(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function pct(value: number | undefined) {
  return `${num(value).toLocaleString("it-IT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export default function RedditivitaStudioPage() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [anno, setAnno] = useState(String(new Date().getFullYear()));
  const [studioId, setStudioId] = useState("");
  const [costi, setCosti] = useState<CostiStudio>(initialCosts);
  const [operatori, setOperatori] = useState<Operatore[]>([]);
  const [draftOperatori, setDraftOperatori] = useState<Record<string, OperatoreDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingCosts, setSavingCosts] = useState(false);
  const [savingOperatorId, setSavingOperatorId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const totaleCosti = useMemo(
    () => costi.personale + costi.affitto + costi.software + costi.assicurazioni + costi.utenze + costi.altri,
    [costi]
  );
  const costoOrario = costi.oreProduttive > 0 ? totaleCosti / costi.oreProduttive : 0;
  const margine = Math.min(95, Math.max(0, costi.margineObiettivo || 0));
  const fatturatoObiettivo = margine < 100 ? totaleCosti / (1 - margine / 100) : 0;
  const margineEuro = Math.max(0, fatturatoObiettivo - totaleCosti);
  const operatoriConfigurati = operatori.filter((o) => num(o.costo?.ore_produttive) > 0).length;

  useEffect(() => {
    (async () => {
      const id = await getStudioId();
      if (!id) {
        setLoading(false);
        setMessage("Studio non disponibile nella sessione corrente.");
        return;
      }
      setStudioId(id);
    })();
  }, []);

  useEffect(() => {
    if (!studioId) return;
    caricaDati(studioId, anno);
  }, [studioId, anno]);

  async function caricaDati(id: string, esercizio: string) {
    try {
      setLoading(true);
      setMessage("");
      const response = await fetch(
        `/api/controllo-gestione/redditivita-studio?studio_id=${encodeURIComponent(id)}&esercizio=${encodeURIComponent(esercizio)}`
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Errore caricamento Redditività Studio");

      const p = json?.parametri;
      setCosti(
        p
          ? {
              personale: num(p.costo_personale),
              affitto: num(p.costo_affitto),
              software: num(p.costo_software),
              assicurazioni: num(p.costo_assicurazioni),
              utenze: num(p.costo_utenze),
              altri: num(p.altri_costi_generali),
              oreProduttive: num(p.ore_produttive_studio),
              margineObiettivo: num(p.margine_obiettivo_percentuale),
            }
          : initialCosts
      );

      const elenco = Array.isArray(json?.operatori) ? json.operatori : [];
      setOperatori(elenco);
      const drafts: Record<string, OperatoreDraft> = {};
      elenco.forEach((o: Operatore) => {
        drafts[o.id] = {
          costo_annuo: num(o.costo?.costo_annuo),
          ore_teoriche: num(o.costo?.ore_teoriche),
          ore_non_produttive: num(o.costo?.ore_non_produttive),
          ore_produttive: num(o.costo?.ore_produttive),
        };
      });
      setDraftOperatori(drafts);
    } catch (error: any) {
      setMessage(error?.message || "Errore caricamento dati");
    } finally {
      setLoading(false);
    }
  }

  const updateCost = (key: keyof CostiStudio, value: string) => {
    const parsed = Number(String(value).replace(",", "."));
    setCosti((prev) => ({ ...prev, [key]: Number.isFinite(parsed) ? parsed : 0 }));
  };

  function updateOperatore(id: string, key: keyof OperatoreDraft, value: string) {
    const parsed = Number(String(value).replace(",", "."));
    setDraftOperatori((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || { costo_annuo: 0, ore_teoriche: 0, ore_non_produttive: 0, ore_produttive: 0 }),
        [key]: Number.isFinite(parsed) ? parsed : 0,
      },
    }));
  }

  async function salvaCosti() {
    if (!studioId) return;
    try {
      setSavingCosts(true);
      setMessage("");
      const response = await fetch("/api/controllo-gestione/redditivita-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "salva_costi_studio",
          studio_id: studioId,
          esercizio: Number(anno),
          costo_personale: costi.personale,
          costo_affitto: costi.affitto,
          costo_software: costi.software,
          costo_assicurazioni: costi.assicurazioni,
          costo_utenze: costi.utenze,
          altri_costi_generali: costi.altri,
          ore_produttive_studio: costi.oreProduttive,
          margine_obiettivo_percentuale: costi.margineObiettivo,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Errore salvataggio costi");
      setMessage("Costi studio salvati.");
      await caricaDati(studioId, anno);
    } catch (error: any) {
      setMessage(error?.message || "Errore salvataggio costi");
    } finally {
      setSavingCosts(false);
    }
  }

  async function salvaOperatore(operatoreId: string) {
    if (!studioId) return;
    const d = draftOperatori[operatoreId];
    if (!d) return;
    try {
      setSavingOperatorId(operatoreId);
      setMessage("");
      const response = await fetch("/api/controllo-gestione/redditivita-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "salva_operatore",
          studio_id: studioId,
          esercizio: Number(anno),
          operatore_id: operatoreId,
          ...d,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Errore salvataggio operatore");
      setMessage("Dati operatore salvati.");
      await caricaDati(studioId, anno);
    } catch (error: any) {
      setMessage(error?.message || "Errore salvataggio operatore");
    } finally {
      setSavingOperatorId(null);
    }
  }

  return (
    <main className="mx-auto max-w-[1500px] px-5 py-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Controllo di gestione</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Redditività Studio</h1>
          <p className="mt-2 max-w-4xl text-sm text-slate-600">
            Costi, carichi di lavoro, compensi, contratti e incassi in un unico ambiente.
          </p>
        </div>
        <label className="w-full max-w-[180px] text-sm font-semibold text-slate-700">
          Esercizio
          <select value={anno} onChange={(e) => setAnno(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-sky-600">
            {[0, 1, 2, 3].map((offset) => {
              const year = String(new Date().getFullYear() - offset);
              return <option key={year}>{year}</option>;
            })}
          </select>
        </label>
      </div>

      {message && <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{message}</div>}

      <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex min-w-max gap-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button key={item.key} type="button" onClick={() => setTab(item.key)} className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm transition ${active ? "bg-sky-700 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
                <Icon className="h-4 w-4" />{item.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Caricamento dati...</div>
      ) : (
        <>
          {tab === "dashboard" && (
            <section className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard icon={Euro} label="Costi annui studio" value={euro(totaleCosti)} note={`Esercizio ${anno}`} />
                <MetricCard icon={Clock3} label="Costo orario pieno" value={euro2(costoOrario)} note="Su ore produttive studio" />
                <MetricCard icon={Percent} label="Margine obiettivo" value={`${margine.toFixed(1)}%`} note={euro(margineEuro)} />
                <MetricCard icon={Gauge} label="Fatturato obiettivo" value={euro(fatturatoObiettivo)} note="Per raggiungere il margine scelto" />
              </div>
              <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">Percorso economico</h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <FlowCard n="1" title="Servizi" text="Prestazioni effettivamente svolte." />
                    <FlowCard n="2" title="Carico" text="Driver × tempo × complessità." />
                    <FlowCard n="3" title="Costo e compenso" text="Ore per risorsa e margine." />
                    <FlowCard n="4" title="Contratto e incasso" text="Forfait, analitico e scadenze." />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">Impostazione iniziale</h2>
                  <div className="mt-5 space-y-3">
                    <SetupRow done={totaleCosti > 0} label="Costi annuali dello studio" onClick={() => setTab("costi")} />
                    <SetupRow done={operatoriConfigurati > 0} label={`Operatori configurati: ${operatoriConfigurati}/${operatori.length}`} onClick={() => setTab("operatori")} />
                    <SetupRow done={false} label="Catalogo attività e tempi standard" onClick={() => setTab("attivita")} />
                    <SetupRow done={false} label="Profilo servizi dei clienti" onClick={() => setTab("clienti")} />
                  </div>
                </div>
              </div>
            </section>
          )}

          {tab === "costi" && (
            <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Costi dello studio · {anno}</h2>
                    <p className="mt-1 text-sm text-slate-500">I valori vengono salvati nello snapshot annuale dello studio.</p>
                  </div>
                  <button type="button" onClick={salvaCosti} disabled={savingCosts} className="flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    <Save className="h-4 w-4" />{savingCosts ? "Salvataggio..." : "Salva"}
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <MoneyField label="Costo personale" value={costi.personale} onChange={(v) => updateCost("personale", v)} />
                  <MoneyField label="Affitto / immobili" value={costi.affitto} onChange={(v) => updateCost("affitto", v)} />
                  <MoneyField label="Software e licenze" value={costi.software} onChange={(v) => updateCost("software", v)} />
                  <MoneyField label="Assicurazioni" value={costi.assicurazioni} onChange={(v) => updateCost("assicurazioni", v)} />
                  <MoneyField label="Utenze e servizi" value={costi.utenze} onChange={(v) => updateCost("utenze", v)} />
                  <MoneyField label="Altri costi generali" value={costi.altri} onChange={(v) => updateCost("altri", v)} />
                  <NumberField label="Ore produttive annue studio" value={costi.oreProduttive} onChange={(v) => updateCost("oreProduttive", v)} />
                  <NumberField label="Margine obiettivo %" value={costi.margineObiettivo} onChange={(v) => updateCost("margineObiettivo", v)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-base font-semibold text-slate-900">Risultato economico di base</h3>
                <div className="mt-5 space-y-4">
                  <ResultRow label="Totale costi annui" value={euro(totaleCosti)} />
                  <ResultRow label="Ore produttive" value={costi.oreProduttive.toLocaleString("it-IT")} />
                  <ResultRow label="Costo orario pieno" value={euro2(costoOrario)} />
                  <div className="border-t border-slate-300 pt-4">
                    <ResultRow label="Margine obiettivo" value={`${margine.toFixed(1)}%`} />
                    <ResultRow label="Fatturato obiettivo" value={euro(fatturatoObiettivo)} emphasize />
                  </div>
                </div>
              </div>
            </section>
          )}

          {tab === "operatori" && (
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-5">
                <h2 className="text-xl font-semibold text-slate-900">Operatori e capacità produttiva</h2>
                <p className="mt-1 text-sm text-slate-500">Il peso % viene mostrato sia per numero operazioni sia per carico ponderato in ore equivalenti.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Operatore</th><th className="px-3 py-3">Costo annuo</th><th className="px-3 py-3">Ore teoriche</th><th className="px-3 py-3">Ore non prod.</th><th className="px-3 py-3">Ore produttive</th><th className="px-3 py-3">Costo/h pieno</th><th className="px-3 py-3">Operazioni</th><th className="px-3 py-3">Peso operazioni</th><th className="px-3 py-3">Peso carico</th><th className="px-3 py-3">Saturazione</th><th className="px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {operatori.length === 0 ? (
                      <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-400">Nessun operatore trovato.</td></tr>
                    ) : operatori.map((o) => {
                      const d = draftOperatori[o.id] || { costo_annuo: 0, ore_teoriche: 0, ore_non_produttive: 0, ore_produttive: 0 };
                      return (
                        <tr key={o.id}>
                          <td className="whitespace-nowrap px-3 py-3"><div className="font-semibold text-slate-900">{[o.nome, o.cognome].filter(Boolean).join(" ") || o.email}</div><div className="text-xs text-slate-500">{o.tipo_rapporto || o.settore || ""}</div></td>
                          <td className="px-3 py-3"><TableNumber value={d.costo_annuo} onChange={(v) => updateOperatore(o.id, "costo_annuo", v)} /></td>
                          <td className="px-3 py-3"><TableNumber value={d.ore_teoriche} onChange={(v) => updateOperatore(o.id, "ore_teoriche", v)} /></td>
                          <td className="px-3 py-3"><TableNumber value={d.ore_non_produttive} onChange={(v) => updateOperatore(o.id, "ore_non_produttive", v)} /></td>
                          <td className="px-3 py-3"><TableNumber value={d.ore_produttive} onChange={(v) => updateOperatore(o.id, "ore_produttive", v)} /></td>
                          <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-800">{euro2(num(o.costo?.costo_orario_pieno))}</td>
                          <td className="px-3 py-3 text-right">{num(o.numero_operazioni).toLocaleString("it-IT", { maximumFractionDigits: 2 })}</td>
                          <td className="px-3 py-3 text-right font-semibold">{pct(o.percentuale_operazioni_studio)}</td>
                          <td className="px-3 py-3 text-right font-semibold">{pct(o.percentuale_carico_studio)}</td>
                          <td className="px-3 py-3 text-right">{pct(o.saturazione_percentuale)}</td>
                          <td className="px-3 py-3"><button type="button" onClick={() => salvaOperatore(o.id)} disabled={savingOperatorId === o.id} className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800 disabled:opacity-50">{savingOperatorId === o.id ? "..." : "Salva"}</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === "attivita" && <EmptyWorkspace title="Catalogo attività e tempi standard" text="Ogni attività avrà area, driver, unità di misura, tempo standard e regola di complessità." columns={["Area", "Attività", "Driver", "Tempo standard", "Complessità", "Attiva"]} />}
          {tab === "clienti" && <EmptyWorkspace title="Analisi economica clienti" text="Per ogni cliente attiveremo solo i servizi realmente svolti, inclusi bilancio, dichiarazioni e consulenza anche quando la contabilità è interna." columns={["Cliente", "Servizi", "Ore equivalenti", "Costo", "Compenso attuale", "Compenso obiettivo", "Margine"]} />}
          {tab === "contratti" && <EmptyWorkspace title="Compensi e contratti" text="Il compenso tecnico sarà trasformato in contratto forfettario, analitico o misto." columns={["Cliente", "Costo", "Compenso consigliato", "Tipo contratto", "Totale annuo", "Scostamento"]} />}
          {tab === "incassi" && <EmptyWorkspace title="Piano fatturazione e incassi" text="Rate mensili, trimestrali o personalizzate e stato previsto, fatturato, incassato o scaduto." columns={["Cliente", "Scadenza", "Importo", "Fatturazione", "Stato", "Incassato il"]} />}
          {tab === "consuntivo" && <EmptyWorkspace title="Consuntivo e rinnovo" text="Confronto tra carico previsto e carico realmente assorbito con proposta di rinnovo." columns={["Cliente", "Ore previste", "Ore consuntive", "Scostamento", "Margine reale", "Compenso rinnovo"]} />}
        </>
      )}
    </main>
  );
}

function MetricCard({ icon: Icon, label, value, note }: { icon: any; label: string; value: string; note: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><div className="text-sm font-medium text-slate-500">{label}</div><div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</div><div className="mt-1 text-xs text-slate-500">{note}</div></div><div className="rounded-lg bg-sky-50 p-2.5 text-sky-700"><Icon className="h-5 w-5" /></div></div></div>;
}

function FlowCard({ n, title, text }: { n: string; title: string; text: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-semibold text-sky-700">FASE {n}</div><div className="mt-1 font-semibold text-slate-900">{title}</div><p className="mt-2 text-sm leading-5 text-slate-600">{text}</p></div>;
}

function SetupRow({ done, label, onClick }: { done: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left hover:border-sky-300 hover:bg-sky-50/40"><span className={`h-2.5 w-2.5 rounded-full ${done ? "bg-emerald-500" : "bg-slate-300"}`} /><span className="flex-1 text-sm font-medium text-slate-700">{label}</span><ArrowRight className="h-4 w-4 text-slate-400" /></button>;
}

function MoneyField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return <label className="text-sm font-semibold text-slate-700">{label}<div className="relative mt-1.5"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">€</span><input type="number" min="0" step="100" value={value || ""} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-900 outline-none focus:border-sky-600" placeholder="0" /></div></label>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return <label className="text-sm font-semibold text-slate-700">{label}<input type="number" min="0" step="1" value={value || ""} onChange={(e) => onChange(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-600" placeholder="0" /></label>;
}

function TableNumber({ value, onChange }: { value: number; onChange: (value: string) => void }) {
  return <input type="number" min="0" step="1" value={value || ""} onChange={(e) => onChange(e.target.value)} className="h-9 w-28 rounded-md border border-slate-300 px-2 text-right text-sm outline-none focus:border-sky-600" placeholder="0" />;
}

function ResultRow({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return <div className="flex items-center justify-between gap-4 py-1.5"><span className="text-sm text-slate-600">{label}</span><span className={emphasize ? "text-lg font-bold text-sky-800" : "text-sm font-semibold text-slate-900"}>{value}</span></div>;
}

function EmptyWorkspace({ title, text, columns }: { title: string; text: string; columns: string[] }) {
  return <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="text-xl font-semibold text-slate-900">{title}</h2><p className="mt-1 max-w-5xl text-sm leading-6 text-slate-500">{text}</p></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr>{columns.map((column) => <th key={column} className="whitespace-nowrap px-4 py-3 font-semibold">{column}</th>)}</tr></thead><tbody><tr><td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">Struttura pronta. Collegamento dati nel prossimo passaggio.</td></tr></tbody></table></div></section>;
}
