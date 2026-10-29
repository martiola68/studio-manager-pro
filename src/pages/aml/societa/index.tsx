import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Pencil, Plus } from "lucide-react";
import { getStudioId } from "@/services/getStudioId";
import { getSupabaseClient } from "@/lib/supabase/client";
type Societa={id:string;Denominazione:string;codice_fiscale:string};
export default function SocietaAML(){
 const [rows,setRows]=useState<Societa[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 useEffect(()=>{let live=true;(async()=>{try{const studioId=await getStudioId();const{data,error}=await (getSupabaseClient() as any).from("tbRespAVSocieta").select("id, Denominazione, codice_fiscale").eq("studio_id",studioId).order("Denominazione");if(error)throw error;if(live)setRows(data||[])}catch(e){if(live)setError(e instanceof Error?e.message:"Errore caricamento")}finally{if(live)setLoading(false)}})();return()=>{live=false}},[]);
 return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Società responsabili AV</h1><p className="text-sm text-slate-500">Un solo soggetto responsabile per la versione AML autonoma. Nessuna modifica alle società già presenti.</p></div>{!loading&&rows.length===0&&<Link href="/aml/societa/nuovo" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4"/> Nuova società</Link>}</div>
 {error&&<p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
 <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[510px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-4">Denominazione</th><th className="p-4">Codice fiscale</th><th className="p-4 text-right">Azioni</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t"><td className="p-4 font-semibold">{r.Denominazione}</td><td className="p-4">{r.codice_fiscale}</td><td className="p-4 text-right"><Link href={`/aml/societa/${r.id}`} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-blue-700 hover:bg-blue-50"><Pencil className="h-4 w-4"/> Modifica</Link></td></tr>)}</tbody></table>{loading&&<p className="p-6 text-slate-500">Caricamento...</p>}{!loading&&!rows.length&&<p className="p-6 text-slate-500">Nessuna società presente. Puoi registrarne una.</p>}</div>
 {rows.length>1&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Sono già registrate più società nel database SMP originale. Non verranno eliminate: da questa interfaccia non è possibile crearne altre.</p>}
 </div>;
}