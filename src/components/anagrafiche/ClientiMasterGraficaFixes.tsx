import { useEffect } from "react";

export function ClientiMasterGraficaFixes() {
  useEffect(() => {
    document.documentElement.classList.add("clienti-master-fixes");
    document.body.classList.add("clienti-master-fixes");

    let resizeObserver: ResizeObserver | null = null;
    let scrollContainer: HTMLElement | null = null;
    let overlayHost: HTMLDivElement | null = null;
    let originalThead: HTMLTableSectionElement | null = null;

    const buildFixedHeader = () => {
      overlayHost?.remove();
      overlayHost = null;
      resizeObserver?.disconnect();
      resizeObserver = null;

      const table = document.querySelector(
        'main.anagrafiche-master-page table:has(th.sticky.left-0):has(th.sticky.right-0)'
      ) as HTMLTableElement | null;
      if (!table) return;

      const thead = table.querySelector("thead") as HTMLTableSectionElement | null;
      const container = table.parentElement as HTMLElement | null;
      if (!thead || !container) return;

      scrollContainer = container;
      originalThead = thead;
      container.style.setProperty("position", "relative", "important");

      const host = document.createElement("div");
      host.className = "clienti-fixed-header-host";
      host.style.position = "sticky";
      host.style.top = "0";
      host.style.left = "0";
      host.style.height = "0";
      host.style.zIndex = "100";
      host.style.overflow = "visible";
      host.style.pointerEvents = "none";

      const overlayTable = document.createElement("table");
      overlayTable.className = "clienti-fixed-header-table";
      overlayTable.style.position = "absolute";
      overlayTable.style.top = "0";
      overlayTable.style.left = "0";
      overlayTable.style.margin = "0";
      overlayTable.style.borderCollapse = "separate";
      overlayTable.style.borderSpacing = "0";
      overlayTable.style.tableLayout = "fixed";
      overlayTable.style.background = "white";

      const clonedHead = thead.cloneNode(true) as HTMLTableSectionElement;
      clonedHead.className = "clienti-fixed-header-thead";
      overlayTable.appendChild(clonedHead);
      host.appendChild(overlayTable);
      container.insertBefore(host, table);
      overlayHost = host;

      const sync = () => {
        const originalCells = Array.from(thead.querySelectorAll("th")) as HTMLElement[];
        const clonedCells = Array.from(clonedHead.querySelectorAll("th")) as HTMLElement[];
        const tableRect = table.getBoundingClientRect();

        overlayTable.style.width = `${table.scrollWidth}px`;
        overlayTable.style.minWidth = `${table.scrollWidth}px`;
        overlayTable.style.transform = `translateX(${-container.scrollLeft}px)`;

        originalCells.forEach((cell, index) => {
          const width = cell.getBoundingClientRect().width;
          const clone = clonedCells[index];
          if (!clone) return;
          clone.style.width = `${width}px`;
          clone.style.minWidth = `${width}px`;
          clone.style.maxWidth = `${width}px`;
          clone.style.boxSizing = "border-box";
        });

        clonedHead.style.width = `${tableRect.width}px`;
      };

      const onScroll = () => {
        overlayTable.style.transform = `translateX(${-container.scrollLeft}px)`;
      };

      container.addEventListener("scroll", onScroll, { passive: true });
      host.dataset.scrollListenerAttached = "true";
      (host as any).__clientiScrollHandler = onScroll;

      resizeObserver = new ResizeObserver(sync);
      resizeObserver.observe(table);
      resizeObserver.observe(container);
      requestAnimationFrame(sync);
    };

    const timer = window.setTimeout(buildFixedHeader, 50);
    const mutationObserver = new MutationObserver(() => {
      if (!document.querySelector(".clienti-fixed-header-host")) {
        buildFixedHeader();
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(timer);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      if (overlayHost && scrollContainer) {
        const handler = (overlayHost as any).__clientiScrollHandler;
        if (handler) scrollContainer.removeEventListener("scroll", handler);
      }
      overlayHost?.remove();
      if (originalThead) originalThead.style.removeProperty("visibility");
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

      /* Approccio indipendente dalla sticky table nativa:
         l'intestazione visibile è una copia separata, ancorata al contenitore scroll. */
      body.clienti-master-fixes .clienti-fixed-header-host {
        position: sticky !important;
        top: 0 !important;
        z-index: 100 !important;
      }

      body.clienti-master-fixes .clienti-fixed-header-table thead,
      body.clienti-master-fixes .clienti-fixed-header-table th {
        position: static !important;
      }

      body.clienti-master-fixes .clienti-fixed-header-table th {
        padding: 8px 9px !important;
        background: rgb(71 85 105) !important;
        color: white !important;
        border-color: rgb(51 65 85) !important;
        font-weight: 700 !important;
        white-space: nowrap !important;
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
