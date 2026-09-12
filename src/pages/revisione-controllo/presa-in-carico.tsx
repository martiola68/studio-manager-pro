import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useStudio } from "@/contexts/StudioContext";

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
type Cliente = { id: string; ragione_sociale: string; codice_fiscale?: string | null; partita_iva?: string | null; indirizzo?: string | null; citta?: string | null; provincia?: string | null; cap?: string | null; email?: string | null };

function nomeCliente(c: Cliente) {
  return c.ragione_sociale || "Cliente senza denominazione";
}

export default function PresaInCaricoRevisione() {
  const router = useRouter();
  const { studioId } = useStudio();
  const [step, setStep] = useState(1);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [dataBilancio, setDataBilancio] = useState("");
  const [snapshot, setSnapshot] = useState<any>(null);
  const [preincaricoId, setPreincaricoId] = useState<string | null>(null);
  const [risposte, setRisposte] = useState<Record<string, Riga>>({});
  const [conclusioni, setConclusioni] = useState("");
  const [loadingClienti, setLoadingClienti] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messaggio, setMessaggio] = useState("");
  const [errore, setErrore] = useState("");

  const completate = useMemo(() => domandeStep1.filter(([c]) => !!risposte[c]?.risposta).length, [risposte]);
  const clienteSelezionato = useMemo(() => clienti.find((c) => c.id === clienteId) || null, [clienti, clienteId]);

  useEffect(() => {
    if (!studioId) return;
    void caricaClienti();
  }, [studioId]);

  useEffect(() => {
    if (!studioId || !clienteId) {
      setSnapshot(null);
      return;
    }
    void caricaSnapshot();
  }, [studioId, clienteId]);

  useEffect(() => {
    if (!studioId || !clienteId || !dataBilancio) return;
    void caricaBozzaEsistente();
  }, [studioId, clienteId, dataBilancio]);

  async function caricaClienti() {
    setLoadingClienti(true);
    setErrore("");
    const supabase = getSupabaseClient() as any;
    const { data, error } = await supabase
      .from("tbclienti")
      .select("id,ragione_sociale,codice_fiscale,partita_iva,indirizzo,citta,provincia,cap,email")
      .eq("studio_id", studioId as string)
      .eq("cliente", true)
      .eq("attivo", true)
      .order("ragione_sociale", { ascending: true });
    if (error) setErrore(error.message);
    setClienti((data || []) as Cliente[]);
    setLoadingClienti(false);
  }

  async function caricaSnapshot() {
    setLoadingSnapshot(true);
    setErrore("");
    const supabase = getSupabaseClient() as any;
    const [clienteRes, organiRes] = await Promise.all([
      supabase.from("tbclienti").select("*").eq("id", clienteId).maybeSingle(),
      supabase.from("tbclienti_organi").select("*").eq("cliente_id", clienteId).eq("attivo", true),
    ]);
    if (clienteRes.error) {
      setErrore(clienteRes.error.message);
      setLoadingSnapshot(false);
      return;
    }
    if (organiRes.error) {
      setErrore(organiRes.error.message);
      setLoadingSnapshot(false);
      return;
    }
    const snap = {
      acquisito_il: new Date().toISOString(),
      cliente: clienteRes.data || null,
      organi_sociali: organiRes.data || [],
    };
    setSnapshot(snap);
    setLoadingSnapshot(false);
  }

  async function caricaBozzaEsistente() {
    const supabase = getSupabaseClient() as any;
    const { data, error } = await supabase
      .from("tbrevisione_preincarichi")
      .select("id,step_corrente,note_finali,snapshot_cliente")
      .eq("studio_id", studioId)
      .eq("cliente_id", clienteId)
      .eq("data_bilancio", dataBilancio)
      .maybeSingle();
    if (error) {
      if (!String(error.message || "").includes("tbrevisione_preincarichi")) setErrore(error.message);
      return;
    }
    if (!data?.id) {
      setPreincaricoId(null);
      return;
    }
    setPreincaricoId(data.id);
    setStep(Math.max(1, Math.min(8, Number(data.step_corrente || 1))));
    setConclusioni(data.note_finali || "");
    if (data.snapshot_cliente) setSnapshot(data.snapshot_cliente);

    const { data: q } = await supabase
      .from("tbrevisione_questionari")
      .select("id,conclusioni")
      .eq("preincarico_id", data.id)
      .eq("codice", "VALUTAZIONE_PRELIMINARE")
      .maybeSingle();
    if (!q?.id) return;
    if (q.conclusioni) setConclusioni(q.conclusioni);
    const { data: rr } = await supabase
      .from("tbrevisione_risposte")
      .select("codice_domanda,risposta,specifica")
      .eq("questionario_id", q.id);
    const mappa: Record<string, Riga> = {};
    for (const r of rr || []) mappa[String(r.codice_domanda)] = { risposta: (r.risposta || "") as Risposta, specifica: r.specifica || "" };
    setRisposte(mappa);
    setMessaggio("Bozza esistente caricata.");
  }

  function aggiorna(codice: string, patch: Partial<Riga>) {
    setRisposte((p) => ({ ...p, [codice]: { risposta: p[codice]?.risposta || "", specifica: p[codice]?.specifica || "", ...patch } }));
  }

  async function salvaBozza() {
    if (!studioId || !clienteId || !dataBilancio) {
      setErrore("Seleziona il cliente e indica la data di bilancio prima di salvare.");
      return;
    }
    setSaving(true);
    setErrore("");
    setMessaggio("");
    const supabase = getSupabaseClient() as any;
    const payload = {
      studio_id: studioId,
      cliente_id: clienteId,
      data_bilancio: dataBilancio,
      stato: "in_compilazione",
      step_corrente: step,
      note_finali: conclusioni || null,
      snapshot_cliente: snapshot || {},
      updated_at: new Date().toISOString(),
    };
    const { data: pre, error: preError } = await supabase
      .from("tbrevisione_preincarichi")
      .upsert(payload, { onConflict: "studio_id,cliente_id,data_bilancio" })
      .select("id")
      .single();
    if (preError) {
      setErrore(preError.message);
      setSaving(false);
      return;
    }
    setPreincaricoId(pre.id);

    const { data: q, error: qError } = await supabase
      .from("tbrevisione_questionari")
      .upsert({
        preincarico_id: pre.id,
        codice: "VALUTAZIONE_PRELIMINARE",
        titolo: "Dati del cliente e valutazione preliminare",
        completato: completate === domandeStep1.length,
        conclusioni: conclusioni || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "preincarico_id,codice" })
      .select("id")
      .single();
    if (qError) {
      setErrore(qError.message);
      setSaving(false);
      return;
    }

    await supabase.from("tbrevisione_risposte").delete().eq("questionario_id", q.id);
    const righe = domandeStep1
      .filter(([codice]) => risposte[codice]?.risposta || risposte[codice]?.specifica)
      .map(([codice], ordine) => ({
        questionario_id: q.id,
        codice_domanda: codice,
        risposta: risposte[codice]?.risposta || null,
        specifica: risposte[codice]?.specifica || null,
        ordine: ordine + 1,
        updated_at: new Date().toISOString(),
      }));
    if (righe.length) {
      const { error: rError } = await supabase.from("tbrevisione_risposte").insert(righe);
      if (rError) {
        setErrore(rError.message);
        setSaving(false);
        return;
      }
    }
    setMessaggio("Bozza salvata correttamente.");
    setSaving(false);
  }

  const soci = (snapshot?.organi_sociali || []).filter((o: any) => o.ruolo === "socio");
  const amministratori = (snapshot?.organi_sociali || []).filter((o: any) => ["amministratore_unico","amministratore","presidente_cda","amministratore_delegato","liquidatore"].includes(o.ruolo));
  const controllo = (snapshot?.organi_sociali || []).filter((o: any) => ["sindaco","presidente_collegio_sindacale","revisore"].includes(o.ruolo));

  return <main style={{maxWidth:1280,margin:"0 auto",padding:"28px 24px 60px",fontFamily:"Inter,Arial,sans-serif",color:"#0f172a"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,marginBottom:20}}>
      <div><div style={{fontSize:13,color:"#64748b",fontWeight:700}}>REVISIONE E CONTROLLO</div><h1 style={{margin:"5px 0 4px",fontSize:30}}>Presa in carico dell’incarico di revisione</h1><div style={{color:"#64748b"}}>Procedura guidata di valutazione, accettazione e generazione della pratica.</div></div>
      <button onClick={()=>router.push("/revisione-controllo")} style={secondary}>← Torna a Revisione e Controllo</button>
    </div>

    <section style={card}>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:14}}>
        <Field label="Cliente / società"><select value={clienteId} onChange={e=>{setClienteId(e.target.value);setPreincaricoId(null);setRisposte({});setConclusioni("");setMessaggio("");}} style={input} disabled={loadingClienti}><option value="">{loadingClienti?"Caricamento clienti...":"Seleziona cliente"}</option>{clienti.map(c=><option key={c.id} value={c.id}>{nomeCliente(c)}</option>)}</select></Field>
        <Field label="Bilancio al"><input type="date" value={dataBilancio} onChange={e=>{setDataBilancio(e.target.value);setPreincaricoId(null);}} style={input}/></Field>
        <Field label="Stato"><input value={preincaricoId?"Bozza salvata":"Nuova bozza"} readOnly style={{...input,background:"#f8fafc"}}/></Field>
      </div>
      <div style={{marginTop:14,padding:14,borderRadius:10,background:"#f8fafc",border:"1px solid #cbd5e1",fontSize:13,color:"#475569"}}>{loadingSnapshot?"Acquisizione dati dagli archivi SMP...":clienteSelezionato?<>Snapshot acquisito per <b>{nomeCliente(clienteSelezionato)}</b>: anagrafica e organi sociali vengono congelati nella presa in carico al salvataggio.</>:"Seleziona un cliente per acquisire automaticamente i dati dagli archivi SMP."}</div>
      {snapshot && <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:12}}><Mini label="Soci" value={soci.length}/><Mini label="Amministratori" value={amministratori.length}/><Mini label="Organo di controllo" value={controllo.length}/><Mini label="CF / P.IVA" value={snapshot.cliente?.codice_fiscale || snapshot.cliente?.partita_iva || "—"}/></div>}
      {errore && <div style={{marginTop:12,padding:12,border:"1px solid #ef4444",background:"#fef2f2",borderRadius:8,color:"#b91c1c",fontWeight:700}}>{errore}</div>}
      {messaggio && <div style={{marginTop:12,padding:12,border:"1px solid #86efac",background:"#f0fdf4",borderRadius:8,color:"#166534",fontWeight:700}}>{messaggio}</div>}
    </section>

    <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:7,margin:"18px 0"}}>{steps.map((s,i)=><button key={s} onClick={()=>setStep(i+1)} style={{padding:"11px 8px",borderRadius:9,border:i+1===step?"2px solid #0d6f9f":"1px solid #cbd5e1",background:i+1===step?"#eaf8ff":"#fff",fontWeight:700,fontSize:12,color:i+1===step?"#075985":"#475569",cursor:"pointer"}}><div style={{fontSize:11,marginBottom:4}}>STEP {i+1}</div>{s}</button>)}</div>

    {step===1 ? <section style={card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",gap:16}}><div><h2 style={{margin:0,fontSize:22}}>Step 1 — Dati del cliente e valutazione preliminare</h2><p style={{margin:"7px 0 0",color:"#64748b"}}>Rispondere a ogni quesito con Sì, No o Non applicabile. Le specifiche possono essere estese.</p></div><div style={{fontWeight:800,color:completate===domandeStep1.length?"#15803d":"#0d6f9f"}}>{completate}/{domandeStep1.length}</div></div>
      <div style={{marginTop:18}}>{domandeStep1.map(([codice,testo,help])=>{const r=risposte[codice]||{risposta:"",specifica:""};return <div key={codice} style={{padding:"18px 0",borderTop:"1px solid #e2e8f0"}}><div style={{display:"grid",gridTemplateColumns:"56px 1fr 360px",gap:16,alignItems:"start"}}><div style={{width:42,height:42,borderRadius:10,display:"grid",placeItems:"center",background:"#eaf8ff",fontWeight:900,color:"#075985"}}>{codice}</div><div><div style={{fontWeight:800,lineHeight:1.45}}>{testo}</div><div style={{fontSize:13,color:"#64748b",marginTop:6}}>{help}</div></div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>{[["SI","Sì"],["NO","No"],["NON_APPLICABILE","N/A"]].map(([v,l])=><button key={v} onClick={()=>aggiorna(codice,{risposta:v as Risposta})} style={{height:40,borderRadius:8,border:r.risposta===v?"2px solid #0d6f9f":"1px solid #94a3b8",background:r.risposta===v?"#eaf8ff":"#fff",fontWeight:800,cursor:"pointer"}}>{l}</button>)}</div></div><textarea value={r.specifica} onChange={e=>aggiorna(codice,{specifica:e.target.value})} placeholder="Specifiche / osservazioni / elementi acquisiti..." style={{...input,minHeight:92,resize:"vertical",marginTop:12}}/></div>})}</div>
      <Field label="Conclusioni della valutazione preliminare"><textarea value={conclusioni} onChange={e=>setConclusioni(e.target.value)} placeholder="Riportare le conclusioni della valutazione preliminare..." style={{...input,minHeight:130,resize:"vertical"}}/></Field>
    </section> : <section style={card}><h2 style={{marginTop:0}}>Step {step} — {steps[step-1]}</h2><p style={{color:"#64748b"}}>Modulo predisposto nel workflow. I quesiti del relativo documento saranno inseriti nel blocco dedicato.</p></section>}

    <div style={{display:"flex",justifyContent:"space-between",gap:12,marginTop:18}}><button disabled={step===1} onClick={()=>setStep(s=>Math.max(1,s-1))} style={secondary}>← Step precedente</button><div style={{display:"flex",gap:10}}><button onClick={()=>window.print()} style={secondary}>Stampa</button><button onClick={salvaBozza} disabled={saving} style={secondary}>{saving?"Salvataggio...":"Salva bozza"}</button><button disabled={step===8} onClick={()=>setStep(s=>Math.min(8,s+1))} style={primary}>Prossimo step →</button></div></div>
  </main>;
}

