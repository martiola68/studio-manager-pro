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

      /* STESSA GERARCHIA DI IVA:
         pagina flex h-full min-h-0 overflow-hidden */
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

      /* Header, statistiche e filtri restano fissi. */
      body.clienti-master-fixes main.anagrafiche-master-page > div > div:not(:last-child),
      body.clienti-master-fixes main.anagrafiche-master-page > div > div[class*="grid"] {
        flex: 0 0 auto !important;
      }

      /* Card tabella = Card flex min-h-0 flex-1 flex-col overflow-hidden di IVA. */
      body.clienti-master-fixes main.anagrafiche-master-page
        > div > div[class*="rounded"]:has(table:has(th.sticky.left-0):has(th.sticky.right-0)) {
        display: flex !important;
        flex: 1 1 0% !important;
        min-height: 0 !important;
        flex-direction: column !important;
        overflow: hidden !important;
        margin-bottom: 0 !important;
      }

      /* CardContent = min-h-0 flex-1 overflow-hidden p-0 di IVA. */
      body.clienti-master-fixes main.anagrafiche-master-page
        > div > div[class*="rounded"]:has(table:has(th.sticky.left-0):has(th.sticky.right-0))
        > div {
        display: flex !important;
        flex: 1 1 0% !important;
        min-height: 0 !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }

      /* Wrapper esterno presente solo in Clienti: NON deve scrollare. */
      body.clienti-master-fixes main.anagrafiche-master-page
        div[class*="overflow-x-auto"][class*="max-h"]:has(table:has(th.sticky.left-0):has(th.sticky.right-0)) {
        display: flex !important;
        flex: 1 1 0% !important;
        min-height: 0 !important;
        height: 100% !important;
        max-height: none !important;
        overflow: hidden !important;
      }

      /* QUESTO è l'unico scroll, equivalente al div h-full w-full overflow-auto di IVA.
         È il wrapper creato dal componente shadcn Table. */
      body.clienti-master-fixes main.anagrafiche-master-page
        div[class*="overflow-x-auto"][class*="max-h"]:has(table:has(th.sticky.left-0):has(th.sticky.right-0))
        > div.relative.w-full.overflow-auto {
        flex: 1 1 0% !important;
        width: 100% !important;
        height: 100% !important;
        min-height: 0 !important;
        overflow: auto !important;
        position: relative !important;
      }

      /* Stesso thead di IVA: sticky top-0 nello STESSO contenitore che scorre. */
      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) thead {
        position: sticky !important;
        top: 0 !important;
        z-index: 30 !important;
        background: rgb(71 85 105) !important;
        color: white !important;
        box-shadow: 0 1px 2px rgb(15 23 42 / 0.12) !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) thead tr {
        background: rgb(71 85 105) !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) thead th {
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
        position: sticky !important;
        top: 0 !important;
        z-index: 40 !important;
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
