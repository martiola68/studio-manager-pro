import fs from "node:fs";

const path = "src/pages/revisione-controllo/presa-in-carico.tsx";
let source = fs.readFileSync(path, "utf8");

const css = `.print-document{display:none}@media print{@page{size:A4;margin:12mm 11mm 14mm}html,body{background:#fff!important}.presa-in-carico-page{max-width:none!important;margin:0!important;padding:0!important;background:#fff!important;color:#111827!important;font-family:Arial,Helvetica,sans-serif!important}.presa-operativa{display:none!important}.print-document{display:block!important;width:100%!important;font-size:9pt!important;line-height:1.35!important}.print-header{border-bottom:2px solid #0d6f9f;padding-bottom:4mm;margin-bottom:5mm}.print-eyebrow{font-size:8pt;font-weight:800;letter-spacing:.08em;color:#0d6f9f}.print-title{font-size:18pt;margin:1.5mm 0 1mm;font-weight:800}.print-subtitle{font-size:9pt;color:#475569;margin:0}.print-grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:2.5mm;margin-top:3mm}.print-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:2.5mm;margin-top:3mm}.print-box{border:1px solid #cbd5e1;border-radius:1.8mm;padding:2.5mm;break-inside:avoid}.print-label{font-size:7pt;text-transform:uppercase;letter-spacing:.04em;color:#64748b;font-weight:800}.print-value{margin-top:1mm;font-size:9pt;font-weight:700;white-space:pre-wrap}.print-big{font-size:13pt;font-weight:900}.print-section{margin-top:4mm}.print-page{break-before:page;page-break-before:always}.print-head{display:flex;align-items:flex-start;gap:3mm;border-bottom:1.5px solid #0d6f9f;padding-bottom:2mm;margin-bottom:3mm}.print-step{min-width:15mm;background:#eaf8ff;color:#075985;border:1px solid #7dd3fc;border-radius:1.8mm;padding:1.5mm 2mm;text-align:center;font-weight:900;font-size:7.5pt}.print-head h2{font-size:13pt;margin:0}.print-muted{font-size:8pt;color:#64748b;margin:1mm 0 0}.print-group{font-size:7.5pt;font-weight:900;color:#075985;background:#eaf8ff;padding:1.5mm 2mm;margin:2.5mm 0 1mm;border-radius:1.5mm}.print-q{display:grid;grid-template-columns:12mm 1fr 24mm;gap:2mm;border-bottom:1px solid #e2e8f0;padding:2mm 0;break-inside:avoid}.print-q-code{font-weight:900;color:#075985}.print-q-text{font-weight:700}.print-q-answer{text-align:right;font-weight:900}.print-specifica{grid-column:2/4;color:#475569;font-size:8pt;padding-top:.8mm;white-space:pre-wrap}.print-note{margin-top:3mm;border:1px solid #cbd5e1;border-radius:1.8mm;padding:3mm;break-inside:avoid}.print-note-title{font-weight:900;margin-bottom:1mm}.print-note p{margin:0;white-space:pre-wrap}.print-table{width:100%;border-collapse:collapse;margin-top:3mm;font-size:8pt}.print-table th{background:#eaf8ff;color:#075985;text-align:left;font-weight:900;border:1px solid #cbd5e1;padding:2mm}.print-table td{border:1px solid #cbd5e1;padding:2mm;vertical-align:top}.print-declaration{border:1px solid #cbd5e1;border-radius:1.8mm;padding:4mm;margin-top:3mm;break-inside:avoid}.print-declaration h3{font-size:10.5pt;text-align:center;margin:0 0 3mm}.print-declaration p,.print-declaration li{font-size:8.5pt}.print-signature{display:grid;grid-template-columns:1fr 1fr;gap:10mm;margin-top:10mm}.print-signature-line{border-top:1px solid #64748b;padding-top:1.5mm;font-size:7.5pt;color:#475569}.print-footer{margin-top:6mm;padding-top:2mm;border-top:1px solid #cbd5e1;font-size:7pt;color:#64748b;text-align:right}.print-wide{grid-column:1/-1}}`;

const mainOld = `    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px 60px", fontFamily: "Inter,Arial,sans-serif", color: "#0f172a" }}>`;
if (!source.includes('className="presa-in-carico-page"')) {
  if (!source.includes(mainOld)) throw new Error("Main della presa in carico non trovato");
  const mainNew = `    <main className="presa-in-carico-page" style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px 60px", fontFamily: "Inter,Arial,sans-serif", color: "#0f172a" }}>\n      <style>{${JSON.stringify(css)}}</style>\n      <div className="presa-operativa">`;
  source = source.replace(mainOld, mainNew);
}

