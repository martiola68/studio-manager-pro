import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Search, Plus, Pencil, Users, ArrowRight } from "lucide-react";
import { clienteService } from "@/services/clienteService";
import { useStudio } from "@/contexts/StudioContext";

type Cliente = { id:string; cod_cliente?:string|null; ragione_sociale?:string|null; tipo_cliente?:string|null; codice_fiscale?:string|null; attivo?:boolean|null; cliente?:boolean|null; utente_operatore_id?:string|null; utente_professionista_id?:string|null };
const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export default function ClientiAmlIndex(){
 const { studioId, isLoading: studioLoading }=useStudio();
 const [rows,setRows]=useState<Cliente[]>([]);
 const [query,setQuery]=useState("");
 const [letter,setLetter]=useState("");
 const [filter,setFilter]=useState("attivi");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const router=useRouter();
 useEffect(()=>{if(studioLoading||!studioId)return;let active=true;setLoading(true);clienteService.getClienti().then(data=>{if(active)setRows(data as Cliente[])}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Errore caricamento clienti")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[studioId,studioLoading]);
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
  <Link href="/aml/clienti/nuovo" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4"/> Nuovo cliente</Link></div>
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
      <div className="max-h-[65vh] overflow-auto"><table className="w-full min-w-[620px] text-left text-sm">
        <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">Codice</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Stato</th><th className="px-4 py-3 text-right">Azioni</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{filtered.map(c=><tr key={c.id} className="hover:bg-slate-50"><td className="px-4 py-3 text-xs text-slate-500">{c.cod_cliente||"—"}</td><td className="px-4 py-3 font-semibold text-slate-800">{c.ragione_sociale||"—"}</td><td className="px-4 py-3 text-slate-600">{c.tipo_cliente||"—"}</td><td className="px-4 py-3"><span className={"rounded-full px-2 py-1 text-xs font-semibold "+(c.attivo===false?"bg-slate-100 text-slate-600":"bg-emerald-50 text-emerald-700")}>{c.attivo===false?"Non attivo":"Attivo"}</span></td><td className="px-4 py-3 text-right"><Link href={`/aml/clienti/${encodeURIComponent(c.id)}`} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"><Pencil className="h-3.5 w-3.5"/>Modifica</Link></td></tr>)}</tbody>
      </table></div>}
  </div>
 </div>;
}
