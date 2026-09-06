import { useEffect } from "react";

const PANEL_TITLES = new Set([
  "Soci diretti",
  "Titolari effettivi",
  "Società controllate",
  "Società collegate",
  "Titolari effettivi del gruppo",
]);

export function GruppiSocietariMasterGraficaFixes() {
  useEffect(() => {
    let frame = 0;

    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const outerMain = document.querySelector("main.anagrafiche-master-page") as HTMLElement | null;
        if (!outerMain) return;

        const pageRoot = Array.from(outerMain.querySelectorAll("main")).find((node) =>
          (node.textContent || "").includes("Gruppi societari")
        ) as HTMLElement | undefined;
        if (!pageRoot) return;

        pageRoot.classList.add("groups-master-root");

        const titleNode = Array.from(pageRoot.querySelectorAll("div")).find(
          (node) => (node.textContent || "").trim() === "Struttura gruppi"
        );
        const sidebar = titleNode?.closest("aside") as HTMLElement | null;
        if (!sidebar) return;

        sidebar.classList.add("groups-master-sidebar");

        const layout = sidebar.parentElement as HTMLElement | null;
        const content = sidebar.nextElementSibling as HTMLElement | null;
        if (!layout || !content) return;

        layout.classList.add("groups-master-layout");
        content.classList.add("groups-master-content");

        const directChildren = Array.from(content.children) as HTMLElement[];
        directChildren.forEach((child) => {
          child.classList.remove("groups-master-heading-card", "groups-master-company-card");
        });

        if (directChildren[0]) directChildren[0].classList.add("groups-master-heading-card");
        if (directChildren[1]) directChildren[1].classList.add("groups-master-company-card");

        Array.from(content.querySelectorAll("div")).forEach((node) => {
          const text = (node.textContent || "").trim();
          if (!PANEL_TITLES.has(text)) return;
          const card = node.parentElement as HTMLElement | null;
          if (card) card.classList.add("groups-dashboard-card");
        });

        const top = Math.max(0, layout.getBoundingClientRect().top);
        layout.style.setProperty("--groups-layout-height", `${Math.max(260, window.innerHeight - top - 16)}px`);

        const heading = directChildren[0];
        if (heading) {
          const secondTop = heading.offsetHeight + 10;
          content.style.setProperty("--groups-company-top", `${secondTop}px`);
        }
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", apply);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", apply);
      document.documentElement.classList.remove("groups-master-active");
      document.body.classList.remove("groups-master-active");
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("groups-master-active");
    document.body.classList.add("groups-master-active");
  }, []);

  return (
    <style jsx global>{`
      html.groups-master-active,
      body.groups-master-active {
        overflow: hidden !important;
        height: 100% !important;
      }

      main.anagrafiche-master-page {
        overflow: hidden !important;
      }

      .groups-master-root {
        height: 100% !important;
        min-height: 0 !important;
        overflow: hidden !important;
        padding-top: 14px !important;
        padding-bottom: 0 !important;
      }

      .groups-master-layout {
        height: var(--groups-layout-height) !important;
        min-height: 260px !important;
        overflow: hidden !important;
        align-items: stretch !important;
      }

      .groups-master-sidebar {
        position: relative !important;
        top: auto !important;
        height: 100% !important;
        max-height: none !important;
        min-height: 0 !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        border: 1px solid rgb(125 211 252) !important;
        border-left: 3px solid rgb(14 165 233) !important;
        border-radius: 10px !important;
        background: white !important;
        box-shadow: 0 8px 22px rgb(15 23 42 / 0.06) !important;
        scrollbar-gutter: stable !important;
      }

      .groups-master-content {
        height: 100% !important;
        min-height: 0 !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        padding-right: 5px !important;
        scrollbar-gutter: stable !important;
      }

      .groups-master-heading-card,
      .groups-master-company-card,
      .groups-dashboard-card {
        border: 1px solid rgb(125 211 252) !important;
        border-left: 3px solid rgb(14 165 233) !important;
        border-radius: 10px !important;
        background: white !important;
        box-shadow: 0 8px 22px rgb(15 23 42 / 0.06) !important;
      }

      .groups-master-heading-card {
        position: sticky !important;
        top: 0 !important;
        z-index: 30 !important;
        margin-bottom: 10px !important;
        padding: 16px 18px !important;
      }

      .groups-master-company-card {
        position: sticky !important;
        top: var(--groups-company-top, 118px) !important;
        z-index: 29 !important;
        margin-bottom: 14px !important;
        padding: 15px 18px !important;
      }

      .groups-master-heading-card::after,
      .groups-master-company-card::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        bottom: -10px;
        height: 10px;
        background: rgb(241 245 249);
        pointer-events: none;
      }

      .groups-dashboard-card {
        padding: 15px !important;
        transition: box-shadow .18s ease, transform .18s ease !important;
      }

      .groups-dashboard-card:hover {
        box-shadow: 0 10px 26px rgb(15 23 42 / 0.09) !important;
      }

      .groups-master-content [style*="background: rgb(248, 250, 252)"],
      .groups-master-content [style*="background: #f8fafc"] {
        border: 1px solid rgb(224 242 254) !important;
        background: rgb(240 249 255) !important;
      }

      .groups-master-content table {
        border: 1px solid rgb(203 213 225) !important;
        border-radius: 8px !important;
        overflow: hidden !important;
      }

      .groups-master-content thead th {
        background: rgb(71 85 105) !important;
        color: white !important;
      }

      @media (max-width: 1100px) {
        .groups-master-layout {
          grid-template-columns: 270px minmax(0, 1fr) !important;
        }
      }
    `}</style>
  );
}
