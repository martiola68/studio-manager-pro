import fs from "node:fs";

const path = "src/pages/revisione-controllo/presa-in-carico.tsx";
let source = fs.readFileSync(path, "utf8");

const oldSnapshot = `  async function caricaSnapshot() {
    setLoadingSnapshot(true); setErrore("");
    const supabase = getSupabaseClient() as any;
    const [clienteRes, organiRes] = await Promise.all([supabase.from("tbclienti").select("*").eq("id", clienteId).maybeSingle(), supabase.from("tbclienti_organi").select("*").eq("cliente_id", clienteId)]);
    if (clienteRes.error) { setErrore(clienteRes.error.message); setLoadingSnapshot(false); return; }
    if (organiRes.error) { setErrore(organiRes.error.message); setLoadingSnapshot(false); return; }
    setSnapshot({ acquisito_il: new Date().toISOString(), cliente: clienteRes.data || null, organi_sociali: organiRes.data || [] }); setLoadingSnapshot(false);
  }
`;

const newSnapshot = `  async function caricaSnapshot() {
    setLoadingSnapshot(true); setErrore("");
    const supabase = getSupabaseClient() as any;

    try {
      const [clienteRes, organiResponse] = await Promise.all([
        supabase.from("tbclienti").select("*").eq("id", clienteId).maybeSingle(),
        fetch(\`/api/clienti-organi?cliente_id=\${encodeURIComponent(clienteId)}\`, { cache: "no-store" }),
      ]);

      if (clienteRes.error) throw new Error(clienteRes.error.message);
      const organiPayload = await organiResponse.json();
      if (!organiResponse.ok) {
        throw new Error(organiPayload?.error || "Errore nel caricamento di soci e organi sociali.");
      }

      setSnapshot({
        acquisito_il: new Date().toISOString(),
        cliente: clienteRes.data || null,
        organi_sociali: Array.isArray(organiPayload?.organi) ? organiPayload.organi : [],
      });
    } catch (e: any) {
      setSnapshot(null);
      setErrore(e?.message || "Errore durante l'acquisizione dei dati societari.");
    } finally {
      setLoadingSnapshot(false);
    }
  }
`;

const oldRoles = `  const organiAllaData = (snapshot?.organi_sociali || []).filter((o: any) => organoValidoAllaData(o, dataBilancio));
  const soci = organiAllaData.filter((o: any) => o.ruolo === "socio");
  const amministratori = organiAllaData.filter((o: any) => ["amministratore_unico", "amministratore", "presidente_cda", "amministratore_delegato", "liquidatore"].includes(o.ruolo));
  const controllo = organiAllaData.filter((o: any) => ["sindaco", "presidente_collegio_sindacale", "revisore"].includes(o.ruolo));
`;

const newRoles = `  const organiAllaData = (snapshot?.organi_sociali || []).filter((o: any) => organoValidoAllaData(o, dataBilancio));
  const soci = organiAllaData.filter((o: any) => o.ruolo === "socio");
  const amministratori = organiAllaData.filter((o: any) => [
    "amministratore",
    "amministratore_unico",
    "amministratore_delegato",
    "consigliere_delegato",
    "presidente_cda",
    "vice_presidente_cda",
    "consigliere",
    "liquidatore",
    "rappresentante_legale",
  ].includes(o.ruolo));
  const controllo = organiAllaData.filter((o: any) => [
    "sindaco_effettivo",
    "presidente_collegio_sindacale",
    "sindaco_unico",
    "sindaco_supplente",
    "revisore",
    "sindaco",
  ].includes(o.ruolo));
`;

const oldCards = `{snapshot && <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 12 }}><Mini label="Soci" value={soci.length} /><Mini label="Amministratori" value={amministratori.length} /><Mini label="Organo di controllo" value={controllo.length} /><Mini label="CF / P.IVA" value={snapshot.cliente?.codice_fiscale || snapshot.cliente?.partita_iva || "—"} /></div>}`;
const newCards = `<div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 12 }}><Mini label="Soci" value={soci.length} /><Mini label="Amministratori" value={amministratori.length} /><Mini label="Organo di controllo" value={controllo.length} /><Mini label="CF / P.IVA" value={snapshot?.cliente?.codice_fiscale || snapshot?.cliente?.partita_iva || "—"} /></div>`;

