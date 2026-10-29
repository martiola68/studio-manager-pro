import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, BellRing, CalendarClock, CheckCircle2, Filter, RefreshCw } from "lucide-react";
import { useRequireAuth } from "@/hooks/useRequireAuth";

type Scadenza = {
 id: string; cliente?: string|null; titolo?: string|null; descrizione?: string|null;
 data_scadenza?: string|null; origine_modulo?: string|null; stato_calcolato?: string|null;
 operatore_responsabile?: string|null; link_dettaglio?: string|null; alert_con_errore?: boolean|null;
};
type AlertResponse = {
 scadenze: Scadenza[]; riepilogo: { totale?: number; scadute?: number; scadono_oggi?: number; con_errori_alert?: number };
};
const isAml = (value: string | null | undefined) => /aml|antiriciclaggio|adeguata.verifica|fascicol/i.test(value || "");
function formatDate(value?:string|null) {
 if(!value) return "—"; const d = new Date(value.length === 10 ? value+"T12:00:00" : value);
 return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit",year:"numeric"});
}
export default function CentroAlertAMLPage(){
 const {ready,session}=useRequireAuth();
 const [state,setState]=useState<AlertResponse|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [filter,setFilter]=useState("");
 const [search,setSearch]=useState("");
 const [reload,setReload]=useState(0);
 useEffect(()=>{
   if(!ready || !session?.access_token)return;
   let live=true;
   const load=async()=>{
     setLoading(true);setError("");
     try{
       const response=await fetch("/api/scadenze-centrale",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
       const payload=await response.json();
       if(!response.ok||!payload.success)throw new Error(payload.error||"Caricamento non riuscito");
       if(live)setState({scadenze:payload.scadenze||[],riepilogo:payload.riepilogo||{}});
     }catch(e){if(live)setError(e instanceof Error?e.message:"Impossibile caricare gli alert");}
     finally{if(live)setLoading(false);}
   };
   void load();return()=>{live=false};
 },[ready,session?.access_token,reload]);
 const visible=useMemo(()=>{
  return (state?.scadenze||[]).filter(v=>{
    if(!isAml(v.origine_modulo))return false;
    if(filter && v.stato_calcolato!==filter)return false;
    const needle=search.toLocaleLowerCase("it").trim();
    if(!needle)return true;
    return [v.cliente,v.titolo,v.origine_modulo,v.operatore_responsabile].some(x=>String(x||"").toLocaleLowerCase("it").includes(needle));
  }).sort((a,b)=>String(a.data_scadenza||"9999").localeCompare(String(b.data_scadenza||"9999")));
 },[state,filter,search]);
 const errorStates=new Set(["scaduta","scade_oggi"]);
 return <div className="space-y-5">
   <div className="flex flex-wrap items-start justify-between gap-3">
     <div><Link href="/aml" className="mb-2 inline-flex items-center gap-1 text-sm text-blue-600"><ArrowLeft className="h-4 w-4"/> Cruscotto AML</Link>
     <h1 className="text-3xl font-bold text-slate-900">Centro Alert</h1>
     <p className="mt-1 text-sm text-slate-500">Solo avvisi antiriciclaggio, elaborati dal motore centrale SMP</p></div>
     <button type="button" onClick={()=>setReload(n=>n+1)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"><RefreshCw className={"h-4 w-4 "+(loading?"animate-spin":"")}/> Aggiorna</button>
   </div>
   <div className="grid gap-3 sm:grid-cols-3">
     <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-sm text-slate-500">Alert nell'elenco</div><div className="mt-1 text-3xl font-bold">{state?visible.length:"—"}</div></div>
     <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-sm text-slate-500">Scaduti nell'elenco</div><div className="mt-1 text-3xl font-bold text-red-600">{state?visible.filter(v=>v.stato_calcolato==="scaduta").length:"—"}</div></div>
     <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-sm text-slate-500">Con errore alert nell'elenco</div><div className="mt-1 text-3xl font-bold text-amber-600">{state?visible.filter(v=>v.alert_con_errore).length:"—"}</div></div>
   </div>
   <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
     <div className="mb-4 flex flex-wrap items-center gap-3">
       <input type="search" aria-label="Cerca alert" placeholder="Cerca cliente, scadenza, modulo, operatore..." value={search} onChange={e=>setSearch(e.target.value)}
        className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"/>
       <label className="flex items-center gap-2 text-sm text-slate-600"><Filter className="h-4 w-4"/> Stato
         <select value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
           <option value="">Tutti</option><option value="scaduta">Scaduta</option><option value="scade_oggi">Scade oggi</option>
           <option value="in_scadenza_7_giorni">Entro 7 giorni</option><option value="in_scadenza_30_giorni">Entro 30 giorni</option>
           <option value="futura">Futura</option><option value="completata">Completata</option><option value="sospesa">Sospesa</option>
           <option value="annullata">Annullata</option>
         </select>
       </label>
     </div>
     {error&&<div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Errore caricamento: {error}</div>}
     {loading?<p className="py-8 text-center text-slate-500">Caricamento dal motore generale SMP...</p>:
       !visible.length?<p className="py-8 text-center text-slate-500">Nessun alert corrispondente ai filtri.</p>:
       <div className="overflow-x-auto"><table className="w-full min-w-[740px] text-left text-sm">
         <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
          <th className="p-3">Scadenza</th><th className="p-3">Cliente / attività</th><th className="p-3">Modulo</th><th className="p-3">Stato</th><th className="p-3">Responsabile</th><th className="p-3">Dettaglio</th>
         </tr></thead>
         <tbody className="divide-y divide-slate-100">{visible.map(v=><tr key={v.id} className="hover:bg-slate-50">
           <td className="whitespace-nowrap p-3"><CalendarClock className="mr-1 inline h-4 w-4 text-slate-400"/>{formatDate(v.data_scadenza)}</td>
           <td className="p-3"><div className="font-semibold">{v.titolo||"Scadenza"}</div><div className="text-xs text-slate-500">{v.cliente||"Cliente non indicato"}</div></td>
           <td className="p-3 text-slate-600">{v.origine_modulo||"—"}</td>
           <td className="p-3"><span className={"inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold "+(errorStates.has(v.stato_calcolato||"")?"bg-red-50 text-red-700":v.stato_calcolato==="completata"?"bg-emerald-50 text-emerald-700":"bg-blue-50 text-blue-700")}>
             {v.alert_con_errore?<AlertTriangle className="h-3 w-3"/>:v.stato_calcolato==="completata"?<CheckCircle2 className="h-3 w-3"/>:<BellRing className="h-3 w-3"/>}
             {v.stato_calcolato||"—"}</span></td>
           <td className="p-3 text-slate-600">{v.operatore_responsabile||"—"}</td>
           <td className="p-3">{v.link_dettaglio?.startsWith("/")&&!v.link_dettaglio.startsWith("//")?
             <Link href={v.link_dettaglio} className="font-medium text-blue-600 hover:underline">Apri</Link>:<span className="text-slate-400">—</span>}</td>
         </tr>)}</tbody>
       </table></div>}
   </div>
   <p className="text-xs text-slate-500">Gli alert sono letti dall'API centrale esistente e rispettano il contesto dello studio. Nessun secondo motore di invio.</p>
 </div>
}