function Field({label,children}:{label:string;children:React.ReactNode}) { return <label style={{display:"block",fontSize:13,fontWeight:800,color:"#334155"}}>{label}<div style={{marginTop:7}}>{children}</div></label>; }
function Mini({label,value}:{label:string;value:React.ReactNode}) { return <div style={{border:"1px solid #cbd5e1",borderRadius:9,padding:"10px 12px",background:"#fff"}}><div style={{fontSize:11,fontWeight:800,color:"#64748b",textTransform:"uppercase"}}>{label}</div><div style={{fontSize:18,fontWeight:900,marginTop:3}}>{value}</div></div>; }
const card:React.CSSProperties={background:"#fff",border:"1px solid #8cddff",borderRadius:12,padding:22,boxShadow:"0 12px 30px rgba(14,78,112,0.10)"};
const input:React.CSSProperties={width:"100%",boxSizing:"border-box",border:"1px solid #94a3b8",borderRadius:8,padding:"10px 12px",fontSize:14,background:"#fff",color:"#0f172a"};
const primary:React.CSSProperties={border:0,borderRadius:9,padding:"11px 18px",background:"linear-gradient(110deg,#0b4f7d,#0d6f9f 58%,#1688b7)",color:"white",fontWeight:800,cursor:"pointer"};
const secondary:React.CSSProperties={border:"1px solid #94a3b8",borderRadius:9,padding:"10px 16px",background:"#fff",color:"#334155",fontWeight:800,cursor:"pointer"};