if (source.includes(oldSnapshot)) {
  source = source.replace(oldSnapshot, newSnapshot);
} else if (!source.includes("/api/clienti-organi?cliente_id=")) {
  throw new Error("Blocco caricaSnapshot atteso non trovato");
}

if (source.includes(oldRoles)) source = source.replace(oldRoles, newRoles);
if (source.includes(oldCards)) source = source.replace(oldCards, newCards);

const printCss = '.print-document{display:none}@media print{@page{size:A4;margin:13mm 12mm 15mm}html,body{background:#fff!important}.presa-in-carico-page{max-width:none!important;margin:0!important;padding:0!important;background:#fff!important;color:#111827!important;font-family:Arial,Helvetica,sans-serif!important}.presa-operativa{display:none!important}.print-document{display:block!important;width:100%!important;font-size:9.5pt!important;line-height:1.35!important}.print-header{border-bottom:2px solid #0d6f9f;padding-bottom:5mm;margin-bottom:5mm}.print-eyebrow{font-size:8.5pt;font-weight:800;letter-spacing:.08em;color:#0d6f9f}.print-title{font-size:19pt;margin:2mm 0 1mm;font-weight:800}.print-subtitle{font-size:9.5pt;color:#475569;margin:0}.print-meta-grid,.print-summary-grid,.print-kv-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:2.5mm;margin-top:4mm}.print-summary-grid{grid-template-columns:repeat(4,1fr)}.print-meta,.print-summary,.print-kv{border:1px solid #cbd5e1;border-radius:2mm;padding:2.5mm;break-inside:avoid}.print-meta-label,.print-kv-label,.print-summary-label{font-size:7.5pt;text-transform:uppercase;letter-spacing:.04em;color:#64748b;font-weight:800}.print-meta-value,.print-kv-value{margin-top:1mm;font-size:9.5pt;font-weight:700;white-space:pre-wrap}.print-summary-value{margin-top:1mm;font-size:14pt;font-weight:800;color:#0f172a}.print-section{margin-top:5mm}.print-page-break{break-before:page;page-break-before:always}.print-section-head{display:flex;align-items:flex-start;gap:3mm;border-bottom:1.5px solid #0d6f9f;padding-bottom:2mm;margin-bottom:3mm}.print-step-badge{min-width:16mm;background:#eaf8ff;color:#075985;border:1px solid #7dd3fc;border-radius:2mm;padding:1.5mm 2mm;text-align:center;font-weight:900;font-size:8pt}.print-section h2{font-size:14pt;margin:0}.print-section-note{font-size:8.5pt;color:#64748b;margin:1mm 0 0}.print-question-group{font-size:8pt;font-weight:900;color:#075985;background:#eaf8ff;padding:1.5mm 2mm;margin:2.5mm 0 1mm;border-radius:1.5mm}.print-question-row{display:grid;grid-template-columns:13mm 1fr 27mm;gap:2.5mm;border-bottom:1px solid #e2e8f0;padding:2.2mm 0;break-inside:avoid}.print-question-code{font-weight:900;color:#075985}.print-question-text{font-weight:700}.print-answer{font-weight:900;text-align:right}.print-specifica{grid-column:2/4;color:#475569;font-size:8.5pt;padding-top:1mm;white-space:pre-wrap}.print-note{margin-top:3mm;border:1px solid #cbd5e1;border-radius:2mm;padding:3mm;break-inside:avoid}.print-note-title{font-weight:900;margin-bottom:1mm}.print-note p{margin:0;white-space:pre-wrap}.print-table{width:100%;border-collapse:collapse;margin-top:3mm;font-size:8.5pt}.print-table th{background:#eaf8ff;color:#075985;text-align:left;font-weight:900;border:1px solid #cbd5e1;padding:2mm}.print-table td{border:1px solid #cbd5e1;padding:2mm;vertical-align:top}.print-declaration{border:1px solid #cbd5e1;border-radius:2mm;padding:4mm;margin-top:3mm}.print-declaration h3{font-size:11pt;text-align:center;margin:0 0 3mm}.print-declaration p,.print-declaration li{font-size:9pt}.print-status-ok{font-weight:900;color:#166534}.print-status-ko{font-weight:900;color:#991b1b}.print-signature{display:grid;grid-template-columns:1fr 1fr;gap:10mm;margin-top:9mm}.print-signature-line{border-top:1px solid #64748b;padding-top:1.5mm;font-size:8pt;color:#475569}.print-footer-note{margin-top:6mm;padding-top:2mm;border-top:1px solid #cbd5e1;font-size:7.5pt;color:#64748b;text-align:right}.print-wide{grid-column:1/-1}}';

