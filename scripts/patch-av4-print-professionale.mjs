import fs from "node:fs";

const pagePath = "src/pages/compilazione-av4/[token].tsx";
const titolariPath = "src/components/antiriciclaggio/TitolariEffettiviForm.tsx";
let source = fs.readFileSync(pagePath, "utf8");
let titolari = fs.readFileSync(titolariPath, "utf8");

function replaceOrFail(label, from, to) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`[AV4 print] pattern not found: ${label}`);
  source = source.replace(from, to);
}

replaceOrFail(
  "root class",
  '<div className="public-av4-shell min-h-screen bg-slate-200/70">',
  '<div className="public-av4-shell av4-doc-root min-h-screen bg-slate-200/70">'
);

replaceOrFail(
  "header class",
  '<header className="sticky top-0 z-30 border-b-[6px] border-slate-500 bg-white">',
  '<header className="av4-doc-header sticky top-0 z-30 border-b-[6px] border-slate-500 bg-white">'
);

replaceOrFail(
  "header inner",
  '<div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-6">\n          <div>\n            <h1 className="text-4xl font-bold text-slate-900">Modello AV4</h1>',
  '<div className="av4-doc-header-inner mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-6">\n          <div>\n            <div className="av4-doc-eyebrow">ANTIRICICLAGGIO · D.LGS. 231/2007</div>\n            <h1 className="text-4xl font-bold text-slate-900">Modello AV4</h1>'
);

replaceOrFail(
  "main class",
  '<main className="bg-slate-200/70">',
  '<main className="av4-doc-main bg-slate-200/70">'
);

replaceOrFail(
  "main container",
  '<div className="mx-auto max-w-5xl px-4 pb-32 pt-4 md:px-8 md:pb-40">',
  '<div className="av4-doc-container mx-auto max-w-5xl px-4 pb-32 pt-4 md:px-8 md:pb-40">'
);

replaceOrFail(
  "print body",
  '<div id="print-area" className="space-y-6">',
  '<div id="print-area" className="av4-doc-body space-y-6">'
);

// Major cards become formal document sections.
source = source.replace(
  /<Card className="((?:mt-6 )?border border-sky-200 bg-slate-50 shadow-sm)">/g,
  '<Card className="av4-doc-section $1">'
);

// Society blocks are rendered as flat document data in print.
source = source.replaceAll(
  '<div className="space-y-4 rounded-lg border p-4">',
  '<div className="av4-print-societa space-y-4 rounded-lg border p-4">'
);

// Page 4 must begin from the relationship/funds/profession block.
source = source.replace(
  '                    <div>\n                      <label className="mb-1 block text-sm font-medium">\n                        Che le relazioni intercorrenti tra il Cliente e il titolare effettivo nonché, ove rilevi, l’esecutore sono',
  '                    <div className="av4-page4-start">\n                      <label className="mb-1 block text-sm font-medium">\n                        Che le relazioni intercorrenti tra il Cliente e il titolare effettivo nonché, ove rilevi, l’esecutore sono'
);

// Legal attachment is a proper document page.
source = source.replace(
  '<div className="md:col-span-2 my-4 rounded-lg border border-slate-300 bg-white p-5 text-slate-800">\n                      <h3 className="mb-4 text-base font-semibold">Allegato alla Dichiarazione del Cliente</h3>',
  '<div className="av4-doc-legal md:col-span-2 my-4 rounded-lg border border-slate-300 bg-white p-5 text-slate-800">\n                      <h3 className="mb-4 text-base font-semibold">Allegato alla Dichiarazione del Cliente</h3>'
);

// Operational completion banner must not enter the formal printout.
source = source.replace(
  '<div className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">',
  '<div className="av4-screen-status mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">'
);

// Keep the old footer node for screen compatibility; print footer is handled by @page.
if (!source.includes('className="av4-doc-print-footer"')) {
  replaceOrFail(
    "print footer node",
    '      </main>\n\n      <style jsx global>{`',
    '      </main>\n\n      <div className="av4-doc-print-footer">Modello AV4 · Dichiarazione del Cliente · D.Lgs. 231/2007</div>\n\n      <style jsx global>{`'
  );
}

