import { useEffect, useState } from "react";
import { useStudio } from "@/contexts/StudioContext";
import { getSupabaseClient } from "@/lib/supabase/client";
import Link from "next/link";

type AmlLicense={
  piano:string;stato:string;pratiche_incluse:number|null;
  canone_annuale_eur:number;data_attivazione:string|null;data_scadenza:string|null;
};
type LicenseInfo={
  aml:AmlLicense|null;
  smp:{piano:string;stato:string;data_scadenza:string|null}|null;
  praticheUtilizzate:number;
};
const displayDate=(v:string|null|undefined)=>v?new Intl.DateTimeFormat("it-IT").format(new Date(v+"T12:00:00")):"—";
export default function AmlLicenza(){
  const {studioId,isLoading,hasModule,amlOnly}=useStudio();
  const [info,setInfo]=useState<LicenseInfo|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    if(isLoading)return;
    let active=true;
    (async()=>{
      try{
        const supabase=getSupabaseClient();
        const {data:{session}}=await supabase.auth.getSession();
        if(!session?.access_token)throw new Error("Sessione scaduta");
        const response=await fetch("/api/aml/licenza",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
        const data=await response.json();
        if(!response.ok)throw new Error(data?.error||"Impossibile caricare le licenze");
        if(active)setInfo(data);
      }catch(e){if(active)setError(e instanceof Error?e.message:"Errore caricamento licenze");}
      finally{if(active)setLoading(false);}
    })();
    return()=>{active=false};
  },[isLoading,studioId]);
  if(loading||isLoading)return <p className="p-8 text-slate-500">Verifica licenze in corso...</p>;
  return <div className="mx-auto max-w-4xl space-y-5">
    <div><Link href="/aml" className="text-sm font-semibold text-blue-700">← Cruscotto AML</Link>
      <h1 className="mt-3 text-2xl font-bold">Gestione licenze SMP e AML</h1>
      <p className="mt-2 text-sm text-slate-500">Due licenze indipendenti per lo stesso studio: AML è attivabile sia da sola sia insieme al gestionale SMP.</p></div>
    {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
    {info&&<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">AML PRO</h2>
        <p className="mt-2 text-sm font-semibold text-blue-700">{hasModule("aml")?"Licenza attiva":"Non abilitato"}</p>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-slate-500">Piano</dt><dd className="font-semibold">{info.aml?.piano||"Non assegnato"}</dd></div>
          <div><dt className="text-slate-500">Prezzo annuale</dt><dd className="font-semibold">{info.aml?info.aml.canone_annuale_eur+" €":"—"}</dd></div>
          <div><dt className="text-slate-500">Attivazione</dt><dd className="font-semibold">{displayDate(info.aml?.data_attivazione)}</dd></div>
          <div><dt className="text-slate-500">Scadenza</dt><dd className="font-semibold">{displayDate(info.aml?.data_scadenza)}</dd></div>
          <div><dt className="text-slate-500">Pratiche utilizzate</dt><dd className="font-semibold">{info.praticheUtilizzate}</dd></div>
          <div><dt className="text-slate-500">Limite pratiche</dt><dd className="font-semibold">{info.aml?.pratiche_incluse===null?"Illimitate":info.aml?.pratiche_incluse??"—"}</dd></div>
        </dl>
      </section>
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">Studio Manager Pro</h2>
        <p className="mt-2 text-sm font-semibold">{amlOnly?"Non acquistato (solo AML)":"Licenza gestionale indipendente"}</p>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-slate-500">Piano</dt><dd className="font-semibold">{info.smp?.piano||"Non acquistato"}</dd></div>
          <div><dt className="text-slate-500">Stato</dt><dd className="font-semibold">{info.smp?.stato||"Non attivo"}</dd></div>
          <div><dt className="text-slate-500">Scadenza</dt><dd className="font-semibold">{displayDate(info.smp?.data_scadenza)}</dd></div>
        </dl>
        <p className="mt-6 border-t pt-4 text-xs leading-relaxed text-slate-500">Il piano SMP non modifica i limiti AML. Per acquistare o rinnovare AML serve una sottoscrizione annuale distinta.</p>
      </section>
    </div>}
    <p className="text-xs leading-relaxed text-slate-500">Consultazione riservata all'amministratore. Attivazioni e rinnovi sono gestiti nel Centro Attivazioni e tramite i pagamenti confermati.</p>
  </div>;
}
