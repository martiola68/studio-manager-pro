import { useEffect } from "react";

export function CassettiFiscaliMasterGraficaEnhancer() {
  useEffect(() => {
    document.body.classList.add("master-grafica-cassetti-fiscali");

    const applyButtonStyles = () => {
      const root = document.querySelector(".cassetti-fiscali-master-page");
      if (!root) return;

      root.querySelectorAll("button").forEach((button) => {
        const text = (button.textContent || "").trim();
        const isViewButton = text === "Gestori" || text === "Società collegate";
        const isNew = text === "Nuovo Cassetto";
        const isAlphabet = text === "Tutti" || /^[A-Z]$/.test(text);

        if (isNew) {
          button.style.backgroundColor = "rgb(3 105 161)";
          button.style.borderColor = "rgb(3 105 161)";
          button.style.color = "white";
        } else if (isViewButton) {
          const active = button.className.includes("bg-green-600");
          button.style.backgroundColor = active ? "rgb(3 105 161)" : "white";
          button.style.border = active ? "1px solid rgb(3 105 161)" : "1px solid rgb(203 213 225)";
          button.style.color = active ? "white" : "rgb(51 65 85)";
        } else if (isAlphabet) {
          const active = button.getAttribute("data-state") === "active" || button.className.includes("bg-primary");
          if (active) {
            button.style.backgroundColor = "rgb(3 105 161)";
            button.style.borderColor = "rgb(3 105 161)";
            button.style.color = "white";
          }
        }
      });
    };

    applyButtonStyles();
    const observer = new MutationObserver(applyButtonStyles);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
      document.body.classList.remove("master-grafica-cassetti-fiscali");
    };
  }, []);

  return (
    <style jsx global>{`
      .cassetti-fiscali-master-page {
        background: rgb(241 245 249);
      }
      .cassetti-fiscali-master-page > div {
        height: 100%;
        min-height: 0;
        max-width: none !important;
        padding-top: 12px !important;
        padding-bottom: 12px !important;
        display: flex;
        flex-direction: column;
      }
      .cassetti-fiscali-master-page > div > div:first-child {
        flex: 0 0 auto;
        margin-bottom: 10px !important;
        padding: 12px 14px;
        border: 1px solid rgb(186 230 253);
        border-radius: 8px;
        background: rgb(248 250 252);
      }
      .cassetti-fiscali-master-page > div > div:first-child h1 {
        color: rgb(15 23 42);
      }
      .cassetti-fiscali-master-page > div > .space-y-4 {
        min-height: 0;
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .cassetti-fiscali-master-page > div > .space-y-4 > div:first-child {
        flex: 0 0 auto;
        padding: 10px;
        border: 1px solid rgb(186 230 253);
        border-radius: 8px;
        background: rgb(248 250 252);
      }
      .cassetti-fiscali-master-page > div > .space-y-4 > div:last-child {
        min-height: 0;
        flex: 1 1 auto;
        border-color: rgb(186 230 253) !important;
        border-radius: 8px !important;
        box-shadow: none !important;
      }
      .cassetti-fiscali-master-page > div > .space-y-4 > div:last-child > div {
        height: 100% !important;
        min-height: 0 !important;
        max-height: none !important;
      }
      .cassetti-fiscali-master-page thead {
        background: rgb(71 85 105) !important;
        color: white !important;
      }
      .cassetti-fiscali-master-page thead tr,
      .cassetti-fiscali-master-page thead th {
        background: rgb(71 85 105) !important;
        color: white !important;
        border-color: rgb(100 116 139) !important;
      }

      /* Righe più compatte e uniformi: nessuna alternanza cromatica. */
      .cassetti-fiscali-master-page tbody tr,
      .cassetti-fiscali-master-page tbody tr:nth-child(even),
      .cassetti-fiscali-master-page tbody tr:nth-child(odd) {
        background: white !important;
        border-color: rgb(226 232 240);
      }
      .cassetti-fiscali-master-page tbody td {
        padding-top: 5px !important;
        padding-bottom: 5px !important;
        background-color: white;
      }
      .cassetti-fiscali-master-page tbody tr:hover td {
        background-color: rgb(240 249 255) !important;
      }

      /* Password attuale: azzurro SMP al posto del verde legacy. */
      .cassetti-fiscali-master-page tbody td.bg-green-100,
      .cassetti-fiscali-master-page tbody td[class*="bg-green-100"] {
        background-color: rgb(224 242 254) !important;
        color: rgb(3 105 161) !important;
        border-color: rgb(125 211 252) !important;
      }
      .cassetti-fiscali-master-page tbody tr:hover td.bg-green-100,
      .cassetti-fiscali-master-page tbody tr:hover td[class*="bg-green-100"] {
        background-color: rgb(186 230 253) !important;
      }

      body.master-grafica-cassetti-fiscali [role="dialog"] {
        background: rgb(248 250 252);
        border-color: rgb(186 230 253);
      }
      body.master-grafica-cassetti-fiscali [role="dialog"] input,
      body.master-grafica-cassetti-fiscali [role="dialog"] textarea,
      body.master-grafica-cassetti-fiscali [role="dialog"] button[role="combobox"] {
        background: white;
        border-color: rgb(203 213 225);
      }
    `}</style>
  );
}
