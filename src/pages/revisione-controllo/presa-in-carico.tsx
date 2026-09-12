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
type IncaricoTrasparenza = { ente: string; ateco: string; sede: string; codiceFiscale: string; ruolo: string };

const incaricoTrasparenzaVuoto = (): IncaricoTrasparenza => ({ ente: "", ateco: "", sede: "", codiceFiscale: "", ruolo: "" });
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
  const [incarichiTrasparenza, setIncarichiTrasparenza] = useState<IncaricoTrasparenza[]>([incaricoTrasparenzaVuoto()]);
  const [dataTrasparenza, setDataTrasparenza] = useState("");
  const [firmatarioTrasparenza, setFirmatarioTrasparenza] = useState("");
  const [trasparenzaConfermata, setTrasparenzaConfermata] = useState(false);
  const [decorrenzaProposta, setDecorrenzaProposta] = useState("");
  const [numeroEserciziProposta, setNumeroEserciziProposta] = useState("3");
  const [eserciziProposta, setEserciziProposta] = useState("");
  const [compensoAnnualeProposta, setCompensoAnnualeProposta] = useState("");
  const [attivitaAggiuntiveProposta, setAttivitaAggiuntiveProposta] = useState("Sottoscrizione delle dichiarazioni fiscali, ove prevista dalla normativa vigente.");
  const [responsabileProposta, setResponsabileProposta] = useState("");
  const [polizzaProposta, setPolizzaProposta] = useState("");
  const [noteProposta, setNoteProposta] = useState("");
  const [dataProposta, setDataProposta] = useState("");
  const [propostaConfermata, setPropostaConfermata] = useState(false);
  const [dataAccettazioneFinale, setDataAccettazioneFinale] = useState("");
  const [responsabileFinale, setResponsabileFinale] = useState("");
  const [noteFinali, setNoteFinali] = useState("");
  const [accettazioneFinaleConfermata, setAccettazioneFinaleConfermata] = useState(false);
  const [generatingPratica, setGeneratingPratica] = useState(false);
  const [praticaRevisioneId, setPraticaRevisioneId] = useState<string | null>(null);
  const [preincaricoStato, setPreincaricoStato] = useState("");
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
    const { data, error } = await supabase.from("tbrevisione_preincarichi").select("id,step_corrente,snapshot_cliente,stato,pratica_revisione_id").eq("studio_id", studioId).eq("cliente_id", clienteId).eq("data_bilancio", dataBilancio).maybeSingle();
    if (error) { setErrore(error.message); return; }
    if (!data?.id) { setPreincaricoId(null); return; }
    setPreincaricoId(data.id); setPreincaricoStato(data.stato || ""); setPraticaRevisioneId(data.pratica_revisione_id || null); setStep(Math.max(1, Math.min(8, Number(data.step_corrente || 1)))); if (data.snapshot_cliente) setSnapshot(data.snapshot_cliente);

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

    const { data: documenti, error: dError } = await supabase.from("tbrevisione_preincarico_documenti").select("tipo,contenuto,stato").eq("preincarico_id", data.id).in("tipo", ["ATTESTAZIONE_INDIPENDENZA", "DICHIARAZIONE_TRASPARENZA", "PROPOSTA_INCARICO", "ACCETTAZIONE_FINALE"]);
    if (dError) { setErrore(dError.message); return; }
    for (const documento of documenti || []) {
      const contenuto = (documento.contenuto || {}) as any;
      if (documento.tipo === "ATTESTAZIONE_INDIPENDENZA") {
        setDataAttestazione(contenuto.data || ""); setFirmatarioAttestazione(contenuto.firmatario || ""); setAttestazioneConfermata(Boolean(contenuto.confermato));
      }
      if (documento.tipo === "DICHIARAZIONE_TRASPARENZA") {
        const righe = Array.isArray(contenuto.incarichi) ? contenuto.incarichi : [];
        setIncarichiTrasparenza(righe.length ? righe : [incaricoTrasparenzaVuoto()]);
        setDataTrasparenza(contenuto.data || ""); setFirmatarioTrasparenza(contenuto.firmatario || ""); setTrasparenzaConfermata(Boolean(contenuto.confermato));
      }
      if (documento.tipo === "PROPOSTA_INCARICO") {
        setDecorrenzaProposta(contenuto.decorrenza || ""); setNumeroEserciziProposta(String(contenuto.numero_esercizi || "3")); setEserciziProposta(contenuto.esercizi || ""); setCompensoAnnualeProposta(contenuto.compenso_annuale || ""); setAttivitaAggiuntiveProposta(contenuto.attivita_aggiuntive || ""); setResponsabileProposta(contenuto.responsabile || ""); setPolizzaProposta(contenuto.polizza || ""); setNoteProposta(contenuto.note || ""); setDataProposta(contenuto.data || ""); setPropostaConfermata(Boolean(contenuto.confermato));
      }
      if (documento.tipo === "ACCETTAZIONE_FINALE") {
        setDataAccettazioneFinale(contenuto.data || ""); setResponsabileFinale(contenuto.responsabile || ""); setNoteFinali(contenuto.note || ""); setAccettazioneFinaleConfermata(Boolean(contenuto.confermato));
      }
    }
    setMessaggio("Bozza esistente caricata.");
  }

  function aggiorna(codice: string, patch: Partial<Riga>) { setRisposte((p) => ({ ...p, [codice]: rigaAggiornata(p[codice], patch) })); }
  function aggiornaStep2(codice: string, patch: Partial<Riga>) { setRisposteStep2((p) => ({ ...p, [codice]: rigaAggiornata(p[codice], patch) })); }
  function aggiornaStep3(codice: string, patch: Partial<Riga>) { setRisposteStep3((p) => ({ ...p, [codice]: rigaAggiornata(p[codice], patch) })); }
  function aggiornaStep4(codice: string, patch: Partial<Riga>) { setRisposteStep4((p) => ({ ...p, [codice]: rigaAggiornata(p[codice], patch) })); }
  function aggiornaIncaricoTrasparenza(index: number, field: keyof IncaricoTrasparenza, value: string) { setIncarichiTrasparenza((prev) => prev.map((r, i) => i === index ? { ...r, [field]: value } : r)); }
  function aggiungiIncaricoTrasparenza() { setIncarichiTrasparenza((prev) => [...prev, incaricoTrasparenzaVuoto()]); }
  function rimuoviIncaricoTrasparenza(index: number) { setIncarichiTrasparenza((prev) => { const next = prev.filter((_, i) => i !== index); return next.length ? next : [incaricoTrasparenzaVuoto()]; }); }

  async function salvaBozza() {
    if (preincaricoStato === "generato" || praticaRevisioneId) { setErrore("La presa in carico è già stata finalizzata ed è bloccata nello storico."); return; }
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
    else if (step === 6) ok = await salvaDocumentoPreincarico({ supabase, preincaricoId: pre.id, tipo: "DICHIARAZIONE_TRASPARENZA", stato: trasparenzaConfermata ? "confermato" : "bozza", contenuto: { data: dataTrasparenza, firmatario: firmatarioTrasparenza, confermato: trasparenzaConfermata, incarichi: incarichiTrasparenza.filter((r) => r.ente || r.ateco || r.sede || r.codiceFiscale || r.ruolo) } });
    else if (step === 7) ok = await salvaDocumentoPreincarico({ supabase, preincaricoId: pre.id, tipo: "PROPOSTA_INCARICO", stato: propostaConfermata ? "confermato" : "bozza", contenuto: { data: dataProposta, decorrenza: decorrenzaProposta, numero_esercizi: numeroEserciziProposta, esercizi: eserciziProposta, compenso_annuale: compensoAnnualeProposta, attivita_aggiuntive: attivitaAggiuntiveProposta, responsabile: responsabileProposta, polizza: polizzaProposta, note: noteProposta, confermato: propostaConfermata } });
    else if (step === 8) ok = await salvaDocumentoPreincarico({ supabase, preincaricoId: pre.id, tipo: "ACCETTAZIONE_FINALE", stato: accettazioneFinaleConfermata ? "confermato" : "bozza", contenuto: { data: dataAccettazioneFinale, responsabile: responsabileFinale, note: noteFinali, confermato: accettazioneFinaleConfermata } });

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
    setPreincaricoId(null); setRisposte({}); setConclusioni(""); setRisposteStep2({}); setConclusioniStep2(""); setRischioIncarico(""); setDataAccettazioneStep2(""); setRisposteStep3({}); setConclusioniStep3(""); setRischioIndipendenza(""); setEsitoIndipendenza(""); setMisureSalvaguardia(""); setCompensoS(""); setCompensoC(""); setCompensoCT(""); setRisposteStep4({}); setConclusioniStep4(""); setRischioRiciclaggio(""); setScoreA(""); setScoreB(""); setScoreC(""); setScoreD(""); setDataAttestazione(""); setFirmatarioAttestazione(""); setAttestazioneConfermata(false); setIncarichiTrasparenza([incaricoTrasparenzaVuoto()]); setDataTrasparenza(""); setFirmatarioTrasparenza(""); setTrasparenzaConfermata(false); setDecorrenzaProposta(""); setNumeroEserciziProposta("3"); setEserciziProposta(""); setCompensoAnnualeProposta(""); setAttivitaAggiuntiveProposta("Sottoscrizione delle dichiarazioni fiscali, ove prevista dalla normativa vigente."); setResponsabileProposta(""); setPolizzaProposta(""); setNoteProposta(""); setDataProposta(""); setPropostaConfermata(false); setDataAccettazioneFinale(""); setResponsabileFinale(""); setNoteFinali(""); setAccettazioneFinaleConfermata(false); setPraticaRevisioneId(null); setPreincaricoStato(""); setMessaggio(""); setErrore(""); setStep(1);
  }

  const stepFinaliCompleti = completate === domandeStep1.length && completateStep2 === domandeStep2.length && completateStep3 === domandeStep3.length && completateStep4 === domandeStep4.length && !!rischioIncarico && !!rischioIndipendenza && esitoIndipendenza === "ACCETTATO" && !!rischioRiciclaggio && attestazioneConfermata && trasparenzaConfermata && propostaConfermata;

  async function generaPraticaRevisione() {
    if (!studioId || !clienteId || !preincaricoId) { setErrore("Salva prima la presa in carico."); return; }
    if (praticaRevisioneId || preincaricoStato === "generato") { setErrore("La pratica di revisione è già stata generata per questa presa in carico."); return; }
    if (!stepFinaliCompleti) { setErrore("Completa e conferma tutti gli step precedenti prima di generare la pratica di revisione."); return; }
    if (!accettazioneFinaleConfermata || !dataAccettazioneFinale) { setErrore("Conferma l’accettazione finale e indica la data di accettazione."); return; }
    setGeneratingPratica(true); setErrore(""); setMessaggio("");
    try {
      const dataInizio = decorrenzaProposta || dataAccettazioneFinale || dataBilancio;
      const response = await fetch("/api/revisione-controllo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studio_id: studioId, cliente_id: clienteId, tipo_incarico: "REVISIONE_LEGALE", data_nomina: dataAccettazioneFinale, data_inizio: dataInizio, data_fine: null, responsabile_id: null, note: [responsabileFinale ? `Responsabile presa in carico: ${responsabileFinale}` : "", noteFinali].filter(Boolean).join("\n") || null, preincarico_id: preincaricoId, data_accettazione: dataAccettazioneFinale, note_finali: noteFinali || null, accettazione_finale: { data: dataAccettazioneFinale, responsabile: responsabileFinale, note: noteFinali, snapshot_cliente: snapshot || {} } }) });
      const payload = await response.json();
      if (!response.ok || !payload?.success || !payload?.data?.id) throw new Error(payload?.error || "Impossibile generare la pratica di revisione");
      setPraticaRevisioneId(payload.data.id); setPreincaricoStato("generato");
      setMessaggio(payload.already_exists ? "La pratica di revisione risultava già generata ed è stata ricollegata." : "Pratica di revisione generata correttamente. La presa in carico è ora congelata nello storico.");
    } catch (e: any) { setErrore(e?.message || "Errore durante la generazione della pratica di revisione."); } finally { setGeneratingPratica(false); }
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

      {step === 6 && <section style={card}><h2 style={{ marginTop: 0 }}>Step 6 — Dichiarazione di trasparenza</h2><p style={{ color: "#64748b", marginBottom: 18 }}>Elenco degli incarichi ricoperti dal revisore, strutturato secondo il modello della dichiarazione di trasparenza allegata.</p><div style={{ border: "1px solid #cbd5e1", borderRadius: 12, overflow: "hidden" }}><div style={{ display: "grid", gridTemplateColumns: "1.35fr .55fr 1.4fr .85fr 1.1fr 48px", background: "#eaf8ff", color: "#075985", fontWeight: 900, fontSize: 12 }}><div style={th}>Società / ente</div><div style={th}>ATECO</div><div style={th}>Sede</div><div style={th}>CF / P.IVA</div><div style={th}>Incarico / ruolo</div><div style={th}></div></div>{incarichiTrasparenza.map((riga, index) => <div key={index} style={{ display: "grid", gridTemplateColumns: "1.35fr .55fr 1.4fr .85fr 1.1fr 48px", borderTop: index ? "1px solid #e2e8f0" : undefined, alignItems: "stretch" }}><input value={riga.ente} onChange={(e) => aggiornaIncaricoTrasparenza(index, "ente", e.target.value)} placeholder="Denominazione" style={tableInput} /><input value={riga.ateco} onChange={(e) => aggiornaIncaricoTrasparenza(index, "ateco", e.target.value)} placeholder="Codice" style={tableInput} /><input value={riga.sede} onChange={(e) => aggiornaIncaricoTrasparenza(index, "sede", e.target.value)} placeholder="Indirizzo / città" style={tableInput} /><input value={riga.codiceFiscale} onChange={(e) => aggiornaIncaricoTrasparenza(index, "codiceFiscale", e.target.value)} placeholder="CF / P.IVA" style={tableInput} /><input value={riga.ruolo} onChange={(e) => aggiornaIncaricoTrasparenza(index, "ruolo", e.target.value)} placeholder="Revisore legale / Sindaco..." style={tableInput} /><button type="button" onClick={() => rimuoviIncaricoTrasparenza(index)} title="Rimuovi riga" style={{ border: 0, background: "#fff", color: "#b91c1c", fontWeight: 900, cursor: "pointer", fontSize: 18 }}>×</button></div>)}</div><button type="button" onClick={aggiungiIncaricoTrasparenza} style={{ ...secondary, marginTop: 12 }}>+ Aggiungi incarico</button><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginTop: 24 }}><Field label="Data dichiarazione"><input type="date" value={dataTrasparenza} onChange={(e) => setDataTrasparenza(e.target.value)} style={input} /></Field><Field label="Revisore / firmatario"><input value={firmatarioTrasparenza} onChange={(e) => setFirmatarioTrasparenza(e.target.value)} placeholder="Nominativo del firmatario" style={input} /></Field></div><label style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: 24, padding: 16, borderRadius: 10, border: trasparenzaConfermata ? "2px solid #16a34a" : "1px solid #94a3b8", background: trasparenzaConfermata ? "#f0fdf4" : "#f8fafc", cursor: "pointer" }}><input type="checkbox" checked={trasparenzaConfermata} onChange={(e) => setTrasparenzaConfermata(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2 }} /><span><b>Confermo che l’elenco degli incarichi dichiarati è completo e aggiornato</b><br/><span style={{ color: "#64748b", fontSize: 13 }}>La versione confermata viene archiviata nel fascicolo di presa in carico.</span></span></label></section>}

      {step === 7 && <section style={card}><h2 style={{ marginTop: 0 }}>Step 7 — Proposta di incarico di revisione</h2><p style={{ color: "#64748b", marginBottom: 18 }}>Lettera di proposta costruita sul modello allegato: oggetto e durata dell’incarico, responsabilità, modalità di svolgimento, corrispettivi, indipendenza, riservatezza, antiriciclaggio e copertura assicurativa.</p><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}><Field label="Data proposta"><input type="date" value={dataProposta} onChange={(e) => setDataProposta(e.target.value)} style={input} /></Field><Field label="Decorrenza incarico"><input type="date" value={decorrenzaProposta} onChange={(e) => setDecorrenzaProposta(e.target.value)} style={input} /></Field><Field label="Numero esercizi"><input type="number" min="1" value={numeroEserciziProposta} onChange={(e) => setNumeroEserciziProposta(e.target.value)} style={input} /></Field></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}><Field label="Esercizi interessati"><input value={eserciziProposta} onChange={(e) => setEserciziProposta(e.target.value)} placeholder="es. 2025 – 2026 – 2027" style={input} /></Field><Field label="Compenso annuale"><input value={compensoAnnualeProposta} onChange={(e) => setCompensoAnnualeProposta(e.target.value)} placeholder="Euro 0,00 oltre IVA e cassa" style={input} /></Field><Field label="Responsabile dell’incarico"><input value={responsabileProposta} onChange={(e) => setResponsabileProposta(e.target.value)} placeholder="Dott./Dott.ssa ..." style={input} /></Field><Field label="Copertura assicurativa"><textarea value={polizzaProposta} onChange={(e) => setPolizzaProposta(e.target.value)} placeholder="Compagnia, numero polizza, eventuali estremi..." style={{ ...input, minHeight: 88, resize: "vertical" }} /></Field></div><div style={{ marginTop: 14 }}><Field label="Attività aggiuntive"><textarea value={attivitaAggiuntiveProposta} onChange={(e) => setAttivitaAggiuntiveProposta(e.target.value)} style={{ ...input, minHeight: 88, resize: "vertical" }} /></Field></div><div style={{ marginTop: 14 }}><Field label="Note e condizioni particolari"><textarea value={noteProposta} onChange={(e) => setNoteProposta(e.target.value)} placeholder="Eventuali condizioni particolari, adeguamenti del compenso o ulteriori pattuizioni..." style={{ ...input, minHeight: 100, resize: "vertical" }} /></Field></div><div style={{ marginTop: 22, border: "1px solid #cbd5e1", borderRadius: 12, padding: 24, lineHeight: 1.6 }}><h3 style={{ textAlign: "center", marginTop: 0 }}>PROPOSTA DI INCARICO DI REVISIONE LEGALE</h3><p><b>Società:</b> {snapshot?.cliente?.ragione_sociale || clienteSelezionato?.ragione_sociale || "—"}</p><p>Con riferimento ai contatti intercorsi, vengono sottoposte le modalità e condizioni relative all’incarico di revisione legale dei conti per gli esercizi indicati.</p><h4>Oggetto dell’incarico</h4><p>L’incarico comprende la revisione dei bilanci degli esercizi per i quali è conferito, al fine di esprimere il giudizio sul bilancio, e la verifica della regolare esecuzione della contabilità sociale e della corretta rilevazione dei fatti e atti di gestione.</p><h4>Durata</h4><p>Durata prevista: <b>{numeroEserciziProposta || "—"} esercizi</b>{eserciziProposta ? ` (${eserciziProposta})` : ""}, con decorrenza {decorrenzaProposta || "—"}.</p><h4>Obiettivi e responsabilità</h4><p>La revisione è svolta secondo i principi di revisione applicabili. La direzione resta responsabile della redazione del bilancio, della correttezza delle informazioni, dell’adeguatezza del controllo interno e della messa a disposizione del revisore di informazioni, documenti e persone necessarie. Il revisore esegue le verifiche periodiche e formula il giudizio professionale sul bilancio nel suo complesso.</p><h4>Modalità di svolgimento</h4><p>Le attività comprendono pianificazione, verifiche sul bilancio, valutazione degli eventuali errori rispetto alla materialità, rapporti con le parti correlate, eventi successivi, continuità aziendale e verifiche della regolare contabilità sociale.</p><h4>Attività aggiuntive</h4><p>{attivitaAggiuntiveProposta || "—"}</p><h4>Corrispettivi e spese</h4><p>Responsabile: <b>{responsabileProposta || "—"}</b>. Compenso annuale: <b>{compensoAnnualeProposta || "—"}</b>.</p><h4>Indipendenza, riservatezza e antiriciclaggio</h4><p>L’assunzione dell’incarico presuppone il mantenimento dell’indipendenza e l’assenza di incompatibilità. I dati e le carte di lavoro sono trattati secondo la disciplina applicabile; restano inoltre fermi gli obblighi previsti dalla normativa antiriciclaggio.</p><h4>Copertura assicurativa</h4><p>{polizzaProposta || "—"}</p>{noteProposta && <><h4>Condizioni particolari</h4><p>{noteProposta}</p></>}<div style={{ marginTop: 34 }}><b>Per accettazione (la società)</b><div style={{ borderBottom: "1px solid #64748b", width: 280, marginTop: 40 }} /></div></div><label style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: 20, padding: 16, borderRadius: 10, border: propostaConfermata ? "2px solid #16a34a" : "1px solid #94a3b8", background: propostaConfermata ? "#f0fdf4" : "#f8fafc", cursor: "pointer" }}><input type="checkbox" checked={propostaConfermata} onChange={(e) => setPropostaConfermata(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2 }} /><span><b>Confermo la proposta di incarico</b><br/><span style={{ color: "#64748b", fontSize: 13 }}>La versione confermata viene congelata nel fascicolo preliminare e sarà utilizzata nello Step 8.</span></span></label></section>}

      {step === 8 && <section style={card}><h2 style={{ marginTop: 0 }}>Step 8 — Accettazione finale</h2><p style={{ color: "#64748b", marginBottom: 18 }}>Riepilogo conclusivo della presa in carico. La pratica di revisione può essere generata solo quando tutti i passaggi precedenti risultano completati e l’indipendenza è stata accettata.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 18 }}><Mini label="Valutazione preliminare" value={completate === domandeStep1.length ? "Completa" : `${completate}/${domandeStep1.length}`} /><Mini label="Accettazione incarico" value={completateStep2 === domandeStep2.length && !!rischioIncarico ? "Completa" : `${completateStep2}/${domandeStep2.length}`} /><Mini label="Indipendenza" value={completateStep3 === domandeStep3.length && esitoIndipendenza === "ACCETTATO" ? "Accettata" : esitoIndipendenza || `${completateStep3}/${domandeStep3.length}`} /><Mini label="Antiriciclaggio" value={completateStep4 === domandeStep4.length && !!rischioRiciclaggio ? "Completa" : `${completateStep4}/${domandeStep4.length}`} /><Mini label="Attestazione indipendenza" value={attestazioneConfermata ? "Confermata" : "Da confermare"} /><Mini label="Trasparenza" value={trasparenzaConfermata ? "Confermata" : "Da confermare"} /><Mini label="Proposta incarico" value={propostaConfermata ? "Confermata" : "Da confermare"} /><Mini label="Esito complessivo" value={stepFinaliCompleti ? "Pronto" : "Da completare"} /></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}><Field label="Data accettazione finale"><input type="date" value={dataAccettazioneFinale} onChange={(e) => setDataAccettazioneFinale(e.target.value)} style={input} /></Field><Field label="Responsabile"><input value={responsabileFinale} onChange={(e) => setResponsabileFinale(e.target.value)} placeholder="Nominativo del responsabile" style={input} /></Field></div><div style={{ marginTop: 14 }}><Field label="Note finali"><textarea value={noteFinali} onChange={(e) => setNoteFinali(e.target.value)} placeholder="Annotazioni conclusive, condizioni e misure di salvaguardia residue..." style={{ ...input, minHeight: 120, resize: "vertical" }} /></Field></div><label style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: 20, padding: 16, borderRadius: 10, border: accettazioneFinaleConfermata ? "2px solid #16a34a" : "1px solid #94a3b8", background: accettazioneFinaleConfermata ? "#f0fdf4" : "#f8fafc", cursor: "pointer" }}><input type="checkbox" checked={accettazioneFinaleConfermata} onChange={(e) => setAccettazioneFinaleConfermata(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2 }} /><span><b>Confermo l’accettazione dell’incarico di revisione</b><br/><span style={{ color: "#64748b", fontSize: 13 }}>Con la generazione della pratica i dati anagrafici e i documenti della presa in carico restano congelati nello storico.</span></span></label>{!stepFinaliCompleti && <div style={{ ...noticeOrange, marginTop: 16 }}><b>Pratica non ancora generabile:</b> completa tutti gli step precedenti e verifica che l’esito dell’indipendenza sia “Accettato”.</div>}<button type="button" onClick={() => void generaPraticaRevisione()} disabled={!stepFinaliCompleti || !accettazioneFinaleConfermata || !dataAccettazioneFinale || generatingPratica || !!praticaRevisioneId} style={{ marginTop: 20, width: "100%", padding: "15px 18px", borderRadius: 10, border: 0, background: stepFinaliCompleti && accettazioneFinaleConfermata && dataAccettazioneFinale ? "#0d6f9f" : "#94a3b8", color: "#fff", fontWeight: 900, fontSize: 15, cursor: stepFinaliCompleti && accettazioneFinaleConfermata && dataAccettazioneFinale ? "pointer" : "not-allowed" }}>{praticaRevisioneId ? "PRATICA DI REVISIONE GIÀ GENERATA" : generatingPratica ? "Generazione pratica..." : "GENERA PRATICA DI REVISIONE"}</button></section>}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 18 }}><button disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))} style={secondary}>← Step precedente</button><div style={{ display: "flex", gap: 10 }}><button onClick={() => window.print()} style={secondary}>Stampa</button><button onClick={salvaBozza} disabled={saving} style={secondary}>{saving ? "Salvataggio..." : "Salva bozza"}</button><button disabled={step === 8} onClick={() => setStep((s) => Math.min(8, s + 1))} style={primary}>Prossimo step →</button></div></div>
    </main>
  );
}

