export function ContenziosoMasterGraficaEnhancer() {
  return (
    <style jsx global>{`
      .contenzioso-master-page {
        background: rgb(241 245 249) !important;
      }

      /* Tutti i form Contenzioso occupano tutta la larghezza disponibile */
      .contenzioso-master-page > div,
      .contenzioso-master-page > main,
      .contenzioso-master-page [class*="mx-auto"][class*="max-w-"] {
        width: 100% !important;
        max-width: none !important;
      }

      .contenzioso-master-page > div[class*="min-h-screen"] {
        padding-left: 12px !important;
        padding-right: 12px !important;
      }

      .contenzioso-master-page h1 {
        color: rgb(15 23 42) !important;
        font-size: 1.25rem !important;
        line-height: 1.7rem !important;
      }

      .contenzioso-master-page h2,
      .contenzioso-master-page h3,
      .contenzioso-master-page h4 {
        color: rgb(15 23 42) !important;
      }

      .contenzioso-master-page p,
      .contenzioso-master-page small {
        color: rgb(100 116 139) !important;
      }

      .contenzioso-master-page label {
        color: rgb(51 65 85) !important;
        font-size: .75rem !important;
        font-weight: 600 !important;
      }

      .contenzioso-master-page input,
      .contenzioso-master-page select,
      .contenzioso-master-page textarea {
        min-height: 34px !important;
        border: 1px solid rgb(203 213 225) !important;
        border-radius: 6px !important;
        background: white !important;
        color: rgb(15 23 42) !important;
        font-size: .78rem !important;
        box-shadow: none !important;
      }

      .contenzioso-master-page input:disabled,
      .contenzioso-master-page select:disabled,
      .contenzioso-master-page textarea:disabled,
      .contenzioso-master-page input[readonly] {
        background: rgb(241 245 249) !important;
        color: rgb(71 85 105) !important;
      }

      .contenzioso-master-page textarea {
        min-height: 90px !important;
      }

      .contenzioso-master-page input[type="checkbox"] {
        min-height: auto !important;
        accent-color: rgb(3 105 161) !important;
      }

      .contenzioso-master-page input[type="file"] {
        min-height: 34px !important;
        padding: 3px 5px !important;
      }

      .contenzioso-master-page button,
      .contenzioso-master-page a[class*="rounded"] {
        min-height: 34px !important;
        border-radius: 7px !important;
        font-size: .76rem !important;
        font-weight: 600 !important;
        box-shadow: none !important;
      }

      .contenzioso-master-page button[class*="bg-black"],
      .contenzioso-master-page button[class*="bg-blue"],
      .contenzioso-master-page button[class*="bg-primary"],
      .contenzioso-master-page button[class*="bg-slate-900"],
      .contenzioso-master-page button[class*="bg-gray-900"],
      .contenzioso-master-page button[type="submit"],
      .contenzioso-master-page a[class*="bg-black"],
      .contenzioso-master-page a[class*="bg-blue"],
      .contenzioso-master-page a[class*="bg-primary"],
      .contenzioso-master-page a[class*="bg-slate-900"],
      .contenzioso-master-page a[class*="bg-gray-900"] {
        background: rgb(3 105 161) !important;
        border: 1px solid rgb(3 105 161) !important;
        color: white !important;
      }

      .contenzioso-master-page button[class*="bg-black"]:hover,
      .contenzioso-master-page button[class*="bg-blue"]:hover,
      .contenzioso-master-page button[class*="bg-primary"]:hover,
      .contenzioso-master-page button[class*="bg-slate-900"]:hover,
      .contenzioso-master-page button[class*="bg-gray-900"]:hover,
      .contenzioso-master-page button[type="submit"]:hover,
      .contenzioso-master-page a[class*="bg-black"]:hover,
      .contenzioso-master-page a[class*="bg-blue"]:hover,
      .contenzioso-master-page a[class*="bg-primary"]:hover,
      .contenzioso-master-page a[class*="bg-slate-900"]:hover,
      .contenzioso-master-page a[class*="bg-gray-900"]:hover {
        background: rgb(2 132 199) !important;
        border-color: rgb(2 132 199) !important;
      }

      .contenzioso-master-page button[class*="border"]:not([class*="bg-red"]):not([class*="bg-green"]):not([class*="bg-black"]):not([class*="bg-blue"]):not([class*="bg-primary"]):not([type="submit"]),
      .contenzioso-master-page a[class*="border"]:not([class*="bg-red"]):not([class*="bg-green"]):not([class*="bg-black"]):not([class*="bg-blue"]):not([class*="bg-primary"]) {
        background: white !important;
        border-color: rgb(125 211 252) !important;
        color: rgb(3 105 161) !important;
      }

      .contenzioso-master-page button[class*="bg-red"],
      .contenzioso-master-page a[class*="bg-red"] {
        background: rgb(220 38 38) !important;
        border-color: rgb(220 38 38) !important;
        color: white !important;
      }

      .contenzioso-master-page button[class*="text-red"],
      .contenzioso-master-page a[class*="text-red"] {
        color: rgb(220 38 38) !important;
      }

      .contenzioso-master-page .rounded-xl.border,
      .contenzioso-master-page .rounded-lg.border,
      .contenzioso-master-page .rounded-md.border,
      .contenzioso-master-page [class*="rounded-xl"][class*="border"],
      .contenzioso-master-page [class*="rounded-lg"][class*="border"],
      .contenzioso-master-page [class*="rounded-md"][class*="border"] {
        border-color: rgb(186 230 253) !important;
        background: rgb(248 250 252) !important;
        box-shadow: none !important;
      }

      .contenzioso-master-page [class*="bg-white"][class*="border"] {
        border-color: rgb(186 230 253) !important;
      }

      .contenzioso-master-page [class*="bg-gray-50"],
      .contenzioso-master-page [class*="bg-slate-50"] {
        background: rgb(248 250 252) !important;
      }

      .contenzioso-master-page table {
        width: 100% !important;
        border-collapse: separate !important;
        border-spacing: 0 !important;
        background: white !important;
        font-size: .74rem !important;
      }

      .contenzioso-master-page thead {
        position: sticky !important;
        top: 0 !important;
        z-index: 8 !important;
      }

      .contenzioso-master-page thead th {
        padding: 8px 9px !important;
        background: rgb(71 85 105) !important;
        color: white !important;
        border-color: rgb(51 65 85) !important;
        font-weight: 700 !important;
        white-space: nowrap !important;
      }

      .contenzioso-master-page tbody td {
        padding: 8px 9px !important;
        border-color: rgb(226 232 240) !important;
        background: white !important;
        vertical-align: middle !important;
      }

      .contenzioso-master-page tbody tr:hover td {
        background: rgb(240 249 255) !important;
      }

      /* MASTER_GRAFICA scadenzari: testata/form fissi, record in scroll interno */
      .contenzioso-scroll-page {
        min-height: 0 !important;
        overflow: hidden !important;
      }

      .contenzioso-scroll-page > div[class*="min-h-screen"] {
        height: 100% !important;
        min-height: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        padding-top: 12px !important;
        padding-bottom: 12px !important;
      }

      .contenzioso-scroll-page > div[class*="min-h-screen"] > div[class*="mx-auto"] {
        width: 100% !important;
        max-width: none !important;
        height: 100% !important;
        min-height: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }

      .contenzioso-scroll-page div:has(> table) {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow-y: auto !important;
        overflow-x: auto !important;
        scrollbar-gutter: stable !important;
      }

      .contenzioso-scroll-page div:has(> table) > table {
        min-width: 100% !important;
      }

      /* Se il contenitore tabella è preceduto da filtri/form, questi restano fissi */
      .contenzioso-scroll-page div:has(> table) ~ * {
        flex: 0 0 auto;
      }

      .contenzioso-master-page .bg-green-50,
      .contenzioso-master-page [class*="bg-green-50"] {
        background: rgb(240 253 244) !important;
      }

      .contenzioso-master-page .bg-green-500,
      .contenzioso-master-page [class*="bg-green-500"],
      .contenzioso-master-page .bg-green-600,
      .contenzioso-master-page [class*="bg-green-600"] {
        background: rgb(22 163 74) !important;
        color: white !important;
      }

      .contenzioso-master-page .bg-red-50,
      .contenzioso-master-page [class*="bg-red-50"] {
        background: rgb(254 242 242) !important;
      }

      .contenzioso-master-page .bg-amber-50,
      .contenzioso-master-page [class*="bg-amber-50"],
      .contenzioso-master-page .bg-yellow-50,
      .contenzioso-master-page [class*="bg-yellow-50"] {
        background: rgb(254 252 232) !important;
      }

      .contenzioso-master-page .bg-blue-50,
      .contenzioso-master-page [class*="bg-blue-50"] {
        background: rgb(240 249 255) !important;
      }

      .contenzioso-master-page [role="dialog"] {
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 10px !important;
        background: rgb(248 250 252) !important;
        box-shadow: 0 18px 45px rgba(15, 23, 42, .18) !important;
      }

      .contenzioso-master-page [role="dialog"] input,
      .contenzioso-master-page [role="dialog"] select,
      .contenzioso-master-page [role="dialog"] textarea {
        background: white !important;
        border-color: rgb(203 213 225) !important;
      }

      .contenzioso-master-page hr {
        border-color: rgb(186 230 253) !important;
      }

      .contenzioso-master-page .overflow-x-auto,
      .contenzioso-master-page .overflow-auto {
        scrollbar-gutter: stable;
      }
    `}</style>
  );
}
