import {useEffect,useState} from "react";
import Link from "next/link";
import {getSupabaseClient} from "@/lib/supabase/client";
import {ShieldCheck,RefreshCw,CheckCircle2} from "lucide-react";
type Request={id:string;ragione_sociale:string;partita_iva:string|null;referente:string;email:string;telefono:string|null;piano:string;note:string|null;stato:string;creata_il:string;studio_id_attivato:string|null};
const label:Record<string,string>={in_attesa:"In attesa",in_valutazione:"In valutazione",approvata:"Approvata",rifiutata:"Rifiutata",attivata:"Attivata"};
export default function AmlGestioneAttivazioni(){
 const [rows,setRows]=useState<Request[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [studioIds,setStudioIds]=useState<Record<string,string>>({});
 const [authorized,setAuthorized]=useState(false);
 const call=async(method:"GET"|"POST",body?:Record<string,string>)=>{
   const {data:{session}}=await getSupabaseClient().auth.getSession();
   if(!session?.access_token)throw new Error("Devi effettuare l'accesso.");
   const response=await fetch("/api/aml/admin/richieste-attivazione",{
     method,headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
     ...(body?{body:JSON.stringify(body)}:{})});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(result.error||"Operazione non riuscita");
   return result;
 };
 const refresh=async()=>{
  setLoading(true);setError("");
  try{const data=await call("GET");setRows(data.requests||[]);setAuthorized(true);}
  catch(e){setAuthorized(false);setError(e instanceof Error?e.message:"Lettura non riuscita");}
  finally{setLoading(false);}
 };
 useEffect(()=>{void refresh();},[]);
 const apply=async(id:string,action:string,status?:string)=>{
  const actionName=action==="activate_verified"?"confermare come già attivata la richiesta":"impostare lo stato "+(label[status||""]||status);
  if(!window.confirm("Confermi di "+actionName+"?"))return;
  setBusy(id);setError("");setNotice("");
  try{
   const payload:Record<string,string>={id,action};
   if(status)payload.status=status;
   if(action==="activate_verified")payload.studioId=(studioIds[id]||"").trim();
   const result=await call("POST",payload);
   setNotice(result.message||"Aggiornamento registrato");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Modifica non riuscita");}
  finally{setBusy("");}
 };
 return <div className="space-y-5">
  <header className="flex flex-wrap items-start justify-between gap-3">
   <div><h1 className="flex items-center gap-3 text-2xl font-extrabold"><ShieldCheck className="h-7 w-7 text-orange-600"/> Attivazioni AML PRO</h1>
    <p className="text-sm text-slate-500">Gestione riservata all'amministratore generale. Nessuna licenza viene concessa automaticamente.</p></div>
   <button className="rounded-xl border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-700" onClick={()=>void refresh()} disabled={loading}><RefreshCw className="mr-1 inline h-4 w-4"/> Aggiorna</button>
  </header>
  {notice&&<p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-green-800">{notice}</p>}
  {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</p>}
  {loading?<p className="rounded-xl border bg-white p-5 text-slate-600">Caricamento delle richieste...</p>:!authorized?
   <p className="rounded-xl border bg-white p-5 text-slate-700">Questa funzione è riservata all'amministratore generale. Se la migrazione SQL non è stata applicata, occorre configurarla prima di usare il pannello.</p>:
  <>
   <div className="grid gap-3 sm:grid-cols-3">
    <div className="rounded-xl border border-sky-200 bg-white p-4"><p className="text-xs text-slate-500">Richieste totali</p><p className="text-3xl font-bold">{rows.length}</p></div>
    <div className="rounded-xl border border-sky-200 bg-white p-4"><p className="text-xs text-slate-500">Da gestire</p><p className="text-3xl font-bold text-orange-600">{rows.filter(x=>x.stato==="in_attesa"||x.stato==="in_valutazione").length}</p></div>
    <div className="rounded-xl border border-sky-200 bg-white p-4"><p className="text-xs text-slate-500">Attivazioni verificate</p><p className="text-3xl font-bold text-green-700">{rows.filter(x=>x.stato==="attivata").length}</p></div>
   </div>
   {!rows.length?<p className="rounded-xl border bg-white p-6 text-slate-600">Nessuna richiesta presente.</p>:
   <div className="space-y-3">{rows.map(r=><section key={r.id} className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">{r.ragione_sociale}</h2><span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold">{label[r.stato]||r.stato}</span></div>
    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
     <p><b>Referente:</b> {r.referente}</p><p><b>Email:</b> <a className="text-sky-700 underline" href={`mailto:${r.email}`}>{r.email}</a></p>
     <p><b>P. IVA:</b> {r.partita_iva||"Da indicare"}</p><p><b>Telefono:</b> {r.telefono||"—"}</p>
     <p><b>Piano richiesto:</b> {r.piano}</p><p><b>Ricevuta il:</b> {new Date(r.creata_il).toLocaleString("it-IT")}</p>
    </div>
    {r.note&&<p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><b>Note:</b> {r.note}</p>}
    <div className="mt-4 flex flex-wrap gap-2">
     {(r.stato==="in_attesa"||r.stato==="rifiutata")&&<button disabled={!!busy} onClick={()=>void apply(r.id,"status","in_valutazione")} className="rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm font-semibold text-sky-700">Prendi in carico</button>}
     {r.stato==="in_valutazione"&&<button disabled={!!busy} onClick={()=>void apply(r.id,"status","approvata")} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Approva richiesta</button>}
     {(r.stato==="in_attesa"||r.stato==="in_valutazione")&&<button disabled={!!busy} onClick={()=>void apply(r.id,"status","rifiutata")} className="rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700">Rifiuta</button>}
    </div>
    {r.stato==="approvata"&&<div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
     <h3 className="font-bold text-amber-900">Verifica attivazione effettiva</h3>
     <p className="mt-1 text-xs text-amber-900">Prima crea lo studio e l'account amministratore attraverso la procedura autorizzata, assegna la licenza AML attiva e verifica il pagamento. Questo controllo verifica studio, P. IVA, email amministratore e licenza già esistenti: non crea né abilita nulla.</p>
     <div className="mt-3 flex flex-wrap gap-2"><input className="min-w-56 flex-1 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm" placeholder="ID studio già attivato (UUID)" value={studioIds[r.id]||""} onChange={e=>setStudioIds(v=>({...v,[r.id]:e.target.value}))}/>
      <button disabled={!!busy||!(studioIds[r.id]||"").trim()} onClick={()=>void apply(r.id,"activate_verified")} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Verifica e concludi</button>
     </div>
    </div>}
    {r.stato==="attivata"&&<p className="mt-3 flex items-center gap-2 text-sm font-semibold text-green-700"><CheckCircle2 className="h-4 w-4"/> Attivata e verificata · Studio: {r.studio_id_attivato}</p>}
   </section>)}</div>}
   <div className="rounded-xl border border-sky-200 bg-blue-50 p-4 text-sm text-slate-700">
    <b>Nota operativa:</b> approvare una richiesta non abilita AML PRO. L'attivazione effettiva richiede ancora la creazione controllata dello studio, dell'amministratore e della licenza e la verifica del pagamento.
    <div className="mt-2"><Link href="/aml/licenza" className="font-semibold text-sky-700 underline">Consulta la gestione licenze</Link></div>
   </div>
  </>}
 </div>;
}
