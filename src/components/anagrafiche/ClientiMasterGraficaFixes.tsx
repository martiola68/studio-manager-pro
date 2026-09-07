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
        height: 100% !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page > div {
        display: flex !important;
        height: 100% !important;
        min-height: 0 !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page > div > div:not(:last-child),
      body.clienti-master-fixes main.anagrafiche-master-page > div > div[class*="grid"] {
        flex: 0 0 auto !important;
      }

      /* Tutti gli antenati della tabella Clienti NON devono scrollare.
         L'unico proprietario dello scroll sarà il parent diretto del table,
         esattamente come il div overflow-auto di IvaScrollableTable. */
      body.clienti-master-fixes main.anagrafiche-master-page
        div:has(table:has(th.sticky.left-0):has(th.sticky.right-0)) {
        min-height: 0 !important;
        overflow: hidden !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page
        > div > div[class*="rounded"]:has(table:has(th.sticky.left-0):has(th.sticky.right-0)) {
        display: flex !important;
        flex: 1 1 0% !important;
        min-height: 0 !important;
        flex-direction: column !important;
        overflow: hidden !important;
        margin-bottom: 0 !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page
        > div > div[class*="rounded"]:has(table:has(th.sticky.left-0):has(th.sticky.right-0))
        > div {
        display: flex !important;
        flex: 1 1 0% !important;
        min-height: 0 !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }

      /* SOLO questo elemento scrolla: è il wrapper generato dal componente Table
         ed è il parent diretto del <table>. */
      body.clienti-master-fixes main.anagrafiche-master-page
        div:has(> table:has(th.sticky.left-0):has(th.sticky.right-0)) {
        display: block !important;
        flex: 1 1 0% !important;
        width: 100% !important;
        height: 100% !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow: auto !important;
        position: relative !important;
        scrollbar-gutter: stable !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) {
        width: 100% !important;
        min-width: 1750px !important;
        border-collapse: separate !important;
        border-spacing: 0 !important;
      }

      /* Stessa logica IVA: thead sticky nel medesimo contenitore che scrolla. */
      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) thead {
        position: sticky !important;
        top: 0 !important;
        z-index: 50 !important;
        background: rgb(71 85 105) !important;
        color: white !important;
        box-shadow: 0 1px 2px rgb(15 23 42 / 0.16) !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) thead tr {
        background: rgb(71 85 105) !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) thead th {
        position: sticky !important;
        top: 0 !important;
        z-index: 51 !important;
        background: rgb(71 85 105) !important;
        color: white !important;
        border-color: rgb(51 65 85) !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) thead th.sticky.left-0,
      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) thead th.sticky[class*="left-"],
      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) thead th.sticky.right-0 {
        z-index: 60 !important;
        background: rgb(71 85 105) !important;
        color: white !important;
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
    `}</style>
  );
}