const mainMarker = `    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px 60px", fontFamily: "Inter,Arial,sans-serif", color: "#0f172a" }}>`;
const mainReplacement = `    <main className="presa-in-carico-page" style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px 60px", fontFamily: "Inter,Arial,sans-serif", color: "#0f172a" }}>
      <style>{printCss}</style>
      <div className="presa-operativa">`;

if (!source.includes('className="presa-in-carico-page"')) {
  if (!source.includes(mainMarker)) throw new Error("Main della presa in carico non trovato");
  source = source.replace(mainMarker, mainReplacement);
}

const printDocument = `
      </div>
      <section className="print-document">
        <header className="print-header">
          <div className="print-eyebrow">REVISIONE E CONTROLLO · FASCICOLO PRELIMINARE</div>
          <h1 className="print-title">Presa in carico dell’incarico di revisione</h1>
          <p className="print-subtitle">Valutazione preliminare, accettazione, indipendenza, antiriciclaggio e formalizzazione dell’incarico.</p>
          <div className="print-meta-grid">
            <PrintKV label="Cliente / società" value={snapshot?.cliente?.ragione_sociale || clienteSelezionato?.ragione_sociale || "—"} />
            <PrintKV label="Bilancio al" value={dataPrint(dataBilancio)} />
            <PrintKV label="CF / P.IVA" value={snapshot?.cliente?.codice_fiscale || snapshot?.cliente?.partita_iva || "—"} />
            <PrintKV label="Stato" value={praticaRevisioneId || preincaricoStato === "generato" ? "Pratica generata" : preincaricoId ? "Bozza salvata" : "Nuova bozza"} />
          </div>
          <div className="print-summary-grid">
            <div className="print-summary"><div className="print-summary-label">Soci</div><div className="print-summary-value">{soci.length}</div></div>
            <div className="print-summary"><div className="print-summary-label">Amministratori</div><div className="print-summary-value">{amministratori.length}</div></div>
            <div className="print-summary"><div className="print-summary-label">Organo di controllo</div><div className="print-summary-value">{controllo.length}</div></div>
            <div className="print-summary"><div className="print-summary-label">Data stampa</div><div className="print-summary-value" style={{ fontSize: "10pt" }}>{new Date().toLocaleDateString("it-IT")}</div></div>
          </div>
        </header>

        <PrintSection numero="1" titolo="Dati del cliente e valutazione preliminare" sottotitolo={String(completate) + "/" + String(domandeStep1.length) + " quesiti compilati"}>
          <PrintQuestionTable domande={domandeStep1} risposte={risposte} />
          <PrintNote titolo="Conclusioni della valutazione preliminare" testo={conclusioni} />
        </PrintSection>

        <PrintSection numero="2" titolo="Accettazione incarico" sottotitolo={String(completateStep2) + "/" + String(domandeStep2.length) + " quesiti compilati"} pageBreak>
          <PrintQuestionTable domande={domandeStep2} risposte={risposteStep2} />
          <div className="print-kv-grid">
            <PrintKV label="Rischio complessivo dell’incarico" value={rischioIncarico || "—"} />
            <PrintKV label="Data accettazione" value={dataPrint(dataAccettazioneStep2)} />
          </div>
          <PrintNote titolo="Conclusioni" testo={conclusioniStep2} />
        </PrintSection>

        <PrintSection numero="3" titolo="Valutazione di indipendenza" sottotitolo={String(completateStep3) + "/" + String(domandeStep3.length) + " quesiti compilati"} pageBreak>
          <PrintQuestionTable domande={domandeStep3} risposte={risposteStep3} />
          <div className="print-kv-grid">
            <PrintKV label="Rischio indipendenza" value={rischioIndipendenza || "—"} />
            <PrintKV label="Esito" value={esitoIndipendenza || "—"} />
            <PrintKV label="Compensi revisione / sindaco (S)" value={compensoS || "—"} />
            <PrintKV label="Altri compensi società / gruppo (C)" value={compensoC || "—"} />
            <PrintKV label="Compensi totali professionista / rete (CT)" value={compensoCT || "—"} />
            <PrintKV label="(S + C) / CT" value={rapportoSCCT.toFixed(2) + "%"} />
            <PrintKV label="S / (S + C)" value={rapportoSsuSC.toFixed(4)} />
          </div>
          <PrintNote titolo="Misure di salvaguardia" testo={misureSalvaguardia} />
          <PrintNote titolo="Conclusioni sulla valutazione di indipendenza" testo={conclusioniStep3} />
        </PrintSection>

        <PrintSection numero="4" titolo="Valutazione rischio riciclaggio" sottotitolo={String(completateStep4) + "/" + String(domandeStep4.length) + " quesiti compilati"} pageBreak>
          <PrintQuestionTable domande={domandeStep4} risposte={risposteStep4} />
          <div className="print-kv-grid">
            <PrintKV label="Natura giuridica" value={scoreA || "—"} />
            <PrintKV label="Prevalente attività svolta" value={scoreB || "—"} />
            <PrintKV label="Comportamento al conferimento" value={scoreC || "—"} />
            <PrintKV label="Area geografica" value={scoreD || "—"} />
            <PrintKV label="Esito rischio riciclaggio" value={rischioRiciclaggio || "—"} wide />
          </div>
          <PrintNote titolo="Conclusioni" testo={conclusioniStep4} />
        </PrintSection>

        <PrintSection numero="5" titolo="Attestazione di indipendenza" pageBreak>
          <div className="print-declaration">
            <h3>DICHIARAZIONE DI INDIPENDENZA</h3>
            <p>Il revisore dichiara di aver letto e compreso le norme e i principi applicabili in materia di indipendenza, inclusi l’art. 10 del D.Lgs. 39/2010, i principi ISA Italia applicabili, il Codice Italiano di Etica e Indipendenza e le procedure interne di controllo della qualità.</p>
            <p>Conferma inoltre che, sulla base delle informazioni ottenute e delle verifiche effettuate, non sono state riscontrate situazioni che compromettano l’indipendenza o costituiscano cause ostative all’accettazione o alla prosecuzione dell’incarico.</p>
            <div className="print-kv-grid">
              <PrintKV label="Data attestazione" value={dataPrint(dataAttestazione)} />
              <PrintKV label="Revisore / firmatario" value={firmatarioAttestazione || "—"} />
              <PrintKV label="Conferma" value={attestazioneConfermata ? "Confermata" : "Da confermare"} wide />
            </div>
            <div className="print-signature"><div className="print-signature-line">Firma del revisore</div><div className="print-signature-line">Data</div></div>
          </div>
        </PrintSection>

        <PrintSection numero="6" titolo="Dichiarazione di trasparenza" pageBreak>
          <table className="print-table">
            <thead><tr><th>Società / ente</th><th>ATECO</th><th>Sede</th><th>CF / P.IVA</th><th>Incarico / ruolo</th></tr></thead>
            <tbody>
              {incarichiTrasparenza.filter((r) => r.ente || r.ateco || r.sede || r.codiceFiscale || r.ruolo).length ? incarichiTrasparenza.filter((r) => r.ente || r.ateco || r.sede || r.codiceFiscale || r.ruolo).map((r, i) => <tr key={i}><td>{r.ente || "—"}</td><td>{r.ateco || "—"}</td><td>{r.sede || "—"}</td><td>{r.codiceFiscale || "—"}</td><td>{r.ruolo || "—"}</td></tr>) : <tr><td colSpan={5}>Nessun incarico indicato.</td></tr>}
            </tbody>
          </table>
          <div className="print-kv-grid">
            <PrintKV label="Data dichiarazione" value={dataPrint(dataTrasparenza)} />
            <PrintKV label="Revisore / firmatario" value={firmatarioTrasparenza || "—"} />
            <PrintKV label="Conferma" value={trasparenzaConfermata ? "Confermata" : "Da confermare"} wide />
          </div>
        </PrintSection>

        <PrintSection numero="7" titolo="Proposta di incarico di revisione" pageBreak>
          <div className="print-kv-grid">
            <PrintKV label="Data proposta" value={dataPrint(dataProposta)} />
            <PrintKV label="Decorrenza incarico" value={dataPrint(decorrenzaProposta)} />
            <PrintKV label="Numero esercizi" value={numeroEserciziProposta || "—"} />
            <PrintKV label="Esercizi interessati" value={eserciziProposta || "—"} />
            <PrintKV label="Compenso annuale" value={compensoAnnualeProposta || "—"} />
            <PrintKV label="Responsabile incarico" value={responsabileProposta || "—"} />
            <PrintKV label="Copertura assicurativa" value={polizzaProposta || "—"} wide />
            <PrintKV label="Attività aggiuntive" value={attivitaAggiuntiveProposta || "—"} wide />
            <PrintKV label="Note e condizioni particolari" value={noteProposta || "—"} wide />
            <PrintKV label="Conferma proposta" value={propostaConfermata ? "Confermata" : "Da confermare"} wide />
          </div>
          <div className="print-declaration">
            <h3>PROPOSTA DI INCARICO DI REVISIONE LEGALE</h3>
            <p>L’incarico comprende la revisione dei bilanci degli esercizi indicati, le verifiche periodiche previste dalla normativa, la valutazione della regolare tenuta della contabilità e l’espressione del giudizio professionale sul bilancio nel suo complesso.</p>
            <p>La direzione resta responsabile della redazione del bilancio, del sistema di controllo interno e della disponibilità delle informazioni necessarie allo svolgimento delle procedure di revisione. Restano fermi gli obblighi di indipendenza, riservatezza e antiriciclaggio.</p>
            <div className="print-signature"><div className="print-signature-line">Per accettazione della società</div><div className="print-signature-line">Revisore / responsabile incarico</div></div>
          </div>
        </PrintSection>

        <PrintSection numero="8" titolo="Accettazione finale" pageBreak>
          <div className="print-kv-grid">
            <PrintKV label="Valutazione preliminare" value={completate === domandeStep1.length ? "Completa" : String(completate) + "/" + String(domandeStep1.length)} />
            <PrintKV label="Accettazione incarico" value={completateStep2 === domandeStep2.length && !!rischioIncarico ? "Completa" : String(completateStep2) + "/" + String(domandeStep2.length)} />
            <PrintKV label="Indipendenza" value={completateStep3 === domandeStep3.length && esitoIndipendenza === "ACCETTATO" ? "Accettata" : esitoIndipendenza || String(completateStep3) + "/" + String(domandeStep3.length)} />
            <PrintKV label="Antiriciclaggio" value={completateStep4 === domandeStep4.length && !!rischioRiciclaggio ? "Completa" : String(completateStep4) + "/" + String(domandeStep4.length)} />
            <PrintKV label="Attestazione indipendenza" value={attestazioneConfermata ? "Confermata" : "Da confermare"} />
            <PrintKV label="Trasparenza" value={trasparenzaConfermata ? "Confermata" : "Da confermare"} />
            <PrintKV label="Proposta incarico" value={propostaConfermata ? "Confermata" : "Da confermare"} />
            <PrintKV label="Esito complessivo" value={stepFinaliCompleti ? "Pronto" : "Da completare"} />
            <PrintKV label="Data accettazione finale" value={dataPrint(dataAccettazioneFinale)} />
            <PrintKV label="Responsabile" value={responsabileFinale || "—"} />
            <PrintKV label="Conferma finale" value={accettazioneFinaleConfermata ? "Confermata" : "Da confermare"} wide />
          </div>
          <PrintNote titolo="Note finali" testo={noteFinali} />
          <div className="print-signature"><div className="print-signature-line">Firma del responsabile</div><div className="print-signature-line">Data</div></div>
        </PrintSection>

        <div className="print-footer-note">Documento generato da Studio Manager Pro · Presa in carico incarico di revisione</div>
      </section>`;

