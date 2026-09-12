import { useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  Users,
  ListChecks,
  BriefcaseBusiness,
  WalletCards,
  ReceiptText,
  History,
  Euro,
  Clock3,
  Percent,
  Gauge,
  ArrowRight,
} from "lucide-react";

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

export default function RedditivitaStudioPage() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [anno, setAnno] = useState(String(new Date().getFullYear()));
  const [costi, setCosti] = useState<CostiStudio>(initialCosts);

  const totaleCosti = useMemo(
    () =>
      costi.personale +
      costi.affitto +
      costi.software +
      costi.assicurazioni +
      costi.utenze +
      costi.altri,
    [costi]
  );

  const costoOrario = costi.oreProduttive > 0 ? totaleCosti / costi.oreProduttive : 0;
  const margine = Math.min(95, Math.max(0, costi.margineObiettivo || 0));
  const fatturatoObiettivo = margine < 100 ? totaleCosti / (1 - margine / 100) : 0;
  const margineEuro = Math.max(0, fatturatoObiettivo - totaleCosti);

  const updateCost = (key: keyof CostiStudio, value: string) => {
    const parsed = Number(String(value).replace(",", "."));
    setCosti((prev) => ({ ...prev, [key]: Number.isFinite(parsed) ? parsed : 0 }));
  };

  return (
    <main className="mx-auto max-w-[1500px] px-5 py-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            Controllo di gestione
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Redditività Studio</h1>
          <p className="mt-2 max-w-4xl text-sm text-slate-600">
            Costi, carichi di lavoro, compensi, contratti e incassi in un unico ambiente. Il motore
            parte dai servizi effettivamente svolti per ogni cliente e arriva alla redditività reale.
          </p>
        </div>

        <label className="w-full max-w-[180px] text-sm font-semibold text-slate-700">
          Esercizio
          <select
            value={anno}
            onChange={(e) => setAnno(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-sky-600"
          >
            {[0, 1, 2, 3].map((offset) => {
              const year = String(new Date().getFullYear() - offset);
              return <option key={year}>{year}</option>;
            })}
          </select>
        </label>
      </div>

      <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex min-w-max gap-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm transition ${
                  active
                    ? "bg-sky-700 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "dashboard" && (
        <section className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Euro} label="Costi annui studio" value={euro(totaleCosti)} note={`Esercizio ${anno}`} />
            <MetricCard icon={Clock3} label="Costo orario pieno" value={euro2(costoOrario)} note="Su ore produttive disponibili" />
            <MetricCard icon={Percent} label="Margine obiettivo" value={`${margine.toFixed(1)}%`} note={euro(margineEuro)} />
            <MetricCard icon={Gauge} label="Fatturato obiettivo" value={euro(fatturatoObiettivo)} note="Per raggiungere il margine scelto" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Percorso economico</h2>
                  <p className="mt-1 text-sm text-slate-500">La logica che userà il motore per ogni cliente.</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <FlowCard n="1" title="Servizi" text="Prestazioni effettivamente svolte, anche senza tenuta contabilità." />
                <FlowCard n="2" title="Carico" text="Driver × tempo standard × coefficiente di complessità." />
                <FlowCard n="3" title="Costo e compenso" text="Ore per risorsa, costo pieno e margine obiettivo." />
                <FlowCard n="4" title="Contratto e incasso" text="Forfettario o analitico, rate e scadenze di incasso." />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Impostazione iniziale</h2>
              <p className="mt-1 text-sm text-slate-500">Prima di analizzare i clienti completiamo i parametri dello studio.</p>
              <div className="mt-5 space-y-3">
                <SetupRow done={totaleCosti > 0} label="Costi annuali dello studio" onClick={() => setTab("costi")} />
                <SetupRow done={false} label="Costo e capacità degli operatori" onClick={() => setTab("operatori")} />
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
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-slate-900">Costi dello studio · {anno}</h2>
              <p className="mt-1 text-sm text-slate-500">
                Prima base dell'algoritmo: costi strutturali e ore realmente produttive disponibili.
              </p>
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

            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              In questa prima impostazione i valori calcolano già il modello economico. Nel passaggio successivo li colleghiamo allo snapshot annuale del database e al dettaglio per operatore.
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
            <div className="mt-5 rounded-lg bg-white p-4 text-sm leading-6 text-slate-600">
              Formula: <span className="font-medium text-slate-900">fatturato obiettivo = costi / (1 − margine)</span>.
              Il costo orario sarà poi raffinato per singolo operatore.
            </div>
          </div>
        </section>
      )}

      {tab === "operatori" && (
        <EmptyWorkspace
          title="Operatori e capacità produttiva"
          text="Qui collegheremo ogni dipendente e professionista al costo annuo, alle ore produttive, al costo orario diretto e al costo orario pieno. La stessa sezione mostrerà carico assegnato, saturazione e capacità residua."
          columns={["Operatore", "Costo annuo", "Ore produttive", "Costo/h pieno", "Carico", "Saturazione"]}
        />
      )}

      {tab === "attivita" && (
        <section className="space-y-5">
          <EmptyWorkspace
            title="Catalogo attività e tempi standard"
            text="Ogni attività avrà area, driver, unità di misura, tempo standard e regola di complessità. Da qui nasce il carico equivalente del cliente."
            columns={["Area", "Attività", "Driver", "Tempo standard", "Complessità", "Attiva"]}
          />
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Prime aree previste</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Contabilità", "Bilancio", "Dichiarativi", "Consulenza", "Societario", "Payroll", "Contenzioso", "Revisione", "Altro"].map((x) => (
                <span key={x} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">{x}</span>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "clienti" && (
        <EmptyWorkspace
          title="Analisi economica clienti"
          text="Per ogni cliente attiveremo solo i servizi realmente svolti. La contabilità potrà essere esclusa quando è interna alla società; bilancio, dichiarazioni, consulenza e ogni altra attività continueranno a generare carico e costo."
          columns={["Cliente", "Servizi", "Ore equivalenti", "Costo", "Compenso attuale", "Compenso obiettivo", "Margine"]}
        />
      )}

      {tab === "contratti" && (
        <EmptyWorkspace
          title="Compensi e contratti"
          text="Il compenso tecnico sarà trasformato in contratto forfettario, analitico o misto. Anche nel forfettario manterremo la ripartizione interna per attività per misurare la redditività."
          columns={["Cliente", "Costo", "Compenso consigliato", "Tipo contratto", "Totale annuo", "Scostamento"]}
        />
      )}

      {tab === "incassi" && (
        <EmptyWorkspace
          title="Piano fatturazione e incassi"
          text="Dal contratto nasceranno automaticamente rate mensili, trimestrali o personalizzate e il relativo scadenzario di incasso: previsto, fatturato, incassato o scaduto."
          columns={["Cliente", "Scadenza", "Importo", "Fatturazione", "Stato", "Incassato il"]}
        />
      )}

      {tab === "consuntivo" && (
        <EmptyWorkspace
          title="Consuntivo e rinnovo"
          text="Confronteremo il carico previsto con quello realmente assorbito. Lo scostamento alimenterà la proposta di adeguamento del compenso per l'esercizio successivo."
          columns={["Cliente", "Ore previste", "Ore consuntive", "Scostamento", "Margine reale", "Compenso rinnovo"]}
        />
      )}
    </main>
  );
}

