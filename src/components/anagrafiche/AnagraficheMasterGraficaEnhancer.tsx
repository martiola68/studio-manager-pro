export function AnagraficheMasterGraficaEnhancer() {
  return (
    <style jsx global>{`
      .anagrafiche-master-page {
        background: rgb(241 245 249) !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      .anagrafiche-master-page > div,
      .anagrafiche-master-page > main,
      .anagrafiche-master-page [class*="mx-auto"][class*="max-w-"] {
        width: 100% !important;
        max-width: none !important;
      }

      .anagrafiche-master-page > div,
      .anagrafiche-master-page > main {
        min-height: 0 !important;
      }

      .anagrafiche-master-page h1 {
        color: rgb(15 23 42) !important;
        font-size: 1.25rem !important;
        line-height: 1.7rem !important;
        font-weight: 700 !important;
      }

      .anagrafiche-master-page h2,
      .anagrafiche-master-page h3,
      .anagrafiche-master-page h4 {
        color: rgb(15 23 42) !important;
      }

      .anagrafiche-master-page p,
      .anagrafiche-master-page small,
      .anagrafiche-master-page [class*="text-gray-500"],
      .anagrafiche-master-page [class*="text-slate-500"] {
        color: rgb(100 116 139) !important;
      }

      .anagrafiche-master-page label {
        color: rgb(51 65 85) !important;
        font-size: .75rem !important;
        font-weight: 600 !important;
      }

      .anagrafiche-master-page input,
      .anagrafiche-master-page select,
      .anagrafiche-master-page textarea,
      .anagrafiche-master-page button[role="combobox"] {
        min-height: 34px !important;
        border: 1px solid rgb(203 213 225) !important;
        border-radius: 6px !important;
        background: white !important;
        color: rgb(15 23 42) !important;
        font-size: .78rem !important;
        box-shadow: none !important;
      }

      .anagrafiche-master-page input:disabled,
      .anagrafiche-master-page select:disabled,
      .anagrafiche-master-page textarea:disabled,
      .anagrafiche-master-page input[readonly] {
        background: rgb(241 245 249) !important;
        color: rgb(71 85 105) !important;
      }

      .anagrafiche-master-page input[type="checkbox"] {
        min-height: auto !important;
        accent-color: rgb(3 105 161) !important;
      }

      .anagrafiche-master-page button,
      .anagrafiche-master-page a[class*="rounded"] {
        min-height: 34px !important;
        border-radius: 7px !important;
        font-size: .76rem !important;
        font-weight: 600 !important;
        box-shadow: none !important;
      }

      .anagrafiche-master-page button[class*="bg-blue"],
      .anagrafiche-master-page button[class*="bg-primary"],
      .anagrafiche-master-page button[class*="bg-black"],
      .anagrafiche-master-page button[class*="bg-slate-900"],
      .anagrafiche-master-page a[class*="bg-blue"],
      .anagrafiche-master-page a[class*="bg-primary"],
      .anagrafiche-master-page a[class*="bg-black"],
      .anagrafiche-master-page a[class*="bg-slate-900"] {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }

      .anagrafiche-master-page button[class*="bg-blue"]:hover,
      .anagrafiche-master-page button[class*="bg-primary"]:hover,
      .anagrafiche-master-page button[class*="bg-black"]:hover,
      .anagrafiche-master-page button[class*="bg-slate-900"]:hover {
        background: rgb(2 132 199) !important;
        border-color: rgb(2 132 199) !important;
      }

      .anagrafiche-master-page button[class*="border"]:not([class*="bg-red"]):not([class*="bg-green"]):not([class*="bg-blue"]):not([class*="bg-primary"]):not([class*="bg-black"]),
      .anagrafiche-master-page a[class*="border"]:not([class*="bg-red"]):not([class*="bg-green"]):not([class*="bg-blue"]):not([class*="bg-primary"]):not([class*="bg-black"]) {
        background: white !important;
        border-color: rgb(125 211 252) !important;
        color: rgb(3 105 161) !important;
      }

      .anagrafiche-master-page .rounded-xl.border,
      .anagrafiche-master-page .rounded-lg.border,
      .anagrafiche-master-page .rounded-md.border,
      .anagrafiche-master-page [class*="rounded-xl"][class*="border"],
      .anagrafiche-master-page [class*="rounded-lg"][class*="border"],
      .anagrafiche-master-page [class*="rounded-md"][class*="border"] {
        border-color: rgb(186 230 253) !important;
        background: rgb(248 250 252) !important;
        box-shadow: none !important;
      }

      .anagrafiche-master-page table {
        width: 100% !important;
        border-collapse: separate !important;
        border-spacing: 0 !important;
        background: white !important;
        font-size: .74rem !important;
      }

      .anagrafiche-master-page thead {
        position: sticky !important;
        top: 0 !important;
        z-index: 8 !important;
      }

      .anagrafiche-master-page thead th {
        padding: 8px 9px !important;
        background: rgb(71 85 105) !important;
        color: white !important;
        border-color: rgb(51 65 85) !important;
        font-weight: 700 !important;
        white-space: nowrap !important;
      }

      .anagrafiche-master-page tbody td {
        padding: 8px 9px !important;
        border-color: rgb(226 232 240) !important;
        vertical-align: middle !important;
      }

      .anagrafiche-master-page tbody tr:hover td {
        background: rgb(240 249 255) !important;
      }

      .anagrafiche-master-page [role="tablist"] {
        border-color: rgb(186 230 253) !important;
        background: rgb(241 245 249) !important;
      }

      .anagrafiche-master-page [role="tab"][data-state="active"] {
        background: white !important;
        color: rgb(3 105 161) !important;
      }

      .anagrafiche-master-page .overflow-x-auto,
      .anagrafiche-master-page .overflow-auto {
        scrollbar-gutter: stable !important;
      }

      .anagrafiche-master-scroll-page > div,
      .anagrafiche-master-scroll-page > main {
        height: 100% !important;
        min-height: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }

      .anagrafiche-master-scroll-page > div > div:has(table),
      .anagrafiche-master-scroll-page > main > div:has(table),
      .anagrafiche-master-scroll-page [class*="overflow-x-auto"]:has(table),
      .anagrafiche-master-scroll-page [class*="overflow-auto"]:has(table) {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        overflow: auto !important;
        border: 1px solid rgb(203 213 225) !important;
        border-radius: 8px !important;
        background: white !important;
      }

      .anagrafiche-master-page [class*="bg-yellow-50"] {
        background: rgb(254 252 232) !important;
      }

      .anagrafiche-master-page [class*="bg-green-50"] {
        background: rgb(240 253 244) !important;
      }

      .anagrafiche-master-page [class*="bg-red-50"] {
        background: rgb(254 242 242) !important;
      }

      .anagrafiche-master-page [class*="bg-blue-50"] {
        background: rgb(240 249 255) !important;
      }

      .anagrafiche-master-page [class*="shadow-xl"],
      .anagrafiche-master-page [class*="shadow-lg"],
      .anagrafiche-master-page [class*="shadow-md"] {
        box-shadow: 0 8px 20px rgb(15 23 42 / 0.08) !important;
      }

      /* CLIENTI: una sola scrollbar verticale, quella interna alla tabella. */
      .anagrafiche-master-page:has(table th.sticky.left-0):has(table th.sticky.right-0) {
        overflow: hidden !important;
      }

      .anagrafiche-master-page:has(table th.sticky.left-0):has(table th.sticky.right-0)
        [class*="overflow-x-auto"]:has(> table) {
        overflow-x: auto !important;
        overflow-y: auto !important;
        max-height: none !important;
        min-height: 0 !important;
      }

      /* CLIENTI: distribuzione colonne su tutta la larghezza disponibile. */
      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0) {
        table-layout: fixed !important;
        width: 100% !important;
        min-width: 1750px !important;
      }

      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0) th:nth-child(1),
      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0) td:nth-child(1) {
        width: 6% !important;
        min-width: 6% !important;
        max-width: 6% !important;
      }

      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0) th:nth-child(2),
      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0) td:nth-child(2) {
        left: 6% !important;
        width: 28% !important;
        min-width: 28% !important;
        max-width: 28% !important;
      }

      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0) th:nth-child(3),
      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0) td:nth-child(3),
      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0) th:nth-child(4),
      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0) td:nth-child(4) {
        width: 10% !important;
        min-width: 10% !important;
        max-width: 10% !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0) th:nth-child(5),
      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0) td:nth-child(5),
      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0) th:nth-child(6),
      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0) td:nth-child(6) {
        width: 6.57% !important;
        min-width: 6.57% !important;
        max-width: 6.57% !important;
        text-align: center !important;
      }

      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0) th:nth-child(7),
      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0) td:nth-child(7) {
        width: 32.86% !important;
        min-width: 32.86% !important;
        max-width: 32.86% !important;
      }

      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0) th:nth-child(7) > div,
      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0) td:nth-child(7) > div {
        grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
      }

      /* CLIENTI: stato sempre leggibile. */
      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0)
        td:nth-child(5) span[class*="bg-green-600"] {
        background: rgb(22 163 74) !important;
        border-color: rgb(22 163 74) !important;
        color: white !important;
        min-width: 58px !important;
        justify-content: center !important;
      }

      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0)
        td:nth-child(5) span[class*="bg-secondary"] {
        background: rgb(226 232 240) !important;
        border-color: rgb(203 213 225) !important;
        color: rgb(51 65 85) !important;
        min-width: 58px !important;
        justify-content: center !important;
      }

      /* CLIENTI: stato organi sociali rosso se incompleto, verde se completo. */
      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0)
        td:nth-child(7) button[class*="border-red-500"] {
        background: white !important;
        border-color: rgb(239 68 68) !important;
        color: rgb(220 38 38) !important;
      }

      .anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0)
        td:nth-child(7) button[class*="border-green-500"] {
        background: white !important;
        border-color: rgb(34 197 94) !important;
        color: rgb(22 163 74) !important;
      }

      /* RAPPRESENTANTI LEGALI: intestazione, tabella compatta e scroll verticale interno. */
      .anagrafiche-master-page:has(input[placeholder^="Cerca per cognome e nome"]) > div.p-3 {
        position: relative !important;
        display: flex !important;
        flex-direction: column !important;
        height: 100% !important;
        min-height: 0 !important;
        overflow: hidden !important;
        padding-top: 50px !important;
      }

      .anagrafiche-master-page:has(input[placeholder^="Cerca per cognome e nome"]) > div.p-3::before {
        content: "Rappresentanti legali";
        position: absolute;
        top: 10px;
        left: 12px;
        color: rgb(15 23 42);
        font-size: 1.25rem;
        line-height: 1.7rem;
        font-weight: 700;
      }

      .anagrafiche-master-page:has(input[placeholder^="Cerca per cognome e nome"]) > div.p-3 > [class*="rounded"] {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        overflow: hidden !important;
        background: white !important;
        border: 1px solid rgb(125 211 252) !important;
      }

      .anagrafiche-master-page:has(input[placeholder^="Cerca per cognome e nome"]) [class*="CardContent"],
      .anagrafiche-master-page:has(input[placeholder^="Cerca per cognome e nome"]) .space-y-3.px-3.pb-3.pt-0 {
        display: flex !important;
        flex-direction: column !important;
        height: 100% !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      .anagrafiche-master-page:has(input[placeholder^="Cerca per cognome e nome"])
        .overflow-x-auto.rounded-md.border {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        overflow-x: auto !important;
        overflow-y: auto !important;
        scrollbar-gutter: stable !important;
        background: white !important;
      }

      .anagrafiche-master-page:has(input[placeholder^="Cerca per cognome e nome"])
        .overflow-x-auto.rounded-md.border > div > .sticky {
        position: sticky !important;
        top: 0 !important;
        z-index: 20 !important;
        background: rgb(71 85 105) !important;
        color: white !important;
        border-bottom-color: rgb(51 65 85) !important;
        padding-top: 6px !important;
        padding-bottom: 6px !important;
      }

      .anagrafiche-master-page:has(input[placeholder^="Cerca per cognome e nome"])
        .overflow-x-auto.rounded-md.border > div > div:last-child > div {
        min-height: 36px !important;
        padding-top: 4px !important;
        padding-bottom: 4px !important;
        background: white !important;
        border-color: rgb(203 213 225) !important;
      }

      .anagrafiche-master-page:has(input[placeholder^="Cerca per cognome e nome"])
        .overflow-x-auto.rounded-md.border > div > div:last-child > div:hover {
        background: white !important;
      }

      .anagrafiche-master-page:has(input[placeholder^="Cerca per cognome e nome"])
        .overflow-x-auto.rounded-md.border > div > div:last-child > div > div:nth-child(2) span {
        background: rgb(241 245 249) !important;
        color: rgb(51 65 85) !important;
      }

      .anagrafiche-master-page:has(input[placeholder^="Cerca per cognome e nome"])
        .overflow-x-auto.rounded-md.border > div > div:last-child > div > div:nth-child(5) span {
        color: rgb(51 65 85) !important;
      }

      .anagrafiche-master-page:has(input[placeholder^="Cerca per cognome e nome"])
        .overflow-x-auto.rounded-md.border > div > div:last-child > div > div:nth-child(5) span:first-child {
        display: none !important;
      }

      .anagrafiche-master-page:has(input[placeholder^="Cerca per cognome e nome"])
        .overflow-x-auto.rounded-md.border > div > div:last-child > div > div:nth-child(3) span,
      .anagrafiche-master-page:has(input[placeholder^="Cerca per cognome e nome"])
        .overflow-x-auto.rounded-md.border > div > div:last-child > div > div:nth-child(7) span {
        min-width: 76px !important;
        padding-top: 3px !important;
        padding-bottom: 3px !important;
      }

      .anagrafiche-master-page:has(input[placeholder^="Cerca per cognome e nome"])
        .flex.flex-wrap.gap-2.pt-1.text-xs.text-muted-foreground {
        display: none !important;
      }
    `}</style>
  );
}
