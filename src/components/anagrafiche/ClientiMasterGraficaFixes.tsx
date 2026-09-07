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

      /* La pagina Clienti deve comportarsi come IVA: pannelli superiori fissi,
         tabella che occupa tutto lo spazio residuo senza scroll pagina. */
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

      /* Card della tabella = equivalente della Card di IvaScrollableTable. */
      body.clienti-master-fixes main.anagrafiche-master-page
        > div > div[class*="rounded"]:has(table:has(th.sticky.left-0):has(th.sticky.right-0)) {
        display: flex !important;
        flex: 1 1 auto !important;
        min-height: 0 !important;
        flex-direction: column !important;
        overflow: hidden !important;
        margin-bottom: 0 !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page
        > div > div[class*="rounded"]:has(table:has(th.sticky.left-0):has(th.sticky.right-0))
        > div {
        display: flex !important;
        flex: 1 1 auto !important;
        min-height: 0 !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }

      /* Questo è l'UNICO contenitore che deve scrollare, come il div h-full w-full overflow-auto di IVA. */
      body.clienti-master-fixes main.anagrafiche-master-page
        div[class*="overflow-x-auto"][class*="max-h"]:has(table:has(th.sticky.left-0):has(th.sticky.right-0)) {
        flex: 1 1 auto !important;
        width: 100% !important;
        height: 100% !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow: auto !important;
        position: relative !important;
      }

      /* Il componente shadcn <Table> aggiunge di suo un secondo div overflow-auto.
         Su Clienti lo neutralizziamo: è lui che generava la doppia scrollbar e impediva
         all'intestazione sticky di riferirsi allo stesso scroll verticale. */
      body.clienti-master-fixes main.anagrafiche-master-page
        div[class*="overflow-x-auto"][class*="max-h"]:has(table:has(th.sticky.left-0):has(th.sticky.right-0))
        > div.relative.w-full.overflow-auto {
        overflow: visible !important;
        position: static !important;
        width: 100% !important;
      }

      /* Stessa logica IVA: thead sticky nello stesso contenitore che scrolla. */
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
        table:has(th.sticky.left-0):has(th.sticky.right-0) thead th {
        top: 0 !important;
        background: rgb(71 85 105) !important;
        color: white !important;
        border-color: rgb(51 65 85) !important;
        z-index: 31 !important;
      }

      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) thead th.sticky.left-0,
      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) thead th.sticky[class*="left-"],
      body.clienti-master-fixes main.anagrafiche-master-page
        table:has(th.sticky.left-0):has(th.sticky.right-0) thead th.sticky.right-0 {
        position: sticky !important;
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
