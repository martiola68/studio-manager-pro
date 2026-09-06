export function ImpostazioniMasterGraficaEnhancer() {
  return (
    <style jsx global>{`
      .impostazioni-master-page {
        background: rgb(241 245 249) !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      .impostazioni-master-page > div,
      .impostazioni-master-page > main {
        width: 100% !important;
        max-width: none !important;
        height: 100% !important;
        min-height: 0 !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        scrollbar-gutter: stable !important;
        padding-top: 16px !important;
        padding-bottom: 24px !important;
      }

      .impostazioni-master-page h1 {
        color: rgb(15 23 42) !important;
        font-size: 1.7rem !important;
        line-height: 2rem !important;
        font-weight: 800 !important;
        letter-spacing: -0.02em !important;
      }

      .impostazioni-master-page h1 + p,
      .impostazioni-master-page p.text-muted-foreground,
      .impostazioni-master-page [class*="text-gray-500"],
      .impostazioni-master-page [class*="text-gray-600"] {
        color: rgb(100 116 139) !important;
      }

      .impostazioni-master-page label {
        color: rgb(51 65 85) !important;
        font-weight: 600 !important;
      }

      .impostazioni-master-page input,
      .impostazioni-master-page select,
      .impostazioni-master-page textarea,
      .impostazioni-master-page button[role="combobox"] {
        border: 1px solid rgb(125 211 252) !important;
        border-radius: 7px !important;
        background: white !important;
        color: rgb(15 23 42) !important;
        box-shadow: none !important;
      }

      .impostazioni-master-page input:focus,
      .impostazioni-master-page select:focus,
      .impostazioni-master-page textarea:focus,
      .impostazioni-master-page button[role="combobox"]:focus {
        border-color: rgb(14 165 233) !important;
        box-shadow: 0 0 0 2px rgb(186 230 253 / .75) !important;
      }

      .impostazioni-master-page button:not([role="switch"]):not([data-radix-collection-item]) {
        border-radius: 7px !important;
        font-weight: 600 !important;
        box-shadow: none !important;
      }

      .impostazioni-master-page button[class*="bg-purple"],
      .impostazioni-master-page button[class*="bg-green"],
      .impostazioni-master-page button[class*="bg-blue"],
      .impostazioni-master-page button[class*="bg-black"],
      .impostazioni-master-page button[class*="bg-primary"],
      .impostazioni-master-page button[class*="text-primary-foreground"] {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }

      .impostazioni-master-page button[class*="bg-purple"]:hover,
      .impostazioni-master-page button[class*="bg-green"]:hover,
      .impostazioni-master-page button[class*="bg-blue"]:hover,
      .impostazioni-master-page button[class*="bg-black"]:hover,
      .impostazioni-master-page button[class*="bg-primary"]:hover,
      .impostazioni-master-page button[class*="text-primary-foreground"]:hover {
        background: rgb(2 132 199) !important;
        border-color: rgb(2 132 199) !important;
      }

      .impostazioni-master-page button[class*="border"]:not([class*="bg-red"]):not([class*="text-red"]),
      .impostazioni-master-page a[class*="border"]:not([class*="bg-red"]):not([class*="text-red"]) {
        background: white !important;
        border-color: rgb(56 189 248) !important;
        color: rgb(3 105 161) !important;
      }

      .impostazioni-master-page [class*="rounded-lg"][class*="border"],
      .impostazioni-master-page [class*="rounded-xl"][class*="border"],
      .impostazioni-master-page [class*="rounded-md"][class*="border"]:not(input):not(textarea):not(button) {
        border: 1px solid rgb(125 211 252) !important;
        border-radius: 9px !important;
        background: white !important;
        box-shadow: 0 8px 20px rgb(15 23 42 / .055) !important;
      }

      .impostazioni-master-page [class*="rounded-lg"][class*="border"]:has(> [class*="bg-blue-50"]),
      .impostazioni-master-page [class*="rounded-lg"][class*="border"] [class*="bg-blue-50"],
      .impostazioni-master-page [class*="rounded-md"][class*="border"][class*="bg-blue-50"] {
        background: rgb(240 249 255) !important;
      }

      .impostazioni-master-page [role="alert"] {
        border: 1px solid rgb(125 211 252) !important;
        border-left: 3px solid rgb(14 165 233) !important;
        border-radius: 9px !important;
        background: rgb(240 249 255) !important;
        color: rgb(3 105 161) !important;
      }

      .impostazioni-master-page table {
        width: 100% !important;
        border-collapse: separate !important;
        border-spacing: 0 !important;
        background: white !important;
        font-size: .78rem !important;
      }

      .impostazioni-master-page thead {
        position: sticky !important;
        top: 0 !important;
        z-index: 12 !important;
      }

      .impostazioni-master-page thead tr,
      .impostazioni-master-page thead th {
        background: rgb(71 85 105) !important;
        color: white !important;
        border-color: rgb(51 65 85) !important;
      }

      .impostazioni-master-page thead th {
        padding: 8px 10px !important;
        font-weight: 700 !important;
        white-space: nowrap !important;
      }

      .impostazioni-master-page tbody td {
        padding: 7px 10px !important;
        color: rgb(15 23 42) !important;
        background: white !important;
        border-bottom: 1.5px solid rgb(148 163 184) !important;
        vertical-align: middle !important;
      }

      .impostazioni-master-page tbody tr:hover td {
        background: rgb(240 249 255) !important;
      }

      .impostazioni-master-page [class*="overflow-x-auto"],
      .impostazioni-master-page [class*="overflow-auto"] {
        scrollbar-gutter: stable !important;
      }

      .impostazioni-master-page [class*="bg-yellow-100"] {
        background: rgb(254 249 195) !important;
        color: rgb(133 77 14) !important;
        border-color: rgb(253 224 71) !important;
      }

      .impostazioni-master-page [class*="bg-green-100"] {
        background: rgb(220 252 231) !important;
        color: rgb(21 128 61) !important;
        border-color: rgb(134 239 172) !important;
      }

      .impostazioni-master-page [class*="bg-red-100"] {
        background: rgb(254 226 226) !important;
        color: rgb(185 28 28) !important;
        border-color: rgb(252 165 165) !important;
      }

      .impostazioni-master-page [class*="bg-blue-100"] {
        background: rgb(224 242 254) !important;
        color: rgb(3 105 161) !important;
        border-color: rgb(125 211 252) !important;
      }

      .impostazioni-master-page [class*="bg-primary"][class*="text-primary-foreground"],
      .impostazioni-master-page [class*="bg-slate-900"],
      .impostazioni-master-page [class*="bg-gray-900"],
      .impostazioni-master-page [class*="bg-slate-950"] {
        background: rgb(15 23 42) !important;
        border-color: rgb(15 23 42) !important;
        color: white !important;
        box-shadow: none !important;
      }

      .impostazioni-master-page [class*="bg-purple-100"] {
        background: rgb(243 232 255) !important;
        border-color: rgb(216 180 254) !important;
        color: rgb(126 34 206) !important;
      }

      .impostazioni-master-page [class*="bg-blue-50"][class*="text-blue"] {
        background: rgb(239 246 255) !important;
        color: rgb(29 78 216) !important;
      }

      .impostazioni-master-page [role="switch"] {
        min-width: 44px !important;
        min-height: 24px !important;
        border: 1px solid rgb(148 163 184) !important;
        background: rgb(203 213 225) !important;
        box-shadow: none !important;
      }

      .impostazioni-master-page [role="switch"][data-state="checked"] {
        border-color: rgb(2 132 199) !important;
        background: rgb(2 132 199) !important;
      }

      .impostazioni-master-page [role="switch"] > span {
        background: white !important;
      }

      .impostazioni-master-page input[type="checkbox"] {
        accent-color: rgb(3 105 161) !important;
      }

      /* Card Genera Nuovi Scadenzari: contenitore principale bianco, colore solo nella card informativa interna. */
      .impostazioni-master-page [class*="rounded-lg"][class*="border"]:not(.payroll-codici-card):has([class*="text-green-700"]) {
        background: white !important;
        border-color: rgb(134 239 172) !important;
        border-left: 3px solid rgb(22 163 74) !important;
      }

      .impostazioni-master-page [class*="rounded-lg"][class*="border"]:not(.payroll-codici-card):has([class*="text-green-700"]) > div:first-child {
        background: white !important;
        border-bottom: 1px solid rgb(226 232 240) !important;
      }

      .impostazioni-master-page [class*="border-[#0d6f9f]"] > div:first-child,
      .impostazioni-master-page [class*="border-[#015EB5]"] > div:first-child,
      .impostazioni-master-page [class*="[&>div]:border-2"] > div > div:first-child {
        background: white !important;
        border-bottom: 0 !important;
      }

      .impostazioni-master-page [class*="border-[#0d6f9f]"] > div:first-child h3,
      .impostazioni-master-page [class*="border-[#015EB5]"] > div:first-child h3,
      .impostazioni-master-page [class*="[&>div]:border-2"] > div > div:first-child h3 {
        display: inline-flex !important;
        width: fit-content !important;
        align-items: center !important;
        gap: 6px !important;
        padding: 6px 11px !important;
        border-radius: 7px !important;
        background: rgb(3 105 161) !important;
        border: 1px solid rgb(3 105 161) !important;
        color: white !important;
        font-weight: 700 !important;
      }

      .impostazioni-master-page [class*="border-[#015EB5]"]:has(label[for="protezione"]) {
        min-height: 190px !important;
      }

      .impostazioni-master-page [class*="border-[#015EB5]"]:has(label[for="protezione"]) > div:nth-child(2) {
        display: none !important;
      }

      .impostazioni-master-page [class*="border-[#015EB5]"]:has(label[for="protezione"]) > div:last-child {
        min-height: 112px !important;
        padding-top: 18px !important;
        padding-bottom: 20px !important;
      }

      .impostazioni-master-page [class*="border-[#015EB5]"]:has(label[for="protezione"]) label[for="protezione"] {
        display: inline-flex !important;
        width: fit-content !important;
        min-height: 32px !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 11px !important;
        border: 1px solid rgb(3 105 161) !important;
        border-radius: 7px !important;
        background: rgb(3 105 161) !important;
        color: white !important;
        font-size: .76rem !important;
        font-weight: 700 !important;
        cursor: pointer !important;
      }

      .impostazioni-master-page [class*="border-[#015EB5]"]:has(label[for="protezione"]) label[for="protezione"]:hover {
        background: rgb(2 132 199) !important;
        border-color: rgb(2 132 199) !important;
      }

      .impostazioni-master-page [class*="border-[#015EB5]"]:has(label[for="protezione"]) [role="switch"] {
        position: absolute !important;
        width: 1px !important;
        min-width: 1px !important;
        height: 1px !important;
        min-height: 1px !important;
        padding: 0 !important;
        margin: 0 !important;
        opacity: 0 !important;
        pointer-events: none !important;
        overflow: hidden !important;
      }

      .impostazioni-master-page [class*="border-[#015EB5]"]:has(label[for="protezione"]) > div:last-child > button.w-full {
        display: none !important;
      }

      .impostazioni-master-page [class*="shadow-lg"],
      .impostazioni-master-page [class*="shadow-md"],
      .impostazioni-master-page [class*="shadow-xl"] {
        box-shadow: 0 8px 20px rgb(15 23 42 / .06) !important;
      }

      .impostazioni-master-page .grid > [class*="border"],
      .impostazioni-master-page .space-y-3 > [class*="border"],
      .impostazioni-master-page .space-y-4 > [class*="border"] {
        border-color: rgb(186 230 253) !important;
      }

      .impostazioni-master-page button[class*="bg-red"] {
        color: white !important;
      }

      .impostazioni-master-page button[class*="text-red"]:not([class*="bg-red"]) {
        color: rgb(220 38 38) !important;
      }
    `}</style>
  );
}
