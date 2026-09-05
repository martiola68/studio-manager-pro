import { useEffect } from "react";

const pad = (value: number) => String(value).padStart(2, "0");
const toLocalIso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const getIsoWeekStart = (year: number, week: number) => {
  const jan4 = new Date(year, 0, 4, 12, 0, 0, 0);
  const jan4Day = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - jan4Day + 1 + (week - 1) * 7);
  return monday;
};

const getEasterSunday = (year: number) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day, 12, 0, 0, 0);
};

const getItalianNationalHolidaySet = (year: number) => {
  const fixed = [[1,1],[1,6],[4,25],[5,1],[6,2],[8,15],[11,1],[12,8],[12,25],[12,26]];
  const values = new Set(fixed.map(([month, day]) => toLocalIso(new Date(year, month - 1, day, 12, 0, 0, 0))));
  const easterMonday = getEasterSunday(year);
  easterMonday.setDate(easterMonday.getDate() + 1);
  values.add(toLocalIso(easterMonday));
  return values;
};

const MONTHS_IT = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];

const viewByLabel: Record<string, string> = {
  "Eventi ricorrenti": "ricorrenti",
  "Scaduti": "list",
  "Riunioni Teams": "teams",
  "Mese": "month",
  "Settimana": "week",
};

export function AgendaMasterGraficaEnhancer() {
  useEffect(() => {
    const apply = () => {
      const root = document.querySelector(".agenda-master-page");
      if (!root) return;

      const weekLabel = Array.from(root.querySelectorAll("span")).find((node) => /Settimana\s+\d+.*\d{4}/i.test(node.textContent || ""));
      const match = weekLabel?.textContent?.match(/Settimana\s+(\d+).*?(\d{4})/i);

      if (match) {
        const week = Number(match[1]);
        const year = Number(match[2]);
        const monday = getIsoWeekStart(year, week);
        const holidays = getItalianNationalHolidaySet(year);
        const headerGrid = root.querySelector(".sticky > div");
        const headerCells = headerGrid ? Array.from(headerGrid.children) : [];

        headerCells.forEach((cell, index) => {
          if (!(cell instanceof HTMLElement) || index === 0 || index > 7) return;
          const date = new Date(monday);
          date.setDate(monday.getDate() + index - 1);
          const special = date.getDay() === 0 || date.getDay() === 6 || holidays.has(toLocalIso(date));
          if (special) {
            cell.style.setProperty("background-color", "rgb(254 226 226)", "important");
            cell.style.setProperty("color", "rgb(185 28 28)", "important");
            cell.style.setProperty("border-color", "rgb(252 165 165)", "important");
            cell.querySelectorAll("*").forEach((node) => node instanceof HTMLElement && node.style.setProperty("color", "rgb(185 28 28)", "important"));
          } else {
            cell.style.removeProperty("background-color");
            cell.style.removeProperty("color");
            cell.style.removeProperty("border-color");
            cell.querySelectorAll("*").forEach((node) => node instanceof HTMLElement && node.style.removeProperty("color"));
          }
        });

        const newEventButton = Array.from(root.querySelectorAll("button")).find((button) => /Nuovo Evento/i.test(button.textContent || ""));
        if (newEventButton?.parentElement) {
          let monthLabel = newEventButton.parentElement.querySelector("[data-agenda-month-label]") as HTMLElement | null;
          if (!monthLabel) {
            monthLabel = document.createElement("span");
            monthLabel.dataset.agendaMonthLabel = "true";
            monthLabel.className = "agenda-master-month-label";
            newEventButton.insertAdjacentElement("afterend", monthLabel);
          }
          const monthDate = new Date(monday);
          monthDate.setDate(monday.getDate() + 3);
          monthLabel.textContent = `${MONTHS_IT[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
        }
      }

      const buttons = Array.from(root.querySelectorAll("button"));
      const viewButtons = buttons.filter((button) => Object.keys(viewByLabel).some((label) => (button.textContent || "").trim().includes(label)));

      let activeView: string | null = null;
      for (const button of viewButtons) {
        const text = (button.textContent || "").trim();
        const label = Object.keys(viewByLabel).find((item) => text.includes(item));
        if (label && String(button.className || "").includes("bg-primary")) {
          activeView = viewByLabel[label];
          break;
        }
      }

      viewButtons.forEach((button) => {
        const text = (button.textContent || "").trim();
        const label = Object.keys(viewByLabel).find((item) => text.includes(item));
        const isActive = !!label && viewByLabel[label] === activeView;

        button.style.setProperty("background-color", isActive ? "rgb(14 165 233)" : "white", "important");
        button.style.setProperty("color", isActive ? "white" : "rgb(3 105 161)", "important");
        button.style.setProperty("border", `1px solid ${isActive ? "rgb(14 165 233)" : "rgb(56 189 248)"}`, "important");
        button.style.setProperty("box-shadow", "none", "important");
      });
    };

    apply();
    const interval = window.setInterval(apply, 250);
    return () => window.clearInterval(interval);
  }, []);

  return <style jsx global>{`
    .agenda-master-page .sticky > div > div:nth-child(7),
    .agenda-master-page .sticky > div > div:nth-child(8) {
      background-color: rgb(254 226 226) !important;
      color: rgb(185 28 28) !important;
      border-color: rgb(252 165 165) !important;
    }
    .agenda-master-page .sticky > div > div:nth-child(7) *,
    .agenda-master-page .sticky > div > div:nth-child(8) * { color: rgb(185 28 28) !important; }
    .agenda-master-month-label {
      display:inline-flex;align-items:center;height:36px;padding:0 14px;border:1px solid rgb(125 211 252);border-radius:8px;background:white;color:rgb(3 105 161);font-weight:700;text-transform:capitalize;white-space:nowrap;
    }
  `}</style>;
}
