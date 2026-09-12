import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useStudio } from "@/contexts/StudioContext";
import { domandeStep3 } from "@/lib/revisione/revisione-step3-data";
import { domandeStep4 } from "@/lib/revisione/revisione-step4-antiriciclaggio";

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

const domandeStep2 = [
  ["1", "Integrità dell’entità e considerazioni etiche", "È stata effettuata una valutazione della struttura proprietaria, degli organi di gestione e del sistema di governance dell’entità in relazione a potenziali criticità di integrità e reputazionali?", "Annotare fonti consultate, segnali d’allarme, conflitti di interesse, precedenti violazioni o pressioni non etiche."],
  ["2", "Integrità dell’entità e considerazioni etiche", "Vi è assenza di indicazioni di comportamenti non etici, violazioni normative o problematiche reputazionali che potrebbero compromettere l’associazione del revisore con l’entità?", "Riportare eventuali casi di frode, corruzione, contenziosi o violazioni normative e la relativa valutazione."],
  ["3", "Integrità dell’entità e considerazioni etiche", "La direzione ha dimostrato un impegno verso prassi etiche e una rendicontazione finanziaria trasparente all’interno dell’entità?", "Valutare il tone at the top, la collaborazione con il revisore e la risposta ai precedenti rilievi."],
  ["4", "Integrità dell’entità e considerazioni etiche", "Esistono relazioni con parti correlate, stakeholder o terze parti che potrebbero rappresentare rischi significativi per l’integrità della rendicontazione finanziaria dell’entità?", "Specificare le relazioni significative e il loro possibile impatto sulla rendicontazione."],
  ["5", "Integrità dell’entità e considerazioni etiche", "Sono state adeguatamente valutate e risolte tutte le criticità sollevate dai precedenti revisori o da altre parti esterne in relazione all’entità?", "Descrivere criticità, comunicazioni ricevute e modalità di risoluzione."],
  ["6", "Comunicazione con i precedenti revisori e valutazione preliminare", "Sono state richieste ai precedenti revisori le informazioni necessarie per la valutazione dell’accettazione dell’incarico?", "Indicare data, modalità e contenuto delle comunicazioni effettuate."],
  ["7", "Comunicazione con i precedenti revisori e valutazione preliminare", "Le eventuali criticità segnalate dai precedenti revisori, incluse controversie o limitazioni al lavoro, sono state adeguatamente analizzate e risolte?", "Descrivere le criticità emerse e indicare se residuano rischi per l’accettazione."],
  ["8", "Comunicazione con i precedenti revisori e valutazione preliminare", "Dalle comunicazioni con i precedenti revisori emergono elementi critici relativi alla governance, alla collaborazione della direzione o alle prassi di rendicontazione finanziaria?", "Riportare gli elementi emersi e valutarne l’impatto sullo svolgimento dell’incarico."],
  ["9", "Comunicazione con i precedenti revisori e valutazione preliminare", "I precedenti revisori hanno segnalato problematiche di indipendenza o altri aspetti professionali rilevanti per l’accettazione dell’incarico?", "Descrivere eventuali problematiche e il loro impatto sull’accettazione o sul rifiuto dell’incarico."],
  ["10", "Valutazione delle competenze specifiche richieste per l’incarico", "Si è acquisita una comprensione sufficiente delle attività dell’entità, del settore e del contesto per identificare i rischi di errori significativi?", "Indicare eventuali lacune conoscitive o approfondimenti ancora necessari."],
  ["11", "Valutazione delle competenze specifiche richieste per l’incarico", "È stata acquisita un’adeguata comprensione dei principi contabili e delle prassi dell’entità, con particolare riferimento alle aree che richiedono stime e valutazioni significative?", "Specificare aree con stime, valutazioni o trattamenti contabili particolarmente rilevanti."],
  ["12", "Valutazione delle competenze specifiche richieste per l’incarico", "L’incarico richiede competenze specialistiche o conoscenze tecniche ulteriori rispetto a quelle già disponibili?", "Indicare specialisti, esperti o formazione specifica eventualmente necessari."],
  ["13", "Verifica dei requisiti preliminari", "Sono state confermate le condizioni preliminari per la revisione, incluso il riconoscimento da parte della direzione delle proprie responsabilità?", "Documentare il riconoscimento delle responsabilità della direzione e l’accesso alle informazioni rilevanti."],
  ["14", "Verifica dei requisiti preliminari", "Il quadro normativo sull’informazione finanziaria applicato dall’entità è appropriato e accettabile rispetto ai destinatari del bilancio?", "Specificare il quadro normativo applicabile e le ragioni della sua adeguatezza."],
  ["15", "Verifica dei requisiti preliminari", "Sussiste una ragionevole aspettativa di assenza di limitazioni allo svolgimento delle procedure di revisione da parte dell’entità?", "Descrivere eventuali restrizioni all’accesso a documentazione, personale o informazioni chiave."],
] as const;

type Risposta = "" | "SI" | "NO" | "NON_APPLICABILE";
type Riga = { risposta: Risposta; specifica: string };
type Cliente = { id: string; ragione_sociale: string; codice_fiscale?: string | null; partita_iva?: string | null; indirizzo?: string | null; citta?: string | null; provincia?: string | null; cap?: string | null; email?: string | null };

