import fs from "node:fs";

const path = "src/pages/compilazione-av4/[token].tsx";
let source = fs.readFileSync(path, "utf8");

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

// Major cards become document sections in print.
source = source.replace(
  /<Card className="((?:mt-6 )?border border-sky-200 bg-slate-50 shadow-sm)">/g,
  '<Card className="av4-doc-section $1">'
);

// Legal attachment is a proper document page, not a web card.
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
        .av4-doc-print-footer {
          display: none;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 11mm 14mm;
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

          .av4-doc-header {
            position: static !important;
            z-index: auto !important;
            margin: 0 0 5mm !important;
            padding: 0 0 4mm !important;
            border: 0 !important;
            border-bottom: 2px solid #0d6f9f !important;
            background: #ffffff !important;
            break-after: avoid-page !important;
            page-break-after: avoid !important;
          }

          .av4-doc-header-inner {
            display: block !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .av4-doc-eyebrow {
            display: block !important;
            margin: 0 0 1.5mm !important;
            color: #0d6f9f !important;
            font-size: 8pt !important;
            font-weight: 800 !important;
            letter-spacing: 0.08em !important;
          }

          .av4-doc-header h1 {
            margin: 0 0 1mm !important;
            color: #111827 !important;
            font-size: 18pt !important;
            line-height: 1.08 !important;
            font-weight: 800 !important;
          }

          .av4-doc-header p {
            margin: 0 !important;
            color: #475569 !important;
            font-size: 9pt !important;
            line-height: 1.3 !important;
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
            margin: 0 0 5mm !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

          .av4-doc-section:nth-of-type(n + 2) {
            break-before: page !important;
            page-break-before: always !important;
          }

          .av4-doc-section > div:first-child {
            margin: 0 0 3mm !important;
            padding: 0 0 2mm !important;
            border-bottom: 1.5px solid #0d6f9f !important;
          }

          .av4-doc-section > div:first-child h3,
          .av4-doc-section > div:first-child [class*="CardTitle"],
          .av4-doc-section > div:first-child .font-semibold {
            margin: 0 !important;
            color: #111827 !important;
            font-size: 12.5pt !important;
            line-height: 1.2 !important;
            font-weight: 800 !important;
          }

          .av4-doc-section > div:last-child {
            padding: 0 !important;
          }

          .av4-doc-body .grid {
            gap: 2.5mm 4mm !important;
          }

          .av4-doc-body .space-y-2 > :not([hidden]) ~ :not([hidden]),
          .av4-doc-body .space-y-3 > :not([hidden]) ~ :not([hidden]),
          .av4-doc-body .space-y-4 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 2.2mm !important;
          }

          .av4-doc-body label {
            margin: 0 0 0.8mm !important;
            color: #334155 !important;
            font-size: 7.5pt !important;
            line-height: 1.25 !important;
            font-weight: 700 !important;
          }

          .av4-doc-body input:not([type="checkbox"]):not([type="file"]),
          .av4-doc-body textarea,
          .av4-doc-body select {
            width: 100% !important;
            min-height: 7mm !important;
            height: auto !important;
            margin: 0 !important;
            padding: 1mm 0 !important;
            border: 0 !important;
            border-bottom: 1px solid #94a3b8 !important;
            border-radius: 0 !important;
            outline: 0 !important;
            background: #ffffff !important;
            color: #111827 !important;
            box-shadow: none !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-size: 9pt !important;
            line-height: 1.3 !important;
          }

          .av4-doc-body textarea {
            min-height: 12mm !important;
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
            width: 3.2mm !important;
            height: 3.2mm !important;
            min-width: 3.2mm !important;
            margin: 0 1.5mm 0 0 !important;
            accent-color: #0d6f9f !important;
            vertical-align: middle !important;
          }

          .av4-doc-body .rounded-lg.border,
          .av4-doc-body .rounded-md.border {
            border-color: #cbd5e1 !important;
            box-shadow: none !important;
          }

          .av4-doc-body .rounded-lg.border {
            padding: 3mm !important;
            border-radius: 1.5mm !important;
            background: #ffffff !important;
            break-inside: avoid-page !important;
            page-break-inside: avoid !important;
          }

          .av4-doc-body p,
          .av4-doc-body .text-sm,
          .av4-doc-body .text-slate-600,
          .av4-doc-body .text-slate-700,
          .av4-doc-body .text-gray-700 {
            font-size: 8.5pt !important;
            line-height: 1.42 !important;
            color: #334155 !important;
          }

          .av4-doc-body .font-semibold {
            font-weight: 700 !important;
          }

          .av4-doc-legal {
            margin: 7mm 0 0 !important;
            padding: 4mm 0 0 !important;
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
            margin: 0 0 3mm !important;
            color: #111827 !important;
            font-size: 11pt !important;
            line-height: 1.2 !important;
            font-weight: 800 !important;
            text-align: left !important;
          }

          .av4-doc-legal .whitespace-pre-line {
            font-size: 7.6pt !important;
            line-height: 1.38 !important;
            text-align: justify !important;
          }

          .av4-doc-print-footer {
            display: block !important;
            position: fixed !important;
            right: 0 !important;
            bottom: -9.5mm !important;
            left: 0 !important;
            padding-top: 1.5mm !important;
            border-top: 1px solid #cbd5e1 !important;
            color: #64748b !important;
            background: #ffffff !important;
            font-size: 7pt !important;
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

fs.writeFileSync(path, source, "utf8");
console.log("AV4 stampa professionale A4 applicata: margini, sezioni, campi, allegato e footer");
