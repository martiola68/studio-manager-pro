import { useEffect, useMemo, useState, type ElementType } from "react";
import Link from "next/link";
import {
  ArrowRight, BellRing, CalendarClock, CheckCircle2, ClipboardCheck,
  Clock3, FileText, FolderOpen, Plus, ShieldCheck, Users, AlertTriangle,
  Cloud, RefreshCw
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { clienteService } from "@/services/clienteService";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useStudio } from "@/contexts/StudioContext";

type AmlPratica = { id: string; stato?: string | null; stato_ciclo?: string | null; data_apertura?: string | null };
type AmlVerifica = { id: string; ScadenzaVerifica?: string | null; AV1Conferma?: boolean | null };
type CentralAlert = {
  id: string; titolo?: string | null; cliente?: string | null; origine_modulo?: string | null;
  data_scadenza: string; stato_calcolato?: string | null; alert_con_errore?: boolean | null;
};
type DataState = {
  clients: number | null; practices: AmlPratica[] | null;
  verifiche: AmlVerifica[] | null; fascicoliMancanti: number | null;
  scadenze: CentralAlert[] | null; generalAlerts: CentralAlert[] | null;
  failedAlerts: number | null; errors: string[];
};
const EMPTY: DataState = {
  clients: null, practices: null, verifiche: null, fascicoliMancanti: null,
  scadenze: null, generalAlerts: null, failedAlerts: null, errors: []
};
const isAmlOrigin = (value?: string | null) => /aml|antiriciclaggio|adeguata.verifica|fascicol/i.test(value || "");
const openStatus = (value?: string | null) => !["completata", "annullata", "sospesa"].includes(String(value || "").toLowerCase());
const todayYmd = () => {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
  return y+"-"+m+"-"+day;
};
function StatCard({ label, value, detail, icon: Icon, tone, href }: {
  label: string; value: number | null; detail: string; icon: ElementType;
  tone: "blue" | "green" | "amber" | "red"; href: string;
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600", green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600", red: "bg-red-50 text-red-600",
  };
  return <Link href={href} className="group flex min-w-0 items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <span className={"flex h-14 w-14 shrink-0 items-center justify-center rounded-xl " + tones[tone]}><Icon className="h-7 w-7" /></span>
    <span className="min-w-0 flex-1"><span className="block text-3xl font-bold text-slate-900">{value ?? "—"}</span>
      <span className="block text-sm font-semibold text-slate-700">{label}</span>
      <span className="mt-1 block text-xs text-slate-500">{detail}</span></span>
    <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1" />
  </Link>;
}
export default function AmlDashboardPage() {
  const { ready, session } = useRequireAuth();
  const { studioId, isLoading: licenseLoading, hasModule } = useStudio();
  const [state, setState] = useState<DataState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const licenseAllowed = !!studioId && hasModule("aml");
  useEffect(() => {
    if (!ready || !session?.access_token || licenseLoading || !licenseAllowed) {
      setLoading(false);
      return;
    }
    let live = true;
    const load = async () => {
      setLoading(true);
      const errors: string[] = [];
      const supabase = getSupabaseClient() as any;
      const result: DataState = { ...EMPTY, errors };
      const run = async (label: string, fn: () => Promise<void>) => {
        try { await fn(); } catch (e) { errors.push(label + ": " + (e instanceof Error ? e.message : "lettura non riuscita")); }
      };
      await Promise.all([
        run("Clienti", async () => {
          const data = await clienteService.getClienti();
          result.clients = data.filter((row: any) => row.attivo !== false).length;
        }),
        run("Pratiche AML", async () => {
          const { data, error } = await supabase.from("tbPraticheAML")
            .select("id, stato, stato_ciclo, data_apertura").eq("studio_id", studioId);
          if (error) throw error;
          result.practices = (data || []) as AmlPratica[];
        }),
        run("Adeguata verifica", async () => {
          const { data, error } = await supabase.from("tbAV1")
            .select("id, ScadenzaVerifica, AV1Conferma").eq("studio_id", studioId);
          if (error) throw error;
          result.verifiche = (data || []) as AmlVerifica[];
        }),
        run("Fascicoli AML", async () => {
          const { count, error } = await supabase.from("tbAVFascicoliAlert")
            .select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("completo", false);
          if (error) throw error;
          result.fascicoliMancanti = count ?? 0;
        }),
        run("Centro Alert", async () => {
          const response = await fetch("/api/scadenze-centrale", { headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store" });
          const payload = await response.json();
          if (!response.ok || !payload.success) throw new Error(payload.error || "API non disponibile");
          const all: CentralAlert[] = payload.scadenze || [];
          result.generalAlerts = all.filter(item => openStatus(item.stato_calcolato));
          result.scadenze = result.generalAlerts.filter(item => isAmlOrigin(item.origine_modulo));
        }),
        run("Alert non inviati", async () => {
          const response = await fetch("/api/scadenze-centrale/alert-non-inviati", { headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store" });
          const payload = await response.json();
          if (!response.ok || !payload.success) throw new Error(payload.error || "API non disponibile");
          result.failedAlerts = Number(payload.numero_errori || 0);
        }),
      ]);
      if (live) { setState(result); setLoading(false); }
    };
    void load();
    return () => { live = false; };
  }, [ready, session?.access_token, licenseLoading, licenseAllowed, studioId, refresh]);

  const statusCounts = useMemo(() => {
    const map = new Map<string,number>();
    for (const p of state.practices || []) {
      const status = String(p.stato_ciclo || p.stato || "Da classificare").trim();
      map.set(status, (map.get(status) || 0) + 1);
    }
    return [...map.entries()].sort((a,b)=>b[1]-a[1]);
  }, [state.practices]);
  const now = todayYmd();
  const next30 = (() => { const d = new Date(); d.setDate(d.getDate()+30); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-"); })();
  const dueVerifiche = state.verifiche?.filter(v => !!v.ScadenzaVerifica && v.ScadenzaVerifica.slice(0,10) <= next30).length ?? null;
  const prossimoAml = (state.scadenze || []).filter(v => v.data_scadenza).sort((a,b)=>a.data_scadenza.localeCompare(b.data_scadenza)).slice(0,5);
  const pct = state.verifiche?.length ? Math.round((state.verifiche.filter(v => v.AV1Conferma).length / state.verifiche.length)*100) : null;

  if (!ready || licenseLoading) return <p className="p-8 text-slate-500">Verifica accesso in corso...</p>;
  if (!licenseAllowed) return <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center">
    <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-red-600" /><h1 className="text-xl font-bold">Modulo AML non abilitato</h1>
    <p className="mt-2 text-slate-600">L'accesso richiede una licenza AML attiva per questo studio.</p>
  </div>;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-3xl font-bold tracking-tight text-slate-900">Cruscotto AML</h1><p className="mt-1 text-sm text-slate-500">Panoramica antiriciclaggio · dati del gestionale Studio Manager Pro</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setRefresh(n => n+1)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" title="Aggiorna dati"><RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} /> Aggiorna</button>
        <Link href="/antiriciclaggio/pratiche/nuovo" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"><Plus className="h-4 w-4" /> Nuova pratica AML</Link>
      </div>
    </div>
    {state.errors.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <AlertTriangle className="mr-2 inline h-4 w-4" />Alcuni indicatori non sono disponibili. {state.errors.join(" · ")}
    </div>}
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Clienti attivi" value={state.clients} detail="Anagrafiche condivise" icon={Users} tone="blue" href="/clienti"/>
      <StatCard label="Pratiche AML" value={state.practices?.length ?? null} detail="Pratiche registrate" icon={ClipboardCheck} tone="green" href="/antiriciclaggio"/>
      <StatCard label="Verifiche in scadenza" value={dueVerifiche} detail="Entro 30 giorni, anche scadute" icon={Clock3} tone="amber" href="/antiriciclaggio"/>
      <StatCard label="Alert AML aperti" value={state.scadenze?.length ?? null} detail="Motore generale SMP" icon={BellRing} tone="red" href="/aml/alert?ambito=aml"/>
      <StatCard label="Fascicoli incompleti" value={state.fascicoliMancanti} detail="Documenti da verificare" icon={FolderOpen} tone="amber" href="/antiriciclaggio/fascicolo-documenti"/>
    </div>
    <div className="grid gap-4 xl:grid-cols-3">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Adeguata verifica AV1</h2>
        <div className="flex flex-wrap items-center justify-center gap-6">
          <div className="flex h-44 w-44 items-center justify-center rounded-full" style={{background: pct===null ? "#e2e8f0" : "conic-gradient(#16a34a "+pct+"%, #e2e8f0 "+pct+"%)"}}>
            <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white">
              <span className="text-3xl font-bold">{pct===null?"—":pct+"%"}</span>
              <span className="text-center text-xs text-slate-500">AV1 confermate</span>
            </div>
          </div>
          <div className="text-sm text-slate-700 space-y-3">
            <p><CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-600" />Confermate: <strong>{state.verifiche?.filter(v=>v.AV1Conferma).length ?? "—"}</strong></p>
            <p><Clock3 className="mr-2 inline h-4 w-4 text-amber-600" />Non confermate: <strong>{state.verifiche?.filter(v=>!v.AV1Conferma).length ?? "—"}</strong></p>
            <p className="text-xs text-slate-500">Indicatore operativo, non certificazione di conformità normativa</p>
          </div>
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Pratiche AML per stato</h2>
        {state.practices === null ? <p className="text-sm text-slate-500">Dati non disponibili</p> :
          statusCounts.length ? <div className="space-y-4">{statusCounts.slice(0,6).map(([label,count],i)=><div key={label}>
            <div className="mb-1 flex justify-between text-sm"><span className="truncate pr-3 text-slate-700">{label}</span><strong>{count}</strong></div>
            <div className="h-3 rounded-full bg-slate-100"><div className={["h-3 rounded-full bg-blue-500","h-3 rounded-full bg-sky-400","h-3 rounded-full bg-emerald-500","h-3 rounded-full bg-amber-400","h-3 rounded-full bg-indigo-400","h-3 rounded-full bg-slate-400"][i]} style={{width: ((count / Math.max(1,state.practices?.length ?? 0))*100)+"%"}} /></div>
          </div>)}</div> : <p className="text-sm text-slate-500">Non sono presenti pratiche AML.</p>}
        <Link href="/antiriciclaggio" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-blue-600">Apri pratiche <ArrowRight className="h-4 w-4"/></Link>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex justify-between gap-3"><h2 className="text-lg font-semibold">Scadenze AML</h2><Link href="/aml/alert?ambito=aml" className="text-sm text-blue-600">Vedi tutte</Link></div>
        {state.scadenze === null ? <p className="text-sm text-slate-500">Dati non disponibili</p> : !prossimoAml.length ?
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Nessuna scadenza AML aperta nel motore centrale.</p> :
        <div className="divide-y divide-slate-100">{prossimoAml.map(item=><div className="flex items-center gap-3 py-3" key={item.id}>
          <div className={"flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg text-xs font-bold " + (item.data_scadenza.slice(0,10)<now?"bg-red-50 text-red-700":"bg-amber-50 text-amber-700")}>
            <CalendarClock className="h-4 w-4" /><span>{new Date(item.data_scadenza+"T12:00:00").toLocaleDateString("it-IT",{day:"2-digit",month:"short"})}</span>
          </div>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{item.titolo||"Scadenza AML"}</p><p className="truncate text-xs text-slate-500">{item.cliente||"Cliente non indicato"}</p></div>
        </div>)}</div>}
      </section>
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex justify-between"><h2 className="font-semibold">Centro Alert generale</h2><BellRing className="h-5 w-5 text-blue-500"/></div>
        <div className="space-y-3">
          <p className="flex justify-between text-sm"><span>Scadenze aperte dello studio</span><strong>{state.generalAlerts?.length ?? "—"}</strong></p>
          <p className="flex justify-between text-sm"><span>Notifiche non inviate</span><strong className={state.failedAlerts ? "text-red-600" : ""}>{state.failedAlerts ?? "—"}</strong></p>
          <Link href="/aml/alert" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600">Apri il motore centrale <ArrowRight className="h-4 w-4"/></Link>
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2"><Cloud className="h-5 w-5 text-blue-600"/><h2 className="font-semibold">Microsoft 365</h2></div>
        <p className="mb-4 text-sm text-slate-600">Accedi alla gestione originale delle connessioni, sincronizzazioni e comunicazioni Microsoft 365 di SMP.</p>
        <Link href="/microsoft365" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600">Gestisci Microsoft 365 <ArrowRight className="h-4 w-4"/></Link>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2"><FileText className="h-5 w-5 text-blue-600"/><h2 className="font-semibold">Moduli originali AML</h2></div>
        <div className="grid gap-2 text-sm">
          <Link href="/antiriciclaggio/modello-av1" className="rounded-lg bg-slate-50 p-2 hover:bg-blue-50">Modello AV1 · Adeguata verifica</Link>
          <Link href="/antiriciclaggio/modello-av2" className="rounded-lg bg-slate-50 p-2 hover:bg-blue-50">Modello AV2</Link>
          <Link href="/antiriciclaggio/modello-av4" className="rounded-lg bg-slate-50 p-2 hover:bg-blue-50">Modello AV4</Link>
        </div>
      </section>
    </div>
    {loading && <p role="status" className="text-xs text-slate-500">Aggiornamento indicatori...</p>}
  </div>;
}
