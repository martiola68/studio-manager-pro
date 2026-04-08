import { useEffect, useMemo, useState } from "react";
import type React from "react";
import type { CheckedState } from "@radix-ui/react-checkbox";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Users,
  X,
  Building2,
  Video,
  Trash2,
  Pencil,
  CheckCircle2,
  Search,
  Mail,
  Link2,
} from "lucide-react";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { calendarSyncService } from "@/services/calendarSyncService";

// ----------------------------------------------------
// TIPI
// ----------------------------------------------------

type ClienteAgenda = {
  id: string;
  ragione_sociale: string;
  attivo: boolean | null;
};

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

type UtenteAgenda = {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  tipo_utente: string;
  ruolo_operatore_id: string | null;
  settore: string | null;
  attivo: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  studio_id?: string | null;
};

type ContactEmailOption = {
  id: string;
  nome: string;
  cognome: string;
  email: string;
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
  microsoft_connection_id?: string | null;

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
  studio_id: string | null;
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

type FormDataState = {
  titolo: string;
  descrizione: string;
  data_inizio: string;
  ora_inizio: string;
  data_fine: string;
  ora_fine: string;
  tutto_giorno: boolean;
  cliente_id: string;
  utente_id: string;
  in_sede: boolean;
  sala: string;
  luogo: string;
  evento_generico: boolean;
  riunione_teams: boolean;
  link_teams: string;
  partecipanti: string[];
  email_partecipanti_esterni: string[];
};

// ----------------------------------------------------
// HELPERS
// ----------------------------------------------------

const safeParseISO = (value: string | null | undefined): Date => {
  if (!value) return new Date();
  try {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  } catch {
    return new Date();
  }
};

const toBool = (c: CheckedState) => c === true;

const normalizeTime = (time: string) => {
  if (!time) return "00:00";
  return time.length >= 5 ? time.substring(0, 5) : time;
};

const addOneHourToTime = (time: string) => {
  const normalized = normalizeTime(time || "09:00");
  const [hours, minutes] = normalized.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return "10:00";

  const totalMinutes = hours * 60 + minutes + 60;
  const nextHours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const nextMinutes = totalMinutes % 60;

  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
};

const toArrayOfStrings = (value: unknown): string[] => {
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
};

const uniqueStrings = (items: Array<string | null | undefined>) =>
  [
    ...new Set(
      items
        .filter((v): v is string => Boolean(v && String(v).trim()))
        .map((v) => String(v).trim())
    ),
  ];

const sortUsersByName = (users: UtenteBase[]) => {
  return [...users].sort((a, b) => {
    const aLabel = `${a.cognome} ${a.nome}`.toLowerCase();
    const bLabel = `${b.cognome} ${b.nome}`.toLowerCase();
    return aLabel.localeCompare(bLabel, "it");
  });
};

const groupKeyFromRow = (row: EventoWithRelations) => String(row.gruppo_evento || row.id);

const normalizeSettore = (settore?: string | null) => {
  const value = String(settore || "").trim().toLowerCase();
  if (value === "fiscale") return "Fiscale";
  if (value === "lavoro") return "Lavoro";
  if (value === "consulenza") return "Consulenza";
  return null;
};

const getSettoreBadgeClass = (settore?: string | null) => {
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

  return "bg-slate-100 text-slate-700 border-slate-200";
};

const getProviderBadgeClass = (provider?: string | null, isTeams?: boolean) => {
  if (isTeams || String(provider || "").toLowerCase().includes("teams")) {
    return "bg-violet-50 text-violet-700 border-violet-200";
  }

  return "bg-slate-100 text-slate-700 border-slate-200";
};

const getSettoreEventColor = (settore?: string | null, isTeams?: boolean) => {
  const normalized = normalizeSettore(settore);

  const base =
    normalized === "Fiscale"
      ? {
  left: "border-l-emerald-500",
  dot: "bg-emerald-500",
},
      : normalized === "Lavoro"
      ? {
          left: "border-l-red-500",
          chip: "bg-red-50 text-red-800 border-red-200",
          soft: "bg-red-500",
        }
      : normalized === "Consulenza"
      ? {
          left: "border-l-blue-500",
          chip: "bg-blue-50 text-blue-800 border-blue-200",
          soft: "bg-blue-500",
        }
      : {
          left: "border-l-slate-400",
          chip: "bg-slate-50 text-slate-800 border-slate-200",
          soft: "bg-slate-400",
        };

  if (isTeams) {
    return {
      left: "border-l-violet-500",
      chip: "bg-violet-50 text-violet-800 border-violet-200",
      soft: "bg-violet-500",
    };
  }

  return base;
};

const aggregateEventGroups = (rows: EventoWithRelations[]): EventoGroup[] => {
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
        (r) => r.utente_id && toArrayOfStrings(r.partecipanti).includes(String(r.utente_id))
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
      studio_id: master.studio_id ? String(master.studio_id) : null,
      ora_inizio: master.ora_inizio ? normalizeTime(String(master.ora_inizio)) : null,
      ora_fine: master.ora_fine ? normalizeTime(String(master.ora_fine)) : null,
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
};

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const startOfWeek = (date: Date) => {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatDayLabel = (date: Date) =>
  date.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "2-digit",
  });

const formatFullDate = (date: Date) =>
  date.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const formatTimeRange = (evento: EventoGroup) => {
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
};

const getParticipantLabel = (evento: EventoGroup) => {
  if (evento.participantUsers.length === 0) return "Nessun partecipante";
  if (evento.participantUsers.length === 1) {
    const u = evento.participantUsers[0];
    return `${u.cognome} ${u.nome}`;
  }
  return `${evento.participantUsers.length} partecipanti`;
};

