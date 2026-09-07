import { useEffect } from "react";

export function ClientiMasterGraficaFixes() {
  useEffect(() => {
    document.documentElement.classList.add("clienti-master-fixes");
    document.body.classList.add("clienti-master-fixes");

    let mutationObserver: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let raf = 0;

    const setImportant = (el: HTMLElement | null, prop: string, value: string) => {
      if (!el) return;
      el.style.setProperty(prop, value, "important");
    };

    const applyClientiLayout = () => {
      const main = document.querySelector(
        "main.anagrafiche-master-page"
      ) as HTMLElement | null;
      if (!main) return;

      const tables = Array.from(main.querySelectorAll("table")) as HTMLTableElement[];
      const table = tables.find((candidate) => {
        const headers = Array.from(candidate.querySelectorAll("th")).map((th) =>
          (th.textContent || "").trim()
        );
        return headers.includes("Cod. Cliente") && headers.includes("Ragione Sociale");
      });
      if (!table) return;

      const scrollOwner = table.parentElement as HTMLElement | null;
      if (!scrollOwner) return;

      const root = main.firstElementChild as HTMLElement | null;
      if (!root) return;

      setImportant(document.documentElement, "height", "100%");
      setImportant(document.documentElement, "overflow", "hidden");
      setImportant(document.body, "height", "100%");
      setImportant(document.body, "overflow", "hidden");
      setImportant(main, "height", "100%");
      setImportant(main, "min-height", "0");
      setImportant(main, "overflow", "hidden");

      setImportant(root, "display", "flex");
      setImportant(root, "flex-direction", "column");
      setImportant(root, "height", "100%");
      setImportant(root, "min-height", "0");
      setImportant(root, "overflow", "hidden");

      Array.from(root.children).forEach((child) => {
        const element = child as HTMLElement;
        if (!element.contains(table)) {
          setImportant(element, "flex", "0 0 auto");
        }
      });

      const chain: HTMLElement[] = [];
      let node = scrollOwner.parentElement as HTMLElement | null;
      while (node && node !== root && node !== main) {
        chain.push(node);
        node = node.parentElement as HTMLElement | null;
      }

      chain.forEach((element) => {
        setImportant(element, "display", "flex");
        setImportant(element, "flex-direction", "column");
        setImportant(element, "flex", "1 1 0%");
        setImportant(element, "min-height", "0");
        setImportant(element, "max-height", "none");
        setImportant(element, "overflow", "hidden");
      });

      setImportant(scrollOwner, "display", "block");
      setImportant(scrollOwner, "flex", "1 1 0%");
      setImportant(scrollOwner, "width", "100%");
      setImportant(scrollOwner, "height", "100%");
      setImportant(scrollOwner, "min-height", "0");
      setImportant(scrollOwner, "max-height", "none");
      setImportant(scrollOwner, "overflow-x", "auto");
      setImportant(scrollOwner, "overflow-y", "auto");
      setImportant(scrollOwner, "position", "relative");
      setImportant(scrollOwner, "scrollbar-gutter", "stable");

      let ancestor = scrollOwner.parentElement as HTMLElement | null;
      while (ancestor && ancestor !== document.body) {
        if (ancestor !== scrollOwner && ancestor !== main && ancestor !== root) {
          setImportant(ancestor, "overflow", "hidden");
          setImportant(ancestor, "min-height", "0");
        }
        if (ancestor === main) break;
        ancestor = ancestor.parentElement as HTMLElement | null;
      }

      setImportant(table, "width", "100%");
      setImportant(table, "min-width", "1750px");
      setImportant(table, "border-collapse", "separate");
      setImportant(table, "border-spacing", "0");
      setImportant(table, "font-size", "0.86rem");

      const thead = table.querySelector("thead") as HTMLElement | null;
      setImportant(thead, "position", "sticky");
      setImportant(thead, "top", "0");
      setImportant(thead, "z-index", "100");
      setImportant(thead, "background", "rgb(71 85 105)");

      table.querySelectorAll("thead th").forEach((th) => {
        const cell = th as HTMLElement;
        setImportant(cell, "position", "sticky");
        setImportant(cell, "top", "0");
        setImportant(cell, "z-index", "101");
        setImportant(cell, "background", "rgb(71 85 105)");
        setImportant(cell, "color", "white");
        setImportant(cell, "font-size", "0.86rem");
      });

      table.querySelectorAll("tbody td").forEach((td) => {
        setImportant(td as HTMLElement, "font-size", "0.86rem");
      });

      main.querySelectorAll("input, select, textarea, button[role='combobox']").forEach((el) => {
        setImportant(el as HTMLElement, "font-size", "0.9rem");
      });
      main.querySelectorAll("button").forEach((el) => {
        setImportant(el as HTMLElement, "font-size", "0.88rem");
      });
      main.querySelectorAll("label").forEach((el) => {
        setImportant(el as HTMLElement, "font-size", "0.87rem");
      });

      resizeObserver?.disconnect();
      resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(applyClientiLayout);
      });
      resizeObserver.observe(root);
      resizeObserver.observe(scrollOwner);
    };

    raf = requestAnimationFrame(applyClientiLayout);
    mutationObserver = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(applyClientiLayout);
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(raf);
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      document.documentElement.classList.remove("clienti-master-fixes");
      document.body.classList.remove("clienti-master-fixes");
      document.documentElement.style.removeProperty("height");
      document.documentElement.style.removeProperty("overflow");
      document.body.style.removeProperty("height");
      document.body.style.removeProperty("overflow");
    };
  }, []);

  return (
    <style jsx global>{`
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
