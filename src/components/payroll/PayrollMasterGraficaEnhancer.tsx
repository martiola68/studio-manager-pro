export function PayrollMasterGraficaEnhancer() {
  return (
    <style jsx global>{`
      .payroll-master-page {
        background: rgb(241 245 249) !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      .payroll-master-page > div,
      .payroll-master-page > main {
        width: 100% !important;
        max-width: none !important;
        height: 100% !important;
        min-height: 0 !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }

      .payroll-master-page > div > :not(:has(table)),
      .payroll-master-page > main > :not(:has(table)) { flex: 0 0 auto; }
      .payroll-master-page > div > :has(table),
      .payroll-master-page > main > :has(table) { flex: 1 1 auto !important; min-height: 0 !important; }

      .payroll-master-page > div > div:has(> table),
      .payroll-master-page > main > div:has(> table),
      .payroll-master-page > div > div:has(table) > div[class*="overflow-x-auto"],
      .payroll-master-page > div > div:has(table) > div[class*="overflow-auto"],
      .payroll-master-page > main > div:has(table) > div[class*="overflow-x-auto"],
      .payroll-master-page > main > div:has(table) > div[class*="overflow-auto"] {
        min-height: 0 !important; overflow-y: auto !important; overflow-x: auto !important; max-height: none !important;
      }

      .payroll-master-page > div > div:has(table):not(:has(> table)),
      .payroll-master-page > main > div:has(table):not(:has(> table)) {
        display: flex !important; flex-direction: column !important; min-height: 0 !important; overflow: hidden !important;
      }

      .payroll-master-page > div.mx-auto.max-w-\[1800px\].p-4 { flex: 1 1 auto !important; min-height: 0 !important; overflow: hidden !important; }
      .payroll-master-page > div.mx-auto.max-w-\[1800px\].p-4 > div.mb-4 { flex: 0 0 auto !important; }
      .payroll-master-page > div.mx-auto.max-w-\[1800px\].p-4 > div[class*="rounded-xl"],
      .payroll-master-page > div.mx-auto.max-w-\[1800px\].p-4 > div[class*="border"]:has(table) {
        flex: 1 1 auto !important; min-height: 0 !important; display: flex !important; flex-direction: column !important; overflow: hidden !important;
      }
      .payroll-master-page > div.mx-auto.max-w-\[1800px\].p-4 .overflow-x-auto.rounded-md.border {
        flex: 1 1 auto !important; min-height: 0 !important; overflow-y: auto !important; overflow-x: auto !important; scrollbar-gutter: stable !important;
      }

      .payroll-presenze-page > div.mx-auto.flex.max-w-\[1800px\].flex-col.gap-4.p-4 {
        height: 100% !important; min-height: 0 !important; max-width: none !important; flex: 1 1 auto !important; overflow: hidden !important;
      }
      .payroll-presenze-page > div.mx-auto.flex.max-w-\[1800px\].flex-col.gap-4.p-4 > div:last-child,
      .payroll-presenze-page > div.mx-auto.flex.max-w-\[1800px\].flex-col.gap-4.p-4 > div:last-child > div:last-child {
        flex: 1 1 auto !important; min-height: 0 !important; display: flex !important; flex-direction: column !important; overflow: hidden !important;
      }
      .payroll-presenze-page .max-h-\[320px\].w-full.overflow-auto.rounded-md.border {
        flex: 1 1 auto !important; min-height: 0 !important; height: 100% !important; max-height: none !important; overflow: auto !important; scrollbar-gutter: stable !important;
      }

      /* Creazione gruppi smart working: due blocchi affiancati, tabella sotto a tutta larghezza */
      .payroll-smart-groups-page > div.p-6.space-y-6 {
        width: 100% !important; max-width: none !important; height: 100% !important; min-height: 0 !important;
        padding: 16px !important; gap: 14px !important; overflow: auto !important;
      }
      .payroll-smart-groups-page > div.p-6.space-y-6 > div:first-child {
        padding: 12px 16px !important; border: 1px solid rgb(186 230 253) !important; border-radius: 8px !important; background: rgb(248 250 252) !important;
      }
      .payroll-smart-groups-page > div.p-6.space-y-6 > div:first-child h1 { margin: 0 !important; }
      .payroll-smart-groups-page > div.p-6.space-y-6 > div:first-child p { margin-top: 2px !important; }
      .payroll-smart-groups-page .grid.grid-cols-1.xl\:grid-cols-\[minmax\(340px\,38\%\)_1fr\] {
        display: grid !important; grid-template-columns: minmax(340px, 38%) minmax(0, 62%) !important;
        gap: 14px !important; align-items: stretch !important; min-height: 0 !important;
      }
      .payroll-smart-groups-page .grid.grid-cols-1.xl\:grid-cols-\[minmax\(340px\,38\%\)_1fr\] > div:first-child,
      .payroll-smart-groups-page .grid.grid-cols-1.xl\:grid-cols-\[minmax\(340px\,38\%\)_1fr\] > div.space-y-4 > div {
        border-color: rgb(186 230 253) !important; background: rgb(248 250 252) !important; box-shadow: none !important;
      }
      .payroll-smart-groups-page .grid.grid-cols-1.xl\:grid-cols-\[minmax\(340px\,38\%\)_1fr\] > div.space-y-4 {
        display: grid !important; grid-template-rows: auto auto !important; gap: 14px !important; min-width: 0 !important;
      }
      .payroll-smart-groups-page .grid.grid-cols-1.lg\:grid-cols-\[1fr_160px_120px_auto_auto_auto\] {
        display: grid !important; grid-template-columns: minmax(240px,1fr) 135px 100px auto auto auto !important; gap: 10px !important; align-items: end !important;
      }
      .payroll-smart-groups-page button[class*="bg-black"] { background: rgb(3 105 161) !important; border-color: rgb(3 105 161) !important; color: white !important; }
      .payroll-smart-groups-page table { width: 100% !important; font-size: .90rem !important; }
      .payroll-smart-groups-page input, .payroll-smart-groups-page select { font-size: .94rem !important; }
      .payroll-smart-groups-page button { font-size: .88rem !important; }
      .payroll-smart-groups-page h2, .payroll-smart-groups-page h3 { font-size: 1rem !important; }
      .payroll-smart-groups-page label { font-size: .88rem !important; }
      .payroll-smart-groups-page p, .payroll-smart-groups-page span { font-size: .90rem; }
      @media (max-width: 1150px) {
        .payroll-smart-groups-page .grid.grid-cols-1.xl\:grid-cols-\[minmax\(340px\,38\%\)_1fr\] { grid-template-columns: 1fr !important; }
        .payroll-smart-groups-page .grid.grid-cols-1.lg\:grid-cols-\[1fr_160px_120px_auto_auto_auto\] { grid-template-columns: 1fr 140px 110px !important; }
      }

      .payroll-master-page [data-radix-scroll-area-viewport], .payroll-master-page [class*="overflow-y-auto"], .payroll-master-page [class*="overflow-auto"] { scrollbar-gutter: stable; }
      .payroll-master-page h1 { color: rgb(15 23 42) !important; font-size: 1.25rem !important; line-height: 1.7rem !important; }
      .payroll-master-page h2, .payroll-master-page h3 { color: rgb(15 23 42) !important; }
      .payroll-master-page p { color: rgb(100 116 139) !important; }
      .payroll-master-page label { color: rgb(51 65 85) !important; font-size: .75rem !important; font-weight: 600 !important; }
      .payroll-master-page input, .payroll-master-page select, .payroll-master-page textarea {
        min-height: 34px !important; border-color: rgb(203 213 225) !important; border-radius: 6px !important; background: white !important; color: rgb(15 23 42) !important; font-size: .78rem !important;
      }
      .payroll-master-page input[type="checkbox"] { min-height: auto !important; accent-color: rgb(3 105 161) !important; }
      .payroll-master-page button { min-height: 34px !important; border-radius: 6px !important; font-size: .76rem !important; }
      .payroll-master-page button[class*="bg-blue"], .payroll-master-page button[class*="bg-primary"], .payroll-master-page button[type="submit"] { background: rgb(3 105 161) !important; border-color: rgb(3 105 161) !important; color: white !important; }
      .payroll-master-page .rounded-xl.border.bg-card, .payroll-master-page .rounded-lg.border.bg-card, .payroll-master-page [class*="rounded-xl"][class*="border"], .payroll-master-page [class*="rounded-lg"][class*="border"] {
        border-color: rgb(186 230 253) !important; background: rgb(248 250 252) !important; box-shadow: none !important;
      }
      .payroll-master-page [class*="border-blue-200"], .payroll-master-page [class*="bg-blue-50"] { border-color: rgb(186 230 253) !important; background: rgb(240 249 255) !important; }
      .payroll-master-page table { border-collapse: separate !important; border-spacing: 0 !important; background: white !important; font-size: .72rem !important; }
      .payroll-master-page thead { position: sticky !important; top: 0 !important; z-index: 8 !important; }
      .payroll-master-page thead th { padding-top: 8px !important; padding-bottom: 8px !important; background: rgb(71 85 105) !important; color: white !important; border-color: rgb(51 65 85) !important; font-weight: 700 !important; }
      .payroll-master-page tbody td { border-color: rgb(226 232 240) !important; }
      .payroll-master-page tbody tr:hover td { background: rgb(240 249 255) !important; }
      .payroll-master-page [role="dialog"] { border: 1px solid rgb(186 230 253) !important; border-radius: 10px !important; background: rgb(248 250 252) !important; }
      .payroll-master-page .bg-green-50, .payroll-master-page [class*="bg-green-50"] { background: rgb(240 253 244) !important; }
      .payroll-master-page .bg-red-50, .payroll-master-page [class*="bg-red-50"] { background: rgb(254 242 242) !important; }
      .payroll-master-page .bg-yellow-50, .payroll-master-page [class*="bg-yellow-50"] { background: rgb(254 252 232) !important; }
      .payroll-master-page .bg-blue-50, .payroll-master-page [class*="bg-blue-50"] { background: rgb(239 246 255) !important; }

      /* Override finale Smart Working: font realmente leggibile anche con scala UI compatta. */
      .payroll-master-page.payroll-smart-groups-page { font-size: 17px !important; }
      .payroll-master-page.payroll-smart-groups-page h1 { font-size: 24px !important; line-height: 1.3 !important; }
      .payroll-master-page.payroll-smart-groups-page h2,
      .payroll-master-page.payroll-smart-groups-page h3 { font-size: 18px !important; line-height: 1.3 !important; }
      .payroll-master-page.payroll-smart-groups-page label { font-size: 16px !important; }
      .payroll-master-page.payroll-smart-groups-page p,
      .payroll-master-page.payroll-smart-groups-page span,
      .payroll-master-page.payroll-smart-groups-page td,
      .payroll-master-page.payroll-smart-groups-page th { font-size: 16px !important; line-height: 1.35 !important; }
      .payroll-master-page.payroll-smart-groups-page input,
      .payroll-master-page.payroll-smart-groups-page select,
      .payroll-master-page.payroll-smart-groups-page textarea { font-size: 16px !important; min-height: 42px !important; }
      .payroll-master-page.payroll-smart-groups-page button { font-size: 15px !important; min-height: 40px !important; }
      .payroll-master-page.payroll-smart-groups-page table { font-size: 16px !important; }

      /* Smart Working gruppi: layout compatto e tabella sempre leggibile. */
      .payroll-master-page.payroll-smart-groups-page .smart-new-group-card {
        padding: 12px !important;
      }
      .payroll-master-page.payroll-smart-groups-page .smart-new-group-card > :not([hidden]) ~ :not([hidden]) {
        margin-top: 10px !important;
      }
      .payroll-master-page.payroll-smart-groups-page .smart-new-group-card input,
      .payroll-master-page.payroll-smart-groups-page .smart-new-group-card select,
      .payroll-master-page.payroll-smart-groups-page .smart-new-group-card button {
        min-height: 38px !important;
      }
      .payroll-master-page.payroll-smart-groups-page .smart-group-summary summary {
        min-height: 0 !important;
      }
      .payroll-master-page.payroll-smart-groups-page .smart-groups-configured-card {
        padding: 12px !important;
        overflow: visible !important;
        min-height: 0 !important;
        flex: 0 0 auto !important;
      }
      .payroll-master-page.payroll-smart-groups-page .smart-groups-configured-card table {
        width: 100% !important;
        table-layout: auto !important;
      }
      .payroll-master-page.payroll-smart-groups-page .smart-groups-configured-card thead {
        position: static !important;
        top: auto !important;
        z-index: auto !important;
      }
      .payroll-master-page.payroll-smart-groups-page .smart-groups-configured-card th,
      .payroll-master-page.payroll-smart-groups-page .smart-groups-configured-card td {
        vertical-align: middle !important;
      }

      /* Presenze: colora esclusivamente i campi giornalieri compilati in base al codice. */
      .payroll-presenze-page select.bg-green-100 {
        background: rgb(220 252 231) !important;
        border-color: rgb(134 239 172) !important;
        color: rgb(22 101 52) !important;
      }
      .payroll-presenze-page select.bg-violet-100 {
        background: rgb(237 233 254) !important;
        border-color: rgb(196 181 253) !important;
        color: rgb(91 33 182) !important;
      }
      .payroll-presenze-page select.bg-sky-100 {
        background: rgb(254 226 226) !important;
        border-color: rgb(252 165 165) !important;
        color: rgb(153 27 27) !important;
      }
      .payroll-presenze-page select.bg-red-100 {
        background: rgb(254 226 226) !important;
        border-color: rgb(252 165 165) !important;
        color: rgb(153 27 27) !important;
      }
      .payroll-presenze-page select.bg-gray-100 {
        background: rgb(241 245 249) !important;
        border-color: rgb(203 213 225) !important;
        color: rgb(71 85 105) !important;
      }
      .payroll-presenze-page select.bg-orange-100 {
        background: rgb(255 237 213) !important;
        border-color: rgb(253 186 116) !important;
        color: rgb(154 52 18) !important;
      }
      .payroll-presenze-page select.bg-teal-100 {
        background: rgb(207 250 254) !important;
        border-color: rgb(103 232 249) !important;
        color: rgb(14 116 144) !important;
      }
      .payroll-presenze-page select.bg-pink-100 {
        background: rgb(252 231 243) !important;
        border-color: rgb(249 168 212) !important;
        color: rgb(157 23 77) !important;
      }
    `}</style>
  );
}
