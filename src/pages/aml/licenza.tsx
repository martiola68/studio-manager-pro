import { useEffect, useState } from "react";
import { useStudio } from "@/contexts/StudioContext";
import { getSupabaseClient } from "@/lib/supabase/client";
import Link from "next/link";

type LicenseInfo = {
  studio: { ragione_sociale: string; stato_abbonamento: string | null; data_scadenza_abbonamento: string | null };
  licenza: { piano: string; stato: string; data_attivazione: string | null; data_scadenza: string | null; numero_licenze?: number | null; stripe_status: string | null; ha_subscription_stripe: boolean } | null;
};
export default function AmlLicenza() {
  const { studioId, isLoading, hasModule, amlOnly } = useStudio();
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
        if(!session?.access_token)throw new Error("Sessione scaduta.");
        const response=await fetch("/api/studio/abbonamento",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
        const data=await response.json();
        if(!response.ok)throw new Error(data?.error||"Impossibile caricare la licenza.");
        if(active)setInfo(data);
      }catch(e){if(active)setError(e instanceof Error?e.message:"Errore lettura licenza.");}
      finally{if(active)setLoading(false);}
    })();
    return()=>{active=false};
  },[isLoading,studioId]);
  if(loading||isLoading)return <p className="p-8 text-slate-500">Verifica licenza AML...</p>;
  return <div className="mx-auto max-w-3xl space-y-5">
    <div><Link href="/aml" className="text-sm font-semibold text-blue-700">← Cruscotto AML</Link><h1 className="mt-3 text-2xl font-bold">Licenza e attivazione AML</h1>
    <p className="mt-2 text-sm text-slate-500">Consulta lo stato della licenza del tuo studio. L'attivazione commerciale viene effettuata dopo verifica amministrativa e conferma del pagamento.</p></div>
    {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
    {info&&<section className="space-y-3 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="font-bold">{info.studio?.ragione_sociale||"Studio"}</h2>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-slate-500">Piano</dt><dd className="font-semibold">{info.licenza?.piano||"Non assegnato"}</dd></div>
        <div><dt className="text-slate-500">Stato</dt><dd className="font-semibold">{info.licenza?.stato||"Non attivo"}</dd></div>
        <div><dt className="text-slate-500">Attivazione</dt><dd className="font-semibold">{info.licenza?.data_attivazione||"—"}</dd></div>
        <div><dt className="text-slate-500">Scadenza</dt><dd className="font-semibold">{info.licenza?.data_scadenza||"Non indicata"}</dd></div>
        <div><dt className="text-slate-500">Accesso al modulo AML</dt><dd className="font-semibold">{hasModule("aml")?"Abilitato":"Non abilitato"}</dd></div>
        <div><dt className="text-slate-500">Tipologia licenza</dt><dd className="font-semibold">{amlOnly?"AML autonoma":"AML incluso nel piano SMP"}</dd></div>
      </dl>
      <p className="border-t pt-4 text-xs text-slate-500">Questa pagina non attiva licenze, non modifica gli abbonamenti e non addebita pagamenti.</p>
    </section>}
  </div>;
}
