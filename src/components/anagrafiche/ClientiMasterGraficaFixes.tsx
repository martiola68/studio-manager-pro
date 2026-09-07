import { useEffect } from "react";

export function ClientiMasterGraficaFixes() {
  useEffect(() => {
    document.documentElement.classList.add("clienti-master-fixes");
    document.body.classList.add("clienti-master-fixes");

    return () => {
      document.documentElement.classList.remove("clienti-master-fixes");
      document.body.classList.remove("clienti-master-fixes");
    };
  }, []);

  return (
    <style jsx global>{`
      html.clienti-master-fixes,
      body.clienti-master-fixes {
        height: 100% !important;
        overflow: hidden !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page {
        overflow: hidden !important;
      }

      /* CLIENTI: il Card esterno della tabella non deve avere una propria scrollbar.
         Lo scroll resta esclusivamente sul contenitore immediato della tabella. */
      body.clienti-master-fixes main.anagrafiche-master-page.anagrafiche-master-scroll-page
        > div > div:has(table th.sticky.left-0):has(table th.sticky.right-0) {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page
        [class*="overflow-x-auto"]:has(> table) {
        overflow-x: auto !important;
        overflow-y: auto !important;
        max-height: none !important;
        min-height: 0 !important;
      }

      /* CLIENTI: intestazione sempre bloccata durante lo scroll verticale dei record. */
      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) thead {
        position: sticky !important;
        top: 0 !important;
        z-index: 50 !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) thead th {
        position: sticky !important;
        top: 0 !important;
        z-index: 50 !important;
        background: rgb(71 85 105) !important;
        color: white !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) thead th:first-child,
      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) thead th:nth-child(2),
      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) thead th:last-child {
        z-index: 60 !important;
        background: rgb(71 85 105) !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0)
        td:nth-child(5) > div[class*="bg-green-600"] {
        display: inline-flex !important;
        min-width: 62px !important;
        justify-content: center !important;
        background: rgb(22 163 74) !important;
        border-color: rgb(22 163 74) !important;
        color: white !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0)
        td:nth-child(5) > div[class*="bg-secondary"] {
        display: inline-flex !important;
        min-width: 62px !important;
        justify-content: center !important;
        background: rgb(226 232 240) !important;
        border-color: rgb(148 163 184) !important;
        color: rgb(51 65 85) !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page button[class*="bg-red-600"] {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page button[class*="bg-red-600"]:hover {
        background: rgb(2 132 199) !important;
        border-color: rgb(2 132 199) !important;
        color: white !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) tbody tr > td {
        border-bottom: 1px solid rgb(148 163 184) !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) tbody tr:last-child > td {
        border-bottom-color: rgb(148 163 184) !important;
      }
    `}</style>
  );
}