function nomeCliente(c: Cliente) { return c.ragione_sociale || "Cliente senza denominazione"; }

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
  const [risposteStep2, setRisposteStep2] = useState<Record<string, Riga>>({});
  const [conclusioniStep2, setConclusioniStep2] = useState("");
  const [rischioIncarico, setRischioIncarico] = useState("");
  const [dataAccettazioneStep2, setDataAccettazioneStep2] = useState("");
  const [risposteStep3, setRisposteStep3] = useState<Record<string, Riga>>({});
  const [conclusioniStep3, setConclusioniStep3] = useState("");
  const [rischioIndipendenza, setRischioIndipendenza] = useState("");
  const [esitoIndipendenza, setEsitoIndipendenza] = useState("");
  const [misureSalvaguardia, setMisureSalvaguardia] = useState("");
  const [compensoS, setCompensoS] = useState("");
  const [compensoC, setCompensoC] = useState("");
  const [compensoCT, setCompensoCT] = useState("");
  const [risposteStep4, setRisposteStep4] = useState<Record<string, Riga>>({});
  const [conclusioniStep4, setConclusioniStep4] = useState("");
  const [rischioRiciclaggio, setRischioRiciclaggio] = useState("");
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [scoreC, setScoreC] = useState("");
  const [scoreD, setScoreD] = useState("");
  const [dataAttestazione, setDataAttestazione] = useState("");
  const [firmatarioAttestazione, setFirmatarioAttestazione] = useState("");
  const [attestazioneConfermata, setAttestazioneConfermata] = useState(false);
  const [loadingClienti, setLoadingClienti] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messaggio, setMessaggio] = useState("");
  const [errore, setErrore] = useState("");

  const completate = useMemo(() => domandeStep1.filter(([c]) => !!risposte[c]?.risposta).length, [risposte]);
  const completateStep2 = useMemo(() => domandeStep2.filter(([c]) => !!risposteStep2[c]?.risposta).length, [risposteStep2]);
  const completateStep3 = useMemo(() => domandeStep3.filter(([c]) => !!risposteStep3[c]?.risposta).length, [risposteStep3]);
  const completateStep4 = useMemo(() => domandeStep4.filter(([c]) => !!risposteStep4[c]?.risposta).length, [risposteStep4]);
  const clienteSelezionato = useMemo(() => clienti.find((c) => c.id === clienteId) || null, [clienti, clienteId]);
  const rapportoSCCT = useMemo(() => { const s = numero(compensoS), c = numero(compensoC), ct = numero(compensoCT); return ct > 0 ? ((s + c) / ct) * 100 : 0; }, [compensoS, compensoC, compensoCT]);
  const rapportoSsuSC = useMemo(() => { const s = numero(compensoS), c = numero(compensoC); return s + c > 0 ? s / (s + c) : 0; }, [compensoS, compensoC]);

  useEffect(() => { if (studioId) void caricaClienti(); }, [studioId]);
  useEffect(() => { if (!studioId || !clienteId) { setSnapshot(null); return; } void caricaSnapshot(); }, [studioId, clienteId]);
  useEffect(() => { if (studioId && clienteId && dataBilancio) void caricaBozzaEsistente(); }, [studioId, clienteId, dataBilancio]);

  async function caricaClienti() {
    setLoadingClienti(true); setErrore("");
    const supabase = getSupabaseClient() as any;
    const { data, error } = await supabase.from("tbclienti").select("id,ragione_sociale,codice_fiscale,partita_iva,indirizzo,citta,provincia,cap,email").eq("studio_id", studioId as string).eq("attivo", true).order("ragione_sociale", { ascending: true });
    if (error) setErrore(error.message); setClienti((data || []) as Cliente[]); setLoadingClienti(false);
  }

  async function caricaSnapshot() {
    setLoadingSnapshot(true); setErrore("");
    const supabase = getSupabaseClient() as any;
    const [clienteRes, organiRes] = await Promise.all([supabase.from("tbclienti").select("*").eq("id", clienteId).maybeSingle(), supabase.from("tbclienti_organi").select("*").eq("cliente_id", clienteId).eq("attivo", true)]);
    if (clienteRes.error) { setErrore(clienteRes.error.message); setLoadingSnapshot(false); return; }
    if (organiRes.error) { setErrore(organiRes.error.message); setLoadingSnapshot(false); return; }
    setSnapshot({ acquisito_il: new Date().toISOString(), cliente: clienteRes.data || null, organi_sociali: organiRes.data || [] }); setLoadingSnapshot(false);
  }

  async function caricaBozzaEsistente() {
    const supabase = getSupabaseClient() as any;
    const { data, error } = await supabase.from("tbrevisione_preincarichi").select("id,step_corrente,snapshot_cliente").eq("studio_id", studioId).eq("cliente_id", clienteId).eq("data_bilancio", dataBilancio).maybeSingle();
    if (error) { setErrore(error.message); return; }
    if (!data?.id) { setPreincaricoId(null); return; }
    setPreincaricoId(data.id); setStep(Math.max(1, Math.min(8, Number(data.step_corrente || 1)))); if (data.snapshot_cliente) setSnapshot(data.snapshot_cliente);

    const { data: questionari, error: qError } = await supabase.from("tbrevisione_questionari").select("id,codice,conclusioni,esito").eq("preincarico_id", data.id).in("codice", ["VALUTAZIONE_PRELIMINARE", "ACCETTAZIONE_INCARICO", "VALUTAZIONE_INDIPENDENZA", "RISCHIO_RICICLAGGIO"]);
    if (qError) { setErrore(qError.message); return; }
    for (const q of questionari || []) {
      const { data: rr, error: rError } = await supabase.from("tbrevisione_risposte").select("codice_domanda,risposta,specifica").eq("questionario_id", q.id);
      if (rError) { setErrore(rError.message); return; }
      const mappa: Record<string, Riga> = {};
      for (const r of rr || []) {
        const codice = String(r.codice_domanda);
        if (q.codice === "ACCETTAZIONE_INCARICO" && codice === "16") { setDataAccettazioneStep2(r.specifica || ""); continue; }
        if (q.codice === "VALUTAZIONE_INDIPENDENZA") {
          if (codice === "FEE_S") { setCompensoS(r.specifica || ""); continue; }
          if (codice === "FEE_C") { setCompensoC(r.specifica || ""); continue; }
          if (codice === "FEE_CT") { setCompensoCT(r.specifica || ""); continue; }
          if (codice === "SALVAGUARDIE") { setMisureSalvaguardia(r.specifica || ""); continue; }
          if (codice === "ESITO") { setEsitoIndipendenza(r.specifica || ""); continue; }
        }
        if (q.codice === "RISCHIO_RICICLAGGIO") {
          if (codice === "SCORE_A") { setScoreA(r.specifica || ""); continue; }
          if (codice === "SCORE_B") { setScoreB(r.specifica || ""); continue; }
          if (codice === "SCORE_C") { setScoreC(r.specifica || ""); continue; }
          if (codice === "SCORE_D") { setScoreD(r.specifica || ""); continue; }
        }
        mappa[codice] = { risposta: (r.risposta || "") as Risposta, specifica: r.specifica || "" };
      }
      if (q.codice === "VALUTAZIONE_PRELIMINARE") { setRisposte(mappa); setConclusioni(q.conclusioni || ""); }
      else if (q.codice === "ACCETTAZIONE_INCARICO") { setRisposteStep2(mappa); setConclusioniStep2(q.conclusioni || ""); setRischioIncarico(q.esito || ""); }
      else if (q.codice === "VALUTAZIONE_INDIPENDENZA") { setRisposteStep3(mappa); setConclusioniStep3(q.conclusioni || ""); setRischioIndipendenza(q.esito || ""); }
      else if (q.codice === "RISCHIO_RICICLAGGIO") { setRisposteStep4(mappa); setConclusioniStep4(q.conclusioni || ""); setRischioRiciclaggio(q.esito || ""); }
    }

    const { data: attestazione, error: dError } = await supabase.from("tbrevisione_preincarico_documenti").select("contenuto,stato").eq("preincarico_id", data.id).eq("tipo", "ATTESTAZIONE_INDIPENDENZA").maybeSingle();
    if (dError) { setErrore(dError.message); return; }
    if (attestazione?.contenuto) {
      const contenuto = attestazione.contenuto as any;
      setDataAttestazione(contenuto.data || ""); setFirmatarioAttestazione(contenuto.firmatario || ""); setAttestazioneConfermata(Boolean(contenuto.confermato));
    }
    setMessaggio("Bozza esistente caricata.");
  }

  function aggiorna(codice: string, patch: Partial<Riga>) { setRisposte((p) => ({ ...p, [codice]: rigaAggiornata(p[codice], patch) })); }
  function aggiornaStep2(codice: string, patch: Partial<Riga>) { setRisposteStep2((p) => ({ ...p, [codice]: rigaAggiornata(p[codice], patch) })); }
  function aggiornaStep3(codice: string, patch: Partial<Riga>) { setRisposteStep3((p) => ({ ...p, [codice]: rigaAggiornata(p[codice], patch) })); }
  function aggiornaStep4(codice: string, patch: Partial<Riga>) { setRisposteStep4((p) => ({ ...p, [codice]: rigaAggiornata(p[codice], patch) })); }

  async function salvaBozza() {
    if (!studioId || !clienteId || !dataBilancio) { setErrore("Seleziona il cliente e indica la data di bilancio prima di salvare."); return; }
    setSaving(true); setErrore(""); setMessaggio("");
    const supabase = getSupabaseClient() as any;
    const { data: pre, error: preError } = await supabase.from("tbrevisione_preincarichi").upsert({ studio_id: studioId, cliente_id: clienteId, data_bilancio: dataBilancio, stato: "in_compilazione", step_corrente: step, snapshot_cliente: snapshot || {}, updated_at: new Date().toISOString() }, { onConflict: "studio_id,cliente_id,data_bilancio" }).select("id").single();
    if (preError) { setErrore(preError.message); setSaving(false); return; }
    setPreincaricoId(pre.id);

    let ok = true;
    if (step === 1) ok = await salvaQuestionario({ supabase, preincaricoId: pre.id, codice: "VALUTAZIONE_PRELIMINARE", titolo: "Dati del cliente e valutazione preliminare", domande: domandeStep1.map(([codice]) => codice), risposte, conclusioni, esito: null, completato: completate === domandeStep1.length });
    else if (step === 2) ok = await salvaQuestionario({ supabase, preincaricoId: pre.id, codice: "ACCETTAZIONE_INCARICO", titolo: "Questionario accettazione incarico", domande: domandeStep2.map(([codice]) => codice), risposte: risposteStep2, conclusioni: conclusioniStep2, esito: rischioIncarico || null, completato: completateStep2 === domandeStep2.length && !!rischioIncarico, dataAccettazione: dataAccettazioneStep2 });
    else if (step === 3) ok = await salvaQuestionario({ supabase, preincaricoId: pre.id, codice: "VALUTAZIONE_INDIPENDENZA", titolo: "Questionario valutazione indipendenza", domande: domandeStep3.map(([codice]) => codice), risposte: risposteStep3, conclusioni: conclusioniStep3, esito: rischioIndipendenza || null, completato: completateStep3 === domandeStep3.length && !!rischioIndipendenza && !!esitoIndipendenza, extraRighe: [{ codice: "SALVAGUARDIE", specifica: misureSalvaguardia }, { codice: "ESITO", specifica: esitoIndipendenza }, { codice: "FEE_S", specifica: compensoS }, { codice: "FEE_C", specifica: compensoC }, { codice: "FEE_CT", specifica: compensoCT }] });
    else if (step === 4) ok = await salvaQuestionario({ supabase, preincaricoId: pre.id, codice: "RISCHIO_RICICLAGGIO", titolo: "Valutazione rischio riciclaggio", domande: domandeStep4.map(([codice]) => codice), risposte: risposteStep4, conclusioni: conclusioniStep4, esito: rischioRiciclaggio || null, completato: completateStep4 === domandeStep4.length && !!rischioRiciclaggio && !!scoreA && !!scoreB && !!scoreC && !!scoreD, extraRighe: [{ codice: "SCORE_A", specifica: scoreA }, { codice: "SCORE_B", specifica: scoreB }, { codice: "SCORE_C", specifica: scoreC }, { codice: "SCORE_D", specifica: scoreD }] });
    else if (step === 5) ok = await salvaDocumentoPreincarico({ supabase, preincaricoId: pre.id, tipo: "ATTESTAZIONE_INDIPENDENZA", stato: attestazioneConfermata ? "confermato" : "bozza", contenuto: { data: dataAttestazione, firmatario: firmatarioAttestazione, confermato: attestazioneConfermata, riferimenti: ["Art. 10 Decreto Legislativo 27 gennaio 2010, n. 39", "ISQC Italia 1 e ISA Italia n. 200 e n. 220", "Codice Italiano di Etica e Indipendenza", "Titolo I, art. 9 Codice deontologico dei Dottori Commercialisti e degli Esperti Contabili", "Direttive e procedure in materia di indipendenza contenute nel manuale di controllo della qualità adottato"] } });

    if (!ok) return; setMessaggio(`Step ${step} salvato correttamente.`); setSaving(false);
  }

  async function salvaQuestionario(args: { supabase: any; preincaricoId: string; codice: string; titolo: string; domande: readonly string[]; risposte: Record<string, Riga>; conclusioni: string; esito: string | null; completato: boolean; dataAccettazione?: string; extraRighe?: Array<{ codice: string; specifica: string }> }) {
    const { data: q, error: qError } = await args.supabase.from("tbrevisione_questionari").upsert({ studio_id: studioId, preincarico_id: args.preincaricoId, codice: args.codice, titolo: args.titolo, versione: 1, completato: args.completato, conclusioni: args.conclusioni || null, esito: args.esito, updated_at: new Date().toISOString() }, { onConflict: "preincarico_id,codice" }).select("id").single();
    if (qError) { setErrore(qError.message); setSaving(false); return false; }
    const { error: deleteError } = await args.supabase.from("tbrevisione_risposte").delete().eq("questionario_id", q.id); if (deleteError) { setErrore(deleteError.message); setSaving(false); return false; }
    const righe: any[] = args.domande.filter((codice) => args.risposte[codice]?.risposta || args.risposte[codice]?.specifica).map((codice, ordine) => ({ studio_id: studioId, questionario_id: q.id, codice_domanda: codice, risposta: args.risposte[codice]?.risposta || null, specifica: args.risposte[codice]?.specifica || null, ordine: ordine + 1, updated_at: new Date().toISOString() }));
    if (args.dataAccettazione) righe.push({ studio_id: studioId, questionario_id: q.id, codice_domanda: "16", risposta: null, specifica: args.dataAccettazione, ordine: 16, updated_at: new Date().toISOString() });
    for (const extra of args.extraRighe || []) if (extra.specifica) righe.push({ studio_id: studioId, questionario_id: q.id, codice_domanda: extra.codice, risposta: null, specifica: extra.specifica, ordine: righe.length + 1, updated_at: new Date().toISOString() });
    if (righe.length) { const { error: rError } = await args.supabase.from("tbrevisione_risposte").insert(righe); if (rError) { setErrore(rError.message); setSaving(false); return false; } }
    return true;
  }

  async function salvaDocumentoPreincarico(args: { supabase: any; preincaricoId: string; tipo: string; stato: "bozza" | "completato" | "confermato" | "generato"; contenuto: Record<string, any> }) {
    const { error } = await args.supabase.from("tbrevisione_preincarico_documenti").upsert({ studio_id: studioId, preincarico_id: args.preincaricoId, tipo: args.tipo, versione: 1, stato: args.stato, contenuto: args.contenuto, confermato_at: args.stato === "confermato" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }, { onConflict: "preincarico_id,tipo" });
    if (error) { setErrore(error.message); setSaving(false); return false; }
    return true;
  }

  const soci = (snapshot?.organi_sociali || []).filter((o: any) => o.ruolo === "socio");
  const amministratori = (snapshot?.organi_sociali || []).filter((o: any) => ["amministratore_unico", "amministratore", "presidente_cda", "amministratore_delegato", "liquidatore"].includes(o.ruolo));
  const controllo = (snapshot?.organi_sociali || []).filter((o: any) => ["sindaco", "presidente_collegio_sindacale", "revisore"].includes(o.ruolo));

  function resetPratica() {
    setPreincaricoId(null); setRisposte({}); setConclusioni(""); setRisposteStep2({}); setConclusioniStep2(""); setRischioIncarico(""); setDataAccettazioneStep2(""); setRisposteStep3({}); setConclusioniStep3(""); setRischioIndipendenza(""); setEsitoIndipendenza(""); setMisureSalvaguardia(""); setCompensoS(""); setCompensoC(""); setCompensoCT(""); setRisposteStep4({}); setConclusioniStep4(""); setRischioRiciclaggio(""); setScoreA(""); setScoreB(""); setScoreC(""); setScoreD(""); setDataAttestazione(""); setFirmatarioAttestazione(""); setAttestazioneConfermata(false); setMessaggio(""); setErrore(""); setStep(1);
  }

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px 60px", fontFamily: "Inter,Arial,sans-serif", color: "#0f172a" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <div><div style={{ fontSize: 13, color: "#64748b", fontWeight: 700 }}>REVISIONE E CONTROLLO</div><h1 style={{ margin: "5px 0 4px", fontSize: 30 }}>Presa in carico dell’incarico di revisione</h1><div style={{ color: "#64748b" }}>Procedura guidata di valutazione, accettazione e generazione della pratica.</div></div>
        <button onClick={() => router.push("/revisione-controllo")} style={secondary}>← Torna a Revisione e Controllo</button>
      </div>

      <section style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14 }}>
          <Field label="Cliente / società"><select value={clienteId} onChange={(e) => { setClienteId(e.target.value); resetPratica(); }} style={input} disabled={loadingClienti}><option value="">{loadingClienti ? "Caricamento clienti..." : "Seleziona cliente"}</option>{clienti.map((c) => <option key={c.id} value={c.id}>{nomeCliente(c)}</option>)}</select></Field>
          <Field label="Bilancio al"><input type="date" value={dataBilancio} onChange={(e) => { setDataBilancio(e.target.value); resetPratica(); }} style={input} /></Field>
          <Field label="Stato"><input value={preincaricoId ? "Bozza salvata" : "Nuova bozza"} readOnly style={{ ...input, background: "#f8fafc" }} /></Field>
        </div>
        <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: "#f8fafc", border: "1px solid #cbd5e1", fontSize: 13, color: "#475569" }}>{loadingSnapshot ? "Acquisizione dati dagli archivi SMP..." : clienteSelezionato ? <>Snapshot acquisito per <b>{nomeCliente(clienteSelezionato)}</b>: anagrafica e organi sociali vengono congelati nella presa in carico al salvataggio.</> : "Seleziona un cliente per acquisire automaticamente i dati dagli archivi SMP."}</div>
        {snapshot && <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 12 }}><Mini label="Soci" value={soci.length} /><Mini label="Amministratori" value={amministratori.length} /><Mini label="Organo di controllo" value={controllo.length} /><Mini label="CF / P.IVA" value={snapshot.cliente?.codice_fiscale || snapshot.cliente?.partita_iva || "—"} /></div>}
        {errore && <div style={{ marginTop: 12, padding: 12, border: "1px solid #ef4444", background: "#fef2f2", borderRadius: 8, color: "#b91c1c", fontWeight: 700 }}>{errore}</div>}
        {messaggio && <div style={{ marginTop: 12, padding: 12, border: "1px solid #86efac", background: "#f0fdf4", borderRadius: 8, color: "#166534", fontWeight: 700 }}>{messaggio}</div>}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 7, margin: "18px 0" }}>{steps.map((s, i) => <button key={s} onClick={() => setStep(i + 1)} style={{ padding: "11px 8px", borderRadius: 9, border: i + 1 === step ? "2px solid #0d6f9f" : "1px solid #cbd5e1", background: i + 1 === step ? "#eaf8ff" : "#fff", fontWeight: 700, fontSize: 12, color: i + 1 === step ? "#075985" : "#475569", cursor: "pointer" }}><div style={{ fontSize: 11, marginBottom: 4 }}>STEP {i + 1}</div>{s}</button>)}</div>

      {step === 1 && <section style={card}><StepHeader title="Step 1 — Dati del cliente e valutazione preliminare" completed={completate} total={domandeStep1.length} /><div style={{ marginTop: 18 }}>{domandeStep1.map(([codice, testo, help]) => <QuestionRow key={codice} codice={codice} testo={testo} help={help} riga={risposte[codice]} onChange={(patch) => aggiorna(codice, patch)} />)}</div><Field label="Conclusioni della valutazione preliminare"><textarea value={conclusioni} onChange={(e) => setConclusioni(e.target.value)} placeholder="Riportare le conclusioni della valutazione preliminare..." style={{ ...input, minHeight: 130, resize: "vertical" }} /></Field></section>}

      {step === 2 && <section style={card}><StepHeader title="Step 2 — Questionario accettazione incarico" completed={completateStep2} total={domandeStep2.length} /><div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: "#f8fafc", border: "1px solid #cbd5e1", fontSize: 13, color: "#475569" }}><b>Collegamenti del fascicolo:</b> le valutazioni preliminari sull’informativa finanziaria sono supportate dallo Step 1; indipendenza e antiriciclaggio sono completati negli Step 3 e 4.</div><QuestionSection domande={domandeStep2} risposte={risposteStep2} onChange={aggiornaStep2} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 18 }}><Field label="Valutazione complessiva del rischio di incarico"><RiskSelect value={rischioIncarico} onChange={setRischioIncarico} /></Field><Field label="Data di accettazione dell’incarico"><input type="date" value={dataAccettazioneStep2} onChange={(e) => setDataAccettazioneStep2(e.target.value)} style={input} /></Field></div><div style={{ marginTop: 16 }}><Field label="Conclusioni"><textarea value={conclusioniStep2} onChange={(e) => setConclusioniStep2(e.target.value)} placeholder="Riportare la conclusione sull’accettazione dell’incarico, le eventuali criticità e le misure di salvaguardia..." style={{ ...input, minHeight: 150, resize: "vertical" }} /></Field></div></section>}

      {step === 3 && <section style={card}><StepHeader title="Step 3 — Questionario valutazione indipendenza" completed={completateStep3} total={domandeStep3.length} /><div style={noticeOrange}><b>Valutazione obbligatoria:</b> verificare rapporti personali, altri incarichi, rapporti economici, minacce e misure di salvaguardia prima dell’accettazione.</div><QuestionSection domande={domandeStep3} risposte={risposteStep3} onChange={aggiornaStep3} /><div style={{ marginTop: 22, padding: 16, borderRadius: 10, border: "1px solid #cbd5e1", background: "#f8fafc" }}><h3 style={{ margin: "0 0 14px" }}>Compensi e dipendenza economica</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}><Field label="(S) Compensi revisione / sindaco"><input value={compensoS} onChange={(e) => setCompensoS(e.target.value)} inputMode="decimal" placeholder="0,00" style={input} /></Field><Field label="(C) Altri compensi società / gruppo"><input value={compensoC} onChange={(e) => setCompensoC(e.target.value)} inputMode="decimal" placeholder="0,00" style={input} /></Field><Field label="(CT) Compensi totali professionista / rete"><input value={compensoCT} onChange={(e) => setCompensoCT(e.target.value)} inputMode="decimal" placeholder="0,00" style={input} /></Field></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}><Mini label="(S + C) / CT" value={`${rapportoSCCT.toFixed(2)}%`} /><Mini label="S / (S + C)" value={rapportoSsuSC.toFixed(4)} /></div></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 18 }}><Field label="Rischio di indipendenza"><RiskSelect value={rischioIndipendenza} onChange={setRischioIndipendenza} /></Field><Field label="Esito della valutazione"><select value={esitoIndipendenza} onChange={(e) => setEsitoIndipendenza(e.target.value)} style={input}><option value="">Seleziona</option><option value="ACCETTATO">Accettato</option><option value="RIFIUTATO">Rifiutato</option></select></Field></div><div style={{ marginTop: 16 }}><Field label="Misure di salvaguardia"><textarea value={misureSalvaguardia} onChange={(e) => setMisureSalvaguardia(e.target.value)} placeholder="Descrivere le misure previste per eliminare o ridurre le minacce a un livello accettabile..." style={{ ...input, minHeight: 120, resize: "vertical" }} /></Field></div><div style={{ marginTop: 16 }}><Field label="Conclusioni sulla valutazione di indipendenza"><textarea value={conclusioniStep3} onChange={(e) => setConclusioniStep3(e.target.value)} placeholder="Riportare le conclusioni finali e gli elementi acquisiti..." style={{ ...input, minHeight: 140, resize: "vertical" }} /></Field></div></section>}

      {step === 4 && <section style={card}><StepHeader title="Step 4 — Valutazione rischio riciclaggio" completed={completateStep4} total={domandeStep4.length} /><div style={noticeOrange}><b>Antiriciclaggio:</b> la valutazione considera natura giuridica, attività prevalente, comportamento al conferimento e area geografica. Le motivazioni restano archiviate nel fascicolo di presa in carico.</div><QuestionSection domande={domandeStep4} risposte={risposteStep4} onChange={aggiornaStep4} /><div style={{ marginTop: 22, padding: 16, borderRadius: 10, border: "1px solid #cbd5e1", background: "#f8fafc" }}><h3 style={{ margin: "0 0 14px" }}>Rischio specifico — aspetti connessi al cliente</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}><Field label="a) Natura giuridica"><input type="number" min="0" step="1" value={scoreA} onChange={(e) => setScoreA(e.target.value)} placeholder="Punteggio" style={input} /></Field><Field label="b) Prevalente attività svolta"><input type="number" min="0" step="1" value={scoreB} onChange={(e) => setScoreB(e.target.value)} placeholder="Punteggio" style={input} /></Field><Field label="c) Comportamento al conferimento"><input type="number" min="0" step="1" value={scoreC} onChange={(e) => setScoreC(e.target.value)} placeholder="Punteggio" style={input} /></Field><Field label="d) Area geografica"><input type="number" min="0" step="1" value={scoreD} onChange={(e) => setScoreD(e.target.value)} placeholder="Punteggio" style={input} /></Field></div></div><div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14, marginTop: 18 }}><Field label="Esito della valutazione del rischio"><RiskSelect value={rischioRiciclaggio} onChange={setRischioRiciclaggio} /></Field><Field label="Conclusioni"><textarea value={conclusioniStep4} onChange={(e) => setConclusioniStep4(e.target.value)} placeholder="Sintetizzare l’esito della valutazione del rischio di riciclaggio e finanziamento del terrorismo..." style={{ ...input, minHeight: 120, resize: "vertical" }} /></Field></div></section>}

      {step === 5 && <section style={card}><h2 style={{ marginTop: 0 }}>Step 5 — Attestazione di indipendenza</h2><p style={{ color: "#64748b", marginBottom: 20 }}>Documento generato sulla base dell’attestazione originale. La conferma viene archiviata nel fascicolo della presa in carico.</p><div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 28, background: "#fff", lineHeight: 1.65 }}><h3 style={{ textAlign: "center", letterSpacing: 1, marginTop: 0 }}>DICHIARO</h3><p>di aver letto e compreso le norme e i principi in materia di indipendenza qui di seguito elencati:</p><ul><li>Art. 10 Decreto Legislativo 27 gennaio 2010, n. 39;</li><li>ISQC Italia 1 e ISA Italia n. 200, “Obiettivi generali del revisore indipendente e svolgimento della revisione contabile in conformità ai principi di revisione internazionali” e n. 220, “Controllo della qualità dell’incarico di revisione contabile del bilancio”;</li><li>Codice Italiano di Etica e Indipendenza;</li><li>Titolo I, art. 9 Codice deontologico dei Dottori Commercialisti e degli Esperti Contabili;</li><li>direttive e procedure in materia di indipendenza contenute nel manuale di controllo della qualità adottato.</li></ul><h3 style={{ textAlign: "center", letterSpacing: 1, marginTop: 30 }}>CONFERMO</h3><p>che, tenuto conto delle informazioni fin qui ottenute e delle verifiche condotte, non ho riscontrato situazioni che, ai sensi di legge e dei principi deontologici che disciplinano l’attività di revisione, compromettano la mia indipendenza o che costituiscano cause di impossibilità ad accettare l’incarico o di cessazione anticipata dall’incarico.</p><p>È mia la responsabilità di segnalare eventuali modifiche a quanto sopra dichiarato.</p><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginTop: 30 }}><Field label="Data attestazione"><input type="date" value={dataAttestazione} onChange={(e) => setDataAttestazione(e.target.value)} style={input} /></Field><Field label="Revisore / firmatario"><input value={firmatarioAttestazione} onChange={(e) => setFirmatarioAttestazione(e.target.value)} placeholder="Nominativo del firmatario" style={input} /></Field></div><label style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: 24, padding: 16, borderRadius: 10, border: attestazioneConfermata ? "2px solid #16a34a" : "1px solid #94a3b8", background: attestazioneConfermata ? "#f0fdf4" : "#f8fafc", cursor: "pointer" }}><input type="checkbox" checked={attestazioneConfermata} onChange={(e) => setAttestazioneConfermata(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2 }} /><span><b>Confermo l’indipendenza e l’assenza di cause ostative</b><br/><span style={{ color: "#64748b", fontSize: 13 }}>La conferma rende l’attestazione completata ai fini del fascicolo di presa in carico.</span></span></label></div></section>}

      {step > 5 && <section style={card}><h2 style={{ marginTop: 0 }}>Step {step} — {steps[step - 1]}</h2><p style={{ color: "#64748b" }}>Modulo predisposto nel workflow. Il documento dello step sarà inserito nel blocco dedicato.</p></section>}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 18 }}><button disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))} style={secondary}>← Step precedente</button><div style={{ display: "flex", gap: 10 }}><button onClick={() => window.print()} style={secondary}>Stampa</button><button onClick={salvaBozza} disabled={saving} style={secondary}>{saving ? "Salvataggio..." : "Salva bozza"}</button><button disabled={step === 8} onClick={() => setStep((s) => Math.min(8, s + 1))} style={primary}>Prossimo step →</button></div></div>
    </main>
  );
}

