import { useEffect } from "react";

export function RubricaScrollSpyFix() {
  useEffect(() => {
    let frame = 0;
    let observer: MutationObserver | null = null;

    const getFilterButtons = () => {
      const page = document.querySelector<HTMLElement>(".rubrica-master-page");
      if (!page) return [] as HTMLButtonElement[];
      return Array.from(page.querySelectorAll<HTMLButtonElement>("button")).filter((button) => {
        const text = button.textContent?.trim().toUpperCase() || "";
        return text === "TUTTI" || /^[A-Z]$/.test(text);
      });
    };

    const prepareSections = () => {
      const page = document.querySelector<HTMLElement>(".rubrica-master-page");
      if (!page) return [] as HTMLElement[];

      const headers = Array.from(page.querySelectorAll<HTMLElement>("h1,h2,h3,h4,div,span")).filter((el) =>
        /^Lettera\s+[A-Z]$/i.test(el.textContent?.trim() || "")
      );

      const cards: HTMLElement[] = [];

      headers.forEach((label) => {
        const match = label.textContent?.trim().match(/^Lettera\s+([A-Z])$/i);
        if (!match) return;

        const letter = match[1].toUpperCase();
        let card: HTMLElement | null = label;
        while (card && card.parentElement) {
          const parent = card.parentElement as HTMLElement;
          if (parent.querySelectorAll('[data-rubrica-contact-row]').length > 0) {
            card = parent;
            break;
          }
          if (parent.classList.contains("space-y-6")) break;
          card = parent;
        }

        const likelyCard = label.closest<HTMLElement>(".overflow-hidden") || card;
        if (!likelyCard) return;

        likelyCard.dataset.rubricaLetterSpy = letter;

        const header = label.closest<HTMLElement>("[class*='bg-blue-600']") || label.parentElement?.parentElement as HTMLElement | null;
        if (header) {
          header.style.setProperty("display", "none", "important");
        }

        cards.push(likelyCard);
      });

      return Array.from(new Set(cards));
    };

    const update = () => {
      const page = document.querySelector<HTMLElement>(".rubrica-master-page");
      if (!page) return;

      const cards = prepareSections();
      if (!cards.length) return;

      let scrollParent: HTMLElement | null = null;
      for (const card of cards) {
        let p = card.parentElement as HTMLElement | null;
        while (p && p !== document.body) {
          const style = getComputedStyle(p);
          if ((style.overflowY === "auto" || style.overflowY === "scroll") && p.scrollHeight > p.clientHeight) {
            scrollParent = p;
            break;
          }
          p = p.parentElement;
        }
        if (scrollParent) break;
      }

      if (!scrollParent) return;

      const top = scrollParent.getBoundingClientRect().top + 2;
      let active = cards[0].dataset.rubricaLetterSpy || "";

      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        if (rect.top <= top) active = card.dataset.rubricaLetterSpy || active;
        else break;
      }

      const buttons = getFilterButtons();
      buttons.forEach((button) => {
        const text = button.textContent?.trim().toUpperCase() || "";
        const isLetter = /^[A-Z]$/.test(text);
        const isActive = isLetter && text === active;
        button.classList.toggle("rubrica-scrollspy-active", isActive);
        button.classList.toggle("rubrica-scrollspy-tutti-off", text === "TUTTI" && Boolean(active));
      });
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    const markRows = () => {
      const page = document.querySelector<HTMLElement>(".rubrica-master-page");
      if (!page) return;
      const labels = Array.from(page.querySelectorAll<HTMLElement>("h1,h2,h3,h4,div,span")).filter((el) =>
        /^Lettera\s+[A-Z]$/i.test(el.textContent?.trim() || "")
      );
      labels.forEach((label) => {
        const card = label.closest<HTMLElement>(".overflow-hidden");
        const content = card?.querySelector<HTMLElement>("[class*='divide-y']");
        if (!content) return;
        Array.from(content.children).forEach((row) => (row as HTMLElement).dataset.rubricaContactRow = "1");
      });
    };

    const init = () => {
      markRows();
      update();
      const page = document.querySelector<HTMLElement>(".rubrica-master-page");
      if (!page) return;
      observer = new MutationObserver(() => {
        markRows();
        schedule();
      });
      observer.observe(page, { childList: true, subtree: true });
    };

    const timer = window.setTimeout(init, 50);
    document.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <style jsx global>{`
      .rubrica-master-page .rubrica-scrollspy-active {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }
      .rubrica-master-page .rubrica-scrollspy-tutti-off {
        background: white !important;
        border-color: rgb(125 211 252) !important;
        color: rgb(3 105 161) !important;
      }
    `}</style>
  );
}
