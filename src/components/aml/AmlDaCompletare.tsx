import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ClipboardList, FileText, RefreshCw } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useStudio } from "@/contexts/StudioContext";

type RecordRow = Record<string, any>;
type Task = { key:string; praticaId:string; cliente:string; prestazione:string; titolo:string; descrizione:string; urgenza:"scaduto"|"da-fare"|"attesa"|"verificare"; url:string; };
const normal = (v:unknown) => String(v ?? "").trim().toLowerCase();
const ymd = (v:unknown) => String(v ?? "").slice(0,10);
const dateStr = (v:unknown) => {
 const x=ymd(v);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(x))return "";
 return x.slice(8,10)+"/"+x.slice(5,7)+"/"+x.slice(0,4);
};
function firstByPratica(rows:RecordRow[],sortKey:string){
 const map=new Map<string,RecordRow>();
 const sorted=[...rows].sort((a,b)=>String(b[sortKey]??"").localeCompare(String(a[sortKey]??"")));
 for(const r of sorted){const id=String(r.pratica_id??"");if(id&&!map.has(id))map.set(id,r);}
 return map;
}
export default function AmlDaCompletare(){
 const {ready,session}=useRequireAuth();
 const {studioId,isLoading:licenseLoading,hasModule}=useStudio();
 const [tasks,setTasks]=useState<Task[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [filter,setFilter]=useState("tutti");
 const [currentSocieta,setCurrentSocieta]=useState("");
 const [needsAccess,setNeedsAccess]=useState(false);
 const allowed=!!studioId&&hasModule("aml");
 useEffect(()=>{
   if(!ready||licenseLoading||!allowed||!studioId||!session?.access_token){setLoading(false);return;}
   let active=true;
   const load=async()=>{
    setLoading(true);setError("");setNotice("");setTasks([]);setCurrentSocieta("");setNeedsAccess(false);
    try{
     const supabase=getSupabaseClient() as any;
     // Use exactly the responsible entity chosen and unlocked in Elenco AML.
     const selectedId=typeof window==="undefined"?"":sessionStorage.getItem("antiriciclaggio_selected_societa_id")||"";
     const unlockedId=typeof window==="undefined"?"":sessionStorage.getItem("antiriciclaggio_unlocked_societa_id")||"";
     if(!selectedId){if(active)setNeedsAccess(true);return;}
     const {data:societa,error:societaError}=await supabase.from("tbRespAVSocieta")
       .select("id,Denominazione,antiriciclaggio_enabled").eq("id",selectedId).eq("studio_id",studioId).maybeSingle();
     if(societaError)throw new Error("Soggetto responsabile: "+societaError.message);
     if(!societa||(societa.antiriciclaggio_enabled&&unlockedId!==selectedId)){
       if(active)setNeedsAccess(true);return;
     }
     if(active)setCurrentSocieta(String(societa.Denominazione||"Soggetto selezionato"));
     // Queries are scoped to this studio; use a visible warning if a result
     // reaches the retrieval ceiling rather than silently omitting practices.
     const read=async(table:string,fields:string,options?:{global?:boolean;responsabile?:boolean})=>{
       let query=supabase.from(table).select(fields);
       if(!options?.global)query=query.eq("studio_id",studioId);
       if(options?.responsabile)query=query.eq("societa_id",selectedId);
       const {data,error}=await query.range(0,1999);
       if(error)throw new Error(table+": "+error.message);
       return (data||[]) as RecordRow[];
     };
     const [pratiche,av1rows,av2rows,av4rows,fascicoli,prestazioni]=await Promise.all([
       read("tbPraticheAML","id,cliente_id,societa_id,tipo_prestazione,data_apertura,stato",{responsabile:true}),
       read("tbAV1","id,pratica_id,AV1Conferma,ScadenzaVerifica,DataVerifica"),
       read("tbAV2","id,pratica_id,confermato"),
       read("tbAV4","id,pratica_id,public_sent_at,Av4InviatoCL,compilato_da_cliente,av4_caricato_manualmente,allegato_pdf_cliente,pdf_firmato_cliente,created_at"),
       read("tbAVFascicoliAlert","id,pratica_id,completo,documenti_mancanti,updated_at"),
       // Shared catalog has no studio_id, as used by the existing AML list.
       read("tbElencoPrestAR","TipoPrestazioneAR,RischioTipoPrestAR,RegolaDiCondotta",{global:true})
     ]);
     const warnings:string[]=[];
     for(const [label,rows] of [["Pratiche",pratiche],["AV1",av1rows],["AV2",av2rows],["AV4",av4rows],["Fascicoli",fascicoli],["Prestazioni",prestazioni]] as const){
       if(rows.length===2000)warnings.push(label+": elenco al limite di 2.000 record; verifica i risultati");
     }
     const clients=Array.from(new Set(pratiche.map(p=>String(p.cliente_id||"")).filter(Boolean)));
     const clienti:RecordRow[]=[];
     // Resolve client names in bounded batches, never a cross-studio query.
     for(let i=0;i<clients.length;i+=200){
       const {data,error}=await supabase.from("tbclienti").select("id,ragione_sociale,cod_cliente")
        .eq("studio_id",studioId).in("id",clients.slice(i,i+200));
       if(error)throw new Error("Clienti: "+error.message);
       clienti.push(...(data||[]));
     }
     const names=new Map(clienti.map(r=>[String(r.id),String(r.ragione_sociale||r.cod_cliente||"Cliente")]));
     const praticaIds=new Set(pratiche.map(p=>String(p.id)));
     const av1=firstByPratica(av1rows.filter(r=>praticaIds.has(String(r.pratica_id))),"DataVerifica");
     const av2=firstByPratica(av2rows.filter(r=>praticaIds.has(String(r.pratica_id))),"id");
     const av4=firstByPratica(av4rows.filter(r=>praticaIds.has(String(r.pratica_id))),"created_at");
     const snapshots=firstByPratica(fascicoli.filter(r=>praticaIds.has(String(r.pratica_id))),"updated_at");
     const rules=new Map(prestazioni.map(r=>[normal(r.TipoPrestazioneAR),r]));
     const today=new Date();
     const todayStr=[today.getFullYear(),String(today.getMonth()+1).padStart(2,"0"),String(today.getDate()).padStart(2,"0")].join("-");
     const found:Task[]=[];
     const add=(p:RecordRow,titolo:string,descrizione:string,urgenza:Task["urgenza"],url:string)=>{
       found.push({key:String(p.id)+"|"+titolo,praticaId:String(p.id),cliente:names.get(String(p.cliente_id))||"Cliente da identificare",prestazione:String(p.tipo_prestazione||"Prestazione non indicata"),titolo,descrizione,urgenza,url});
     };
     for(const p of pratiche){
       if(!p.id)continue;
       const pid=String(p.id);
       const params=new URLSearchParams({pratica_id:pid,cliente_id:String(p.cliente_id||""),societa_id:String(p.societa_id||""),studio_id:String(studioId)});
       const urlF="/antiriciclaggio/fascicolo-documenti?"+params.toString();
       const av1url="/antiriciclaggio/modello-av1?"+params.toString();
       const av2url="/antiriciclaggio/modello-av2?"+params.toString();
       const av4url="/antiriciclaggio/modello-av4?"+params.toString();
       const a1=av1.get(pid),a2=av2.get(pid),a4=av4.get(pid);
       const rule=rules.get(normal(p.tipo_prestazione));
       const exempt=!!rule && normal(rule.RischioTipoPrestAR)==="non significativo" && !!String(rule.RegolaDiCondotta||"").trim();
       if(!exempt){
        if(!a1)add(p,"AV1 da compilare","La pratica non risulta collegata a un modello AV1.", "da-fare",av1url);
        else if(a1.AV1Conferma!==true)add(p,"AV1 da confermare","È presente un AV1 senza conferma registrata.", "da-fare",av1url);
        if(!a2||a2.confermato!==true)add(p,"AV2 da confermare","Non risulta confermato il modello AV2.", "da-fare",av2url);
        if(!a4)add(p,"AV4 da predisporre","Non risulta un AV4 associato alla pratica.", "da-fare",av4url);
        else {
         const received=!!(String(a4.pdf_firmato_cliente||a4.allegato_pdf_cliente||"").trim() || a4.compilato_da_cliente===true || a4.av4_caricato_manualmente===true);
         const sent=!!(a4.public_sent_at||a4.Av4InviatoCL);
         if(!received)add(p,sent?"AV4 in attesa del cliente":"AV4 da completare",sent?"Richiesta inviata, nessun ricevimento registrato.":"Non risulta una compilazione o un allegato ricevuto.",sent?"attesa":"da-fare",av4url);
        }
       }
       const expiry=ymd(a1?.ScadenzaVerifica);
       if(expiry && expiry<todayStr)add(p,"Verifica scaduta","Scadenza verifica: "+dateStr(expiry),"scaduto","/antiriciclaggio");
       const snapshot=snapshots.get(pid);
       if(snapshot?.completo===false){
        const missing=Array.isArray(snapshot.documenti_mancanti)?snapshot.documenti_mancanti:[];
        if(missing.length){
          add(p,"Documenti da verificare",missing.map(String).join(" · ")+" (ultimo controllo fascicolo)", "verificare",urlF);
        }else{
          add(p,"Fascicolo da verificare","L'ultimo controllo ha segnalato un fascicolo incompleto.", "verificare",urlF);
        }
       }
     }
     const order:Record<Task["urgenza"],number>={scaduto:0,"da-fare":1,verificare:2,attesa:3};
     found.sort((a,b)=>order[a.urgenza]-order[b.urgenza]||a.cliente.localeCompare(b.cliente,"it"));
     if(active){setTasks(found);setNotice(warnings.join(" · "));}
    }catch(e){if(active){setTasks([]);setError(e instanceof Error?e.message:"Impossibile caricare le attività");}}
    finally{if(active)setLoading(false);}
   };
   void load();
   return ()=>{active=false;};
 },[ready,licenseLoading,allowed,studioId,session?.access_token,refresh]);
 const shown=useMemo(()=>filter==="tutti"?tasks:tasks.filter(t=>t.urgenza===filter),[tasks,filter]);
 const count=(x:Task["urgenza"])=>tasks.filter(t=>t.urgenza===x).length;
 if(!ready||licenseLoading)return <p className="p-5 text-slate-500">Verifica accesso AML...</p>;
 if(!allowed)return <p className="rounded-lg border border-amber-200 bg-amber-50 p-5">Licenza AML non abilitata.</p>;
 return <div className="space-y-5 p-2 sm:p-4">
   <div className="flex flex-wrap items-center justify-between gap-3">
     <div><h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><ClipboardList className="h-7 w-7 text-sky-700"/> Centro adempimenti</h1><p className="mt-1 text-sm text-slate-500">Attività da completare, per cliente e prestazione · sola lettura</p></div>
     <div className="flex gap-2"><Link href="/aml" className="rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700">Cruscotto</Link><button type="button" onClick={()=>setRefresh(x=>x+1)} disabled={loading} className="flex items-center gap-2 rounded-xl bg-[#0369a1] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw className={"h-4 w-4 "+(loading?"animate-spin":"")}/> Aggiorna</button></div>
   </div>
   {currentSocieta&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-white p-4">
      <div><div className="text-xs text-slate-500">Soggetto responsabile attivo</div><div className="font-bold text-sky-800">{currentSocieta}</div><div className="text-xs text-slate-500">Sono visualizzate esclusivamente le pratiche di questo soggetto.</div></div>
      <Link href="/antiriciclaggio" className="rounded-lg border border-sky-300 px-3 py-2 text-sm font-semibold text-sky-700">Cambia soggetto dall'Elenco AML</Link>
   </div>}
   {needsAccess&&<div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
     Seleziona e, se richiesto, sblocca un soggetto responsabile nell'<Link href="/antiriciclaggio" className="font-semibold underline">Elenco Antiriciclaggio</Link> prima di visualizzare gli adempimenti. Le due utenze restano separate.
   </div>}
   {!error&&!needsAccess&&<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
    {([{key:"scaduto",label:"Scadute",value:count("scaduto"),color:"text-red-700"},{key:"da-fare",label:"Da fare",value:count("da-fare"),color:"text-amber-700"},{key:"verificare",label:"Documenti da verificare",value:count("verificare"),color:"text-sky-700"},{key:"attesa",label:"In attesa",value:count("attesa"),color:"text-slate-700"}] as const).map(x=><button key={x.key} type="button" onClick={()=>setFilter(filter===x.key?"tutti":x.key)} aria-pressed={filter===x.key} className={"rounded-xl border bg-white p-4 text-left shadow-sm "+(filter===x.key?"border-sky-600 ring-1 ring-sky-600":"border-slate-200")}><span className={"block text-3xl font-bold "+x.color}>{loading?"—":x.value}</span><span className="text-xs font-semibold text-slate-600">{x.label}</span></button>)}
   </div>}
   {notice&&<div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{notice}</div>}
   {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">Errore caricamento: {error}</div>}
   <p className="text-xs text-slate-500">I documenti mancanti provengono dall'ultimo controllo registrato nel Fascicolo. Per aggiornarli apri il Fascicolo della pratica. Le esenzioni per prestazioni non significative con regola di condotta sono rispettate; nessun dato viene modificato.</p>
   <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3"><h2 className="font-semibold">Attività {filter!=="tutti"?"filtrate":""} ({shown.length})</h2>{filter!=="tutti"&&<button onClick={()=>setFilter("tutti")} className="text-xs font-semibold text-sky-700">Mostra tutte</button>}</div>
    {loading?<div className="p-6 text-sm text-slate-500">Caricamento attività AML...</div>:error?<div className="p-6 text-sm text-red-700">Risultati non disponibili: controlla l'errore sopra.</div>:needsAccess?<div className="p-6 text-sm text-slate-600">Seleziona il soggetto responsabile dall'Elenco AML.</div>:!shown.length?<div className="flex items-center gap-2 p-6 text-sm text-slate-600"><CheckCircle2 className="h-5 w-5 text-green-600"/>Nessuna attività per il filtro selezionato.</div>:<div className="divide-y divide-slate-100">{shown.map(t=><div key={t.key} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50"><span className={"h-3 w-3 shrink-0 rounded-full "+(t.urgenza==="scaduto"?"bg-red-500":t.urgenza==="da-fare"?"bg-amber-500":t.urgenza==="attesa"?"bg-slate-400":"bg-sky-500")} aria-hidden="true"/><div className="min-w-[200px] flex-1"><div className="text-sm font-semibold text-slate-900">{t.cliente}</div><div className="text-xs text-slate-500">{t.prestazione}</div></div><div className="min-w-[240px] flex-[2]"><div className="flex items-center gap-2 text-sm font-medium text-slate-900">{t.urgenza==="scaduto"?<AlertCircle className="h-4 w-4 text-red-600"/>:<FileText className="h-4 w-4 text-slate-500"/>}{t.titolo}</div><div className="mt-1 text-xs text-slate-600">{t.descrizione}</div></div><Link href={t.url} className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50">Apri</Link></div>)}</div>}
   </section>
 </div>;
}
