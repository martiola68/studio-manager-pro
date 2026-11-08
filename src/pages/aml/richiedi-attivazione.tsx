import { useState, type FormEvent } from "react";
import Head from "next/head";
import Link from "next/link";
import { ShieldCheck, CheckCircle2, ArrowLeft } from "lucide-react";
import { isValidItalianVat } from "@/lib/aml/italianVat";

type Fields={ragione_sociale:string;partita_iva:string;referente:string;email:string;telefono:string;piano:"starter"|"professional"|"business";note:string;consenso:boolean;website:string};
const initial:Fields={ragione_sociale:"",partita_iva:"",referente:"",email:"",telefono:"",piano:"starter",note:"",consenso:false,website:""};
const input="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500";
export default function RichiediAttivazioneAml(){
 const [form,setForm]=useState<Fields>(initial);
 const [startedAt]=useState(()=>Date.now());
 const [saving,setSaving]=useState(false);
 const [result,setResult]=useState("");
 const [error,setError]=useState("");
 const vatComplete=form.partita_iva.length===11;
 const vatValid=isValidItalianVat(form.partita_iva);
 const update=<K extends keyof Fields>(key:K,value:Fields[K])=>setForm(f=>({...f,[key]:value}));
 const submit=async(e:FormEvent)=>{
  e.preventDefault();setError("");setResult("");setSaving(true);
  try{
   if(!vatValid)throw new Error("Partita IVA non valida: inserisci 11 cifre con codice di controllo corretto.");
   const response=await fetch("/api/aml/richieste-attivazione",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,startedAt})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok||!data.ok)throw new Error(data.error||"Invio non riuscito.");
   setResult(data.message||"Richiesta acquisita.");
  }catch(e){setError(e instanceof Error?e.message:"Errore invio richiesta");}
  finally{setSaving(false);}
 };
 return <>
 <Head><title>Richiedi AML PRO | Studio Manager Pro</title><meta name="robots" content="noindex,follow"/></Head>
 <main className="min-h-screen bg-gradient-to-br from-[#0b2450] via-[#123f7c] to-[#0764b6] px-4 py-8 text-slate-900">
  <div className="mx-auto max-w-2xl">
   <Link href="/login?next=/aml" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-white"><ArrowLeft className="h-4 w-4"/> Torna all'accesso AML</Link>
   <div className="rounded-3xl border border-sky-200 bg-white p-6 shadow-2xl sm:p-9">
    <div className="mb-6 flex items-center gap-3"><ShieldCheck className="h-10 w-10 text-[#f36b15]"/><div><h1 className="text-2xl font-extrabold text-[#102856]">Richiedi AML PRO</h1><p className="text-sm text-slate-500">Attivazione autonoma per studi professionali</p></div></div>
    {result?<div role="status" className="rounded-2xl border border-green-200 bg-green-50 p-5 text-green-800"><div className="flex items-center gap-2 font-semibold"><CheckCircle2/> Richiesta ricevuta</div><p className="mt-2 text-sm">{result}</p><p className="mt-3 text-xs">Non è stato ancora creato un account e non è stato effettuato alcun addebito.</p></div>:
    <form onSubmit={submit} className="space-y-4">
     <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">Compila i dati dello studio. La richiesta viene esaminata prima dell'attivazione della licenza. Non viene creato automaticamente alcun account.</p>
     <label className="block text-sm font-semibold">Studio / denominazione *<input className={input} maxLength={200} required value={form.ragione_sociale} onChange={e=>update("ragione_sociale",e.target.value)}/></label>
     <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-semibold">Partita IVA *<input className={input} type="text" inputMode="numeric" autoComplete="off" maxLength={11} minLength={11} pattern="[0-9]{11}" required aria-invalid={vatComplete&&!vatValid} aria-describedby="aml-vat-status" value={form.partita_iva} onChange={e=>update("partita_iva",e.target.value.replace(/\\D/g,"").slice(0,11))}/><span id="aml-vat-status" aria-live="polite" className={"mt-1 block text-xs "+(vatComplete?(vatValid?"text-green-700":"text-red-700"):"text-slate-500")}>{vatComplete?(vatValid?"Partita IVA formalmente valida":"Partita IVA non valida: controlla le cifre"):"Inserisci esattamente 11 cifre"}</span></label>
      <label className="block text-sm font-semibold">Referente *<input className={input} maxLength={160} minLength={3} required value={form.referente} onChange={e=>update("referente",e.target.value)}/></label>
     </div>
     <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-semibold">Email amministratore *<input className={input} type="email" maxLength={254} required value={form.email} onChange={e=>update("email",e.target.value)}/></label>
      <label className="block text-sm font-semibold">Telefono<input className={input} type="tel" maxLength={40} value={form.telefono} onChange={e=>update("telefono",e.target.value)}/></label>
     </div>
     <label className="block text-sm font-semibold">Piano richiesto *<select className={input} value={form.piano} onChange={e=>update("piano",e.target.value as Fields["piano"])}><option value="starter">Starter — fino a 50 pratiche</option><option value="professional">Professional — fino a 200 pratiche</option><option value="business">Business — fino a 500 pratiche</option></select></label>
     <label className="block text-sm font-semibold">Informazioni aggiuntive (facoltative)<textarea rows={3} maxLength={500} className={input} value={form.note} onChange={e=>update("note",e.target.value)} /></label>
     <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-1" required checked={form.consenso} onChange={e=>update("consenso",e.target.checked)}/><span>Acconsento al trattamento dei dati inseriti per la gestione della richiesta commerciale e dichiaro di aver letto l'informativa privacy. *</span></label>
     <label className="absolute -left-[10000px]" aria-hidden="true">Non compilare<input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={e=>update("website",e.target.value)}/></label>
     {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
     <button type="submit" disabled={saving||!form.consenso||!vatValid} className="w-full rounded-xl bg-[#0765ba] px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving?"Invio richiesta...":"Invia richiesta di attivazione"}</button>
     <p className="text-center text-xs text-slate-500">La richiesta non comporta pagamento, attivazione automatica o accesso al database.</p>
    </form>}
   </div>
  </div>
 </main>
 </>;
}