function QuestionSection({ domande, risposte, onChange }: { domande: readonly (readonly [string, string, string, string])[]; risposte: Record<string, Riga>; onChange: (codice: string, patch: Partial<Riga>) => void }) {
  return <div style={{ marginTop: 18 }}>{domande.map(([codice, sezione, testo, help], i) => { const nuovaSezione = i === 0 || domande[i - 1][1] !== sezione; return <React.Fragment key={codice}>{nuovaSezione && <div style={{ marginTop: i ? 24 : 0, padding: "10px 12px", borderRadius: 8, background: "#eaf8ff", color: "#075985", fontWeight: 900 }}>{sezione}</div>}<QuestionRow codice={codice} testo={testo} help={help} riga={risposte[codice]} onChange={(patch) => onChange(codice, patch)} /></React.Fragment>; })}</div>;
}

function StepHeader({ title, completed, total }: { title: string; completed: number; total: number }) { return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 }}><div><h2 style={{ margin: 0, fontSize: 22 }}>{title}</h2><p style={{ margin: "7px 0 0", color: "#64748b" }}>Rispondere a ogni quesito con Sì, No o Non applicabile. Le specifiche possono essere estese.</p></div><div style={{ fontWeight: 800, color: completed === total ? "#15803d" : "#0d6f9f" }}>{completed}/{total}</div></div>; }

