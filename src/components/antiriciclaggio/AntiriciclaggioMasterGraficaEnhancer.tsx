export function AntiriciclaggioMasterGraficaEnhancer() {
  return (
    <style jsx global>{`
      .antiriciclaggio-master-page {
        background: rgb(241 245 249) !important;
        min-height: 0 !important;
      }

      .antiriciclaggio-master-page > div,
      .antiriciclaggio-master-page > main,
      .antiriciclaggio-master-page [class*="mx-auto"][class*="max-w-"] {
        width: 100% !important;
        max-width: none !important;
      }

      .antiriciclaggio-master-page h1 {
        color: rgb(15 23 42) !important;
        font-size: 1.25rem !important;
        line-height: 1.7rem !important;
      }

      .antiriciclaggio-master-page h2,
      .antiriciclaggio-master-page h3 {
        color: rgb(15 23 42) !important;
      }

      .antiriciclaggio-master-page p,
      .antiriciclaggio-master-page small {
        color: rgb(100 116 139) !important;
      }

      .antiriciclaggio-master-page label {
        color: rgb(51 65 85) !important;
        font-size: .75rem !important;
        font-weight: 600 !important;
      }

      .antiriciclaggio-master-page input,
      .antiriciclaggio-master-page select,
      .antiriciclaggio-master-page textarea {
        min-height: 34px !important;
        border: 1px solid rgb(203 213 225) !important;
        border-radius: 6px !important;
        background: white !important;
        color: rgb(15 23 42) !important;
        font-size: .78rem !important;
        box-shadow: none !important;
      }

      .antiriciclaggio-master-page input:disabled,
      .antiriciclaggio-master-page select:disabled,
      .antiriciclaggio-master-page textarea:disabled,
      .antiriciclaggio-master-page input[readonly] {
        background: rgb(241 245 249) !important;
        color: rgb(71 85 105) !important;
      }

      .antiriciclaggio-master-page input[type="checkbox"] {
        min-height: auto !important;
        accent-color: rgb(3 105 161) !important;
      }

      .antiriciclaggio-master-page button,
      .antiriciclaggio-master-page a[class*="rounded"] {
        min-height: 34px !important;
        border-radius: 7px !important;
        font-size: .76rem !important;
        font-weight: 600 !important;
        box-shadow: none !important;
      }

      .antiriciclaggio-master-page button[class*="bg-blue"],
      .antiriciclaggio-master-page button[class*="bg-primary"],
      .antiriciclaggio-master-page button[class*="bg-black"],
      .antiriciclaggio-master-page button[class*="bg-slate-900"],
      .antiriciclaggio-master-page a[class*="bg-blue"],
      .antiriciclaggio-master-page a[class*="bg-primary"],
      .antiriciclaggio-master-page a[class*="bg-black"],
      .antiriciclaggio-master-page a[class*="bg-slate-900"] {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }

      .antiriciclaggio-master-page button[class*="bg-blue"]:hover,
      .antiriciclaggio-master-page button[class*="bg-primary"]:hover,
      .antiriciclaggio-master-page button[class*="bg-black"]:hover,
      .antiriciclaggio-master-page button[class*="bg-slate-900"]:hover {
        background: rgb(2 132 199) !important;
        border-color: rgb(2 132 199) !important;
      }

      .antiriciclaggio-master-page button[class*="border"]:not([class*="bg-red"]):not([class*="bg-green"]):not([class*="bg-blue"]):not([class*="bg-primary"]):not([class*="bg-black"]),
      .antiriciclaggio-master-page a[class*="border"]:not([class*="bg-red"]):not([class*="bg-green"]):not([class*="bg-blue"]):not([class*="bg-primary"]):not([class*="bg-black"]) {
        background: white !important;
        border-color: rgb(125 211 252) !important;
        color: rgb(3 105 161) !important;
      }

      /* AML: NON sovrascrivere i colori semantici AV1/AV2/AV4.
         Verde = completato, giallo/arancio = in avanzamento, rosso = da completare. */
      .antiriciclaggio-elenco-page button[class*="border-lime-500"] {
        background: white !important;
        border-color: rgb(132 204 22) !important;
        color: rgb(63 98 18) !important;
        box-shadow: 0 0 10px rgba(132, 204, 22, .9) !important;
      }

      .antiriciclaggio-elenco-page button[class*="border-yellow-400"] {
        background: white !important;
        border-color: rgb(250 204 21) !important;
        color: rgb(161 98 7) !important;
        box-shadow: 0 0 10px rgba(250, 204, 21, .9) !important;
      }

      .antiriciclaggio-elenco-page button[class*="border-red-500"] {
        background: white !important;
        border-color: rgb(239 68 68) !important;
        color: rgb(185 28 28) !important;
        box-shadow: 0 0 8px rgba(239, 68, 68, .5) !important;
      }

      .antiriciclaggio-elenco-page button[class*="border-blue-500"] {
        background: white !important;
        border-color: rgb(59 130 246) !important;
        color: rgb(37 99 235) !important;
        box-shadow: none !important;
      }

      .antiriciclaggio-elenco-page button:has(svg.text-red-500) {
        background: white !important;
        border-color: transparent !important;
        color: rgb(239 68 68) !important;
      }

      .antiriciclaggio-master-page .rounded-xl.border,
      .antiriciclaggio-master-page .rounded-lg.border,
      .antiriciclaggio-master-page .rounded-md.border,
      .antiriciclaggio-master-page [class*="rounded-xl"][class*="border"],
      .antiriciclaggio-master-page [class*="rounded-lg"][class*="border"],
      .antiriciclaggio-master-page [class*="rounded-md"][class*="border"] {
        border-color: rgb(186 230 253) !important;
        background: rgb(248 250 252) !important;
        box-shadow: none !important;
      }

      .antiriciclaggio-master-page table {
        width: 100% !important;
        border-collapse: separate !important;
        border-spacing: 0 !important;
        background: white !important;
        font-size: .74rem !important;
      }

      .antiriciclaggio-master-page thead {
        position: sticky !important;
        top: 0 !important;
        z-index: 8 !important;
      }

      .antiriciclaggio-master-page thead th {
        padding: 8px 9px !important;
        background: rgb(71 85 105) !important;
        color: white !important;
        border-color: rgb(51 65 85) !important;
        font-weight: 700 !important;
        white-space: nowrap !important;
      }

      .antiriciclaggio-master-page tbody td {
        padding: 8px 9px !important;
        border-color: rgb(226 232 240) !important;
        vertical-align: middle !important;
      }

      .antiriciclaggio-master-page tbody tr:hover td {
        background: rgb(240 249 255) !important;
      }

      .antiriciclaggio-master-page .overflow-x-auto,
      .antiriciclaggio-master-page .overflow-auto {
        scrollbar-gutter: stable !important;
      }

      /* Elenco AML: controlli fissi sopra, record scrollabili sotto */
      .antiriciclaggio-elenco-page {
        overflow: hidden !important;
      }

      .antiriciclaggio-elenco-page > div {
        height: 100% !important;
        min-height: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }

      .antiriciclaggio-elenco-page > div > div:has(table) {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        overflow: auto !important;
        border: 1px solid rgb(203 213 225) !important;
        border-radius: 8px !important;
        background: white !important;
      }

      /* Fascicolo documenti: alert e upload restano sopra, documenti scorrono nel riquadro */
      .antiriciclaggio-fascicolo-page {
        overflow: hidden !important;
      }

      .antiriciclaggio-fascicolo-page > div {
        height: 100% !important;
        min-height: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }

      .antiriciclaggio-fascicolo-page > div > div:has(table) {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        overflow: auto !important;
        border: 1px solid rgb(203 213 225) !important;
        border-radius: 8px !important;
        background: white !important;
      }

      /* Fascicolo: i pulsanti tabella devono avere testo sempre leggibile,
         anche durante lo stato disabled/working. */
      .antiriciclaggio-fascicolo-page tbody button[class*="border-blue-200"] {
        background: white !important;
        border-color: rgb(125 211 252) !important;
        color: rgb(3 105 161) !important;
        opacity: 1 !important;
      }

      .antiriciclaggio-fascicolo-page tbody button[class*="border-blue-200"]:disabled {
        background: rgb(248 250 252) !important;
        border-color: rgb(186 230 253) !important;
        color: rgb(71 85 105) !important;
        opacity: 1 !important;
        cursor: wait !important;
      }

      .antiriciclaggio-fascicolo-page tbody button[class*="border-red-200"] {
        background: white !important;
        border-color: rgb(254 202 202) !important;
        color: rgb(185 28 28) !important;
        opacity: 1 !important;
      }

      .antiriciclaggio-fascicolo-page tbody button[class*="border-red-200"]:disabled {
        background: rgb(248 250 252) !important;
        border-color: rgb(254 202 202) !important;
        color: rgb(127 29 29) !important;
        opacity: 1 !important;
        cursor: wait !important;
      }

      .antiriciclaggio-master-page [class*="bg-yellow-50"] {
        background: rgb(254 252 232) !important;
      }

      .antiriciclaggio-master-page [class*="bg-green-50"] {
        background: rgb(240 253 244) !important;
      }

      .antiriciclaggio-master-page [class*="bg-red-50"] {
        background: rgb(254 242 242) !important;
      }

      .antiriciclaggio-master-page [class*="bg-blue-50"] {
        background: rgb(240 249 255) !important;
      }
    `}</style>
  );
}
