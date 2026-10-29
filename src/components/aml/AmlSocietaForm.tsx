import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import NuovaSocietaOriginale from "@/pages/antiriciclaggio/responsabili-av-societa/nuovo";
import { getStudioId } from "@/services/getStudioId";
import { getSupabaseClient } from "@/lib/supabase/client";
export default function SocietaAMLForm({edit=false}:{edit?:boolean}){
 const router=useRouter();const [allowed,setAllowed]=useState(false);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 useEffect(()=>{if(!router.isReady)return;let live=true;(async()=>{try{const studioId=await getStudioId();const{data,error}=await (getSupabaseClient() as any).from("tbRespAVSocieta").select("id").eq("studio_id",studioId);if(error)throw error;const rows=data||[];if(edit){if(!rows.some((r:any)=>r.id===router.query.id))throw new Error("Società non appartenente allo studio corrente.");}else if(rows.length>=1)throw new Error("La versione AML prevede un solo soggetto responsabile. Modifica quello già presente.");if(live)setAllowed(true)}catch(e){if(live)setError(e instanceof Error?e.message:"Controllo società non riuscito")}finally{if(live)setLoading(false)}})();return()=>{live=false}},[router.isReady,router.query.id,edit]);
 if(loading)return <p className="p-6 text-slate-500">Controllo società responsabile...</p>;
 if(!allowed)return <div className="rounded-xl bg-white p-6"><p role="alert" className="mb-4 text-red-700">{error}</p><Link className="text-blue-700" href="/aml/societa">Torna alle società</Link></div>;
 return <NuovaSocietaOriginale returnHref="/aml/societa" recordId={edit && typeof router.query.id==="string" ? router.query.id : undefined}/>;
}