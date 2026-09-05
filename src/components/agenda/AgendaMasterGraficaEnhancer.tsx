import { useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

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

const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

const extractTeamsUrl = (value: string | null | undefined) => {
  const text = String(value || "");
  const match = text.match(/https:\/\/(?:teams\.microsoft\.com|teams\.live\.com)\/[^\s<>'\"]+/i);
  return match?.[0] || null;
};

const formatAgendaDate = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatAgendaTime = (value: string | null | undefined) => String(value || "").slice(0, 5);

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

        button.style.setProperty("background-color", isActive ? "rgb(3 105 161)" : "white", "important");
        button.style.setProperty("color", isActive ? "white" : "rgb(3 105 161)", "important");
        button.style.setProperty("border", `1px solid rgb(3 105 161)`, "important");
        button.style.setProperty("box-shadow", "none", "important");
      });
    };

    let teamsLookupRunning = false;
    let lastTeamsKey = "";

    const repairTeamsEmptyView = async () => {
      if (teamsLookupRunning) return;
      const root = document.querySelector(".agenda-master-page");
      if (!root) return;

      const emptyMessage = Array.from(root.querySelectorAll("p")).find((node) =>
        /Nessuna riunione Teams trovata per/i.test(node.textContent || "")
      ) as HTMLElement | undefined;

      if (!emptyMessage) {
        const fallback = root.querySelector("[data-agenda-teams-fallback]");
        if (fallback) fallback.remove();
        lastTeamsKey = "";
        return;
      }

      const rawNames = (emptyMessage.textContent || "")
        .replace(/^.*Nessuna riunione Teams trovata per\s*/i, "")
        .trim();
      if (!rawNames) return;

      const key = rawNames.toLowerCase();
      if (key === lastTeamsKey && root.querySelector("[data-agenda-teams-fallback]")) return;

      teamsLookupRunning = true;
      try {
        const supabase = getSupabaseClient() as any;
        const { data: users, error: usersError } = await supabase
          .from("tbutenti")
          .select("id,nome,cognome,email")
          .eq("attivo", true);
        if (usersError) return;

        let selectedIds: string[] = [];
        if (/tutti gli utenti/i.test(rawNames)) {
          selectedIds = (users || []).map((u: any) => String(u.id));
        } else {
          const selectedNames = rawNames.split(",").map(normalizeName).filter(Boolean);
          selectedIds = (users || [])
            .filter((u: any) => {
              const surnameFirst = normalizeName(`${u.cognome || ""} ${u.nome || ""}`);
              const nameFirst = normalizeName(`${u.nome || ""} ${u.cognome || ""}`);
              return selectedNames.includes(surnameFirst) || selectedNames.includes(nameFirst);
            })
            .map((u: any) => String(u.id));
        }
        if (selectedIds.length === 0) return;

        const { data: rows, error: rowsError } = await supabase
          .from("tbagenda")
          .select("id,titolo,data_inizio,data_fine,ora_inizio,ora_fine,utente_id,riunione_teams,link_teams,luogo,descrizione,provider")
          .in("utente_id", selectedIds)
          .order("data_inizio", { ascending: true });
        if (rowsError) return;

        const meetings = (rows || []).filter((row: any) => {
          const description = String(row.descrizione || "");
          const place = String(row.luogo || "");
          return Boolean(row.riunione_teams) ||
            Boolean(String(row.link_teams || "").trim()) ||
            /teams\.microsoft\.com|teams\.live\.com/i.test(description) ||
            /microsoft teams/i.test(description) ||
            /microsoft teams/i.test(place);
        });

        if (meetings.length === 0) return;

        const nativeContainer = emptyMessage.parentElement;
        if (!nativeContainer?.parentElement) return;

        nativeContainer.style.display = "none";
        root.querySelector("[data-agenda-teams-fallback]")?.remove();

        const wrapper = document.createElement("div");
        wrapper.dataset.agendaTeamsFallback = "true";
        wrapper.className = "agenda-teams-fallback";

        const title = document.createElement("div");
        title.className = "agenda-teams-fallback-title";
        title.textContent = `Riunioni Teams di ${rawNames}`;
        wrapper.appendChild(title);

        const table = document.createElement("table");
        table.className = "agenda-teams-fallback-table";
        table.innerHTML = "<thead><tr><th>Data</th><th>Orario</th><th>Descrizione</th><th>Teams</th></tr></thead>";
        const tbody = document.createElement("tbody");

        meetings.forEach((row: any) => {
          const tr = document.createElement("tr");
          const tdDate = document.createElement("td");
          const tdTime = document.createElement("td");
          const tdTitle = document.createElement("td");
          const tdLink = document.createElement("td");

          tdDate.textContent = formatAgendaDate(row.data_inizio);
          tdTime.textContent = `${formatAgendaTime(row.ora_inizio || String(row.data_inizio || "").slice(11, 16))} - ${formatAgendaTime(row.ora_fine || String(row.data_fine || "").slice(11, 16))}`;
          tdTitle.textContent = String(row.titolo || "Riunione Teams");

          const joinUrl = String(row.link_teams || "").trim() || extractTeamsUrl(row.descrizione);
          if (joinUrl) {
            const a = document.createElement("a");
            a.href = joinUrl;
            a.target = "_blank";
            a.rel = "noreferrer";
            a.textContent = "Partecipa";
            a.className = "agenda-teams-join-link";
            tdLink.appendChild(a);
          } else {
            tdLink.textContent = "Teams";
          }

          tr.append(tdDate, tdTime, tdTitle, tdLink);
          tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        wrapper.appendChild(table);
        nativeContainer.parentElement.appendChild(wrapper);
        lastTeamsKey = key;
      } finally {
        teamsLookupRunning = false;
      }
    };

    apply();
    void repairTeamsEmptyView();
    const interval = window.setInterval(() => {
      apply();
      void repairTeamsEmptyView();
    }, 500);

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
      display:inline-flex;align-items:center;height:36px;padding:0 14px;border:1px solid rgb(3 105 161);border-radius:8px;background:white;color:rgb(3 105 161);font-weight:700;text-transform:capitalize;white-space:nowrap;
    }
    .agenda-teams-fallback { padding: 16px; }
    .agenda-teams-fallback-title { margin-bottom: 12px; padding: 10px 12px; border: 1px solid rgb(186 230 253); border-radius: 8px; background: rgb(248 250 252); color: rgb(3 105 161); font-weight: 700; }
    .agenda-teams-fallback-table { width: 100%; border-collapse: collapse; background: white; border: 1px solid rgb(226 232 240); }
    .agenda-teams-fallback-table th { background: rgb(71 85 105); color: white; text-align: left; font-size: 12px; padding: 10px; }
    .agenda-teams-fallback-table td { border-top: 1px solid rgb(226 232 240); padding: 10px; font-size: 13px; }
    .agenda-teams-join-link { display: inline-flex; padding: 6px 10px; border-radius: 6px; background: rgb(3 105 161); color: white !important; font-weight: 600; text-decoration: none; }
  `}</style>;
}
