export function VariazioniMasterGraficaEnhancer() {
  return (
    <style jsx global>{`
      .variazioni-master-page {
        background: rgb(241 245 249) !important;
      }

      .variazioni-master-page > div {
        width: 100% !important;
        max-width: none !important;
        height: 100% !important;
        min-height: 0 !important;
        padding: 12px !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }

      .variazioni-master-page > div > div:first-child {
        flex: 0 0 auto !important;
        margin-bottom: 10px !important;
        padding: 10px 14px !important;
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 8px !important;
        background: rgb(248 250 252) !important;
      }

      .variazioni-master-page > div > div:first-child h1 {
        margin: 0 !important;
        color: rgb(15 23 42) !important;
        font-size: 1.25rem !important;
        line-height: 1.75rem !important;
      }

      .variazioni-master-page > div > div:first-child button {
        height: 34px !important;
        border-color: rgb(125 211 252) !important;
        border-radius: 7px !important;
        background: white !important;
        color: rgb(3 105 161) !important;
      }

      .variazioni-master-page > div > div:first-child button:last-child {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }

      .variazioni-master-page > div > div:first-child button:last-child:hover {
        background: rgb(2 132 199) !important;
      }

      .variazioni-master-page > div > div.border.rounded.p-4.mb-4.bg-white.space-y-4 {
        flex: 0 0 auto !important;
        margin-bottom: 10px !important;
        padding: 12px 14px !important;
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 8px !important;
        background: rgb(248 250 252) !important;
        box-shadow: none !important;
      }

      .variazioni-master-page label {
        font-size: .75rem !important;
        font-weight: 600 !important;
        color: rgb(51 65 85) !important;
      }

      .variazioni-master-page input,
      .variazioni-master-page select,
      .variazioni-master-page textarea {
        min-height: 34px !important;
        border-color: rgb(203 213 225) !important;
        border-radius: 6px !important;
        background: white !important;
        color: rgb(15 23 42) !important;
        font-size: .8rem !important;
      }

      .variazioni-master-page textarea {
        min-height: 72px !important;
      }

      .variazioni-master-page > div > .overflow-x-auto,
      .variazioni-master-page > div > div:has(> table) {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        overflow: auto !important;
        border: 1px solid rgb(203 213 225) !important;
        border-radius: 8px !important;
        background: white !important;
      }

      .variazioni-master-page table {
        width: 100% !important;
        border-collapse: separate !important;
        border-spacing: 0 !important;
        background: white !important;
        font-size: .75rem !important;
      }

      .variazioni-master-page thead {
        position: sticky !important;
        top: 0 !important;
        z-index: 5 !important;
      }

      .variazioni-master-page thead th {
        padding: 8px 9px !important;
        background: rgb(71 85 105) !important;
        color: white !important;
        border-bottom: 1px solid rgb(51 65 85) !important;
        font-size: .72rem !important;
        font-weight: 700 !important;
        white-space: nowrap !important;
      }

      .variazioni-master-page tbody td {
        padding: 8px 9px !important;
        border-bottom: 1px solid rgb(226 232 240) !important;
        vertical-align: middle !important;
        color: rgb(15 23 42) !important;
        background: white !important;
      }

      .variazioni-master-page tbody tr:hover td {
        background: rgb(240 249 255) !important;
      }

      .variazioni-master-page tbody tr:last-child td {
        border-bottom: 0 !important;
      }

      .variazioni-master-page tbody td a {
        color: rgb(3 105 161) !important;
      }

      .variazioni-master-page tbody td button {
        width: 30px !important;
        height: 30px !important;
        padding: 0 !important;
        border-radius: 6px !important;
      }

      .variazioni-master-page .bg-green-500,
      .variazioni-master-page [class*="bg-green-500"] {
        background: rgb(14 165 233) !important;
      }

      .variazioni-master-page .bg-red-500,
      .variazioni-master-page [class*="bg-red-500"] {
        background: rgb(239 68 68) !important;
      }

      .variazioni-master-page .bg-gray-200,
      .variazioni-master-page [class*="bg-gray-200"] {
        background: rgb(226 232 240) !important;
      }
    `}</style>
  );
}
