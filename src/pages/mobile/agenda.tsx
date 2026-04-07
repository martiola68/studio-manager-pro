import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { ChevronLeft, ChevronRight, CalendarDays, List } from "lucide-react";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type MobileAgendaView = "week" | "day";

type ClienteBase = {
  id: string;
  ragione_sociale?: string;
  codice_fiscale?: string;
  partita_iva?: string;
};

type UtenteBase = {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  settore: string | null;
};

type AgendaRow = Database["public"]["Tables"]["tbagenda"]["Row"];

type EventoWithRelations = Omit<AgendaRow, "cliente_id" | "utente_id"> & {
  cliente_id: string | null;
  utente_id: string | null;
  gruppo_evento?: string | null;
  external_id?: string | null;
  provider?: string | null;
  microsoft_event_id?: string | null;
  outlook_synced?: boolean | null;
  studio_id?: string | null;
  riunione_teams?: boolean | null;
  link_teams?: string | null;
  evento_generico?: boolean | null;
  ora_inizio?: string | null;
  ora_fine?: string | null;
  ricorrente?: boolean | null;
  frequenza_giorni?: number | null;
  durata_giorni?: number | null;
  partecipanti?: unknown;
  email_partecipanti_esterni?: unknown;

  cliente: ClienteBase | null;
  utente: UtenteBase | null;
};

type EventoGroup = {
  id: string;
  gruppo_evento: string;
  titolo: string;
  descrizione: string | null;
  data_inizio: string;
  data_fine: string;
  tutto_giorno: boolean;
  cliente_id: string | null;
  cliente: ClienteBase | null;
  utente_id: string | null;
  utente: UtenteBase | null;
  in_sede: boolean;
  sala: string | null;
  luogo: string | null;
  partecipanti: string[];
  email_partecipanti_esterni: string[];
  riunione_teams: boolean;
  link_teams: string | null;
  evento_generico: boolean;
  ora_inizio: string | null;
  ora_fine: string | null;
  ricorrente: boolean;
  frequenza_giorni: number | null;
  durata_giorni: number | null;
  microsoft_event_id: string | null;
  outlook_synced: boolean | null;
  external_id: string | null;
  provider: string | null;
  rows: EventoWithRelations[];
  participantUsers: UtenteBase[];
};

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "2-digit",
  });
}

function formatFullDate(date: Date) {
  return date.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function safeParseISO(value: string | null | undefined): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function normalizeTime(time: string | null | undefined) {
  if (!time) return "";
  return String(time).length >= 5 ? String(time).substring(0, 5) : String(time);
}

function formatTimeRange(evento: EventoGroup) {
  if (evento.tutto_giorno) return "Tutto il giorno";

  const start =
    evento.ora_inizio?.substring(0, 5) ||
    safeParseISO(evento.data_inizio).toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const end =
    evento.ora_fine?.substring(0, 5) ||
    safeParseISO(evento.data_fine).toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });

  return `${start} - ${end}`;
}

function toArrayOfStrings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function uniqueStrings(items: Array<string | null | undefined>) {
  return [
    ...new Set(
      items
        .filter((v): v is string => Boolean(v && String(v).trim()))
        .map((v) => String(v).trim())
    ),
  ];
}

function sortUsersByName(users: UtenteBase[]) {
  return [...users].sort((a, b) => {
    const aLabel = `${a.cognome} ${a.nome}`.toLowerCase();
    const bLabel = `${b.cognome} ${b.nome}`.toLowerCase();
    return aLabel.localeCompare(bLabel, "it");
  });
}

function groupKeyFromRow(row: EventoWithRelations) {
  return String(row.gruppo_evento || row.id);
}

function normalizeSettore(settore?: string | null) {
  const value = String(settore || "").trim().toLowerCase();
  if (value === "fiscale") return "Fiscale";
  if (value === "lavoro") return "Lavoro";
  if (value === "consulenza") return "Consulenza";
  return null;
}

function getSettoreBadgeClass(settore?: string | null) {
  const normalized = normalizeSettore(settore);

  if (normalized === "Fiscale") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (normalized === "Lavoro") {
    return "bg-red-50 text-red-700 border-red-200";
  }

  if (normalized === "Consulenza") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  return "bg-gray-50 text-gray-700 border-gray-200";
}