const helpers = `
function printDate(value?: string | null) {
  if (!value) return "—";
  const v = String(value).slice(0, 10);
  const p = v.split("-");
  return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : String(value);
}
function printAnswer(value?: Risposta | null) {
  if (value === "SI") return "Sì";
  if (value === "NO") return "No";
  if (value === "NON_APPLICABILE") return "N/A";
  return "—";
}
function PrintBox({ label, value, big = false, wide = false }: { label: string; value: React.ReactNode; big?: boolean; wide?: boolean }) {
  return <div className={"print-box" + (wide ? " print-wide" : "")}><div className="print-label">{label}</div><div className={big ? "print-value print-big" : "print-value"}>{value ?? "—"}</div></div>;
}
function PrintNote({ title, text }: { title: string; text?: string | null }) {
  return <div className="print-note"><div className="print-note-title">{title}</div><p>{text || "—"}</p></div>;
}
function PrintSection({ n, title, sub, page = false, children }: { n: string; title: string; sub?: string; page?: boolean; children: React.ReactNode }) {
  return <section className={"print-section" + (page ? " print-page" : "")}><div className="print-head"><div className="print-step">STEP {n}</div><div><h2>{title}</h2>{sub ? <p className="print-muted">{sub}</p> : null}</div></div>{children}</section>;
}
function PrintQuestions({ domande, risposte }: { domande: readonly any[]; risposte: Record<string, Riga> }) {
  return <div>{domande.map((raw: any, index: number) => {
    const item = raw as any[];
    const code = String(item[0]);
    const grouped = item.length >= 4;
    const group = grouped ? String(item[1]) : "";
    const text = grouped ? String(item[2]) : String(item[1]);
    const prev = index > 0 ? (domande[index - 1] as any[]) : null;
    const prevGroup = prev && prev.length >= 4 ? String(prev[1]) : "";
    const row = risposte[code];
    return <React.Fragment key={code}>{grouped && group !== prevGroup ? <div className="print-group">{group}</div> : null}<div className="print-q"><div className="print-q-code">{code}</div><div className="print-q-text">{text}</div><div className="print-q-answer">{printAnswer(row?.risposta)}</div>{row?.specifica ? <div className="print-specifica"><b>Specifiche:</b> {row.specifica}</div> : null}</div></React.Fragment>;
  })}</div>;
}
`;

if (!source.includes("function PrintQuestions")) {
  const anchor = "\nfunction QuestionSection(";
  const i = source.indexOf(anchor);
  if (i < 0) throw new Error("Anchor helper di stampa non trovato");
  source = source.slice(0, i) + "\n" + helpers + source.slice(i);
}