function QuestionRow({ codice, testo, help, riga, onChange }: { codice: string; testo: string; help: string; riga?: Riga; onChange: (patch: Partial<Riga>) => void }) {
  const r = riga || { risposta: "", specifica: "" };
  return <div style={{ padding: "18px 0", borderTop: "1px solid #e2e8f0" }}><div style={{ display: "grid", gridTemplateColumns: "56px 1fr 360px", gap: 16, alignItems: "start" }}><div style={{ width: 42, height: 42, borderRadius: 10, display: "grid", placeItems: "center", background: "#eaf8ff", fontWeight: 900, color: "#075985" }}>{codice}</div><div><div style={{ fontWeight: 800, lineHeight: 1.45 }}>{testo}</div><div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>{help}</div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>{[["SI", "Sì"], ["NO", "No"], ["NON_APPLICABILE", "N/A"]].map(([v, l]) => <button key={v} onClick={() => onChange({ risposta: v as Risposta })} style={{ height: 40, borderRadius: 8, border: r.risposta === v ? "2px solid #0d6f9f" : "1px solid #94a3b8", background: r.risposta === v ? "#eaf8ff" : "#fff", fontWeight: 800, cursor: "pointer" }}>{l}</button>)}</div></div><textarea value={r.specifica} onChange={(e) => onChange({ specifica: e.target.value })} placeholder="Specifiche / motivazioni / evidenze acquisite..." style={{ ...input, minHeight: 92, resize: "vertical", marginTop: 12 }} /></div>;
}

function RiskSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <select value={value} onChange={(e) => onChange(e.target.value)} style={input}><option value="">Seleziona</option><option value="BASSO">Basso</option><option value="MEDIO">Medio</option><option value="ALTO">Alto</option></select>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#334155" }}>{label}<div style={{ marginTop: 7 }}>{children}</div></label>; }
function Mini({ label, value }: { label: string; value: React.ReactNode }) { return <div style={{ border: "1px solid #cbd5e1", borderRadius: 9, padding: "10px 12px", background: "#fff" }}><div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>{label}</div><div style={{ fontSize: 18, fontWeight: 900, marginTop: 3 }}>{value}</div></div>; }
function rigaAggiornata(attuale: Riga | undefined, patch: Partial<Riga>): Riga { return { risposta: attuale?.risposta || "", specifica: attuale?.specifica || "", ...patch }; }
function numero(value: string) { const normalized = value.replace(/\./g, "").replace(",", "."); const parsed = Number(normalized); return Number.isFinite(parsed) ? parsed : 0; }

const card: React.CSSProperties = { background: "#fff", border: "1px solid #8cddff", borderRadius: 12, padding: 22, boxShadow: "0 12px 30px rgba(14,78,112,0.10)" };
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #94a3b8", borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff", color: "#0f172a" };
const primary: React.CSSProperties = { border: 0, borderRadius: 9, padding: "11px 18px", background: "linear-gradient(110deg,#0b4f7d,#0d6f9f 58%,#1688b7)", color: "white", fontWeight: 800, cursor: "pointer" };
const secondary: React.CSSProperties = { border: "1px solid #94a3b8", borderRadius: 9, padding: "10px 16px", background: "#fff", color: "#334155", fontWeight: 800, cursor: "pointer" };
const noticeOrange: React.CSSProperties = { marginTop: 14, padding: 14, borderRadius: 10, background: "#fff7ed", border: "1px solid #fdba74", fontSize: 13, color: "#9a3412" };
