import React from "react";
import Head from "next/head";
import { ArrowLeft, Boxes, Calculator, BookOpen, FileText, RefreshCcw, Settings, ShieldCheck } from "lucide-react";

const sections=[
["1. Accesso ad AmmortaPro","Dal menu principale selezionare AmmortaPro. Il modulo gestisce cespiti e ammortamenti per le sole società abilitate al servizio Ammortamenti."],
["2. Categorie cespiti","Il catalogo comprende immobilizzazioni materiali e immateriali con aliquote civilistiche, fiscali e deducibilità. La modifica del catalogo è riservata all'Amministratore generale di sistema."],
["3. Anagrafica cespiti","Con Nuovo cespite si registrano società, categoria, numero progressivo, quantità, descrizione, matricola, date, costo originario, fondi iniziali, ubicazione, fornitore e documento."],
["4. Parametri personalizzati","Aliquota civilistica, aliquota fiscale, deducibilità e durata possono essere personalizzate sul singolo cespite. Per beni a durata contrattuale la durata consente di determinare la quota in funzione degli anni indicati."],
["5. Variazioni cespiti","Registra incrementi, decrementi, rivalutazioni, svalutazioni, cessioni e dismissioni mantenendo lo storico del bene."],
["6. Calcolo ammortamenti","Selezionare società ed esercizio e avviare Simula. AmmortaPro mantiene separati calcolo civilistico e fiscale, fondi e valori residui e impedisce l'ammortamento oltre il valore ammortizzabile."],
["7. Conferma e chiusura","Dopo il controllo, il calcolo può essere reso definitivo e l'esercizio chiuso. La storicizzazione conserva i parametri utilizzati nell'anno."],
["8. Registro cespiti","Il Registro cespiti ricostruisce per esercizio costo, quote, fondi e residui sulla base degli ammortamenti definitivi."],
["9. Scritture contabili","La funzione genera il fac-simile delle scritture di ammortamento utilizzando i conti configurati nelle categorie. I dati vanno verificati prima dell'utilizzo contabile."],
];

export default function ManualeAmmortaPro(){
 return <><Head><title>Manuale AmmortaPro | Studio Manager Pro</title></Head>
 <main className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white">
  <article className="mx-auto max-w-5xl overflow-hidden rounded-2xl bg-white shadow-sm print:shadow-none">
   <header className="border-b px-8 py-10 text-center">
    <div className="text-xs font-bold tracking-wide text-slate-600">STUDIO MANAGER PRO | MANUALE OPERATIVO</div>
    <h1 className="mt-3 text-4xl font-extrabold text-slate-900">AMMORTAPRO</h1>
    <p className="mt-2 text-lg text-blue-600">Cespiti e Ammortamenti</p>
    <p className="mx-auto mt-4 max-w-3xl text-sm leading-6 text-slate-600">Guida operativa completa alla gestione civilistica e fiscale dei cespiti integrata in Studio Manager Pro.</p>
   </header>
   <div className="px-8 py-8">
    <div className="grid gap-3 md:grid-cols-4">
     {[["Categorie",Settings],["Cespiti",Boxes],["Ammortamenti",Calculator],["Registro e scritture",BookOpen]].map(([t,I]:any)=><div key={t} className="rounded-xl border p-4 text-center"><I className="mx-auto mb-2 h-6 w-6 text-blue-600"/><b className="text-sm">{t}</b></div>)}
    </div>
    <section className="mt-8 rounded-xl bg-blue-50 p-5 text-sm leading-6 text-slate-700"><b className="text-blue-700">Flusso operativo:</b> abilita il servizio Ammortamenti sulla società → verifica le categorie → registra il cespite → registra eventuali variazioni → simula e conferma gli ammortamenti → consulta il registro → genera le scritture contabili.</section>
    <div className="mt-8 space-y-5">
     {sections.map(([h,p],i)=><section key={h} className="rounded-xl border border-slate-200 p-6">
       <h2 className="text-xl font-bold text-slate-900">{h}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{p}</p>
       {i===1&&<div className="mt-4 flex items-start gap-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-900"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0"/><span>Gli utenti degli studi possono utilizzare le categorie ma non crearle, modificarle o eliminarle. La protezione è applicata anche a livello database.</span></div>}
     </section>)}
    </div>
    <section className="mt-8 rounded-xl border p-6"><h2 className="text-xl font-bold">Controlli consigliati</h2><p className="mt-2 text-sm leading-6 text-slate-600">Verificare sempre società, esercizio, data di entrata in funzione, costo, fondi iniziali e parametri fiscali applicabili al caso concreto. Le personalizzazioni del singolo cespite prevalgono sui valori standard della categoria.</p></section>
   </div>
  </article>
 </main></>
}