function QuestionSection({ domande, risposte, onChange }: { domande: readonly (readonly [string, string, string, string])[]; risposte: Record<string, Riga>; onChange: (codice: string, patch: Partial<Riga>) => void }) { return <div style={{ marginTop: 18 }}>{domande.map(([codice, sezione, testo, help], i) => { const nuovaSezione = i === 0 || domande[i - 1][1] !== sezione; return <React.Fragment key={codice}>{nuovaSezione && <div style={{ marginTop: i ? 24 : 0, padding: "10px 12px", borderRadius: 8, background: "#eaf8ff", color: "#075985", fontWeight: 900 }}>{sezione}</div>}<QuestionRow codice={codice} testo={testo} help={help} riga={risposte[codice]} onChange={(patch) => onChange(codice, patch)} /></React.Fragment>; })}</div>; }
function StepHeader({ title, completed, total }: { title: string; completed: number; total: number }) { return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 }}><div><h2 style={{ margin: 0, fontSize: 22 }}>{title}</h2><p style={{ margin: "7px 0 0", color: "#64748b" }}>Rispondere a ogni quesito con Sì, No o Non applicabile. Le specifiche possono essere estese.</p></div><div style={{ fontWeight: 800, color: completed === total ? "#15803d" : "#0d6f9f" }}>{completed}/{total}</div></div>; }
function QuestionRow({ codice, testo, help, riga, onChange }: { codice: string; testo: string; help: string; riga?: Riga; onChange: (patch: Partial<Riga>) => void }) { const r = riga || { risposta: "", specifica: "" }; return <div style={{ padding: "18px 0", borderTop: "1px solid #e2e8f0" }}><div style={{ display: "grid", gridTemplateColumns: "56px 1fr 360px", gap: 16, alignItems: "start" }}><div style={{ width: 42, height: 42, borderRadius: 10, display: "grid", placeItems: "center", background: "#eaf8ff", fontWeight: 900, color: "#075985" }}>{codice}</div><div><div style={{ fontWeight: 800, lineHeight: 1.45 }}>{testo}</div><div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>{help}</div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>{[["SI", "Sì"], ["NO", "No"], ["NON_APPLICABILE", "N/A"]].map(([v, l]) => <button key={v} onClick={() => onChange({ risposta: v as Risposta })} style={{ height: 40, borderRadius: 8, border: r.risposta === v ? "2px solid #0d6f9f" : "1px solid #94a3b8", background: r.risposta === v ? "#eaf8ff" : "#fff", fontWeight: 800, cursor: "pointer" }}>{l}</button>)}</div></div><textarea value={r.specifica} onChange={(e) => onChange({ specifica: e.target.value })} placeholder="Specifiche / motivazioni / evidenze acquisite..." style={{ ...input, minHeight: 92, resize: "vertical", marginTop: 12 }} /></div>; }
function RiskSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <select value={value} onChange={(e) => onChange(e.target.value)} style={input}><option value="">Seleziona</option><option value="BASSO">Basso</option><option value="MEDIO">Medio</option><option value="ALTO">Alto</option></select>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#334155" }}>{label}<div style={{ marginTop: 7 }}>{children}</div></label>; }
function Mini({ label, value }: { label: string; value: React.ReactNode }) { return <div style={{ border: "1px solid #cbd5e1", borderRadius: 9, padding: "10px 12px", background: "#fff" }}><div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>{label}</div><div style={{ fontSize: 18, fontWeight: 900, marginTop: 3 }}>{value}</div></div>; }
function rigaAggiornata(attuale: Riga | undefined, patch: Partial<Riga>): Riga { return { risposta: attuale?.risposta || "", specifica: attuale?.specifica || "", ...patch }; }
function numero(value: string) { const normalized = value.replace(/\./g, "").replace(",", "."); const parsed = Number(normalized); return Number.isFinite(parsed) ? parsed : 0; }

const card: React.CSSProperties = { background: "#fff", border: "1px solid #8cddff", borderRadius: 12, padding: 22, boxShadow: "0 12px 30px rgba(14,78,112,0.10)" };
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #94a3b8", borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff", color: "#0f172a" };
const tableInput: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: 0, borderRight: "1px solid #e2e8f0", padding: "10px 8px", fontSize: 12, background: "#fff", color: "#0f172a", minWidth: 0 };
const th: React.CSSProperties = { padding: "10px 8px", borderRight: "1px solid #bae6fd" };
const primary: React.CSSProperties = { border: 0, borderRadius: 9, padding: "11px 18px", background: "linear-gradient(110deg,#0b4f7d,#0d6f9f 58%,#1688b7)", color: "white", fontWeight: 800, cursor: "pointer" };
const secondary: React.CSSProperties = { border: "1px solid #94a3b8", borderRadius: 9, padding: "10px 16px", background: "#fff", color: "#334155", fontWeight: 800, cursor: "pointer" };
const noticeOrange: React.CSSProperties = { marginTop: 14, padding: 14, borderRadius: 10, background: "#fff7ed", border: "1px solid #fdba74", fontSize: 13, color: "#9a3412" };
