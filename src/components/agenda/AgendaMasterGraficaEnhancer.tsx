import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type FestivitaRow = {
  data_festivita: string;
};

const pad = (value: number) => String(value).padStart(2, "0");

const toLocalIso = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const getIsoWeekStart = (year: number, week: number) => {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - jan4Day + 1 + (week - 1) * 7);
  monday.setHours(12, 0, 0, 0);
  return monday;
};

const MONTHS_IT = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

export function AgendaMasterGraficaEnhancer() {
  const [festivita, setFestivita] = useState<string[]>([]);
  const festivitaSet = useMemo(() => new Set(festivita), [festivita]);

  useEffect(() => {
    let cancelled = false;

    const loadFestivita = async () => {
      try {
        const supabase = getSupabaseClient();
        const currentYear = new Date().getFullYear();
        const { data, error } = await (supabase as any)
          .from("tbfestivita")
          .select("data_festivita")
          .eq("tipo", "nazionale")
          .gte("data_festivita", `${currentYear - 2}-01-01`)
          .lte("data_festivita", `${currentYear + 3}-12-31`);

        if (error) throw error;
        if (!cancelled) {
          setFestivita(
            ((data || []) as FestivitaRow[])
              .map((row) => String(row.data_festivita || "").slice(0, 10))
              .filter(Boolean)
          );
        }
      } catch (error) {
        console.error("Errore caricamento festività Agenda:", error);
      }
    };

    void loadFestivita();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let applying = false;

    const enhanceAgenda = () => {
      if (applying) return;
      applying = true;

      try {
        const root = document.querySelector(".agenda-master-page");
        if (!root) return;

        const weekLabel = Array.from(root.querySelectorAll("span")).find((node) =>
          /Settimana\s+\d+.*\d{4}/i.test(node.textContent || "")
        );
        const match = weekLabel?.textContent?.match(/Settimana\s+(\d+).*?(\d{4})/i);

        if (match) {
          const week = Number(match[1]);
          const year = Number(match[2]);

          if (week && year) {
            const monday = getIsoWeekStart(year, week);
            const headerGrid = root.querySelector(".sticky > div");
            const headerCells = headerGrid ? Array.from(headerGrid.children) : [];

            headerCells.forEach((cell, index) => {
              if (!(cell instanceof HTMLElement)) return;
              if (index === 0 || index > 7) return;

              const date = new Date(monday);
              date.setDate(monday.getDate() + index - 1);
              const iso = toLocalIso(date);
              const day = date.getDay();
              const weekend = day === 0 || day === 6;
              const holiday = festivitaSet.has(iso);

              if (weekend) cell.setAttribute("data-agenda-weekend", "true");
              else cell.removeAttribute("data-agenda-weekend");

              if (holiday) cell.setAttribute("data-agenda-holiday", "true");
              else cell.removeAttribute("data-agenda-holiday");
            });

            const newEventButton = Array.from(root.querySelectorAll("button")).find((button) =>
              /Nuovo Evento/i.test(button.textContent || "")
            );

            if (newEventButton?.parentElement) {
              let monthLabel = newEventButton.parentElement.querySelector("[data-agenda-month-label]") as HTMLElement | null;
              if (!monthLabel) {
                monthLabel = document.createElement("span");
                monthLabel.setAttribute("data-agenda-month-label", "true");
                monthLabel.className = "agenda-master-month-label";
                newEventButton.insertAdjacentElement("afterend", monthLabel);
              }

              const monthDate = new Date(monday);
              monthDate.setDate(monday.getDate() + 3);
              monthLabel.textContent = `${MONTHS_IT[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
            }
          }
        }

        const viewLabels = ["Eventi ricorrenti", "Scaduti", "Riunioni Teams", "Mese", "Settimana"];
        const viewButtons = Array.from(root.querySelectorAll("button")).filter((button) =>
          viewLabels.some((label) => (button.textContent || "").trim().includes(label))
        );

        viewButtons.forEach((button) => {
          const isActive = button.className.includes("bg-primary");
          button.setAttribute("data-agenda-view-button", "true");
          button.setAttribute("data-agenda-view-active", isActive ? "true" : "false");
        });
      } finally {
        applying = false;
      }
    };

    enhanceAgenda();
    const observer = new MutationObserver(() => enhanceAgenda());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, [festivitaSet]);

  return (
    <style jsx global>{`
      .agenda-master-page button[data-agenda-view-button="true"] {
        background-color: white !important;
        color: rgb(15 23 42) !important;
        border: 1px solid rgb(125 211 252) !important;
        box-shadow: none !important;
      }

      .agenda-master-page button[data-agenda-view-button="true"]:hover {
        background-color: rgb(240 249 255) !important;
        border-color: rgb(56 189 248) !important;
      }

      .agenda-master-page button[data-agenda-view-button="true"][data-agenda-view-active="true"] {
        background-color: rgb(3 105 161) !important;
        color: white !important;
        border-color: rgb(3 105 161) !important;
      }

      .agenda-master-page button[data-agenda-view-button="true"][data-agenda-view-active="true"]:hover {
        background-color: rgb(2 132 199) !important;
        border-color: rgb(2 132 199) !important;
      }

      .agenda-master-page .sticky > div > div[data-agenda-weekend="true"],
      .agenda-master-page .sticky > div > div[data-agenda-holiday="true"] {
        background-color: rgb(254 226 226) !important;
        color: rgb(185 28 28) !important;
        border-color: rgb(252 165 165) !important;
      }

      .agenda-master-page .sticky > div > div[data-agenda-weekend="true"] *,
      .agenda-master-page .sticky > div > div[data-agenda-holiday="true"] * {
        color: rgb(185 28 28) !important;
      }

      .agenda-master-month-label {
        display: inline-flex;
        align-items: center;
        height: 36px;
        padding: 0 14px;
        border: 1px solid rgb(125 211 252);
        border-radius: 8px;
        background-color: white;
        color: rgb(3 105 161);
        font-weight: 700;
        text-transform: capitalize;
        white-space: nowrap;
      }
    `}</style>
  );
}