const USER_EVENT_COLORS = [
  {
    left: "border-l-emerald-500",
    dot: "bg-emerald-500",
    badge: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  {
    left: "border-l-blue-500",
    dot: "bg-blue-500",
    badge: "border-blue-300 bg-blue-50 text-blue-800",
  },
  {
    left: "border-l-violet-500",
    dot: "bg-violet-500",
    badge: "border-violet-300 bg-violet-50 text-violet-800",
  },
  {
    left: "border-l-amber-500",
    dot: "bg-amber-500",
    badge: "border-amber-300 bg-amber-50 text-amber-800",
  },
  {
    left: "border-l-rose-500",
    dot: "bg-rose-500",
    badge: "border-rose-300 bg-rose-50 text-rose-800",
  },
  {
    left: "border-l-cyan-500",
    dot: "bg-cyan-500",
    badge: "border-cyan-300 bg-cyan-50 text-cyan-800",
  },
  {
    left: "border-l-fuchsia-500",
    dot: "bg-fuchsia-500",
    badge: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800",
  },
  {
    left: "border-l-lime-500",
    dot: "bg-lime-500",
    badge: "border-lime-300 bg-lime-50 text-lime-800",
  },
];

const getUserEventColor = (userId?: string | null) => {
  if (!userId) {
   return {
  left: "border-l-slate-400",
  dot: "bg-slate-400",
};
  }

  const chars = String(userId).split("");
  const hash = chars.reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return USER_EVENT_COLORS[hash % USER_EVENT_COLORS.length];
};

const getSelectedAgendaUsersLabel = (users: UtenteAgenda[]) => {
  if (users.length === 0) return "Tutti i nominativi";
  return users.map((u) => `${u.cognome} ${u.nome}`).join(", ");
};

const toNotificationPayload = (e: Record<string, unknown>) => ({
  ...e,
  eventoInSede: Boolean((e as any)?.in_sede),
  eventoLuogo: (e as any)?.sala ?? "",
  durata_giorni: (e as any)?.durata_giorni ?? null,
  evento_generico: (e as any)?.evento_generico ?? null,
  frequenza_giorni: (e as any)?.frequenza_giorni ?? null,
  link_teams: (e as any)?.link_teams ?? null,
  email_partecipanti_esterni: (e as any)?.email_partecipanti_esterni ?? null,
  outlook_event_id: (e as any)?.outlook_event_id ?? null,
});

// ----------------------------------------------------
// COMPONENT
// ----------------------------------------------------

export default function MobileAgendaPage() {
  const { toast } = useToast();

  const [view, setView] = useState<"week" | "day">("day");
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [loading, setLoading] = useState(true);

  const [eventiRows, setEventiRows] = useState<EventoWithRelations[]>([]);
  const [clienti, setClienti] = useState<ClienteAgenda[]>([]);
  const [utenti, setUtenti] = useState<UtenteAgenda[]>([]);
  const [contactOptions, setContactOptions] = useState<ContactEmailOption[]>([]);
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentStudioId, setCurrentStudioId] = useState<string | null>(null);
  const [selectedAgendaUserIds, setSelectedAgendaUserIds] = useState<string[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [editingEventoId, setEditingEventoId] = useState<string | null>(null);
  const [editingGruppoEvento, setEditingGruppoEvento] = useState<string | null>(null);
  const [eventoToDelete, setEventoToDelete] = useState<string | null>(null);
  const [savingEvento, setSavingEvento] = useState(false);

  const [searchPartecipanti, setSearchPartecipanti] = useState("");
  const [searchContatti, setSearchContatti] = useState("");
  const [selectedEvento, setSelectedEvento] = useState<EventoGroup | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [formData, setFormData] = useState<FormDataState>({
    titolo: "",
    descrizione: "",
    data_inizio: "",
    ora_inizio: "09:00",
    data_fine: "",
    ora_fine: "10:00",
    tutto_giorno: false,
    cliente_id: "",
    utente_id: "",
    in_sede: false,
    sala: "",
    luogo: "",
    evento_generico: false,
    riunione_teams: false,
    link_teams: "",
    partecipanti: [],
    email_partecipanti_esterni: [],
  });

  // ----------------------------------------------------
  // LOAD
  // ----------------------------------------------------

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

 const loadData = async () => {
    const supabase = getSupabaseClient() as any;

    try {
      setLoading(true);

      let resolvedUserId: string | null = null;
      let resolvedStudioId: string | null = null;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.email) {
        const { data: userData, error: userErr } = await supabase
          .from("tbutenti")
          .select("id, studio_id")
          .eq("email", session.user.email)
          .single();

        if (!userErr && userData?.id) {
          resolvedUserId = String(userData.id);
          resolvedStudioId = userData?.studio_id ? String(userData.studio_id) : null;

          setCurrentUserId(resolvedUserId);
          setCurrentStudioId(resolvedStudioId);
          setSelectedAgendaUserIds((prev) =>
  prev.length > 0 ? prev : resolvedUserId ? [resolvedUserId] : []
);
        }
      }

      let eventiQuery = supabase
        .from("tbagenda")
        .select(`
          *,
          cliente:cliente_id(id, ragione_sociale, codice_fiscale, partita_iva),
          utente:utente_id(id, nome, cognome, email, settore)
        `)
        .order("data_inizio", { ascending: true });

      if (resolvedStudioId) {
        eventiQuery = eventiQuery.eq("studio_id", resolvedStudioId);
      }

      const { data: eventiData, error: eventiError } = await eventiQuery;

      if (eventiError) throw eventiError;
      setEventiRows(((eventiData ?? []) as unknown) as EventoWithRelations[]);

      let clientiQuery = supabase
        .from("tbclienti")
        .select("id, ragione_sociale, attivo")
        .eq("attivo", true)
        .order("ragione_sociale");

      if (resolvedStudioId) {
        clientiQuery = clientiQuery.eq("studio_id", resolvedStudioId);
      }

      const { data: clientiData, error: clientiError } = await clientiQuery;

      if (clientiError) throw clientiError;
      setClienti(((clientiData ?? []) as unknown) as ClienteAgenda[]);

      let utentiQuery = supabase
        .from("tbutenti")
        .select(`
          id,
          nome,
          cognome,
          email,
          settore,
          tipo_utente,
          ruolo_operatore_id,
          attivo,
          created_at,
          updated_at,
          studio_id
        `)
        .eq("attivo", true)
        .order("cognome", { ascending: true });

      if (resolvedStudioId) {
        utentiQuery = utentiQuery.eq("studio_id", resolvedStudioId);
      }

      const { data: utentiData, error: utentiError } = await utentiQuery;

      if (utentiError) throw utentiError;
      setUtenti(((utentiData ?? []) as unknown) as UtenteAgenda[]);

      let contattiQuery = (supabase as any)
        .from("tbcontatti")
        .select("*")
        .order("cognome", { ascending: true });

      if (resolvedStudioId) {
        contattiQuery = contattiQuery.eq("studio_id", resolvedStudioId);
      }

      const { data: contattiData, error: contattiError } = await contattiQuery;

      if (!contattiError) {
        const mapped: ContactEmailOption[] = (contattiData ?? [])
          .filter((c: any) => Boolean(c?.email))
          .map((c: any) => ({
            id: String(c.id),
            nome: String(c.nome ?? c.first_name ?? ""),
            cognome: String(c.cognome ?? c.last_name ?? ""),
            email: String(c.email ?? "").trim(),
          }))
          .filter((c: ContactEmailOption) => Boolean(c.email));

        setContactOptions(mapped);
      } else {
        setContactOptions([]);
      }
   } catch (error) {
      console.error("Errore caricamento agenda mobile:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati agenda",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // ----------------------------------------------------
  // MEMO
  // ----------------------------------------------------

  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, index) => addDays(weekStart, index));
  }, [weekStart]);

  const groupedEvents = useMemo(() => aggregateEventGroups(eventiRows), [eventiRows]);

 const mobileEvents = useMemo(() => {
  const effectiveUserIds =
    selectedAgendaUserIds.length > 0
      ? selectedAgendaUserIds
      : currentUserId
      ? [currentUserId]
      : [];

  if (effectiveUserIds.length === 0) return groupedEvents;

  return groupedEvents.filter((evento) => {
    const ownerId = String(evento.utente_id || "");
    const participantIds = evento.partecipanti.map((id) => String(id));

    return effectiveUserIds.some(
      (userId) =>
        ownerId === String(userId) || participantIds.includes(String(userId))
    );
  });
}, [groupedEvents, currentUserId, selectedAgendaUserIds]);
  const eventiGiorno = useMemo(() => {
    return mobileEvents.filter((evento) =>
      isSameDay(safeParseISO(evento.data_inizio), selectedDate)
    );
  }, [mobileEvents, selectedDate]);

  const eventiSettimana = useMemo(() => {
    return weekDays.map((day) => ({
      day,
      eventi: mobileEvents.filter((evento) => isSameDay(safeParseISO(evento.data_inizio), day)),
    }));
  }, [mobileEvents, weekDays]);

  const filteredContactOptions = useMemo(() => {
    const search = searchContatti.trim().toLowerCase();
    if (!search) return contactOptions;

    return contactOptions.filter((c) => {
      const fullName = `${c.cognome} ${c.nome}`.toLowerCase();
      return fullName.includes(search) || c.email.toLowerCase().includes(search);
    });
  }, [contactOptions, searchContatti]);

  // ----------------------------------------------------
  // FORM
  // ----------------------------------------------------

  const resetForm = () => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;

    setEditingEventoId(null);
    setEditingGruppoEvento(null);
    setSearchPartecipanti("");
    setSearchContatti("");

    setFormData({
      titolo: "",
      descrizione: "",
      data_inizio: dateStr,
      ora_inizio: "09:00",
      data_fine: dateStr,
      ora_fine: "10:00",
      tutto_giorno: false,
      cliente_id: "",
      utente_id: currentUserId || "",
      in_sede: false,
      sala: "",
      luogo: "",
      evento_generico: false,
      riunione_teams: false,
      link_teams: "",
      partecipanti: [],
      email_partecipanti_esterni: [],
    });
  };

  const handleNuovoEvento = (date?: Date) => {
    resetForm();

    if (date) {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`;

      setFormData((prev) => ({
        ...prev,
        data_inizio: dateStr,
        data_fine: dateStr,
        utente_id: currentUserId || prev.utente_id,
      }));
      setSelectedDate(date);
    }

    setDialogOpen(true);
  };

  const handleEditEvento = (evento: EventoGroup) => {
    const startDate = safeParseISO(evento.data_inizio);
    const endDate = safeParseISO(evento.data_fine);

    const formatDateInput = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`;

    setEditingEventoId(String(evento.id));
    setEditingGruppoEvento(String(evento.gruppo_evento));
    setSearchPartecipanti("");
    setSearchContatti("");

    setFormData({
      titolo: evento.titolo ?? "",
      descrizione: evento.descrizione || "",
      data_inizio: formatDateInput(startDate),
      ora_inizio: evento.ora_inizio ? normalizeTime(String(evento.ora_inizio)) : "09:00",
      data_fine: formatDateInput(endDate),
      ora_fine: evento.ora_fine ? normalizeTime(String(evento.ora_fine)) : "10:00",
      tutto_giorno: Boolean(evento.tutto_giorno),
      cliente_id: evento.cliente_id || "",
      utente_id: evento.utente_id || currentUserId || "",
      in_sede: Boolean(evento.in_sede),
      sala: evento.in_sede ? evento.sala || "" : "",
      luogo: !evento.in_sede ? evento.luogo || "" : "",
      evento_generico: Boolean(evento.evento_generico),
      riunione_teams: Boolean(evento.riunione_teams),
      link_teams: evento.link_teams || "",
      partecipanti: evento.partecipanti.filter((id) => id !== evento.utente_id),
      email_partecipanti_esterni: evento.email_partecipanti_esterni,
    });

    setDetailOpen(false);
    setDialogOpen(true);
  };

  const handleOpenDetail = (evento: EventoGroup) => {
    setSelectedEvento(evento);
    setDetailOpen(true);
  };

  const handleOraInizioChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      ora_inizio: value,
      ora_fine: addOneHourToTime(value),
    }));
  };

  const handleToggleExternalEmail = (email: string, checked: CheckedState) => {
    const isChecked = toBool(checked);

    setFormData((prev) => ({
      ...prev,
      email_partecipanti_esterni: isChecked
        ? [...new Set([...prev.email_partecipanti_esterni, email])]
        : prev.email_partecipanti_esterni.filter((e) => e !== email),
    }));
  };

  // ----------------------------------------------------
  // SAVE / DELETE HELPERS
  // ----------------------------------------------------

  const getStudioIdForOwner = async (ownerUserId: string) => {
    if (!ownerUserId) return null;

    const localUser = utenti.find((u) => u.id === ownerUserId);
    if (localUser?.studio_id) return String(localUser.studio_id);

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", ownerUserId)
      .maybeSingle();

    if (error || !data?.studio_id) return null;
    return String(data.studio_id);
  };

  const buildBasePayload = (
    utenteId: string,
    gruppoEvento: string,
    dataInizio: string,
    dataFine: string,
    teamsLink: string | null,
    studioId: string | null
  ): Partial<AgendaRow> & Record<string, unknown> => ({
    gruppo_evento: gruppoEvento,
    titolo: formData.titolo,
    descrizione: formData.descrizione || null,
    data_inizio: dataInizio,
    data_fine: dataFine,
    ora_inizio: formData.tutto_giorno ? null : (formData.ora_inizio as any),
    ora_fine: formData.tutto_giorno ? null : (formData.ora_fine as any),
    tutto_giorno: formData.tutto_giorno as any,
    cliente_id: formData.evento_generico ? null : formData.cliente_id || null,
    utente_id: utenteId as any,
    in_sede: formData.in_sede as any,
    sala: formData.in_sede ? formData.sala || null : null,
    luogo: !formData.in_sede ? formData.luogo || null : null,
    evento_generico: formData.evento_generico,
    riunione_teams: formData.riunione_teams,
    link_teams: teamsLink || null,
    partecipanti: [...new Set([formData.utente_id, ...formData.partecipanti].filter(Boolean))],
    email_partecipanti_esterni: [...new Set(formData.email_partecipanti_esterni.filter(Boolean))],
    ricorrente: false,
    frequenza_giorni: null,
    durata_giorni: null,
    studio_id: studioId || currentStudioId || null,
    updated_at: new Date().toISOString(),
  });

  const syncRowsToOutlook = async (
    rows: Array<{
      id: string;
      utente_id: string | null;
    }>
  ) => {
    for (const row of rows) {
      if (!row?.id || !row.utente_id) continue;

      try {
        await calendarSyncService.syncEventToOutlook(String(row.utente_id), String(row.id));
      } catch (syncError) {
        console.error("Errore sincronizzazione Outlook:", syncError);
      }
    }
  };

  const deleteRowsFromOutlook = async (
    rows: Array<{
      id: string;
      utente_id: string | null;
      microsoft_connection_id?: string | null;
      microsoft_event_id?: string | null;
    }>
  ) => {
    const supabase = getSupabaseClient();

    for (const row of rows) {
      if (!row?.microsoft_event_id || !row?.utente_id) continue;

      try {
        let connectionId = row.microsoft_connection_id || null;

        if (!connectionId) {
          const { data: utente, error: utenteError } = await supabase
            .from("tbutenti")
            .select("microsoft_connection_id")
            .eq("id", row.utente_id)
            .maybeSingle();

          if (utenteError) continue;
          connectionId = utente?.microsoft_connection_id || null;
        }

        if (!connectionId) continue;

        if ((calendarSyncService as any).deleteEventFromOutlook) {
          await (calendarSyncService as any).deleteEventFromOutlook(
            String(row.utente_id),
            String(connectionId),
            String(row.microsoft_event_id)
          );
        }
      } catch (error) {
        console.error("Errore cancellazione Outlook:", error);
      }
    }
  };

  const sendTeamsMessagesToParticipants = async (
    ownerUserId: string,
    internalParticipantIds: string[],
    teamsLink: string,
    title: string,
    date: string,
    time: string
  ) => {
    try {
      const studioId = await getStudioIdForOwner(ownerUserId);
      if (!studioId) return;

      const { teamsService } = await import("@/services/teamsService");

      for (const pId of internalParticipantIds) {
        const user = utenti.find((u) => u.id === pId);

        if (user?.email) {
          await teamsService.sendDirectMessage(studioId, ownerUserId, user.email, {
            content: `<strong>Nuova riunione Teams:</strong> ${title}<br><br>📅 ${date} alle ${time}<br><br><a href="${teamsLink}">Clicca qui per partecipare</a>`,
            contentType: "html",
          });
        }
      }
    } catch (err) {
      console.error("Errore invio notifiche Teams:", err);
    }
  };

  const sendSingleNotifications = async (
    rows: any[],
    ownerUserId: string,
    internalParticipantIds: string[],
    action: "created" | "updated" | "cancelled" = "created"
  ) => {
    const { eventoService } = await import("@/services/eventoService");

    const owner = utenti.find((u) => String(u.id) === String(ownerUserId)) || null;

    const targetUserIds = [
      ...new Set(
        [
          ...(internalParticipantIds ?? []),
          ...rows.map((r) => String(r?.utente_id || "")),
        ]
          .filter(Boolean)
          .map((id) => String(id))
      ),
    ];

    const finalTargetUserIds =
      targetUserIds.filter((id) => String(id) !== String(ownerUserId)).length > 0
        ? targetUserIds.filter((id) => String(id) !== String(ownerUserId))
        : [String(ownerUserId)];

    const sentKeys = new Set<string>();

    for (const userId of finalTargetUserIds) {
      const rowForUser = rows.find((r) => String(r?.utente_id || "") === String(userId));

      if (!rowForUser?.id) continue;

      const dedupeKey = `${String(rowForUser.id)}:${String(userId)}:${action}`;
      if (sentKeys.has(dedupeKey)) continue;

      sentKeys.add(dedupeKey);

      const participantIds = toArrayOfStrings((rowForUser as any)?.partecipanti);

      const participantUsers = participantIds
        .map((id) => utenti.find((u) => String(u.id) === String(id)))
        .filter((u): u is UtenteAgenda => Boolean(u));

      const isOwnerFallback = String(userId) === String(ownerUserId);

      const visibleParticipants = participantUsers.filter((u) =>
        isOwnerFallback ? true : String(u.id) !== String(ownerUserId)
      );

      const payload = {
        ...rowForUser,
        utente_id: ownerUserId,
        utente: owner || rowForUser.utente,
        responsabile_nome: owner ? `${owner.nome} ${owner.cognome}` : "",
        partecipanti_notifica: visibleParticipants.map((u) => ({
          id: u.id,
          nome: u.nome,
          cognome: u.cognome,
          email: u.email,
          settore: u.settore ?? null,
        })),
        partecipanti_nomi: visibleParticipants.map((u) => `${u.nome} ${u.cognome}`),
      };

      await eventoService.sendEventNotification(
        toNotificationPayload(payload as any) as any,
        action
      );
    }
  };

  // ----------------------------------------------------
  // SAVE
  // ----------------------------------------------------

  const handleSaveEvento = async () => {
    if (savingEvento) return;

    const supabase = getSupabaseClient();
    setSavingEvento(true);

    try {
      if (!formData.titolo.trim()) {
        toast({
          title: "Errore",
          description: "Titolo obbligatorio",
          variant: "destructive",
        });
        return;
      }

      if (!formData.utente_id) {
        toast({
          title: "Errore",
          description: "Seleziona un organizzatore",
          variant: "destructive",
        });
        return;
      }

      const startDateTimeISO = formData.tutto_giorno
        ? new Date(formData.data_inizio).toISOString()
        : new Date(`${formData.data_inizio}T${formData.ora_inizio}`).toISOString();

      const endDateTimeISO = formData.tutto_giorno
        ? new Date(formData.data_fine || formData.data_inizio).toISOString()
        : new Date(`${formData.data_fine || formData.data_inizio}T${formData.ora_fine}`).toISOString();

      const allParticipantIds = [
        ...new Set([formData.utente_id, ...formData.partecipanti].filter(Boolean)),
      ];

      const internalParticipantIds = allParticipantIds.filter((id) => id !== formData.utente_id);
      const externalEmails = [...new Set(formData.email_partecipanti_esterni.filter(Boolean))];

      let teamsLink = formData.link_teams || "";
      let teamsJoinUrl: string | null = null;

      const ownerStudioId = await getStudioIdForOwner(formData.utente_id);

      if (formData.riunione_teams) {
        if (teamsLink.trim().length > 0) {
          const isUrl = /^https?:\/\/\S+/i.test(teamsLink.trim());

          if (!isUrl) {
            toast({
              title: "Errore",
              description: "Il link Teams deve essere un URL valido",
              variant: "destructive",
            });
            return;
          }
        } else if (!editingGruppoEvento) {
          if (!ownerStudioId) {
            toast({
              title: "Errore",
              description: "Impossibile determinare lo studio dell'utente selezionato",
              variant: "destructive",
            });
            return;
          }

          const {
            data: { session: m365Session },
          } = await supabase.auth.getSession();

          if (!m365Session?.access_token) {
            toast({
              title: "Microsoft 365 non connesso",
              description: "Collega l'account M365 prima di creare un meeting Teams",
              variant: "destructive",
            });
            return;
          }

          const statusResponse = await fetch("/api/microsoft365/status", {
            method: "GET",
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${m365Session.access_token}`,
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          });

          const statusJson = await statusResponse.json().catch(() => null);

          if (!statusResponse.ok || !statusJson?.connected) {
            toast({
              title: "Microsoft 365 non connesso",
              description: "Collega l'account M365 in Impostazioni → Microsoft 365",
              variant: "destructive",
            });
            return;
          }

          const { teamsService } = await import("@/services/teamsService");

          const meeting = await teamsService.createTeamsMeeting(
            ownerStudioId,
            formData.utente_id,
            formData.titolo || "Riunione",
            new Date(startDateTimeISO),
            new Date(endDateTimeISO)
          );

          if (!meeting?.success) {
            toast({
              title: "Errore Teams",
              description: meeting?.error || "Impossibile creare il meeting Teams",
              variant: "destructive",
            });
            return;
          }

          teamsJoinUrl = meeting.joinUrl ?? null;

          if (!teamsJoinUrl) {
            toast({
              title: "Errore",
              description: "Meeting Teams creato ma link non disponibile",
              variant: "destructive",
            });
            return;
          }

          teamsLink = teamsJoinUrl;
        }
      } else {
        teamsLink = "";
      }

      if (editingGruppoEvento) {
        const existingRows = eventiRows.filter(
          (r) => String(r.gruppo_evento || r.id) === String(editingGruppoEvento)
        );

        const existingUserIds = uniqueStrings(existingRows.map((r) => r.utente_id || ""));
        const desiredUserIds = allParticipantIds;

        const userIdsToInsert = desiredUserIds.filter((id) => !existingUserIds.includes(id));
        const rowIdsToDelete = existingRows
          .filter((r) => !desiredUserIds.includes(String(r.utente_id || "")))
          .map((r) => String(r.id));

        const commonData = {
          titolo: formData.titolo,
          descrizione: formData.descrizione || null,
          data_inizio: startDateTimeISO,
          data_fine: endDateTimeISO,
          ora_inizio: formData.tutto_giorno ? null : (formData.ora_inizio as any),
          ora_fine: formData.tutto_giorno ? null : (formData.ora_fine as any),
          tutto_giorno: formData.tutto_giorno as any,
          cliente_id: formData.evento_generico ? null : formData.cliente_id || null,
          in_sede: formData.in_sede as any,
          sala: formData.in_sede ? formData.sala || null : null,
          luogo: !formData.in_sede ? formData.luogo || null : null,
          evento_generico: formData.evento_generico,
          riunione_teams: formData.riunione_teams,
          link_teams: teamsLink || null,
          partecipanti: desiredUserIds,
          email_partecipanti_esterni: externalEmails,
          updated_at: new Date().toISOString(),
        };

        const { data: updatedRows, error: updateError } = await supabase
          .from("tbagenda")
          .update(commonData as any)
          .eq("gruppo_evento", editingGruppoEvento)
          .select();

        if (updateError) throw updateError;

        let insertedRows: any[] = [];

        if (userIdsToInsert.length > 0) {
          const payloads = userIdsToInsert.map((utenteId) =>
            buildBasePayload(
              utenteId,
              editingGruppoEvento,
              startDateTimeISO,
              endDateTimeISO,
              teamsLink || null,
              ownerStudioId
            )
          );

          const { data, error } = await supabase.from("tbagenda").insert(payloads as any).select();

          if (error) throw error;
          insertedRows = data ?? [];
        }

        if (rowIdsToDelete.length > 0) {
          const rowsToDeleteFromOutlook = existingRows
            .filter((r) => rowIdsToDelete.includes(String(r.id)))
            .map((r) => ({
              id: String(r.id),
              utente_id: r.utente_id,
              microsoft_connection_id: (r as any).microsoft_connection_id,
              microsoft_event_id: r.microsoft_event_id,
            }));

          await deleteRowsFromOutlook(rowsToDeleteFromOutlook);

          const { error } = await supabase.from("tbagenda").delete().in("id", rowIdsToDelete);

          if (error) throw error;
        }

        const finalRows = [...(updatedRows ?? []), ...insertedRows];

        await sendSingleNotifications(finalRows, formData.utente_id, internalParticipantIds, "updated");

        const organizerRows = finalRows.filter(
          (row: any) => String(row.utente_id || "") === String(formData.utente_id)
        );

        await syncRowsToOutlook(
          organizerRows.map((row: any) => ({
            id: String(row.id),
            utente_id: row.utente_id ? String(row.utente_id) : null,
          }))
        );

        toast({
          title: "Successo",
          description: "Evento aggiornato",
        });
      } else {
        const gruppoEvento = crypto.randomUUID();

        const payloads = allParticipantIds.map((utenteId) =>
          buildBasePayload(
            utenteId,
            gruppoEvento,
            startDateTimeISO,
            endDateTimeISO,
            teamsLink || null,
            ownerStudioId
          )
        );

        const { data, error } = await supabase.from("tbagenda").insert(payloads as any).select();

        if (error) throw error;

        await sendSingleNotifications(data ?? [], formData.utente_id, internalParticipantIds, "created");

        const organizerRows = (data ?? []).filter(
          (row: any) => String(row.utente_id || "") === String(formData.utente_id)
        );

        await syncRowsToOutlook(
          organizerRows.map((row: any) => ({
            id: String(row.id),
            utente_id: row.utente_id ? String(row.utente_id) : null,
          }))
        );

        if (formData.riunione_teams && teamsLink) {
          await sendTeamsMessagesToParticipants(
            formData.utente_id,
            internalParticipantIds,
            teamsLink,
            formData.titolo,
            formData.data_inizio,
            formData.ora_inizio
          );
        }

        toast({
          title: "Successo",
          description: "Evento creato",
        });
      }

      setDialogOpen(false);
      setDetailOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Errore salvataggio evento:", error);
      toast({
        title: "Errore",
        description: "Salvataggio fallito",
        variant: "destructive",
      });
    } finally {
      setSavingEvento(false);
    }
  };

  const handleDeleteEvento = async () => {
    const supabase = getSupabaseClient();

    if (!eventoToDelete) return;

    try {
      const gruppo = mobileEvents.find(
        (e) => e.id === eventoToDelete || e.gruppo_evento === eventoToDelete
      );

      if (!gruppo) {
        toast({
          title: "Errore",
          description: "Evento non trovato",
          variant: "destructive",
        });
        return;
      }

      const gruppoId = String(gruppo.gruppo_evento || gruppo.id);

      const rowsToDelete = eventiRows.filter((r) => String(r.gruppo_evento || r.id) === gruppoId);

      const ownerUserId = String(gruppo.utente_id || rowsToDelete[0]?.utente_id || "");
      const cancellationParticipantIds = (gruppo.partecipanti || []).filter(
        (id) => String(id) !== ownerUserId
      );

      if (ownerUserId && rowsToDelete.length > 0) {
        await sendSingleNotifications(
          rowsToDelete as any[],
          ownerUserId,
          cancellationParticipantIds,
          "cancelled"
        );
      }

      await deleteRowsFromOutlook(
        rowsToDelete.map((r) => ({
          id: String(r.id),
          utente_id: r.utente_id,
          microsoft_connection_id: (r as any).microsoft_connection_id,
          microsoft_event_id: r.microsoft_event_id,
        }))
      );

      const ids = rowsToDelete.map((r) => r.id);

      const { error } = await supabase.from("tbagenda").delete().in("id", ids);

      if (error) throw error;

      setEventiRows((prev) => prev.filter((r) => !ids.includes(r.id)));
      setDeleteDialogOpen(false);
      setDetailOpen(false);
      setDialogOpen(false);
      setEventoToDelete(null);
      setSelectedEvento(null);

      toast({
        title: "Evento eliminato",
        description: "Il gruppo evento è stato eliminato",
      });
    } catch (error) {
      console.error("Errore eliminazione evento:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare l'evento",
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
      setEventoToDelete(null);
    }
  };

  // ----------------------------------------------------
  // UI
  // ----------------------------------------------------

const toggleAgendaUser = (userId: string, checked: boolean) => {
  setSelectedAgendaUserIds((prev) => {
    if (checked) {
      return [...new Set([...prev, userId])];
    }
    return prev.filter((id) => id !== userId);
  });
};
  
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

   const selectedAgendaUsers = utenti.filter((u) =>
    selectedAgendaUserIds.includes(String(u.id))
  );

  const agendaFilterLabel = getSelectedAgendaUsersLabel(selectedAgendaUsers);

const renderAgendaCard = (evento: EventoGroup, compact = false) => {
    const userColor = getUserEventColor(evento.utente_id);
    const ownerName = evento.utente
      ? `${evento.utente.cognome} ${evento.utente.nome}`
      : "Nominativo non disponibile";

    const mainTitle = `${evento.titolo || "(senza titolo)"} - ${ownerName}`;

    return (
      <button
        key={evento.gruppo_evento}
        type="button"
        onClick={() => handleOpenDetail(evento)}
        className={`w-full text-left rounded-[16px] border border-slate-200 bg-white p-2 shadow-sm transition active:scale-[0.99] border-l-4 ${userColor.left}`}
      >
        <div className="flex items-start gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${userColor.dot}`} />
              <p className="text-[15px] font-semibold text-slate-900 truncate">
                {mainTitle}
              </p>
            </div>

            <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
              <Clock className="h-4 w-4 shrink-0" />
              <span>{formatTimeRange(evento)}</span>
            </div>
          </div>
        </div>

        <div className="mt-1.5 space-y-1">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {evento.cliente?.ragione_sociale || "Evento senza cliente"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {evento.in_sede
                ? `In sede${evento.sala ? ` • ${evento.sala}` : ""}`
                : evento.luogo || "Fuori sede"}
            </span>
          </div>

          {!compact && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Users className="h-4 w-4 shrink-0" />
              <span className="truncate">{getParticipantLabel(evento)}</span>
            </div>
          )}
        </div>
      </button>
    );
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f6fb] px-4 py-10">
        <div className="mx-auto max-w-md">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
            Caricamento agenda...
          </div>
        </div>
      </div>
    );
  }

   return (
    <div className="min-h-screen bg-[#f3f6fb] text-slate-900">
      <div className="mx-auto max-w-md pb-28">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-[#f3f6fb]/95 backdrop-blur">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[26px] font-bold tracking-tight">Agenda</div>
              <div className="text-sm text-slate-500 capitalize text-right">{headerTitle}</div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-w-0 flex-1 justify-between rounded-2xl border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm"
                  >
                    <span className="truncate">Seleziona nominativi</span>
                    <Users className="h-4 w-4 ml-2 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-[280px] rounded-2xl p-2">
                  <div className="max-h-[320px] overflow-y-auto">
                    <div className="flex items-center gap-3 rounded-xl px-3 py-2">
                      <Checkbox
                        checked={selectedAgendaUserIds.length === 0}
                        onCheckedChange={(checked: CheckedState) => {
                          if (checked === true) {
                            setSelectedAgendaUserIds([]);
                          }
                        }}
                      />
                      <span className="text-sm font-medium">Tutti i nominativi</span>
                    </div>

                    {utenti.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-3 rounded-xl px-3 py-2"
                      >
                        <Checkbox
                          checked={selectedAgendaUserIds.includes(u.id)}
                          onCheckedChange={(checked: CheckedState) =>
                            toggleAgendaUser(u.id, checked === true)
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-800">
                            {u.cognome} {u.nome}
                          </div>
                          {u.settore && (
                            <div className="mt-1 text-[11px] text-slate-500">
                              {normalizeSettore(u.settore) || u.settore}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                type="button"
                onClick={handlePrev}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
              >
                <ChevronLeft size={18} />
              </button>

              <button
                type="button"
                onClick={() => setView(view === "day" ? "week" : "day")}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm"
              >
                {view === "day" ? (
                  <>
                    <CalendarDays className="h-4 w-4" />
                    Settimana
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4" />
                    Giorno
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="mt-2 text-xs leading-5 text-slate-500">
              <span className="font-medium text-slate-600">Filtrati:</span>{" "}
              <span>{agendaFilterLabel}</span>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {weekDays.map((day) => {
                const active = isSameDay(day, selectedDate);
                const today = isSameDay(day, new Date());

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      setSelectedDate(day);
                      setView("day");
                    }}
                    className={`min-w-[70px] rounded-[18px] border px-2.5 py-2.5 text-center shadow-sm ${
                      active
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-200 bg-white text-slate-800"
                    }`}
                  >
                    <div className="text-[10px] uppercase">
                      {day.toLocaleDateString("it-IT", { weekday: "short" })}
                    </div>

                    <div className="mt-1 text-lg font-bold">
                      {day.toLocaleDateString("it-IT", { day: "2-digit" })}
                    </div>

                    <div className="mt-1 text-[10px] font-medium">
                      {(() => {
                        const count = mobileEvents.filter((evento) =>
                          isSameDay(safeParseISO(evento.data_inizio), day)
                        ).length;

                        if (count > 0) {
                          return count === 1 ? "1 app." : `${count} app.`;
                        }

                        return today ? "Oggi" : "\u00A0";
                      })()}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        
               <div className="px-4 pt-3">
          {view === "day" ? (
            <div className="space-y-3">
              <div className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {formatFullDate(selectedDate)}
              </div>

              {eventiGiorno.length === 0 ? (
                <div className="rounded-[26px] border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                  Nessun evento per questa giornata
                </div>
              ) : (
                eventiGiorno.map((evento) => renderAgendaCard(evento, false))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {eventiSettimana.map(({ day, eventi }) => (
                 <div
                  key={day.toISOString()}
                  className="rounded-[20px] border border-slate-200 bg-white p-2.5 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold capitalize text-slate-900">
                        {formatDayLabel(day)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {day.toLocaleDateString("it-IT", {
                          month: "long",
                          year: "numeric",
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(day);
                        setView("day");
                      }}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      Apri
                    </button>
                  </div>

                  {eventi.length === 0 ? (
                    <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                      Nessun evento
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {eventi.map((evento) => renderAgendaCard(evento, true))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => handleNuovoEvento(selectedDate)}
          className="fixed bottom-6 right-6 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md rounded-[24px] p-0 overflow-hidden">
          {selectedEvento && (
            <>
              <div className="border-b border-slate-200 bg-white px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <DialogTitle className="text-lg font-semibold">
                      {selectedEvento.titolo || "(senza titolo)"}
                    </DialogTitle>
                    <div className="mt-1 text-sm text-slate-500">{formatTimeRange(selectedEvento)}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleEditEvento(selectedEvento)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        setEventoToDelete(selectedEvento.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4 px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  {selectedEvento.in_sede && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      In sede
                    </span>
                  )}
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2 text-slate-700">
                    <Building2 className="h-4 w-4 mt-0.5" />
                    <div>{selectedEvento.cliente?.ragione_sociale || "Evento senza cliente"}</div>
                  </div>

                  <div className="flex items-start gap-2 text-slate-700">
                    <MapPin className="h-4 w-4 mt-0.5" />
                    <div>
                      {selectedEvento.in_sede
                        ? `In sede${selectedEvento.sala ? ` • ${selectedEvento.sala}` : ""}`
                        : selectedEvento.luogo || "Fuori sede"}
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-slate-700">
                    <Users className="h-4 w-4 mt-0.5" />
                    <div>
                      {selectedEvento.participantUsers.length > 0
                        ? selectedEvento.participantUsers
                            .map((u) => `${u.cognome} ${u.nome}`)
                            .join(", ")
                        : "Nessun partecipante"}
                    </div>
                  </div>

                  {selectedEvento.email_partecipanti_esterni.length > 0 && (
                    <div className="flex items-start gap-2 text-slate-700">
                      <Mail className="h-4 w-4 mt-0.5" />
                      <div>{selectedEvento.email_partecipanti_esterni.join(", ")}</div>
                    </div>
                  )}

                  {selectedEvento.riunione_teams && selectedEvento.link_teams && (
                    <a
                      href={selectedEvento.link_teams}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-violet-700 font-medium"
                    >
                      <Link2 className="h-4 w-4" />
                      Apri riunione Teams
                    </a>
                  )}

                  {selectedEvento.descrizione && (
                    <div className="rounded-[18px] bg-slate-50 p-3 text-slate-700 whitespace-pre-wrap">
                      {selectedEvento.descrizione}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[92vh] overflow-hidden rounded-[24px] p-0">
          <DialogHeader className="border-b border-slate-200 px-5 py-4">
            <DialogTitle>{editingEventoId ? "Modifica evento" : "Nuovo evento"}</DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[72vh] px-5 py-4">
            <div className="space-y-4 pb-2">
              <div>
                <Label>Titolo *</Label>
                <Input
                  value={formData.titolo}
                  onChange={(e) => setFormData({ ...formData, titolo: e.target.value })}
                  placeholder="Es. Riunione cliente"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data inizio</Label>
                  <Input
                    type="date"
                    value={formData.data_inizio}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        data_inizio: e.target.value,
                        data_fine: e.target.value || prev.data_fine,
                      }))
                    }
                  />
                </div>

                <div>
                  <Label>Ora inizio</Label>
                  <Input
                    type="time"
                    disabled={formData.tutto_giorno}
                    value={formData.ora_inizio}
                    onChange={(e) => handleOraInizioChange(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data fine</Label>
                  <Input
                    type="date"
                    value={formData.data_fine}
                    onChange={(e) => setFormData({ ...formData, data_fine: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Ora fine</Label>
                  <Input
                    type="time"
                    disabled={formData.tutto_giorno}
                    value={formData.ora_fine}
                    onChange={(e) => setFormData({ ...formData, ora_fine: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-3">
                <Checkbox
                  id="tutto_giorno_mobile"
                  checked={formData.tutto_giorno}
                  onCheckedChange={(c: CheckedState) =>
                    setFormData({ ...formData, tutto_giorno: toBool(c) })
                  }
                />
                <Label htmlFor="tutto_giorno_mobile">Tutto il giorno</Label>
              </div>

              <div>
                <Label>Organizzatore *</Label>
                <Select
                  value={formData.utente_id}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      utente_id: v,
                      partecipanti: [...new Set(prev.partecipanti.filter((id) => id !== v))],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona utente" />
                  </SelectTrigger>
                  <SelectContent>
                    {utenti.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.cognome} {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-3">
                <Checkbox
                  id="evento_generico_mobile"
                  checked={formData.evento_generico}
                  onCheckedChange={(c: CheckedState) =>
                    setFormData({
                      ...formData,
                      evento_generico: toBool(c),
                      cliente_id: toBool(c) ? "" : formData.cliente_id,
                    })
                  }
                />
                <Label htmlFor="evento_generico_mobile">Evento generico</Label>
              </div>

              {!formData.evento_generico && (
                <div>
                  <Label>Cliente</Label>
                  <Select
                    value={formData.cliente_id}
                    onValueChange={(v) => setFormData({ ...formData, cliente_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clienti.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.ragione_sociale}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-3 rounded-[20px] border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="in_sede_mobile"
                    checked={formData.in_sede}
                    onCheckedChange={(c: CheckedState) => {
                      const isChecked = toBool(c);
                      setFormData({
                        ...formData,
                        in_sede: isChecked,
                        luogo: isChecked ? "" : formData.luogo,
                        sala: !isChecked ? "" : formData.sala,
                      });
                    }}
                  />
                  <Label htmlFor="in_sede_mobile">In sede</Label>
                </div>

                {formData.in_sede ? (
                  <div>
                    <Label>Sala</Label>
                    <Select
                      value={formData.sala}
                      onValueChange={(v) => setFormData({ ...formData, sala: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona sala" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A - Sala riunioni">A - Sala riunioni</SelectItem>
                        <SelectItem value="B - Sala Briefing">B - Sala Briefing</SelectItem>
                        <SelectItem value="C - Stanza personale">C - Stanza personale</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label>Luogo / Indirizzo</Label>
                    <Input
                      value={formData.luogo}
                      onChange={(e) => setFormData({ ...formData, luogo: e.target.value })}
                      placeholder="Es. Via Roma 10, Milano"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-[20px] border border-violet-200 bg-violet-50/50 p-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="riunione_teams_mobile"
                    checked={formData.riunione_teams}
                    onCheckedChange={(c: CheckedState) =>
                      setFormData({
                        ...formData,
                        riunione_teams: toBool(c),
                        link_teams: !toBool(c) ? "" : formData.link_teams,
                        email_partecipanti_esterni: !toBool(c) ? [] : formData.email_partecipanti_esterni,
                      })
                    }
                  />
                  <Label htmlFor="riunione_teams_mobile">Riunione Teams</Label>
                </div>

                {formData.riunione_teams && (
                  <>
                    <div>
                      <Label>Link Teams</Label>
                      <Input
                        value={formData.link_teams}
                        onChange={(e) => setFormData({ ...formData, link_teams: e.target.value })}
                        placeholder="Lascia vuoto per generarlo automaticamente"
                      />
                    </div>

                    <Button type="button" variant="outline" onClick={() => setContactDialogOpen(true)}>
                      <Mail className="h-4 w-4 mr-2" />
                      Seleziona email esterne
                    </Button>

                    {formData.email_partecipanti_esterni.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.email_partecipanti_esterni.map((email) => (
                          <div
                            key={email}
                            className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-3 py-1 text-xs"
                          >
                            <span>{email}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  email_partecipanti_esterni: prev.email_partecipanti_esterni.filter(
                                    (e) => e !== email
                                  ),
                                }))
                              }
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <Label className="mb-2 block">Partecipanti interni</Label>

                <div className="relative mb-2">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Cerca partecipante..."
                    value={searchPartecipanti}
                    onChange={(e) => setSearchPartecipanti(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <ScrollArea className="h-[170px] rounded-[18px] border border-slate-200 p-3">
                  {utenti
                    .filter((u) => {
                      const search = searchPartecipanti.toLowerCase();
                      const fullName = `${u.cognome} ${u.nome}`.toLowerCase();
                      const sector = u.settore ? u.settore.toLowerCase() : "";
                      return fullName.includes(search) || sector.includes(search);
                    })
                    .map((u) => (
                      <div key={u.id} className="flex items-center gap-3 py-2">
                        <Checkbox
                          checked={formData.utente_id === u.id || formData.partecipanti.includes(u.id)}
                          onCheckedChange={(checked: CheckedState) => {
                            const isChecked = toBool(checked);

                            if (u.id === formData.utente_id) return;

                            const newPart = isChecked
                              ? [...formData.partecipanti, u.id]
                              : formData.partecipanti.filter((id) => id !== u.id);

                            setFormData({ ...formData, partecipanti: [...new Set(newPart)] });
                          }}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-800">
                            {u.cognome} {u.nome}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {u.settore && (
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${getSettoreBadgeClass(
                                  u.settore
                                )}`}
                              >
                                {normalizeSettore(u.settore) || u.settore}
                              </span>
                            )}

                            {u.id === formData.utente_id && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                <CheckCircle2 className="h-3 w-3" />
                                Organizzatore
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </ScrollArea>
              </div>

              <div>
                <Label>Descrizione</Label>
                <Textarea
                  value={formData.descrizione}
                  onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
                  placeholder="Note evento"
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="border-t border-slate-200 px-5 py-4">
            <div className="flex w-full items-center justify-between gap-2">
              {editingEventoId ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setDialogOpen(false);
                    setEventoToDelete(editingEventoId);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Elimina
                </Button>
              ) : (
                <div />
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                >
                  Annulla
                </Button>

                <Button type="button" onClick={handleSaveEvento} disabled={savingEvento}>
                  {savingEvento ? "Salvataggio..." : editingEventoId ? "Aggiorna" : "Crea"}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Seleziona email dai contatti</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cerca nome o email..."
                value={searchContatti}
                onChange={(e) => setSearchContatti(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[320px] rounded-[18px] border border-slate-200 p-2">
              {filteredContactOptions.length === 0 ? (
                <div className="text-sm text-slate-500 p-2">Nessun contatto trovato</div>
              ) : (
                filteredContactOptions.map((contact) => {
                  const checked = formData.email_partecipanti_esterni.includes(contact.email);

                  return (
                    <div key={contact.id} className="flex items-start gap-3 py-3 border-b last:border-b-0">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c: CheckedState) => handleToggleExternalEmail(contact.email, c)}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          {contact.cognome} {contact.nome}
                        </div>
                        <div className="text-sm text-slate-500 truncate">{contact.email}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </ScrollArea>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setContactDialogOpen(false)}>
                Chiudi
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina evento</AlertDialogTitle>
            <AlertDialogDescription>
              Verrà eliminato l&apos;intero gruppo evento per tutti i partecipanti.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEvento} className="bg-red-600 hover:bg-red-700">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
