import { useMemo, useState } from "react";
import { useRouter } from "next/router";

const steps = [
  "Dati e valutazione preliminare",
  "Accettazione incarico",
  "Indipendenza",
  "Antiriciclaggio",
  "Attestazione indipendenza",
  "Trasparenza",
  "Proposta incarico",
  "Accettazione finale",
];

const domandeStep1 = [
  ["3.1", "Il capitale sociale è interamente versato?", "Indicare eventuali limitazioni o contributi di capitale ancora in sospeso."],
  ["9", "La fonte della segnalazione o del contatto iniziale con il cliente è stata documentata e valutata per eventuali rischi potenziali?", "Specificare la fonte del contatto e gli elementi valutati."],
  ["10", "Se si tratta di un nuovo cliente che sostituisce un revisore o un organo di controllo precedente, la motivazione del cambio è stata chiaramente documentata?", "Annotare le motivazioni del cambio e le eventuali criticità emerse."],
  ["11", "I tempi richiesti per l’esecuzione dell’incarico sono stati verificati come compatibili con le risorse disponibili?", "Indicare eventuali vincoli di tempo o di risorse."],
  ["12", "Le discussioni preliminari con il cliente hanno chiarito l’ambito dei servizi attesi?", "Specificare richieste particolari, limitazioni o aspetti da chiarire."],
  ["13", "Esistono circostanze o fattori di rischio che suggeriscono che l’incarico potrebbe presentare sfide significative, rischi significativi o aree che richiedono competenze specialistiche?", "Descrivere rischi, complessità o competenze specialistiche necessarie."],
  ["14", "Vi sono circostanze in cui lo svolgimento dell’incarico potrebbe comportare violazioni dei requisiti etici, incluso il mancato rispetto dell’indipendenza, o danneggiare la reputazione del professionista?", "Descrivere le circostanze e le misure di salvaguardia."],
  ["15", "Il quadro normativo di riferimento per la redazione del bilancio è adeguato, considerando la natura e lo scopo del bilancio?", "Specificare il quadro normativo applicabile."],
  ["16", "La direzione ha riconosciuto e accettato le proprie responsabilità per la redazione del bilancio, il controllo interno e l’accesso alle informazioni necessarie?", "Indicare come è stato ottenuto il riconoscimento della direzione."],
  ["17", "Tutte le eventuali limitazioni all’ambito dell’incarico, imposte dalla direzione o dai responsabili della governance, sono state risolte?", "Descrivere le limitazioni e la relativa soluzione."],
  ["18", "Sono stati considerati i rischi specifici del settore, la struttura di governance, l’appartenenza a gruppi societari e il quadro normativo e di rendicontazione applicabile?", "Riportare gli aspetti rilevanti emersi dall’analisi."],
  ["19", "I termini dell’incarico sono stati chiaramente definiti, garantendo l’allineamento con i requisiti dell’ISA 210 e una comprensione reciproca dell’ambito e degli obiettivi dell’incarico?", "Specificare eventuali condizioni particolari dell’incarico."],
  ["20", "Gli utilizzatori previsti del bilancio sono stati identificati e le loro esigenze valutate?", "Indicare i principali utilizzatori previsti e le relative esigenze."],
] as const;

type Risposta = "" | "SI" | "NO" | "NON_APPLICABILE";
type Riga = { risposta: Risposta; specifica: string };