const printDocument = `
      </div>
      <section className="print-document">
        <header className="print-header">
          <div className="print-eyebrow">REVISIONE E CONTROLLO · FASCICOLO PRELIMINARE</div>
          <h1 className="print-title">Presa in carico dell’incarico di revisione</h1>
          <p className="print-subtitle">Valutazione, accettazione, indipendenza, antiriciclaggio e formalizzazione dell’incarico.</p>
          <div className="print-grid2">
            <PrintBox label="Cliente / società" value={snapshot?.cliente?.ragione_sociale || clienteSelezionato?.ragione_sociale || "—"} />
            <PrintBox label="Bilancio al" value={printDate(dataBilancio)} />
            <PrintBox label="CF / P.IVA" value={snapshot?.cliente?.codice_fiscale || snapshot?.cliente?.partita_iva || "—"} />
            <PrintBox label="Stato" value={praticaRevisioneId || preincaricoStato === "generato" ? "Pratica generata" : preincaricoId ? "Bozza salvata" : "Nuova bozza"} />
          </div>
          <div className="print-grid4">
            <PrintBox label="Soci" value={soci.length} big />
            <PrintBox label="Amministratori" value={amministratori.length} big />
            <PrintBox label="Organo di controllo" value={controllo.length} big />
            <PrintBox label="Data stampa" value={new Date().toLocaleDateString("it-IT")} />
          </div>
        </header>

        <PrintSection n="1" title="Dati del cliente e valutazione preliminare" sub={String(completate) + "/" + String(domandeStep1.length) + " quesiti compilati"}>
          <PrintQuestions domande={domandeStep1} risposte={risposte} />
          <PrintNote title="Conclusioni della valutazione preliminare" text={conclusioni} />
        </PrintSection>

        <PrintSection n="2" title="Accettazione incarico" sub={String(completateStep2) + "/" + String(domandeStep2.length) + " quesiti compilati"} page>
          <PrintQuestions domande={domandeStep2} risposte={risposteStep2} />
          <div className="print-grid2"><PrintBox label="Rischio complessivo incarico" value={rischioIncarico || "—"} /><PrintBox label="Data accettazione" value={printDate(dataAccettazioneStep2)} /></div>
          <PrintNote title="Conclusioni" text={conclusioniStep2} />
        </PrintSection>

        <PrintSection n="3" title="Valutazione di indipendenza" sub={String(completateStep3) + "/" + String(domandeStep3.length) + " quesiti compilati"} page>
          <PrintQuestions domande={domandeStep3} risposte={risposteStep3} />
          <div className="print-grid2">
            <PrintBox label="Rischio indipendenza" value={rischioIndipendenza || "—"} /><PrintBox label="Esito" value={esitoIndipendenza || "—"} />
            <PrintBox label="Compensi revisione / sindaco (S)" value={compensoS || "—"} /><PrintBox label="Altri compensi società / gruppo (C)" value={compensoC || "—"} />
            <PrintBox label="Compensi totali professionista / rete (CT)" value={compensoCT || "—"} /><PrintBox label="(S + C) / CT" value={rapportoSCCT.toFixed(2) + "%"} />
          </div>
          <PrintNote title="Misure di salvaguardia" text={misureSalvaguardia} />
          <PrintNote title="Conclusioni sulla valutazione di indipendenza" text={conclusioniStep3} />
        </PrintSection>

        <PrintSection n="4" title="Valutazione rischio riciclaggio" sub={String(completateStep4) + "/" + String(domandeStep4.length) + " quesiti compilati"} page>
          <PrintQuestions domande={domandeStep4} risposte={risposteStep4} />
          <div className="print-grid2">
            <PrintBox label="Natura giuridica" value={scoreA || "—"} /><PrintBox label="Prevalente attività svolta" value={scoreB || "—"} />
            <PrintBox label="Comportamento al conferimento" value={scoreC || "—"} /><PrintBox label="Area geografica" value={scoreD || "—"} />
            <PrintBox label="Esito rischio riciclaggio" value={rischioRiciclaggio || "—"} wide />
          </div>
          <PrintNote title="Conclusioni" text={conclusioniStep4} />
        </PrintSection>

        <PrintSection n="5" title="Attestazione di indipendenza" page>
          <div className="print-declaration">
            <h3>DICHIARAZIONE DI INDIPENDENZA</h3>
            <p>Il revisore dichiara di aver letto e compreso le norme e i principi applicabili in materia di indipendenza, incluso l’art. 10 del D.Lgs. 39/2010, i principi ISA Italia applicabili, il Codice Italiano di Etica e Indipendenza e le procedure interne di controllo della qualità.</p>
            <p>Conferma che, sulla base delle informazioni ottenute e delle verifiche effettuate, non risultano situazioni che compromettano l’indipendenza o costituiscano cause ostative all’accettazione o alla prosecuzione dell’incarico.</p>
            <div className="print-grid2"><PrintBox label="Data attestazione" value={printDate(dataAttestazione)} /><PrintBox label="Revisore / firmatario" value={firmatarioAttestazione || "—"} /><PrintBox label="Conferma" value={attestazioneConfermata ? "Confermata" : "Da confermare"} wide /></div>
            <div className="print-signature"><div className="print-signature-line">Firma del revisore</div><div className="print-signature-line">Data</div></div>
          </div>
        </PrintSection>

        <PrintSection n="6" title="Dichiarazione di trasparenza" page>
          <table className="print-table"><thead><tr><th>Società / ente</th><th>ATECO</th><th>Sede</th><th>CF / P.IVA</th><th>Incarico / ruolo</th></tr></thead><tbody>
            {incarichiTrasparenza.filter((r) => r.ente || r.ateco || r.sede || r.codiceFiscale || r.ruolo).length ? incarichiTrasparenza.filter((r) => r.ente || r.ateco || r.sede || r.codiceFiscale || r.ruolo).map((r, i) => <tr key={i}><td>{r.ente || "—"}</td><td>{r.ateco || "—"}</td><td>{r.sede || "—"}</td><td>{r.codiceFiscale || "—"}</td><td>{r.ruolo || "—"}</td></tr>) : <tr><td colSpan={5}>Nessun incarico indicato.</td></tr>}
          </tbody></table>
          <div className="print-grid2"><PrintBox label="Data dichiarazione" value={printDate(dataTrasparenza)} /><PrintBox label="Revisore / firmatario" value={firmatarioTrasparenza || "—"} /><PrintBox label="Conferma" value={trasparenzaConfermata ? "Confermata" : "Da confermare"} wide /></div>
        </PrintSection>

        <PrintSection n="7" title="Proposta di incarico di revisione" page>
          <div className="print-grid2">
            <PrintBox label="Data proposta" value={printDate(dataProposta)} /><PrintBox label="Decorrenza incarico" value={printDate(decorrenzaProposta)} />
            <PrintBox label="Numero esercizi" value={numeroEserciziProposta || "—"} /><PrintBox label="Esercizi interessati" value={eserciziProposta || "—"} />
            <PrintBox label="Compenso annuale" value={compensoAnnualeProposta || "—"} /><PrintBox label="Responsabile incarico" value={responsabileProposta || "—"} />
            <PrintBox label="Copertura assicurativa" value={polizzaProposta || "—"} wide /><PrintBox label="Attività aggiuntive" value={attivitaAggiuntiveProposta || "—"} wide /><PrintBox label="Note e condizioni particolari" value={noteProposta || "—"} wide />
          </div>
          <div className="print-declaration"><h3>PROPOSTA DI INCARICO DI REVISIONE LEGALE</h3><p>L’incarico comprende la revisione dei bilanci degli esercizi indicati, le verifiche periodiche previste dalla normativa, la valutazione della regolare tenuta della contabilità e l’espressione del giudizio professionale sul bilancio nel suo complesso.</p><p>La direzione resta responsabile della redazione del bilancio, del sistema di controllo interno e della disponibilità delle informazioni necessarie allo svolgimento delle procedure di revisione.</p><div className="print-signature"><div className="print-signature-line">Per accettazione della società</div><div className="print-signature-line">Revisore / responsabile incarico</div></div></div>
        </PrintSection>

        <PrintSection n="8" title="Accettazione finale" page>
          <div className="print-grid2">
            <PrintBox label="Valutazione preliminare" value={completate === domandeStep1.length ? "Completa" : String(completate) + "/" + String(domandeStep1.length)} />
            <PrintBox label="Accettazione incarico" value={completateStep2 === domandeStep2.length && !!rischioIncarico ? "Completa" : String(completateStep2) + "/" + String(domandeStep2.length)} />
            <PrintBox label="Indipendenza" value={completateStep3 === domandeStep3.length && esitoIndipendenza === "ACCETTATO" ? "Accettata" : esitoIndipendenza || String(completateStep3) + "/" + String(domandeStep3.length)} />
            <PrintBox label="Antiriciclaggio" value={completateStep4 === domandeStep4.length && !!rischioRiciclaggio ? "Completa" : String(completateStep4) + "/" + String(domandeStep4.length)} />
            <PrintBox label="Attestazione indipendenza" value={attestazioneConfermata ? "Confermata" : "Da confermare"} /><PrintBox label="Trasparenza" value={trasparenzaConfermata ? "Confermata" : "Da confermare"} />
            <PrintBox label="Proposta incarico" value={propostaConfermata ? "Confermata" : "Da confermare"} /><PrintBox label="Esito complessivo" value={stepFinaliCompleti ? "Pronto" : "Da completare"} />
            <PrintBox label="Data accettazione finale" value={printDate(dataAccettazioneFinale)} /><PrintBox label="Responsabile" value={responsabileFinale || "—"} /><PrintBox label="Conferma finale" value={accettazioneFinaleConfermata ? "Confermata" : "Da confermare"} wide />
          </div>
          <PrintNote title="Note finali" text={noteFinali} />
          <div className="print-signature"><div className="print-signature-line">Firma del responsabile</div><div className="print-signature-line">Data</div></div>
        </PrintSection>

        <div className="print-footer">Documento generato da Studio Manager Pro · Presa in carico incarico di revisione</div>
      </section>`;

if (!source.includes('className="print-document"')) {
  const close = source.lastIndexOf("\n    </main>");
  if (close < 0) throw new Error("Chiusura main non trovata");
  source = source.slice(0, close) + printDocument + source.slice(close);
}

if (!source.includes('className="presa-in-carico-page"')) throw new Error("Wrapper stampa non applicato");
if (!source.includes('className="print-document"')) throw new Error("Documento di stampa non applicato");
if (!source.includes("function PrintQuestions")) throw new Error("Helper questionari stampa non applicato");
if (!source.includes("@page{size:A4")) throw new Error("CSS A4 non incorporato nel TSX");

fs.writeFileSync(path, source, "utf8");
console.log("Layout di stampa professionale A4 applicato a tutti gli 8 step");