// -----------------------------------------------------------------------------
// Titolari effettivi: keep the interactive form on screen, but print a dedicated
// document view with the same label/value/line layout used on page 1.
// -----------------------------------------------------------------------------
if (!titolari.includes('className="av4-titolari-root')) {
  const root = '<div className="mt-4 rounded-lg border p-4">';
  if (!titolari.includes(root)) throw new Error("[AV4 print] root titolari non trovato");
  titolari = titolari.replace(root, '<div className="av4-titolari-root mt-4 rounded-lg border p-4">');
}

if (!titolari.includes('className="av4-titolari-print"')) {
  const closeAnchor = '    </div>\n  );\n}';
  const closeIndex = titolari.lastIndexOf(closeAnchor);
  if (closeIndex < 0) throw new Error("[AV4 print] chiusura componente titolari non trovata");

  const printView = `      <div className="av4-titolari-print">\n        <h3 className="av4-titolari-print-title">Titolari effettivi</h3>\n        {righe.length ? righe.map((riga, index) => (\n          <div className="av4-print-persona" key={\`print-\${riga.id || "new"}-\${index}\`}>\n            <div className="av4-print-field"><div className="av4-print-field-label">Cognome e nome</div><div className="av4-print-field-value">{riga.nome_cognome || "—"}</div></div>\n            <div className="av4-print-field"><div className="av4-print-field-label">Codice fiscale</div><div className="av4-print-field-value">{riga.codice_fiscale || "—"}</div></div>\n            <div className="av4-print-field"><div className="av4-print-field-label">Luogo di nascita</div><div className="av4-print-field-value">{riga.luogo_nascita || "—"}</div></div>\n            <div className="av4-print-field"><div className="av4-print-field-label">Data di nascita</div><div className="av4-print-field-value">{riga.data_nascita ? normalizeDateForInput(riga.data_nascita).split("-").reverse().join("/") : "—"}</div></div>\n            <div className="av4-print-field"><div className="av4-print-field-label">Indirizzo residenza</div><div className="av4-print-field-value">{riga.indirizzo_residenza || "—"}</div></div>\n            <div className="av4-print-field"><div className="av4-print-field-label">Città residenza</div><div className="av4-print-field-value">{riga.citta_residenza || "—"}</div></div>\n            <div className="av4-print-field"><div className="av4-print-field-label">CAP residenza</div><div className="av4-print-field-value">{riga.cap_residenza || "—"}</div></div>\n            <div className="av4-print-field"><div className="av4-print-field-label">Nazionalità</div><div className="av4-print-field-value">{riga.nazionalita || "—"}</div></div>\n          </div>\n        )) : <div className="av4-print-empty">Nessun titolare effettivo indicato.</div>}\n      </div>\n\n`;

  titolari = titolari.slice(0, closeIndex) + printView + titolari.slice(closeIndex);
}

fs.writeFileSync(titolariPath, titolari, "utf8");

// Remove the old browser-form print rules; the real paged document CSS is injected below.
const oldPrint = `        @media print {
          body {
            background: white !important;
          }

          button,
          input[type="file"] {
            display: none !important;
          }

          .shadow,
          .shadow-sm {
            box-shadow: none !important;
          }

          .bg-slate-50,
          .bg-white {
            background: white !important;
          }

          .border {
            border-color: #d1d5db !important;
          }
        }`;

if (!source.includes(oldPrint)) {
  throw new Error("[AV4 print] old print block not found");
}
source = source.replace(oldPrint, "");

// Header copied from the approved visual (image 4), rendered inside the true page margin.
const headerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 94">
  <rect width="760" height="94" fill="#ffffff"/>
  <text x="0" y="14" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" letter-spacing="1.15" fill="#0d6f9f">ANTIRICICLAGGIO · D.LGS. 231/2007</text>
  <text x="0" y="42" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="800" fill="#111827">Modello AV4</text>
  <text x="0" y="59" font-family="Arial, Helvetica, sans-serif" font-size="11.5" fill="#475569">Dichiarazione del Cliente</text>
  <text x="0" y="75" font-family="Arial, Helvetica, sans-serif" font-size="10.5" letter-spacing="2.05" fill="#334155">COMPILAZIONE TRAMITE COLLEGAMENTO RISERVATO</text>
  <line x1="0" y1="90" x2="760" y2="90" stroke="#0d6f9f" stroke-width="3"/>
