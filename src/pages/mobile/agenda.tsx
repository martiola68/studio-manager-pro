import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { ChevronLeft, ChevronRight, CalendarDays, List } from "lucide-react";

type MobileAgendaView = "week" | "day";

type MobileAgendaEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string | null;
  description?: string | null;
  settore?: string | null;
  provider?: string | null;
  isTeams?: boolean;
  gruppo_evento?: string | null;
};

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
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
  const diff = day === 0 ? -6 : 1 - day; // lunedì
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

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSettoreBadgeClass(settore?: string | null) {
  const s = (settore || "").toLowerCase();

  if (s.includes("fisc")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (s.includes("lavor")) {
    return "bg-red-50 text-red-700 border-red-200";
  }

  if (s.includes("consul")) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  return "bg-gray-50 text-gray-700 border-gray-200";
}

function getProviderBadgeClass(provider?: string | null, isTeams?: boolean) {
  if (isTeams || (provider || "").toLowerCase().includes("teams")) {
    return "bg-violet-50 text-violet-700 border-violet-200";
  }

  return "bg-gray-50 text-gray-700 border-gray-200";
}

function buildMockEvents(baseDate: Date): MobileAgendaEvent[] {
  const day1 = startOfDay(baseDate);
  const day2 = addDays(day1, 1);
  const day3 = addDays(day1, 2);

  return [
    {
      id: "1",
      title: "Verifica pratica cliente Rossi",
      start: new Date(day1.getFullYear(), day1.getMonth(), day1.getDate(), 9, 0).toISOString(),
      end: new Date(day1.getFullYear(), day1.getMonth(), day1.getDate(), 10, 0).toISOString(),
      location: "Studio",
      settore: "Fiscale",
      provider: "Interno",
      gruppo_evento: "grp-1",
    },
    {
      id: "2",
      title: "Call Teams con cliente Bianchi",
      start: new Date(day1.getFullYear(), day1.getMonth(), day1.getDate(), 11, 30).toISOString(),
      end: new Date(day1.getFullYear(), day1.getMonth(), day1.getDate(), 12, 15).toISOString(),
      location: "Microsoft Teams",
      settore: "Consulenza",
      provider: "Teams",
      isTeams: true,
      gruppo_evento: "grp-2",
    },
    {
      id: "3",
      title: "Scadenze cedolini",
      start: new Date(day2.getFullYear(), day2.getMonth(), day2.getDate(), 14, 0).toISOString(),
      end: new Date(day2.getFullYear(), day2.getMonth(), day2.getDate(), 15, 0).toISOString(),
      location: "Ufficio Lavoro",
      settore: "Lavoro",
      provider: "Interno",
      gruppo_evento: "grp-3",
    },
    {
      id: "4",
      title: "Firma documenti AV4",
      start: new Date(day3.getFullYear(), day3.getMonth(), day3.getDate(), 16, 30).toISOString(),
      end: new Date(day3.getFullYear(), day3.getMonth(), day3.getDate(), 17, 0).toISOString(),
      location: "Studio",
      settore: "Consulenza",
      provider: "Interno",
      gruppo_evento: "grp-4",
    },
  ];
}

export default function MobileAgendaPage() {
  const router = useRouter();

  const [view, setView] = useState<MobileAgendaView>("week");
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [loading, setLoading] = useState(true);
  const [eventi, setEventi] = useState<MobileAgendaEvent[]>([]);

  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, index) => addDays(weekStart, index));
  }, [weekStart]);

  useEffect(() => {
    let isMounted = true;

    const loadEventi = async () => {
      try {
        setLoading(true);

        // TODO: qui va collegata la query reale del tuo progetto agenda.
        // Per ora la pagina resta pronta e funzionante con dati demo.
        const data = buildMockEvents(selectedDate);

        if (!isMounted) return;

        setEventi(data);
      } catch (error) {
        console.error("Errore caricamento agenda mobile:", error);
        if (!isMounted) return;
        setEventi([]);
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
  }, [selectedDate]);

  const eventiOrdinati = useMemo(() => {
    return [...eventi].sort((a, b) => {
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });
  }, [eventi]);

  const eventiGiorno = useMemo(() => {
    return eventiOrdinati.filter((evento) =>
      isSameDay(new Date(evento.start), selectedDate)
    );
  }, [eventiOrdinati, selectedDate]);

  const eventiSettimana = useMemo(() => {
    return weekDays.map((day) => ({
      day,
      eventi: eventiOrdinati.filter((evento) =>
        isSameDay(new Date(evento.start), day)
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
                    <div className="mt-1 text-[11px]">
                      {today ? "Oggi" : "\u00A0"}
                    </div>
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
                    key={evento.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold">{evento.title}</h3>
                        <p className="mt-1 text-sm text-gray-600">
                          {formatTime(evento.start)} - {formatTime(evento.end)}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {evento.settore && (
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getSettoreBadgeClass(
                              evento.settore
                            )}`}
                          >
                            {evento.settore}
                          </span>
                        )}

                        {(evento.provider || evento.isTeams) && (
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getProviderBadgeClass(
                              evento.provider,
                              evento.isTeams
                            )}`}
                          >
                            {evento.isTeams ? "Teams" : evento.provider}
                          </span>
                        )}
                      </div>
                    </div>

                    {evento.location && (
                      <p className="mt-3 text-sm text-gray-700">
                        <span className="font-medium">Luogo:</span> {evento.location}
                      </p>
                    )}

                    {evento.description && (
                      <p className="mt-2 text-sm text-gray-600">{evento.description}</p>
                    )}
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
                          key={evento.id}
                          className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900">
                                {evento.title}
                              </p>
                              <p className="mt-1 text-xs text-gray-600">
                                {formatTime(evento.start)} - {formatTime(evento.end)}
                              </p>
                              {evento.location && (
                                <p className="mt-1 truncate text-xs text-gray-500">
                                  {evento.location}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              {evento.settore && (
                                <span
                                  className={`rounded-full border px-2 py-1 text-[10px] font-medium ${getSettoreBadgeClass(
                                    evento.settore
                                  )}`}
                                >
                                  {evento.settore}
                                </span>
                              )}

                              {(evento.provider || evento.isTeams) && (
                                <span
                                  className={`rounded-full border px-2 py-1 text-[10px] font-medium ${getProviderBadgeClass(
                                    evento.provider,
                                    evento.isTeams
                                  )}`}
                                >
                                  {evento.isTeams ? "Teams" : evento.provider}
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