if (!source.includes('className="print-document"')) {
  const closeMain = source.lastIndexOf("\n    </main>");
  if (closeMain < 0) throw new Error("Chiusura main non trovata");
  source = source.slice(0, closeMain) + printDocument + source.slice(closeMain);
}

const printHelpers = `
function dataPrint(value?: string | null) {
  if (!value) return "—";
  const raw = String(value).slice(0, 10);
  const parts = raw.split("-");
  return parts.length === 3 ? parts[2] + "/" + parts[1] + "/" + parts[0] : String(value);
}
function rispostaPrint(value?: Risposta | null) {
  if (value === "SI") return "Sì";
  if (value === "NO") return "No";
  if (value === "NON_APPLICABILE") return "N/A";
  return "—";
}
function PrintKV({ label, value, wide = false }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return <div className={"print-kv" + (wide ? " print-wide" : "")}><div className="print-kv-label">{label}</div><div className="print-kv-value">{value || "—"}</div></div>;
}
function PrintNote({ titolo, testo }: { titolo: string; testo?: string | null }) {
  return <div className="print-note"><div className="print-note-title">{titolo}</div><p>{testo || "—"}</p></div>;
}
function PrintSection({ numero, titolo, sottotitolo, pageBreak = false, children }: { numero: string; titolo: string; sottotitolo?: string; pageBreak?: boolean; children: React.ReactNode }) {
  return <section className={"print-section" + (pageBreak ? " print-page-break" : "")}><div className="print-section-head"><div className="print-step-badge">STEP {numero}</div><div><h2>{titolo}</h2>{sottotitolo && <p className="print-section-note">{sottotitolo}</p>}</div></div>{children}</section>;
}
function PrintQuestionTable({ domande, risposte }: { domande: readonly (readonly any[])[]; risposte: Record<string, Riga> }) {
  return <div>{domande.map((raw, index) => {
    const item = raw as readonly any[];
    const codice = String(item[0]);
    const hasSection = item.length >= 4;
    const sezione = hasSection ? String(item[1]) : "";
    const testo = hasSection ? String(item[2]) : String(item[1]);
    const precedente = index > 0 ? domande[index - 1] as readonly any[] : null;
    const sezionePrecedente = precedente && precedente.length >= 4 ? String(precedente[1]) : "";
    const riga = risposte[codice];
    return <React.Fragment key={codice}>{hasSection && sezione !== sezionePrecedente && <div className="print-question-group">{sezione}</div>}<div className="print-question-row"><div className="print-question-code">{codice}</div><div className="print-question-text">{testo}</div><div className="print-answer">{rispostaPrint(riga?.risposta)}</div>{riga?.specifica && <div className="print-specifica"><b>Specifiche:</b> {riga.specifica}</div>}</div></React.Fragment>;
  })}</div>;
}
`;