</svg>`;
const headerDataUri = `data:image/svg+xml,${encodeURIComponent(headerSvg)}`;

const pagedPrintCss = `
@page {
  size: A4 portrait;
  margin: 29mm 11mm 14mm;

  @top-center {
    content: "";
    background-image: url("${headerDataUri}");
    background-repeat: no-repeat;
    background-position: left bottom;
    background-size: 100% 23mm;
  }

  @bottom-right {
    content: "Modello AV4 · Dichiarazione del Cliente · D.Lgs. 231/2007 · Pagina " counter(page) " / " counter(pages);
    border-top: 1px solid #cbd5e1;
    padding-top: 1.3mm;
    color: #64748b;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 6.7pt;
    text-align: right;
  }
}

@media print {
  html,
  body {
    width: auto !important;
    min-width: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    color: #111827 !important;
    font-family: Arial, Helvetica, sans-serif !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .public-av4-shell {
    min-height: 0 !important;
    background: #ffffff !important;
    color: #111827 !important;
  }

  /* Real page-margin header/footer replace the HTML header/footer in print. */
  .av4-doc-header,
  .av4-doc-print-footer,
  .av4-screen-status,
  .public-av4-shell button,
  .public-av4-shell input[type="file"],
  .public-av4-shell a[href*="pdf"],
  .public-av4-shell a[target="_blank"] {
    display: none !important;
  }

  .av4-doc-main,
  .av4-doc-container,
  .av4-doc-body {
    max-width: none !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
  }

  .av4-doc-body.space-y-6 > :not([hidden]) ~ :not([hidden]) {
    margin-top: 0 !important;
  }

  .av4-doc-section {
    margin: 0 0 4mm !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: #ffffff !important;
    box-shadow: none !important;
    break-inside: auto !important;
    page-break-inside: auto !important;
  }

  /* Deterministic pagination: 1 data, 2 declarations, 3 company/owners, 4 funds/profession/signature, 5 legal attachment. */
  .av4-doc-section:nth-of-type(2) {
    break-before: page !important;
    page-break-before: always !important;
  }

  .av4-print-societa {
    break-before: page !important;
    page-break-before: always !important;
  }

  .av4-page4-start {
    break-before: page !important;
    page-break-before: always !important;
  }

  .av4-doc-section:nth-of-type(3) {
    break-before: auto !important;
    page-break-before: auto !important;
    margin-top: 4mm !important;
  }

  .av4-doc-section > div:first-child {
    margin: 0 0 2.5mm !important;
    padding: 0 0 1.5mm !important;
    border-bottom: 1.5px solid #0d6f9f !important;
    break-after: avoid-page !important;
    page-break-after: avoid !important;
  }

  .av4-doc-section > div:first-child h3,
  .av4-doc-section > div:first-child .font-semibold {
    margin: 0 !important;
    color: #111827 !important;
    font-size: 12pt !important;
    line-height: 1.15 !important;
    font-weight: 800 !important;
  }

  .av4-doc-section > div:last-child {
    padding: 0 !important;
  }

  .av4-doc-body .grid {
    gap: 1.8mm 4mm !important;
  }

  .av4-doc-body .space-y-2 > :not([hidden]) ~ :not([hidden]),
  .av4-doc-body .space-y-3 > :not([hidden]) ~ :not([hidden]),
  .av4-doc-body .space-y-4 > :not([hidden]) ~ :not([hidden]) {
    margin-top: 1.6mm !important;
  }

  .av4-doc-body label {
    margin: 0 0 0.5mm !important;
    color: #334155 !important;
    font-size: 7.4pt !important;
    line-height: 1.18 !important;
    font-weight: 700 !important;
  }

  .av4-doc-body input:not([type="checkbox"]):not([type="file"]),
  .av4-doc-body textarea,
  .av4-doc-body select {
    width: 100% !important;
    min-height: 5.7mm !important;
    height: auto !important;
    margin: 0 !important;
    padding: 0.7mm 0 !important;
    border: 0 !important;
    border-bottom: 1px solid #94a3b8 !important;
    border-radius: 0 !important;
    outline: 0 !important;
    background: #ffffff !important;
    color: #111827 !important;
    box-shadow: none !important;
    font-family: Arial, Helvetica, sans-serif !important;
    font-size: 8.4pt !important;
    line-height: 1.2 !important;
  }

  .av4-doc-body textarea {
    min-height: 7mm !important;
    resize: none !important;
    white-space: pre-wrap !important;
  }

  .av4-doc-body select {
    appearance: none !important;
    -webkit-appearance: none !important;
    padding-right: 0 !important;
  }

  .av4-doc-body input[type="date"]::-webkit-calendar-picker-indicator {
    display: none !important;
  }

  .av4-doc-body input[type="checkbox"] {
    display: inline-block !important;
    width: 3mm !important;
    height: 3mm !important;
    min-width: 3mm !important;
    margin: 0 1.4mm 0 0 !important;
    accent-color: #0d6f9f !important;
    vertical-align: middle !important;
  }

  .av4-doc-body p,
  .av4-doc-body .text-sm,
  .av4-doc-body .text-slate-600,
  .av4-doc-body .text-slate-700,
  .av4-doc-body .text-gray-700 {
    font-size: 7.9pt !important;
    line-height: 1.32 !important;
    color: #334155 !important;
  }

  .av4-doc-body .font-semibold {
    font-weight: 700 !important;
  }

  /* Society details: same full-width line presentation as page 1. */
  .av4-print-societa {
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: #ffffff !important;
    box-shadow: none !important;
    break-inside: auto !important;
    page-break-inside: auto !important;
  }

  .av4-print-societa > .grid {
    display: block !important;
  }

  .av4-print-societa > .grid > div {
    display: block !important;
    margin: 0 0 1.5mm !important;
  }

  .av4-print-societa .rounded-lg.border,
  .av4-print-societa .av4-titolari-root {
    margin: 1.8mm 0 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: #ffffff !important;
  }

  /* Beneficial owners: print-only flat view with labels and lines. */
  .av4-titolari-root > :not(.av4-titolari-print) {
    display: none !important;
  }

  .av4-titolari-root {
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: #ffffff !important;
  }

  .av4-titolari-print {
    display: block !important;
    margin: 1.8mm 0 0 !important;
  }

  .av4-titolari-print-title {
    margin: 0 0 1.5mm !important;
    color: #111827 !important;
    font-size: 10pt !important;
    font-weight: 800 !important;
  }

  .av4-print-persona {
    margin: 0 0 2.4mm !important;
    padding: 0 !important;
    break-inside: avoid-page !important;
    page-break-inside: avoid !important;
  }

  .av4-print-field {
    margin: 0 0 1.25mm !important;
  }

  .av4-print-field-label {
    margin-bottom: 0.3mm !important;
    color: #334155 !important;
    font-size: 7.3pt !important;
    line-height: 1.12 !important;
    font-weight: 700 !important;
  }

  .av4-print-field-value {
    min-height: 4.5mm !important;
    padding: 0.55mm 0 0.65mm !important;
    border-bottom: 1px solid #94a3b8 !important;
    color: #111827 !important;
    font-size: 8.3pt !important;
    line-height: 1.15 !important;
  }

  .av4-print-empty {
    color: #64748b !important;
    font-size: 7.8pt !important;
  }

  /* Legal attachment = page 5. */
  .av4-doc-legal {
    margin: 0 !important;
    padding: 2mm 0 0 !important;
    border: 0 !important;
    border-top: 1.5px solid #0d6f9f !important;
    border-radius: 0 !important;
    background: #ffffff !important;
    break-before: page !important;
    page-break-before: always !important;
    break-inside: auto !important;
    page-break-inside: auto !important;
    color: #1f2937 !important;
    text-align: justify !important;
  }

  .av4-doc-legal h3 {
    margin: 0 0 2mm !important;
    color: #111827 !important;
    font-size: 10.3pt !important;
    line-height: 1.12 !important;
    font-weight: 800 !important;
    text-align: left !important;
  }

  .av4-doc-legal .whitespace-pre-line {
    font-size: 7pt !important;
    line-height: 1.28 !important;
    text-align: justify !important;
  }

  .shadow,
  .shadow-sm {
    box-shadow: none !important;
  }

  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`;

// Insert a raw style tag so modern paged-media margin boxes reach Chromium unchanged.
replaceOrFail(
  "paged print style",
  '      <style jsx global>{`',
  `      <style>{\`${pagedPrintCss.replace(/`/g, "\\`")}\`}</style>\n\n      <style jsx global>{\``
);

fs.writeFileSync(pagePath, source, "utf8");
console.log("AV4 stampa professionale v3: header/footer @page, 5 pagine e nessuna intestazione nel flusso");
