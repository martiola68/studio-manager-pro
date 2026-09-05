import { useEffect } from "react";

export function RubricaMasterGraficaEnhancer() {
  useEffect(() => {
    document.body.classList.add("master-grafica-rubrica");
    return () => document.body.classList.remove("master-grafica-rubrica");
  }, []);

  useEffect(() => {
    let scrollArea: HTMLElement | null = null;
    let mutationObserver: MutationObserver | null = null;
    let frame = 0;

    const refresh = () => {
      const page = document.querySelector<HTMLElement>(".rubrica-master-page");
      if (!page) return;

      const pageRoot = page.firstElementChild as HTMLElement | null;
      if (!pageRoot) return;

      const nextScrollArea = Array.from(pageRoot.children).find((el) =>
        (el as HTMLElement).classList.contains("space-y-6")
      ) as HTMLElement | undefined;

      const filterPanel = pageRoot.children.item(1) as HTMLElement | null;
      if (!nextScrollArea || !filterPanel) return;

      if (scrollArea !== nextScrollArea) {
        scrollArea?.removeEventListener("scroll", scheduleUpdate);
        scrollArea = nextScrollArea;
        scrollArea.addEventListener("scroll", scheduleUpdate, { passive: true });
      }

      Array.from(scrollArea.children).forEach((node) => {
        const card = node as HTMLElement;
        const title = card.querySelector("h3");
        const match = title?.textContent?.trim().match(/^Lettera\s+([A-Z])$/i);
        if (!match) return;

        card.dataset.rubricaLetter = match[1].toUpperCase();
        const header = card.firstElementChild as HTMLElement | null;
        header?.classList.add("rubrica-letter-header-hidden");
      });

      updateActiveLetter(filterPanel);
    };

    const updateActiveLetter = (filterPanel?: HTMLElement | null) => {
      if (!scrollArea) return;

      const page = document.querySelector<HTMLElement>(".rubrica-master-page");
      const pageRoot = page?.firstElementChild as HTMLElement | null;
      const panel = filterPanel || (pageRoot?.children.item(1) as HTMLElement | null);
      if (!panel) return;

      const cards = Array.from(
        scrollArea.querySelectorAll<HTMLElement>("[data-rubrica-letter]")
      );
      if (!cards.length) return;

      const topLine = scrollArea.getBoundingClientRect().top + 4;
      let activeCard = cards[0];

      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        if (rect.top <= topLine) activeCard = card;
        if (rect.top > topLine) break;
      }

      const activeLetter = activeCard.dataset.rubricaLetter || "";
      const buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>("button"));

      buttons.forEach((button) => {
        const label = button.textContent?.trim().toUpperCase() || "";
        button.classList.toggle(
          "rubrica-scroll-letter-active",
          label.length === 1 && label === activeLetter
        );
        button.classList.toggle(
          "rubrica-scroll-tutti-inactive",
          label === "TUTTI" && Boolean(activeLetter)
        );
      });
    };

    function scheduleUpdate() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => updateActiveLetter());
    }

    const timer = window.setTimeout(() => {
      refresh();
      const page = document.querySelector<HTMLElement>(".rubrica-master-page");
      if (page) {
        mutationObserver = new MutationObserver(() => {
          refresh();
          scheduleUpdate();
        });
        mutationObserver.observe(page, { childList: true, subtree: true });
      }
    }, 0);

    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      mutationObserver?.disconnect();
      scrollArea?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, []);

  return (
    <style jsx global>{`
      .rubrica-master-page { background: rgb(241 245 249); }
      .rubrica-master-page > div {
        width: 100% !important;
        max-width: none !important;
        height: 100%;
        min-height: 0;
        padding-top: 12px !important;
        padding-bottom: 12px !important;
        display: flex;
        flex-direction: column;
      }
      .rubrica-master-page > div > div:first-child {
        flex: 0 0 auto;
        position: static !important;
        margin-bottom: 10px !important;
        padding: 10px 14px !important;
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 8px !important;
        background: rgb(248 250 252) !important;
      }
      .rubrica-master-page > div > div:first-child h1 {
        color: rgb(15 23 42) !important;
        font-size: 1.5rem !important;
        line-height: 2rem !important;
      }
      .rubrica-master-page > div > div:first-child p {
        font-size: .875rem !important;
        color: rgb(100 116 139) !important;
      }
      .rubrica-master-page > div > div:first-child button[class*="bg-blue-600"] {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }
      .rubrica-master-page > div > div:first-child button[class*="border-green-600"] {
        background: white !important;
        border-color: rgb(3 105 161) !important;
        color: rgb(3 105 161) !important;
      }
      .rubrica-master-page > div > div:nth-child(2) {
        flex: 0 0 auto;
        margin-bottom: 10px !important;
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 8px !important;
        background: rgb(248 250 252) !important;
        box-shadow: none !important;
      }
      .rubrica-master-page > div > div:nth-child(2) > div:first-child { padding: 9px 14px 4px !important; }
      .rubrica-master-page > div > div:nth-child(2) > div:nth-child(2) { padding: 6px 14px 10px !important; }
      .rubrica-master-page > div > div:nth-child(2) input {
        height: 34px !important;
        background: white !important;
        border-color: rgb(203 213 225) !important;
      }
      .rubrica-master-page > div > div:nth-child(2) button {
        width: 32px !important;
        min-width: 32px !important;
        height: 30px !important;
        padding: 0 !important;
        background: white !important;
        border-color: rgb(125 211 252) !important;
        color: rgb(3 105 161) !important;
      }
      .rubrica-master-page > div > div:nth-child(2) button[class*="bg-red-600"] {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }
      .rubrica-master-page > div > div:nth-child(2) button:first-child {
        width: 52px !important;
        min-width: 52px !important;
      }
      .rubrica-master-page > div > div:nth-child(2) button.rubrica-scroll-letter-active {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }
      .rubrica-master-page > div > div:nth-child(2) button.rubrica-scroll-tutti-inactive {
        background: white !important;
        border-color: rgb(125 211 252) !important;
        color: rgb(3 105 161) !important;
      }

      .rubrica-master-page > div > div.space-y-6 {
        min-height: 0;
        flex: 1 1 auto;
        display: block !important;
        margin: 0 !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        padding: 10px 14px 18px !important;
        border: 1px solid rgb(186 230 253);
        border-radius: 8px;
        background: white !important;
      }
      .rubrica-master-page > div > div.space-y-6 > div {
        width: 100% !important;
        height: auto !important;
        margin: 0 0 12px 0 !important;
        border: 1px solid rgb(203 213 225) !important;
        border-radius: 7px !important;
        box-shadow: 0 1px 2px rgb(15 23 42 / .06) !important;
        background: white !important;
      }
      .rubrica-master-page > div > div.space-y-6 > div:last-child { margin-bottom: 0 !important; }
      .rubrica-master-page .rubrica-letter-header-hidden { display: none !important; }
      .rubrica-master-page > div > div.space-y-6 > div > div:nth-child(2) > div {
        padding: 8px 12px !important;
        min-height: 52px;
        border-color: rgb(226 232 240) !important;
      }
      .rubrica-master-page > div > div.space-y-6 > div > div:nth-child(2) > div:hover { background: rgb(240 249 255) !important; }
      .rubrica-master-page > div > div.space-y-6 .text-xl { font-size: .9rem !important; line-height: 1.25rem !important; }
      .rubrica-master-page > div > div.space-y-6 .text-base { font-size: .75rem !important; line-height: 1rem !important; }
      .rubrica-master-page > div > div.space-y-6 svg { width: 15px !important; height: 15px !important; }
      .rubrica-master-page > div > div.space-y-6 .bg-red-100 { background: rgb(254 242 242) !important; }
      .rubrica-master-page > div > div.space-y-6 .bg-red-600 { background: rgb(220 38 38) !important; }

      body.master-grafica-rubrica [role="dialog"] {
        width: min(96vw, 1120px) !important;
        max-width: 1120px !important;
        max-height: 90vh !important;
        padding: 0 !important;
        overflow: hidden !important;
        background: rgb(248 250 252) !important;
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 10px !important;
      }
      body.master-grafica-rubrica [role="dialog"] > div:first-child,
      body.master-grafica-rubrica [role="dialog"] > header {
        padding: 14px 18px 10px !important;
        border-bottom: 1px solid rgb(186 230 253);
        background: rgb(248 250 252);
      }
      body.master-grafica-rubrica [role="dialog"] h2 {
        font-size: 1.125rem !important;
        color: rgb(15 23 42) !important;
      }
      body.master-grafica-rubrica [role="dialog"] form {
        max-height: calc(90vh - 78px);
        overflow-y: auto;
        padding: 12px 18px 16px !important;
      }
      body.master-grafica-rubrica [role="dialog"] form.space-y-4 > :not([hidden]) ~ :not([hidden]) {
        margin-top: 10px !important;
      }
      body.master-grafica-rubrica [role="dialog"] label {
        font-size: .75rem !important;
        font-weight: 600 !important;
        color: rgb(51 65 85) !important;
      }
      body.master-grafica-rubrica [role="dialog"] input,
      body.master-grafica-rubrica [role="dialog"] select,
      body.master-grafica-rubrica [role="dialog"] textarea {
        background: white !important;
        border-color: rgb(203 213 225) !important;
      }
      body.master-grafica-rubrica [role="dialog"] input,
      body.master-grafica-rubrica [role="dialog"] select {
        height: 34px !important;
      }
      body.master-grafica-rubrica [role="dialog"] textarea {
        min-height: 72px !important;
        height: 72px !important;
      }
      body.master-grafica-rubrica [role="dialog"] .rounded-lg.border.bg-gray-50 {
        background: rgb(248 250 252) !important;
        border-color: rgb(186 230 253) !important;
        padding: 10px 12px !important;
      }
      body.master-grafica-rubrica [role="dialog"] .border-blue-200.bg-blue-50 {
        background: rgb(240 249 255) !important;
        border-color: rgb(125 211 252) !important;
        padding: 10px 12px !important;
      }
      body.master-grafica-rubrica [role="dialog"] input[type="checkbox"] {
        accent-color: rgb(3 105 161);
      }
      body.master-grafica-rubrica [role="dialog"] button.bg-blue-600,
      body.master-grafica-rubrica [role="dialog"] button[class*="bg-blue-600"] {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }
      body.master-grafica-rubrica [role="dialog"] button.bg-blue-600:hover,
      body.master-grafica-rubrica [role="dialog"] button[class*="bg-blue-600"]:hover {
        background: rgb(2 132 199) !important;
      }
      body.master-grafica-rubrica [role="dialog"] .mt-4.flex.flex-col.gap-3.border-t {
        position: sticky;
        bottom: -16px;
        z-index: 5;
        margin-left: -18px !important;
        margin-right: -18px !important;
        margin-bottom: -16px !important;
        padding: 10px 18px 12px !important;
        background: rgb(248 250 252);
        border-top-color: rgb(186 230 253) !important;
      }
    `}</style>
  );
}
