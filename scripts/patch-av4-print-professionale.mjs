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

// Fixed print footer in the reserved lower margin.
if (!source.includes('className="av4-doc-print-footer"')) {
  replaceOrFail(
    "print footer",
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

const professionalPrint = `        .av4-doc-eyebrow,
        .av4-doc-print-footer,
        .av4-titolari-print {
          display: none;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 31mm 11mm 14mm;
          }

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

          /* Fixed header: Chrome repeats fixed elements on every printed page. */
          .av4-doc-header {
            position: fixed !important;
            top: -25mm !important;
            right: 0 !important;
            left: 0 !important;
            z-index: 1000 !important;
            height: 22mm !important;
            margin: 0 !important;
            padding: 0 0 3mm !important;
            border: 0 !important;
            border-bottom: 2px solid #0d6f9f !important;
            background: #ffffff !important;
          }

          .av4-doc-header-inner {
            display: block !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .av4-doc-eyebrow {
            display: block !important;
            margin: 0 0 1mm !important;
            color: #0d6f9f !important;
            font-size: 8pt !important;
            font-weight: 800 !important;
            letter-spacing: 0.08em !important;
          }

          .av4-doc-header h1 {
            margin: 0 0 0.8mm !important;
            color: #111827 !important;
            font-size: 18pt !important;
            line-height: 1.05 !important;
            font-weight: 800 !important;
          }

          .av4-doc-header p {
            margin: 0 !important;
            color: #475569 !important;
            font-size: 8.5pt !important;
            line-height: 1.2 !important;
          }

          .av4-doc-main,
          .av4-doc-container {
            max-width: none !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          .av4-screen-status,
          .public-av4-shell button,
          .public-av4-shell input[type="file"],
          .public-av4-shell a[href*="pdf"],
          .public-av4-shell a[target="_blank"] {
            display: none !important;
          }

          .av4-doc-body {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
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

          /* Page 1 = dati principali. Page 2 starts declarations. Firma stays with page 4. */
          .av4-doc-section:nth-of-type(2) {
            break-before: page !important;
            page-break-before: always !important;
          }

          .av4-doc-section:nth-of-type(3) {
            break-before: auto !important;
            page-break-before: auto !important;
            margin-top: 5mm !important;
          }

          .av4-doc-section > div:first-child {
            margin: 0 0 2.5mm !important;
            padding: 0 0 1.5mm !important;
            border-bottom: 1.5px solid #0d6f9f !important;
            break-after: avoid-page !important;
            page-break-after: avoid !important;
          }

          .av4-doc-section > div:first-child h3,
          .av4-doc-section > div:first-child [class*="CardTitle"],
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
            gap: 2mm 4mm !important;
          }

          .av4-doc-body .space-y-2 > :not([hidden]) ~ :not([hidden]),
          .av4-doc-body .space-y-3 > :not([hidden]) ~ :not([hidden]),
          .av4-doc-body .space-y-4 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 1.8mm !important;
          }

          .av4-doc-body label {
            margin: 0 0 0.6mm !important;
            color: #334155 !important;
            font-size: 7.5pt !important;
            line-height: 1.2 !important;
            font-weight: 700 !important;
          }

          .av4-doc-body input:not([type="checkbox"]):not([type="file"]),
          .av4-doc-body textarea,
          .av4-doc-body select {
            width: 100% !important;
            min-height: 6mm !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0.8mm 0 !important;
            border: 0 !important;
            border-bottom: 1px solid #94a3b8 !important;
            border-radius: 0 !important;
            outline: 0 !important;
            background: #ffffff !important;
            color: #111827 !important;
            box-shadow: none !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-size: 8.5pt !important;
            line-height: 1.25 !important;
          }

          .av4-doc-body textarea {
            min-height: 8mm !important;
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
            font-size: 8pt !important;
            line-height: 1.35 !important;
            color: #334155 !important;
          }

          .av4-doc-body .font-semibold {
            font-weight: 700 !important;
          }

          /* Society details: same full-width line presentation as page 1. */
          .av4-print-societa {
            margin: 2mm 0 3mm !important;
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
            margin: 0 0 1.8mm !important;
          }

          .av4-print-societa .rounded-lg.border,
          .av4-print-societa .av4-titolari-root {
            margin: 2mm 0 0 !important;
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
            margin: 2mm 0 0 !important;
          }

          .av4-titolari-print-title {
            margin: 0 0 2mm !important;
            color: #111827 !important;
            font-size: 10.5pt !important;
            font-weight: 800 !important;
          }

          .av4-print-persona {
            margin: 0 0 3mm !important;
            padding: 0 !important;
            break-inside: avoid-page !important;
            page-break-inside: avoid !important;
          }

          .av4-print-field {
            margin: 0 0 1.6mm !important;
          }

          .av4-print-field-label {
            margin-bottom: 0.4mm !important;
            color: #334155 !important;
            font-size: 7.5pt !important;
            line-height: 1.15 !important;
            font-weight: 700 !important;
          }

          .av4-print-field-value {
            min-height: 5mm !important;
            padding: 0.7mm 0 0.8mm !important;
            border-bottom: 1px solid #94a3b8 !important;
            color: #111827 !important;
            font-size: 8.5pt !important;
            line-height: 1.2 !important;
          }

          .av4-print-empty {
            color: #64748b !important;
            font-size: 8pt !important;
          }

          /* The attachment must be the next and final page (page 5). */
          .av4-doc-legal {
            margin: 0 !important;
            padding: 3mm 0 0 !important;
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
            margin: 0 0 2.5mm !important;
            color: #111827 !important;
            font-size: 10.5pt !important;
            line-height: 1.15 !important;
            font-weight: 800 !important;
            text-align: left !important;
          }

          .av4-doc-legal .whitespace-pre-line {
            font-size: 7.2pt !important;
            line-height: 1.32 !important;
            text-align: justify !important;
          }

          .av4-doc-print-footer {
            display: block !important;
            position: fixed !important;
            right: 0 !important;
            bottom: -9.5mm !important;
            left: 0 !important;
            padding-top: 1.2mm !important;
            border-top: 1px solid #cbd5e1 !important;
            color: #64748b !important;
            background: #ffffff !important;
            font-size: 6.8pt !important;
            line-height: 1 !important;
            text-align: right !important;
          }

          .shadow,
          .shadow-sm {
            box-shadow: none !important;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }`;

if (source.includes(oldPrint)) {
  source = source.replace(oldPrint, professionalPrint);
} else if (!source.includes(".av4-doc-print-footer")) {
  throw new Error("[AV4 print] old print block not found");
}

fs.writeFileSync(pagePath, source, "utf8");
console.log("AV4 stampa professionale v2: header ripetuto, 5 pagine, società/titolari flat e firma accorpata");