function MetricCard({ icon: Icon, label, value, note }: { icon: any; label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
          <div className="mt-1 text-xs text-slate-500">{note}</div>
        </div>
        <div className="rounded-lg bg-sky-50 p-2.5 text-sky-700"><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
}

function FlowCard({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold text-sky-700">FASE {n}</div>
      <div className="mt-1 font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm leading-5 text-slate-600">{text}</p>
    </div>
  );
}

function SetupRow({ done, label, onClick }: { done: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left hover:border-sky-300 hover:bg-sky-50/40">
      <span className={`h-2.5 w-2.5 rounded-full ${done ? "bg-emerald-500" : "bg-slate-300"}`} />
      <span className="flex-1 text-sm font-medium text-slate-700">{label}</span>
      <ArrowRight className="h-4 w-4 text-slate-400" />
    </button>
  );
}

function MoneyField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <div className="relative mt-1.5">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">€</span>
        <input type="number" min="0" step="100" value={value || ""} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-900 outline-none focus:border-sky-600" placeholder="0" />
      </div>
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <input type="number" min="0" step="1" value={value || ""} onChange={(e) => onChange(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-600" placeholder="0" />
    </label>
  );
}

function ResultRow({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={emphasize ? "text-lg font-bold text-sky-800" : "text-sm font-semibold text-slate-900"}>{value}</span>
    </div>
  );
}

function EmptyWorkspace({ title, text, columns }: { title: string; text: string; columns: string[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 max-w-5xl text-sm leading-6 text-slate-500">{text}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>{columns.map((column) => <th key={column} className="whitespace-nowrap px-4 py-3 font-semibold">{column}</th>)}</tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">
                Struttura pronta. I dati verranno collegati al database nel prossimo passaggio.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
