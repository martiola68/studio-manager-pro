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
      .payroll-master-page > main > :not(:has(table)) {
        flex: 0 0 auto;
      }

      .payroll-master-page > div > :has(table),
      .payroll-master-page > main > :has(table) {
        flex: 1 1 auto !important;
        min-height: 0 !important;
      }

      .payroll-master-page > div > div:has(> table),
      .payroll-master-page > main > div:has(> table),
      .payroll-master-page > div > div:has(table) > div[class*="overflow-x-auto"],
      .payroll-master-page > div > div:has(table) > div[class*="overflow-auto"],
      .payroll-master-page > main > div:has(table) > div[class*="overflow-x-auto"],
      .payroll-master-page > main > div:has(table) > div[class*="overflow-auto"] {
        min-height: 0 !important;
        overflow-y: auto !important;
        overflow-x: auto !important;
        max-height: none !important;
      }

      .payroll-master-page > div > div:has(> table),
      .payroll-master-page > main > div:has(> table) {
        flex: 1 1 auto !important;
      }

      .payroll-master-page > div > div:has(table):not(:has(> table)),
      .payroll-master-page > main > div:has(table):not(:has(> table)) {
        display: flex !important;
        flex-direction: column !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      .payroll-master-page > div > div:has(table):not(:has(> table)) > div[class*="overflow-x-auto"],
      .payroll-master-page > div > div:has(table):not(:has(> table)) > div[class*="overflow-auto"],
      .payroll-master-page > main > div:has(table):not(:has(> table)) > div[class*="overflow-x-auto"],
      .payroll-master-page > main > div:has(table):not(:has(> table)) > div[class*="overflow-auto"] {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        overflow: auto !important;
        max-height: none !important;
      }

      .payroll-master-page [data-radix-scroll-area-viewport],
      .payroll-master-page [class*="overflow-y-auto"],
      .payroll-master-page [class*="overflow-auto"] {
        scrollbar-gutter: stable;
      }

      .payroll-master-page h1 {
        color: rgb(15 23 42) !important;
        font-size: 1.25rem !important;
        line-height: 1.7rem !important;
      }

      .payroll-master-page h2,
      .payroll-master-page h3 {
        color: rgb(15 23 42) !important;
      }

      .payroll-master-page p {
        color: rgb(100 116 139) !important;
      }

      .payroll-master-page label {
        color: rgb(51 65 85) !important;
        font-size: .75rem !important;
        font-weight: 600 !important;
      }

      .payroll-master-page input,
      .payroll-master-page select,
      .payroll-master-page textarea {
        min-height: 34px !important;
        border-color: rgb(203 213 225) !important;
        border-radius: 6px !important;
        background: white !important;
        color: rgb(15 23 42) !important;
        font-size: .78rem !important;
      }

      .payroll-master-page input[type="checkbox"] {
        min-height: auto !important;
        accent-color: rgb(3 105 161) !important;
      }

      .payroll-master-page button {
        min-height: 34px !important;
        border-radius: 6px !important;
        font-size: .76rem !important;
      }

      .payroll-master-page button[class*="bg-blue"],
      .payroll-master-page button[class*="bg-primary"],
      .payroll-master-page button[type="submit"] {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }

      .payroll-master-page .rounded-xl.border.bg-card,
      .payroll-master-page .rounded-lg.border.bg-card,
      .payroll-master-page [class*="rounded-xl"][class*="border"],
      .payroll-master-page [class*="rounded-lg"][class*="border"] {
        border-color: rgb(186 230 253) !important;
        background: rgb(248 250 252) !important;
        box-shadow: none !important;
      }

      .payroll-master-page [class*="border-blue-200"],
      .payroll-master-page [class*="bg-blue-50"] {
        border-color: rgb(186 230 253) !important;
        background: rgb(240 249 255) !important;
      }

      .payroll-master-page table {
        border-collapse: separate !important;
        border-spacing: 0 !important;
        background: white !important;
        font-size: .72rem !important;
      }

      .payroll-master-page thead {
        position: sticky !important;
        top: 0 !important;
        z-index: 8 !important;
      }

      .payroll-master-page thead th {
        padding-top: 8px !important;
        padding-bottom: 8px !important;
        background: rgb(71 85 105) !important;
        color: white !important;
        border-color: rgb(51 65 85) !important;
        font-weight: 700 !important;
      }

      .payroll-master-page tbody td {
        border-color: rgb(226 232 240) !important;
      }

      .payroll-master-page tbody tr:hover td {
        background: rgb(240 249 255) !important;
      }

      .payroll-master-page [role="dialog"] {
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 10px !important;
        background: rgb(248 250 252) !important;
      }

      .payroll-master-page [role="dialog"] button[class*="bg-blue"],
      .payroll-master-page [role="dialog"] button[class*="bg-primary"] {
        background: rgb(3 105 161) !important;
        color: white !important;
      }

      .payroll-master-page .bg-green-50,
      .payroll-master-page [class*="bg-green-50"] {
        background: rgb(240 253 244) !important;
      }

      .payroll-master-page .bg-red-50,
      .payroll-master-page [class*="bg-red-50"] {
        background: rgb(254 242 242) !important;
      }

      .payroll-master-page .bg-yellow-50,
      .payroll-master-page [class*="bg-yellow-50"] {
        background: rgb(254 252 232) !important;
      }

      .payroll-master-page .bg-blue-50,
      .payroll-master-page [class*="bg-blue-50"] {
        background: rgb(239 246 255) !important;
      }
    `}</style>
  );
}
