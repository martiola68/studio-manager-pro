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
    const decorateWeek = () => {
      const root = document.querySelector(".agenda-master-page");
      if (!root) return;

      const weekLabel = Array.from(root.querySelectorAll("span")).find((node) =>
        /Settimana\s+\d+.*\d{4}/i.test(node.textContent || "")
      );
      const match = weekLabel?.textContent?.match(/Settimana\s+(\d+).*?(\d{4})/i);
      if (!match) return;

      const week = Number(match[1]);
      const year = Number(match[2]);
      if (!week || !year) return;

      const monday = getIsoWeekStart(year, week);
      const headerCells = root.querySelectorAll(".sticky > div > div");

      headerCells.forEach((cell, index) => {
        cell.removeAttribute("data-agenda-weekend");
        cell.removeAttribute("data-agenda-holiday");
        if (index === 0 || index > 7) return;

        const date = new Date(monday);
        date.setDate(monday.getDate() + index - 1);
        const iso = toLocalIso(date);
        const day = date.getDay();

        if (day === 0 || day === 6) {
          cell.setAttribute("data-agenda-weekend", "true");
        }
        if (festivitaSet.has(iso)) {
          cell.setAttribute("data-agenda-holiday", "true");
        }
      });
    };

    decorateWeek();
    const observer = new MutationObserver(decorateWeek);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => observer.disconnect();
  }, [festivitaSet]);

  return (
    <style jsx global>{`
      .agenda-master-page .md\\:block > div:first-child > div:last-child > div:last-child button {
        background-color: white !important;
        color: rgb(15 23 42) !important;
        border: 1px solid rgb(125 211 252) !important;
        box-shadow: none !important;
      }

      .agenda-master-page .md\\:block > div:first-child > div:last-child > div:last-child button:hover {
        background-color: rgb(240 249 255) !important;
        border-color: rgb(56 189 248) !important;
      }

      .agenda-master-page .md\\:block > div:first-child > div:last-child > div:last-child button[class*="bg-primary"] {
        background-color: rgb(3 105 161) !important;
        color: white !important;
        border-color: rgb(3 105 161) !important;
      }

      .agenda-master-page .md\\:block > div:first-child > div:last-child > div:last-child button[class*="bg-primary"]:hover {
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
    `}</style>
  );
}
