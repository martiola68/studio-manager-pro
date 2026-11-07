import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Doc = { id:string; tipo_documento:string|null; numero_documento:string|null; scadenza_documento:string|null; allegato_documento:string|null };
type Person = { soggetto_cliente_id:string; nome:string; email:string; documento:Doc|null; signed_url:string|null };
function status(p:Person){
 const d=p.documento;
 if(!d?.allegato_documento)return {label:"Mancante",cls:"bg-red-100 text-red-700"};
 if(!d.scadenza_documento)return {label:"Scadenza da indicare",cls:"bg-amber-100 text-amber-800"};
 const dt=new Date(d.scadenza_documento+"T12:00:00Z").getTime(),today=Date.now();
 const days=Math.ceil((dt-today)/86400000);
 if(days<0)return {label:"Scaduto",cls:"bg-red-100 text-red-700"};
 if(days<=90)return {label:"In scadenza",cls:"bg-amber-100 text-amber-800"};
 return {label:"Valido",cls:"bg-emerald-100 text-emerald-700"};
}
export default function AmlOrganiDocumenti({clienteId,praticaId}:{clienteId:string;praticaId?:string}){
 const [items,setItems]=useState<Person[]>([]);
 const [edits,setEdits]=useState<Record<string,{tipo_documento:string;numero_documento:string;scadenza_documento:string}>>({});
 const [uploads,setUploads]=useState<Record<string,File|null>>({});
 const [busy,setBusy]=useState("");const [error,setError]=useState("");const [message,setMessage]=useState("");
 const [loading,setLoading]=useState(false);const [notice,setNotice]=useState("");
 const request=useCallback(async(method:"GET"|"POST",body?:Record<string,unknown>)=>{
  const {data:{session}}=await getSupabaseClient().auth.getSession();
  if(!session?.access_token)throw new Error("Sessione scaduta: accedi nuovamente");
  const url="/api/aml/documenti-organi"+(method==="GET"?"?cliente_id="+encodeURIComponent(clienteId)+(praticaId?"&pratica_id="+encodeURIComponent(praticaId):""):"");
  const res=await fetch(url,{method,headers:{Authorization:"Bearer "+session.access_token,...(method==="POST"?{"Content-Type":"application/json"}:{})},body:method==="POST"?JSON.stringify({cliente_id:clienteId,...(praticaId?{pratica_id:praticaId}:{}),...body}):undefined,cache:"no-store"});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||!data.ok)throw new Error(data.error||"Operazione non riuscita");
  return data;
 },[clienteId,praticaId]);
 const refresh=useCallback(async()=>{
  if(!clienteId){setItems([]);return;}
  setLoading(true);setError("");
  try{
   const d=await request("GET");
   const rows:Person[]=d.items||[];setItems(rows);setNotice(String(d.notice||""));
   setEdits(Object.fromEntries(rows.map(p=>[p.soggetto_cliente_id,{tipo_documento:p.documento?.tipo_documento==="Carta d'identità"?"Carta di identità":p.documento?.tipo_documento||"",numero_documento:p.documento?.numero_documento||"",scadenza_documento:p.documento?.scadenza_documento||""}])));
  }catch(e){setError(e instanceof Error?e.message:"Errore caricamento documenti");}finally{setLoading(false);}
 },[clienteId,request]);
 useEffect(()=>{void refresh();},[refresh]);
 const update=(id:string,k:"tipo_documento"|"numero_documento"|"scadenza_documento",v:string)=>setEdits(prev=>({...prev,[id]:{...(prev[id]||{tipo_documento:"",numero_documento:"",scadenza_documento:""}),[k]:v}}));
 async function execute(p:Person,action:"save"|"request"){
  const id=p.soggetto_cliente_id;setBusy(id);setError("");setMessage("");
  try{
   if(action==="request"){await request("POST",{action,soggetto_cliente_id:id});setMessage("Richiesta documento inviata per "+p.nome);await refresh();return;}
   const f=uploads[id];let path="";
   if(f){
    if(f.size>15*1024*1024)throw new Error("File oltre il limite di 15 MB");
    if(!["application/pdf","image/png","image/jpeg"].includes(f.type))throw new Error("Sono ammessi PDF, JPG e PNG");
    const {data:{session}}=await getSupabaseClient().auth.getSession();
    if(!session)throw new Error("Sessione scaduta");
    const sid=String(session.user.user_metadata?.studio_id||"");
    // Lo studio viene validato dal server: recuperiamo l'ID dal percorso già noto
    // solo quando disponibile, altrimenti l'API espone lo studio autorizzato.
    const studioId=(p as Person&{studio_id?:string}).studio_id||sid;
    if(!studioId)throw new Error("Studio non disponibile: aggiornare la pagina");
    const ext=f.name.split(".").pop()?.toLowerCase()||"pdf";
    path=studioId+"/organi-documenti/"+id+"/"+crypto.randomUUID()+"."+ext;
    const {error:upError}=await getSupabaseClient().storage.from("allegati").upload(path,f,{upsert:false,contentType:f.type});
    if(upError)throw upError;
   }
   await request("POST",{action,soggetto_cliente_id:id,...edits[id],...(path?{allegato_documento:path}:{})});
   setUploads(x=>({...x,[id]:null}));setMessage("Documento aggiornato per "+p.nome);await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Errore aggiornamento documento");}finally{setBusy("");}
 }
 if(!clienteId)return null;
 return <section className="mb-5 rounded-lg border border-sky-200 bg-white p-4">
  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="text-base font-bold">Documento d'identità – Amministratore associato</h2><p className="text-xs text-slate-500">Documento del rappresentante associato alla pratica, condiviso tra gli incarichi. Avvisi centralizzati.</p></div>
   <div className="flex gap-2"><Link href={"/aml/clienti/organi-sociali?cliente_id="+encodeURIComponent(clienteId)} className="rounded border border-sky-400 px-3 py-2 text-xs font-semibold text-sky-700">Organi sociali</Link><button onClick={()=>void refresh()} type="button" className="rounded border px-3 py-2 text-xs">Aggiorna</button></div>
  </div>
  {error&&<p role="alert" className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
  {message&&<p className="mb-3 rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p>}
  {loading?<p className="py-3 text-sm text-slate-500">Caricamento documenti...</p>:!items.length?<p className="text-sm text-slate-500">{notice||"Nessun amministratore associato alla pratica."}</p>:
   <div className="space-y-3">{items.map(p=>{
    const e=edits[p.soggetto_cliente_id]||{tipo_documento:"",numero_documento:"",scadenza_documento:""};
    const st=status(p);
    return <div key={p.soggetto_cliente_id} className="rounded-lg border border-slate-200 p-3">
     <div className="mb-3 flex flex-wrap items-center gap-2"><strong className="text-sm">{p.nome}</strong><span className={"rounded-full px-2 py-0.5 text-xs font-semibold "+st.cls}>{st.label}</span>{p.email&&<span className="text-xs text-slate-500">{p.email}</span>}</div>
     <div className="grid gap-3 md:grid-cols-3">
      <label className="text-xs text-slate-600">Tipo documento<select value={e.tipo_documento} onChange={v=>update(p.soggetto_cliente_id,"tipo_documento",v.target.value)} className="mt-1 w-full rounded border p-2 text-sm"><option value="">Seleziona</option><option value="Carta di identità">Carta di identità</option><option>Passaporto</option><option>Patente</option></select></label>
      <label className="text-xs text-slate-600">Numero documento<input value={e.numero_documento} onChange={v=>update(p.soggetto_cliente_id,"numero_documento",v.target.value)} className="mt-1 w-full rounded border p-2 text-sm" /></label>
      <label className="text-xs text-slate-600">Data scadenza<input type="date" value={e.scadenza_documento} onChange={v=>update(p.soggetto_cliente_id,"scadenza_documento",v.target.value)} className="mt-1 w-full rounded border p-2 text-sm"/></label>
     </div>
     <div className="mt-3 flex flex-wrap items-center gap-2">
      <label className="cursor-pointer rounded border border-sky-300 px-3 py-2 text-xs text-sky-700">Carica PDF / immagine<input type="file" accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={v=>setUploads(x=>({...x,[p.soggetto_cliente_id]:v.target.files?.[0]||null}))}/></label>
      {uploads[p.soggetto_cliente_id]&&<span className="text-xs">{uploads[p.soggetto_cliente_id]?.name}</span>}
      {p.signed_url&&<a href={p.signed_url} target="_blank" rel="noopener noreferrer" className="rounded border px-3 py-2 text-xs text-sky-700">Apri documento</a>}
      <button type="button" disabled={!!busy} onClick={()=>void execute(p,"save")} className="rounded border border-blue-600 bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Salva / aggiorna</button>
      <button type="button" disabled={!!busy||!p.email} onClick={()=>void execute(p,"request")} className="rounded border border-sky-400 px-3 py-2 text-xs font-semibold text-sky-700 disabled:opacity-50">Richiedi documento</button>
     </div>
    </div>;
   })}</div>}
 </section>;
}