function getProviderBadgeClass(provider?: string | null, isTeams?: boolean) {
  if (isTeams || String(provider || "").toLowerCase().includes("teams")) {
    return "bg-violet-50 text-violet-700 border-violet-200";
  }

  return "bg-gray-50 text-gray-700 border-gray-200";
}

function aggregateEventGroups(rows: EventoWithRelations[]): EventoGroup[] {
  const grouped = new Map<string, EventoWithRelations[]>();

  for (const row of rows) {
    const key = groupKeyFromRow(row);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  const result: EventoGroup[] = [];

  for (const [groupKey, groupRows] of grouped.entries()) {
    const sortedRows = [...groupRows].sort((a, b) => {
      const aUser = `${a.utente?.cognome ?? ""} ${a.utente?.nome ?? ""}`;
      const bUser = `${b.utente?.cognome ?? ""} ${b.utente?.nome ?? ""}`;
      return aUser.localeCompare(bUser, "it");
    });

    const master =
      sortedRows.find(
        (r) =>
          r.utente_id &&
          toArrayOfStrings(r.partecipanti).includes(String(r.utente_id))
      ) || sortedRows[0];

    const participantUsers = sortUsersByName(
      sortedRows
        .map((r) => r.utente)
        .filter((u): u is UtenteBase => Boolean(u?.id))
        .filter((u, idx, arr) => arr.findIndex((x) => x.id === u.id) === idx)
    );

    const participantIds = uniqueStrings(participantUsers.map((u) => u.id));
    const externalEmails = uniqueStrings(
      sortedRows.flatMap((r) => toArrayOfStrings(r.email_partecipanti_esterni))
    );

    result.push({
      id: String(master.id),
      gruppo_evento: String(master.gruppo_evento || groupKey),
      titolo: master.titolo || "",
      descrizione: (master.descrizione as string | null) || null,
      data_inizio: String(master.data_inizio),
      data_fine: String(master.data_fine),
      tutto_giorno: Boolean(master.tutto_giorno),
      cliente_id: master.cliente_id || null,
      cliente: master.cliente || null,
      utente_id: master.utente_id || null,
      utente: master.utente || null,
      in_sede: Boolean(master.in_sede),
      sala: master.sala ? String(master.sala) : null,
      luogo: master.luogo ? String(master.luogo) : null,
      partecipanti: participantIds,
      email_partecipanti_esterni: externalEmails,
      riunione_teams: Boolean(master.riunione_teams),
      link_teams: master.link_teams ? String(master.link_teams) : null,
      evento_generico: Boolean(master.evento_generico),
      ora_inizio: master.ora_inizio ? normalizeTime(master.ora_inizio) : null,
      ora_fine: master.ora_fine ? normalizeTime(master.ora_fine) : null,
      ricorrente: Boolean(master.ricorrente),
      frequenza_giorni: master.frequenza_giorni ? Number(master.frequenza_giorni) : null,
      durata_giorni: master.durata_giorni ? Number(master.durata_giorni) : null,
      microsoft_event_id: master.microsoft_event_id ? String(master.microsoft_event_id) : null,
      outlook_synced: master.outlook_synced ?? null,
      external_id: master.external_id ? String(master.external_id) : null,
      provider: master.provider ? String(master.provider) : null,
      rows: sortedRows,
      participantUsers,
    });
  }

  return result.sort(
    (a, b) => safeParseISO(a.data_inizio).getTime() - safeParseISO(b.data_inizio).getTime()
  );
}

export default function MobileAgendaPage() {
  const router = useRouter();

  const [view, setView] = useState<MobileAgendaView>("week");
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [loading, setLoading] = useState(true);
  const [eventiRows, setEventiRows] = useState<EventoWithRelations[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, index) => addDays(weekStart, index));
  }, [weekStart]);

  useEffect(() => {
    let isMounted = true;

    const loadEventi = async () => {
      try {
        setLoading(true);

        const supabase = getSupabaseClient() as any;

        const {
          data: { session },
        } = await supabase.auth.getSession();

        let loggedUserId: string | null = null;

        if (session?.user?.email) {
          const { data: userData, error: userErr } = await supabase
            .from("tbutenti")
            .select("id")
            .eq("email", session.user.email)
            .single();

          if (!userErr && userData?.id) {
            loggedUserId = String(userData.id);
          }
        }

        const { data: eventiData, error: eventiError } = await supabase
          .from("tbagenda")
          .select(`
            *,
            cliente:cliente_id(id, ragione_sociale, codice_fiscale, partita_iva),
            utente:utente_id(id, nome, cognome, email, settore)
          `)
          .order("data_inizio", { ascending: true });

        if (eventiError) throw eventiError;
        if (!isMounted) return;

        setCurrentUserId(loggedUserId);
        setEventiRows(((eventiData ?? []) as unknown) as EventoWithRelations[]);
      } catch (error) {
        console.error("Errore caricamento agenda mobile:", error);
        if (!isMounted) return;
        setEventiRows([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadEventi();

    return () => {
      isMounted = false;
    };
  }, []);

  const groupedEvents = useMemo(() => aggregateEventGroups(eventiRows), [eventiRows]);

  const filteredEvents = useMemo(() => {
    if (!currentUserId) return groupedEvents;

    return groupedEvents.filter((evento) =>
      evento.rows.some((row) => String(row.utente_id || "") === String(currentUserId))
    );
  }, [groupedEvents, currentUserId]);

  const eventiOrdinati = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      return safeParseISO(a.data_inizio).getTime() - safeParseISO(b.data_inizio).getTime();
    });
  }, [filteredEvents]);

  const eventiGiorno = useMemo(() => {
    return eventiOrdinati.filter((evento) =>
      isSameDay(safeParseISO(evento.data_inizio), selectedDate)
    );
  }, [eventiOrdinati, selectedDate]);

  const eventiSettimana = useMemo(() => {
    return weekDays.map((day) => ({
      day,
      eventi: eventiOrdinati.filter((evento) =>
        isSameDay(safeParseISO(evento.data_inizio), day)
      ),
    }));
  }, [eventiOrdinati, weekDays]);

  const handlePrev = () => {
    if (view === "day") {
      setSelectedDate((prev) => addDays(prev, -1));
      return;
    }

    setSelectedDate((prev) => addDays(prev, -7));
  };

  const handleNext = () => {
    if (view === "day") {
      setSelectedDate((prev) => addDays(prev, 1));
      return;
    }

    setSelectedDate((prev) => addDays(prev, 7));
  };

  const headerTitle =
    view === "day"
      ? formatFullDate(selectedDate)
      : `${weekDays[0].toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "short",
        })} - ${weekDays[6].toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}`;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-md">
        <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between px-4 pb-3 pt-4">
            <div>
              <h1 className="text-xl font-bold">Agenda mobile</h1>
              <p className="mt-1 text-sm text-gray-600 capitalize">{headerTitle}</p>
            </div>

            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-full border border-gray-200 px-3 py-2 text-sm text-gray-700"
            >
              Chiudi
            </button>
          </div>

          <div className="flex items-center gap-2 px-4 pb-3">
            <button
              type="button"
              onClick={handlePrev}
              className="rounded-xl border border-gray-200 bg-white p-2"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              type="button"
              onClick={() => setSelectedDate(startOfDay(new Date()))}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium"
            >
              Oggi
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="rounded-xl border border-gray-200 bg-white p-2"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 rounded-2xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setView("week")}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
                  view === "week" ? "bg-white shadow-sm" : "text-gray-600"
                }`}
              >
                <CalendarDays size={16} />
                Settimana
              </button>

              <button
                type="button"
                onClick={() => setView("day")}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
                  view === "day" ? "bg-white shadow-sm" : "text-gray-600"
                }`}
              >
                <List size={16} />
                Giorno
              </button>
            </div>
          </div>

          {view === "week" && (
            <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4 pb-4">
              {weekDays.map((day) => {
                const active = isSameDay(day, selectedDate);
                const today = isSameDay(day, new Date());

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    className={`min-w-[72px] rounded-2xl border px-3 py-3 text-center ${
                      active
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-200 bg-white text-gray-800"
                    }`}
                  >
                    <div className="text-xs uppercase">
                      {day.toLocaleDateString("it-IT", { weekday: "short" })}
                    </div>
                    <div className="mt-1 text-lg font-bold">
                      {day.toLocaleDateString("it-IT", { day: "2-digit" })}
                    </div>
                    <div className="mt-1 text-[11px]">{today ? "Oggi" : "\u00A0"}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4">
          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
              Caricamento agenda...
            </div>
          ) : view === "day" ? (
            <div className="space-y-3">
              <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
                {formatFullDate(selectedDate)}
              </div>

              {eventiGiorno.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
                  Nessun evento per questa giornata
                </div>
              ) : (
                eventiGiorno.map((evento) => (
                  <div
                    key={evento.gruppo_evento}
                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold">{evento.titolo || "(senza titolo)"}</h3>
                        <p className="mt-1 text-sm text-gray-600">{formatTimeRange(evento)}</p>

                        <p className="mt-2 text-sm text-gray-700">
                          <span className="font-medium">Organizzatore:</span>{" "}
                          {evento.utente ? `${evento.utente.cognome} ${evento.utente.nome}` : "Non assegnato"}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {evento.utente?.settore && (
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getSettoreBadgeClass(
                              evento.utente.settore
                            )}`}
                          >
                            {normalizeSettore(evento.utente.settore) || evento.utente.settore}
                          </span>
                        )}

                        {(evento.provider || evento.riunione_teams) && (
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getProviderBadgeClass(
                              evento.provider,
                              evento.riunione_teams
                            )}`}
                          >
                            {evento.riunione_teams ? "Teams" : evento.provider}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2 text-sm text-gray-700">
                      <p>
                        <span className="font-medium">Cliente:</span>{" "}
                        {evento.cliente?.ragione_sociale || "Evento senza cliente"}
                      </p>

                      <p>
                        <span className="font-medium">Luogo:</span>{" "}
                        {evento.in_sede
                          ? `In sede${evento.sala ? ` • ${evento.sala}` : ""}`
                          : evento.luogo || "Fuori sede"}
                      </p>

                      <p>
                        <span className="font-medium">Partecipanti:</span>{" "}
                        {evento.participantUsers.length > 0
                          ? evento.participantUsers.map((u) => `${u.cognome} ${u.nome}`).join(", ")
                          : "Nessuno"}
                      </p>

                      {evento.email_partecipanti_esterni.length > 0 && (
                        <p>
                          <span className="font-medium">Esterni:</span>{" "}
                          {evento.email_partecipanti_esterni.join(", ")}
                        </p>
                      )}

                      {evento.descrizione && (
                        <p className="text-gray-600">{evento.descrizione}</p>
                      )}

                      {evento.riunione_teams && evento.link_teams && (
                        <a
                          href={evento.link_teams}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-sm font-medium text-violet-700 underline"
                        >
                          Apri riunione Teams
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {eventiSettimana.map(({ day, eventi }) => (
                <div
                  key={day.toISOString()}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold capitalize text-gray-900">
                        {formatDayLabel(day)}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {day.toLocaleDateString("it-IT", {
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(day);
                        setView("day");
                      }}
                      className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700"
                    >
                      Apri giorno
                    </button>
                  </div>

                  {eventi.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                      Nessun evento
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {eventi.map((evento) => (
                        <div
                          key={evento.gruppo_evento}
                          className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900">
                                {evento.titolo || "(senza titolo)"}
                              </p>

                              <p className="mt-1 text-xs text-gray-600">
                                {formatTimeRange(evento)}
                              </p>

                              <p className="mt-1 truncate text-xs text-gray-500">
                                {evento.cliente?.ragione_sociale || "Evento senza cliente"}
                              </p>

                              <p className="mt-1 truncate text-xs text-gray-500">
                                {evento.in_sede
                                  ? `In sede${evento.sala ? ` • ${evento.sala}` : ""}`
                                  : evento.luogo || "Fuori sede"}
                              </p>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              {evento.utente?.settore && (
                                <span
                                  className={`rounded-full border px-2 py-1 text-[10px] font-medium ${getSettoreBadgeClass(
                                    evento.utente.settore
                                  )}`}
                                >
                                  {normalizeSettore(evento.utente.settore) || evento.utente.settore}
                                </span>
                              )}

                              {(evento.provider || evento.riunione_teams) && (
                                <span
                                  className={`rounded-full border px-2 py-1 text-[10px] font-medium ${getProviderBadgeClass(
                                    evento.provider,
                                    evento.riunione_teams
                                  )}`}
                                >
                                  {evento.riunione_teams ? "Teams" : evento.provider}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