export default function PresaInCaricoRevisione() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [risposte, setRisposte] = useState<Record<string, Riga>>({});
  const [conclusioni, setConclusioni] = useState("");
  const completate = useMemo(() => domandeStep1.filter(([c]) => !!risposte[c]?.risposta).length, [risposte]);

  function aggiorna(codice: string, patch: Partial<Riga>) {
    setRisposte((p) => ({ ...p, [codice]: { risposta: p[codice]?.risposta || "", specifica: p[codice]?.specifica || "", ...patch } }));
  }

  return <main style={{maxWidth:1280,margin:"0 auto",padding:"28px 24px 60px",fontFamily:"Inter,Arial,sans-serif",color:"#0f172a"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,marginBottom:20}}>
      <div><div style={{fontSize:13,color:"#64748b",fontWeight:700}}>REVISIONE E CONTROLLO</div><h1 style={{margin:"5px 0 4px",fontSize:30}}>Presa in carico dell’incarico di revisione</h1><div style={{color:"#64748b"}}>Procedura guidata di valutazione, accettazione e generazione della pratica.</div></div>
      <button onClick={()=>router.push("/revisione-controllo")} style={secondary}>← Torna a Revisione e Controllo</button>
    </div>

    <section style={card}>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:14}}>
        <Field label="Cliente / società"><select style={input}><option>Seleziona cliente</option></select></Field>
        <Field label="Bilancio al"><input type="date" style={input}/></Field>
        <Field label="Stato"><input value="Bozza" readOnly style={{...input,background:"#f8fafc"}}/></Field>
      </div>
      <div style={{marginTop:14,padding:14,borderRadius:10,background:"#f8fafc",border:"1px solid #cbd5e1",fontSize:13,color:"#475569"}}>I dati anagrafici, soci, governance, organi di controllo, gruppi societari e titolare effettivo saranno acquisiti dagli archivi SMP e congelati nello snapshot della presa in carico.</div>
    </section>

    <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:7,margin:"18px 0"}}>{steps.map((s,i)=><button key={s} onClick={()=>setStep(i+1)} style={{padding:"11px 8px",borderRadius:9,border:i+1===step?"2px solid #0d6f9f":"1px solid #cbd5e1",background:i+1===step?"#eaf8ff":"#fff",fontWeight:700,fontSize:12,color:i+1===step?"#075985":"#475569",cursor:"pointer"}}><div style={{fontSize:11,marginBottom:4}}>STEP {i+1}</div>{s}</button>)}</div>

    {step===1 ? <section style={card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",gap:16}}><div><h2 style={{margin:0,fontSize:22}}>Step 1 — Dati del cliente e valutazione preliminare</h2><p style={{margin:"7px 0 0",color:"#64748b"}}>Rispondere a ogni quesito con Sì, No o Non applicabile. Le specifiche possono essere estese.</p></div><div style={{fontWeight:800,color:completate===domandeStep1.length?"#15803d":"#0d6f9f"}}>{completate}/{domandeStep1.length}</div></div>
      <div style={{marginTop:18}}>{domandeStep1.map(([codice,testo,help])=>{const r=risposte[codice]||{risposta:"",specifica:""};return <div key={codice} style={{padding:"18px 0",borderTop:"1px solid #e2e8f0"}}><div style={{display:"grid",gridTemplateColumns:"56px 1fr 360px",gap:16,alignItems:"start"}}><div style={{width:42,height:42,borderRadius:10,display:"grid",placeItems:"center",background:"#eaf8ff",fontWeight:900,color:"#075985"}}>{codice}</div><div><div style={{fontWeight:800,lineHeight:1.45}}>{testo}</div><div style={{fontSize:13,color:"#64748b",marginTop:6}}>{help}</div></div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>{[["SI","Sì"],["NO","No"],["NON_APPLICABILE","N/A"]].map(([v,l])=><button key={v} onClick={()=>aggiorna(codice,{risposta:v as Risposta})} style={{height:40,borderRadius:8,border:r.risposta===v?"2px solid #0d6f9f":"1px solid #94a3b8",background:r.risposta===v?"#eaf8ff":"#fff",fontWeight:800,cursor:"pointer"}}>{l}</button>)}</div></div><textarea value={r.specifica} onChange={e=>aggiorna(codice,{specifica:e.target.value})} placeholder="Specifiche / osservazioni / elementi acquisiti..." style={{...input,minHeight:92,resize:"vertical",marginTop:12}}/></div>})}</div>
      <Field label="Conclusioni della valutazione preliminare"><textarea value={conclusioni} onChange={e=>setConclusioni(e.target.value)} placeholder="Riportare le conclusioni della valutazione preliminare..." style={{...input,minHeight:130,resize:"vertical"}}/></Field>
    </section> : <section style={card}><h2 style={{marginTop:0}}>Step {step} — {steps[step-1]}</h2><p style={{color:"#64748b"}}>Modulo predisposto nel workflow. I quesiti del relativo documento saranno inseriti integralmente nel prossimo blocco di implementazione.</p></section>}

    <div style={{display:"flex",justifyContent:"space-between",gap:12,marginTop:18}}><button disabled={step===1} onClick={()=>setStep(s=>Math.max(1,s-1))} style={secondary}>← Step precedente</button><div style={{display:"flex",gap:10}}><button onClick={()=>window.print()} style={secondary}>Stampa</button><button style={secondary}>Salva bozza</button><button disabled={step===8} onClick={()=>setStep(s=>Math.min(8,s+1))} style={primary}>Prossimo step →</button></div></div>
  </main>;
}

function Field({label,children}:{label:string;children:React.ReactNode}) { return <label style={{display:"block",fontSize:13,fontWeight:800,color:"#334155"}}>{label}<div style={{marginTop:7}}>{children}</div></label>; }
const card:React.CSSProperties={background:"#fff",border:"1px solid #8cddff",borderRadius:12,padding:22,boxShadow:"0 12px 30px rgba(14,78,112,0.10)"};
const input:React.CSSProperties={width:"100%",boxSizing:"border-box",border:"1px solid #94a3b8",borderRadius:8,padding:"10px 12px",fontSize:14,background:"#fff",color:"#0f172a"};
const primary:React.CSSProperties={border:0,borderRadius:9,padding:"11px 18px",background:"linear-gradient(110deg,#0b4f7d,#0d6f9f 58%,#1688b7)",color:"white",fontWeight:800,cursor:"pointer"};
const secondary:React.CSSProperties={border:"1px solid #94a3b8",borderRadius:9,padding:"10px 16px",background:"#fff",color:"#334155",fontWeight:800,cursor:"pointer"};