if (!source.includes("function PrintQuestionTable")) {
  const helperAnchor = "\nfunction QuestionSection(";
  const helperIndex = source.indexOf(helperAnchor);
  if (helperIndex < 0) throw new Error("Anchor helper stampa non trovato");
  source = source.slice(0, helperIndex) + "\n" + printHelpers + source.slice(helperIndex);
}

const snapshotStart = source.indexOf("async function caricaSnapshot");
const snapshotEnd = source.indexOf("async function caricaBozzaEsistente");
const snapshotBlock = source.slice(snapshotStart, snapshotEnd);
if (snapshotBlock.includes('supabase.from("tbclienti_organi")')) throw new Error("La presa in carico legge ancora direttamente tbclienti_organi");
if (!snapshotBlock.includes("/api/clienti-organi?cliente_id=")) throw new Error("Endpoint clienti-organi non applicato");
if (!source.includes('"consigliere_delegato"') || !source.includes('"sindaco_effettivo"')) throw new Error("Ruoli societari non allineati");
if (source.includes(oldCards) || !source.includes('value={snapshot?.cliente?.codice_fiscale || snapshot?.cliente?.partita_iva || "—"}')) throw new Error("Card riepilogo non impostate come sempre visibili");
if (!source.includes('className="print-document"') || !source.includes("function PrintQuestionTable") || !source.includes("@page{size:A4")) throw new Error("Layout di stampa professionale non applicato");

fs.writeFileSync(path, source, "utf8");
console.log("Presa in carico allineata a /api/clienti-organi; card riepilogo sempre visibili; stampa professionale A4 applicata a tutti gli 8 step");
