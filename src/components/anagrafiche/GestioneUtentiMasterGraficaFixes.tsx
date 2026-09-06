export function GestioneUtentiMasterGraficaFixes() {
  return (
    <style jsx global>{`
      .anagrafiche-master-page:has(h1:first-of-type) table {
        background: white !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody tr {
        background: white !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody tr:hover {
        background: rgb(248 250 252) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody td {
        border-bottom: 1.5px solid rgb(148 163 184) !important;
        color: rgb(15 23 42) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody tr:last-child td {
        border-bottom-color: rgb(203 213 225) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody td > div[class*="inline-flex"],
      .anagrafiche-master-page:has(h1:first-of-type) table tbody td > span[class*="inline-flex"] {
        opacity: 1 !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody td:nth-child(4) > div {
        min-width: 74px !important;
        justify-content: center !important;
        border: 1px solid rgb(125 211 252) !important;
        background: rgb(240 249 255) !important;
        color: rgb(3 105 161) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody td:nth-child(5) > div {
        min-width: 70px !important;
        justify-content: center !important;
        border: 1px solid rgb(125 211 252) !important;
        background: rgb(240 249 255) !important;
        color: rgb(3 105 161) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody td:nth-child(5) span[class*="bg-yellow-100"] {
        background: rgb(254 249 195) !important;
        color: rgb(133 77 14) !important;
        border-color: rgb(253 224 71) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody td:nth-child(6) > div {
        min-width: 94px !important;
        justify-content: center !important;
        border: 1px solid rgb(125 211 252) !important;
        background: rgb(224 242 254) !important;
        color: rgb(3 105 161) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody td:nth-child(8) > div {
        min-width: 92px !important;
        justify-content: center !important;
        border: 1px solid rgb(134 239 172) !important;
        background: rgb(240 253 244) !important;
        color: rgb(21 128 61) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody tr.opacity-60 td {
        opacity: 1 !important;
        color: rgb(71 85 105) !important;
        background: rgb(248 250 252) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody tr.opacity-60 td:nth-child(8) > div {
        border-color: rgb(203 213 225) !important;
        background: rgb(241 245 249) !important;
        color: rgb(71 85 105) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody td:nth-child(7) {
        color: rgb(30 41 59) !important;
        font-weight: 500 !important;
      }
    `}</style>
  );
}
