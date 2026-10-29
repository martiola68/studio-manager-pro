import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Search, Plus, Pencil, Users, Trash2, Building2 } from "lucide-react";
import { clienteService } from "@/services/clienteService";
import { useStudio } from "@/contexts/StudioContext";
import { getSupabaseClient } from "@/lib/supabase/client";

type Cliente = { id:string; cod_cliente?:string|null; ragione_sociale?:string|null; tipo_cliente?:string|null; codice_fiscale?:string|null; attivo?:boolean|null; cliente?:boolean|null; utente_operatore_id?:string|null; utente_professionista_id?:string|null };
const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export default function ClientiAmlIndex(){
 const { studioId, isLoading: studioLoading }=useStudio();
 const [rows,setRows]=useState<Cliente[]>([]);
 const [people,setPeople]=useState<Record<string,string>>({});
 const [query,setQuery]=useState("");
 const [letter,setLetter]=useState("");
 const [filter,setFilter]=useState("attivi");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const router=useRouter();
 useEffect(()=>{if(studioLoading||!studioId)return;let active=true;setLoading(true);Promise.all([clienteService.getClienti(),getSupabaseClient().from("tbutenti").select("id,nome,cognome,settore").eq("studio_id",studioId)]).then(([data,users])=>{if(active){setRows(data as Cliente[]);if(users.error)throw users.error;setPeople(Object.fromEntries((users.data||[]).filter(u=>String(u.settore||"Fiscale").toLowerCase()==="fiscale").map(u=>[u.id,[u.cognome,u.nome].filter(Boolean).join(" ")])));}}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Errore caricamento clienti")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[studioId,studioLoading]);
 const remove=async(c:Cliente)=>{
  if(!window.confirm(`Eliminare definitivamente "${c.ragione_sociale||"il cliente"}"? L'operazione può incidere su moduli collegati.`))return;
  try{
    const db=getSupabaseClient() as any;
    const [{count:orgCount,error:orgErr},{count:prCount,error:prErr}]=await Promise.all([
      db.from("tbclienti_organi").select("id",{count:"exact",head:true}).eq("cliente_id",c.id),
      db.from("tbPraticheAML").select("id",{count:"exact",head:true}).eq("cliente_id",c.id)
    ]);
    if(orgErr||prErr)throw orgErr||prErr;
    if(Number(orgCount||0)>0||Number(prCount||0)>0)throw new Error("Cliente collegato a organi sociali o pratiche AML: impossibile eliminarlo. Disattivalo invece.");
    throw new Error("Eliminazione protetta: prima della vendita AML è necessario verificare tutti i collegamenti con le altre sezioni SMP. Nessun dato è stato cancellato.");
  }catch(e){setError(e instanceof Error?e.message:"Eliminazione non riuscita")}
 };
 const filtered=useMemo(()=>rows.filter(c=>{
   if(filter==="attivi"&&c.attivo===false)return false;
   if(filter==="non-attivi"&&c.attivo!==false)return false;
   const nome=String(c.ragione_sociale||"").trim();
   if(letter&&!nome.toLocaleUpperCase("it").startsWith(letter))return false;
   const term=query.trim().toLocaleLowerCase("it");
   return !term||[c.ragione_sociale,c.cod_cliente,c.codice_fiscale].some(x=>String(x||"").toLocaleLowerCase("it").includes(term));
 }),[rows,query,letter,filter]);
 return <div className="space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Anagrafiche clienti</h1><p className="text-sm text-slate-500">Anagrafica AML semplificata · stessa tabella clienti SMP</p></div>
  <Link href="/aml/clienti/nuovo" className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"><Plus className="h-4 w-4"/> Nuovo cliente</Link></div>
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_210px]"><label className="relative"><Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400"/><input aria-label="Cerca cliente" className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cerca per cliente, codice cliente o codice fiscale..."/></label>
    <select aria-label="Filtro attivi" className="rounded-lg border border-slate-200 bg-white p-2 text-sm" value={filter} onChange={e=>setFilter(e.target.value)}><option value="attivi">Solo clienti attivi</option><option value="tutti">Tutti i clienti</option><option value="non-attivi">Clienti non attivi</option></select></div>
    <div className="mt-4 flex flex-wrap gap-1.5">{["",...alphabet].map(v=><button type="button" key={v} onClick={()=>setLetter(v)} className={"h-8 min-w-8 rounded-md border px-2 text-xs font-semibold "+(letter===v?"border-blue-700 bg-blue-600 text-white":"border-slate-200 text-slate-700 hover:bg-blue-50")}>{v||"Tutti"}</button>)}</div>
  </div>
  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3 text-sm text-slate-600"><span><Users className="mr-2 inline h-4 w-4"/>Clienti {loading?"—":filtered.length}</span><span>Gestione AML</span></div>
    {error&&<p role="alert" className="p-4 text-sm text-red-700">{error}</p>}
    {loading||studioLoading?<p className="p-8 text-center text-slate-500">Caricamento clienti...</p>:
      !filtered.length?<p className="p-8 text-center text-slate-500">Nessun cliente per i filtri selezionati.</p>:
      <div className="max-h-[65vh] overflow-auto"><table className="w-full min-w-[1220px] text-left text-sm">
        <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr><th className="w-[125px] px-4 py-3">Codice</th><th className="px-4 py-3">Cliente</th><th className="min-w-[205px] px-4 py-3 whitespace-nowrap">Utente</th><th className="min-w-[205px] px-4 py-3 whitespace-nowrap">Responsabile</th><th className="w-[110px] px-4 py-3">Stato</th><th className="w-[200px] px-4 py-3 text-right">Azioni</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{filtered.map(c=><tr key={c.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{c.cod_cliente||"—"}</td><td className="px-4 py-3 font-semibold text-slate-800">{c.ragione_sociale||"—"}</td><td className="min-w-[205px] whitespace-nowrap px-4 py-3 text-slate-600">{people[c.utente_operatore_id||""]||"—"}</td><td className="min-w-[205px] whitespace-nowrap px-4 py-3 text-slate-600">{people[c.utente_professionista_id||""]||"—"}</td><td className="px-4 py-3 whitespace-nowrap"><span className={"rounded-full px-2 py-1 text-xs font-semibold "+(c.attivo===false?"bg-slate-100 text-slate-600":"bg-emerald-50 text-emerald-700")}>{c.attivo===false?"Non attivo":"Attivo"}</span></td><td className="px-4 py-3 text-right"><div className="flex justify-end gap-1.5"><Link href={`/aml/clienti/${encodeURIComponent(c.id)}`} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"><Pencil className="h-3.5 w-3.5"/>Modifica</Link><Link href={`/aml/clienti/organi-sociali?cliente_id=${encodeURIComponent(c.id)}`} title="Organi sociali" className="inline-flex items-center rounded-lg border border-blue-200 px-2 text-blue-700 hover:bg-blue-50"><Building2 className="h-4 w-4"/></Link><button type="button" title="Elimina cliente" onClick={()=>void remove(c)} className="rounded-lg border border-red-200 px-2 py-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4"/></button></div></td></tr>)}</tbody>
      </table></div>}
  </div>
 </div>;
}
