// src/pages/agenda/index.tsx
import { useEffect, useMemo, useState } from "react";
import type React from "react";
import type { CheckedState } from "@radix-ui/react-checkbox";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

import { Card, CardContent } from "@/components/ui/card";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  User,
  MapPin,
  Clock,
  List,
  CalendarDays,
  Filter,
  Calendar as CalendarIcon,
  Building2,
  FileText,
  Search,
  Mail,
  ExternalLink,
  Users,
  Video,
  RefreshCw,
  Link2,
  CheckCircle2,
} from "lucide-react";

import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  parseISO,
} from "date-fns";
import { it } from "date-fns/locale";

import { calendarSyncService } from "@/services/calendarSyncService";

// ----------------------------------------------------
// TIPI
// ----------------------------------------------------

type ClienteAgenda = {
  id: string;
  ragione_sociale: string;
  attivo: boolean | null;
  cap: string;
  citta: string;
  cod_cliente: string;
  codice_fiscale: string;
  contatto1_id: string | null;
  contatto2_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  utente_professionista_id: string | null;
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

  cliente: ClienteBase | null;
  utente: UtenteBase | null;
};

type EventoBadge = {
  label: string;
  className: string;
  icon?: React.ReactNode;
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
  colore: string | null;
  created_at: string | null;
  updated_at: string | null;
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
  ricorrente: boolean;
  frequenza_giorni: number;
  durata_giorni: number;
};

// ----------------------------------------------------
// HELPERS GENERALI
// ----------------------------------------------------

const toNotificationPayload = (e: Record<string, unknown>) => ({
  ...e,
  durata_giorni: (e as any)?.durata_giorni ?? null,
  evento_generico: (e as any)?.evento_generico ?? null,
  frequenza_giorni: (e as any)?.frequenza_giorni ?? null,
  link_teams: (e as any)?.link_teams ?? null,
  email_partecipanti_esterni: (e as any)?.email_partecipanti_esterni ?? null,
  frequenza_settimane: (e as any)?.frequenza_settimane ?? null,
  frequenza_mesi: (e as any)?.frequenza_mesi ?? null,
  giorno_mese: (e as any)?.giorno_mese ?? null,
  giorni_settimana: (e as any)?.giorni_settimana ?? null,
  ricorrenza_fine: (e as any)?.ricorrenza_fine ?? null,
  ricorrenza_count: (e as any)?.ricorrenza_count ?? null,
  outlook_event_id: (e as any)?.outlook_event_id ?? null,
});

const safeParseISO = (value: string | null | undefined): Date => {
  if (!value) return new Date();
  try {
    return parseISO(value);
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

const groupKeyFromRow = (row: EventoWithRelations) => String(row.gruppo_evento || row.id);

const sortUsersByName = (users: UtenteBase[]) => {
  return [...users].sort((a, b) => {
    const aLabel = `${a.cognome} ${a.nome}`.toLowerCase();
    const bLabel = `${b.cognome} ${b.nome}`.toLowerCase();
    return aLabel.localeCompare(bLabel, "it");
  });
};

const uniqueStrings = (items: Array<string | null | undefined>) =>
  [
    ...new Set(
      items
        .filter((v): v is string => Boolean(v && String(v).trim()))
        .map((v) => String(v).trim())
    ),
  ];

const getInitials = (nome?: string | null, cognome?: string | null) => {
  const n = (nome || "").trim().charAt(0);
  const c = (cognome || "").trim().charAt(0);
  return `${n}${c}`.toUpperCase() || "?";
};

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
    return "bg-green-100 text-green-800 border-green-200";
  }

  if (normalized === "Lavoro") {
    return "bg-red-100 text-red-800 border-red-200";
  }

  if (normalized === "Consulenza") {
    return "bg-blue-100 text-blue-800 border-blue-200";
  }

  return "bg-slate-100 text-slate-700 border-slate-200";
};

const getSettoreEventColor = (settore?: string | null) => {
  const normalized = normalizeSettore(settore);

  if (normalized === "Fiscale") {
    return {
      border: "border-l-green-600",
      chip: "bg-green-50 border-green-200 text-green-900",
      subtle: "bg-green-100 text-green-800",
      dot: "bg-green-600",
    };
  }

  if (normalized === "Lavoro") {
    return {
      border: "border-l-red-600",
      chip: "bg-red-50 border-red-200 text-red-900",
      subtle: "bg-red-100 text-red-800",
      dot: "bg-red-600",
    };
  }

  if (normalized === "Consulenza") {
    return {
      border: "border-l-blue-600",
      chip: "bg-blue-50 border-blue-200 text-blue-900",
      subtle: "bg-blue-100 text-blue-800",
      dot: "bg-blue-600",
    };
  }

  return {
    border: "border-l-slate-500",
    chip: "bg-slate-50 border-slate-200 text-slate-900",
    subtle: "bg-slate-100 text-slate-800",
    dot: "bg-slate-500",
  };
};

const getEventoBadges = (evento: EventoGroup): EventoBadge[] => {
  const badges: EventoBadge[] = [];

  if (evento.riunione_teams) {
    badges.push({
      label: "Teams",
      className: "bg-violet-100 text-violet-800 border-violet-200",
      icon: <Video className="h-3 w-3" />,
    });
  }

  if (evento.evento_generico) {
    badges.push({
      label: "Generico",
      className: "bg-slate-100 text-slate-800 border-slate-200",
    });
  }

  if (evento.in_sede) {
    badges.push({
      label: "In sede",
      className: "bg-emerald-100 text-emerald-800 border-emerald-200",
    });
  }

  if (evento.ricorrente) {
    badges.push({
      label: "Ricorrente",
      className: "bg-amber-100 text-amber-800 border-amber-200",
      icon: <RefreshCw className="h-3 w-3" />,
    });
  }

  if (evento.provider) {
    badges.push({
      label: String(evento.provider),
      className: "bg-indigo-100 text-indigo-800 border-indigo-200",
    });
  }

  return badges;
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
      sortedRows.flatMap((r) => toArrayOfStrings((r as any).email_partecipanti_esterni))
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
      colore: master.colore ? String(master.colore) : null,
      created_at: master.created_at ? String(master.created_at) : null,
      updated_at: master.updated_at ? String(master.updated_at) : null,
      luogo: master.luogo ? String(master.luogo) : null,
      partecipanti: participantIds,
      email_partecipanti_esterni: externalEmails,
      riunione_teams: Boolean((master as any).riunione_teams),
      link_teams: ((master as any).link_teams as string) || null,
      evento_generico: Boolean((master as any).evento_generico),
      studio_id: master.studio_id ? String(master.studio_id) : null,
      ora_inizio: master.ora_inizio ? normalizeTime(String(master.ora_inizio)) : null,
      ora_fine: master.ora_fine ? normalizeTime(String(master.ora_fine)) : null,
      ricorrente: Boolean((master as any).ricorrente),
      frequenza_giorni: (master as any).frequenza_giorni
        ? Number((master as any).frequenza_giorni)
        : null,
      durata_giorni: (master as any).durata_giorni
        ? Number((master as any).durata_giorni)
        : null,
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

// ----------------------------------------------------
// COMPONENT
// ----------------------------------------------------

export default function AgendaPage() {
  const { toast } = useToast();

  // stato dati
  const [eventiRows, setEventiRows] = useState<EventoWithRelations[]>([]);
  const [clienti, setClienti] = useState<ClienteAgenda[]>([]);
  const [utenti, setUtenti] = useState<UtenteAgenda[]>([]);
  const [contactOptions, setContactOptions] = useState<ContactEmailOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentStudioId, setCurrentStudioId] = useState<string | null>(null);

  // stato ui
  const [view, setView] = useState<"list" | "month" | "week" | "ricorrenti" | "teams">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filtroUtenti, setFiltroUtenti] = useState<string[]>([]);

  // dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventoToDelete, setEventoToDelete] = useState<string | null>(null);
  const [editingEventoId, setEditingEventoId] = useState<string | null>(null);
  const [editingGruppoEvento, setEditingGruppoEvento] = useState<string | null>(null);

   const [savingEvento, setSavingEvento] = useState(false);

  // popup multipli
  const [moreEventsOpen, setMoreEventsOpen] = useState(false);
  const [moreEventsDate, setMoreEventsDate] = useState<Date | null>(null);
  const [moreEventsList, setMoreEventsList] = useState<EventoGroup[]>([]);

  // popup contatti
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [searchContatti, setSearchContatti] = useState("");

  // ricerca partecipanti
  const [searchPartecipanti, setSearchPartecipanti] = useState("");

  // form
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
    ricorrente: false,
    frequenza_giorni: 7,
    durata_giorni: 180,
  });

  const [userFilterInitialized, setUserFilterInitialized] = useState(false);

  // ----------------------------------------------------
  // LOAD DATA
  // ----------------------------------------------------

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    const supabase = getSupabaseClient() as any;

    try {
      setLoading(true);

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
          setCurrentUserId(String(userData.id));
          setCurrentStudioId((userData as any).studio_id ? String((userData as any).studio_id) : null);
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
      setEventiRows(((eventiData ?? []) as unknown) as EventoWithRelations[]);

      const { data: clientiData, error: clientiError } = await supabase
        .from("tbclienti")
        .select("*")
        .eq("attivo", true)
        .order("ragione_sociale");

      if (clientiError) throw clientiError;
      setClienti(((clientiData ?? []) as unknown) as ClienteAgenda[]);

      const { data: utentiData, error: utentiError } = await supabase
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

      if (utentiError) throw utentiError;
      setUtenti(((utentiData ?? []) as unknown) as UtenteAgenda[]);

      const { data: contattiData, error: contattiError } = await (supabase as any)
        .from("tbcontatti")
        .select("*")
        .order("cognome", { ascending: true });

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
        console.warn("tbcontatti non caricata:", contattiError);
        setContactOptions([]);
      }
    } catch (error) {
      console.error("Errore caricamento agenda:", error);
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
  // DATI AGGREGATI
  // ----------------------------------------------------

  const groupedEvents = useMemo(() => aggregateEventGroups(eventiRows), [eventiRows]);

const filteredEvents = useMemo(() => {
  return groupedEvents.filter((e) => {
    if (filtroUtenti.length === 0) return true;

    return e.rows.some((row) =>
      filtroUtenti.includes(String(row.utente_id || ""))
    );
  });
}, [groupedEvents, filtroUtenti]);

  const loggedUser = useMemo(
    () => utenti.find((u) => String(u.id) === String(currentUserId || "")) || null,
    [utenti, currentUserId]
  );

 useEffect(() => {
  if (!currentUserId) return;
  if (userFilterInitialized) return;

  setFiltroUtenti([String(currentUserId)]);
  setUserFilterInitialized(true);
}, [currentUserId, userFilterInitialized]);

  const teamsEvents = useMemo(() => {
    return groupedEvents
      .filter(
        (e) =>
          Boolean(e.riunione_teams) &&
          Boolean(String(e.link_teams || "").trim()) &&
          Boolean(currentUserId) &&
          (String(e.utente_id || "") === String(currentUserId) ||
            e.partecipanti.some((id) => String(id) === String(currentUserId)))
      )
      .sort((a, b) => safeParseISO(a.data_inizio).getTime() - safeParseISO(b.data_inizio).getTime());
  }, [groupedEvents, currentUserId]);

  const filteredContactOptions = useMemo(() => {
    const search = searchContatti.trim().toLowerCase();
    if (!search) return contactOptions;

    return contactOptions.filter((c) => {
      const fullName = `${c.cognome} ${c.nome}`.toLowerCase();
      return fullName.includes(search) || c.email.toLowerCase().includes(search);
    });
  }, [contactOptions, searchContatti]);

  // ----------------------------------------------------
  // FORM HELPERS
  // ----------------------------------------------------

  const resetForm = () => {
    setEditingEventoId(null);
    setEditingGruppoEvento(null);
    setSearchPartecipanti("");
    setSearchContatti("");

    const today = format(new Date(), "yyyy-MM-dd");

    setFormData({
      titolo: "",
      descrizione: "",
      data_inizio: today,
      ora_inizio: "09:00",
      data_fine: today,
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
      ricorrente: false,
      frequenza_giorni: 7,
      durata_giorni: 180,
    });
  };

  const handleNuovoEvento = (date?: Date, hour?: number) => {
    resetForm();

    if (date) {
      const dateStr = format(date, "yyyy-MM-dd");
      let startHour = "09:00";
      let endHour = "10:00";

      if (hour !== undefined) {
        startHour = `${String(hour).padStart(2, "0")}:00`;
        endHour = addOneHourToTime(startHour);
      }

      setFormData((prev) => ({
        ...prev,
        data_inizio: dateStr,
        data_fine: dateStr,
        ora_inizio: startHour,
        ora_fine: endHour,
      }));
      setSelectedDate(date);
    } else {
      setSelectedDate(null);
    }

    setDialogOpen(true);
  };

  const handleEditEvento = (evento: EventoGroup) => {
    const startDate = safeParseISO(evento.data_inizio);
    const endDate = safeParseISO(evento.data_fine);

    setEditingEventoId(String(evento.id));
    setEditingGruppoEvento(String(evento.gruppo_evento));
    setSearchPartecipanti("");
    setSearchContatti("");

    setFormData({
      titolo: evento.titolo ?? "",
      descrizione: evento.descrizione || "",
      data_inizio: format(startDate, "yyyy-MM-dd"),
      ora_inizio: evento.ora_inizio ? normalizeTime(String(evento.ora_inizio)) : "09:00",
      data_fine: format(endDate, "yyyy-MM-dd"),
      ora_fine: evento.ora_fine ? normalizeTime(String(evento.ora_fine)) : "10:00",
      tutto_giorno: Boolean(evento.tutto_giorno),
      cliente_id: evento.cliente_id || "",
      utente_id: evento.utente_id || "",
      in_sede: Boolean(evento.in_sede),
      sala: evento.in_sede ? (evento.sala ? String(evento.sala) : "") : "",
      luogo: !evento.in_sede ? (evento.luogo ? String(evento.luogo) : "") : "",
      evento_generico: Boolean(evento.evento_generico),
      riunione_teams: Boolean(evento.riunione_teams),
      link_teams: evento.link_teams || "",
      partecipanti: evento.partecipanti,
      email_partecipanti_esterni: evento.email_partecipanti_esterni,
      ricorrente: Boolean(evento.ricorrente),
      frequenza_giorni: Number(evento.frequenza_giorni ?? 7),
      durata_giorni: Number(evento.durata_giorni ?? 180),
    });

    setDialogOpen(true);
  };

  const handleDataInizioChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      data_inizio: value,
      data_fine: value || prev.data_fine,
    }));
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

  const getMicrosoftConnectionIdForUser = async (ownerUserId: string) => {
  if (!ownerUserId) return null;

  const supabase = getSupabaseClient();

  const { data, error } = await (supabase as any)
    .from("microsoft365_connections")
    .select("id")
    .eq("utente_id", ownerUserId)
    .eq("active", true)
    .maybeSingle();

  if (error || !data?.id) return null;
  return String(data.id);
};

const buildBasePayload = (
  utenteId: string,
  gruppoEvento: string,
  dataInizio: string,
  dataFine: string,
  teamsLink: string | null,
  studioId: string | null,
  microsoftConnectionId: string | null
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
  ricorrente: formData.ricorrente,
  frequenza_giorni: formData.ricorrente ? formData.frequenza_giorni : null,
  durata_giorni: formData.ricorrente ? formData.durata_giorni : null,
  studio_id: studioId || currentStudioId || null,
  microsoft_connection_id: microsoftConnectionId || null,
  updated_at: new Date().toISOString(),
});

const syncRowsToOutlook = async (
  rows: Array<{
    id: string;
    utente_id: string | null;
  }>
) => {
  const supabase = getSupabaseClient();

  for (const row of rows) {
    if (!row?.id || !row.utente_id) continue;

    try {
      const { data: connection } = await (supabase as any)
        .from("microsoft365_connections")
        .select("id")
        .eq("utente_id", row.utente_id)
        .eq("active", true)
        .maybeSingle();

      if (!connection?.id) {
        console.warn("Utente senza connessione Microsoft:", row.utente_id);
        continue;
      }

      await calendarSyncService.syncEventToOutlook(
        String(row.utente_id),
        String(row.id)
      );
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
      const { data: connection } = await (supabase as any)
        .from("microsoft365_connections")
        .select("id")
        .eq("utente_id", row.utente_id)
        .eq("active", true)
        .maybeSingle();

      if (!connection?.id) {
        console.warn("Connessione Microsoft non trovata per:", row.utente_id);
        continue;
      }
if ((calendarSyncService as any).deleteEventFromOutlook) {
  await (calendarSyncService as any).deleteEventFromOutlook(
    String(row.utente_id),
    String(connection.id),
    String(row.microsoft_event_id)
  );
} else {
  console.warn("deleteEventFromOutlook non presente in calendarSyncService");
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
      if (!studioId) {
        console.error("Errore invio notifiche Teams: studioId non trovato.");
        return;
      }

      const { teamsService } = await import("@/services/teamsService");

      for (const pId of internalParticipantIds) {
        const user = utenti.find((u) => u.id === pId);

        if (user?.email) {
          const dmRes = await teamsService.sendDirectMessage(studioId, ownerUserId, user.email, {
            content: `<strong>Nuova riunione Teams:</strong> ${title}<br><br>📅 ${date} alle ${time}<br><br><a href="${teamsLink}">Clicca qui per partecipare</a>`,
            contentType: "html",
          });

          if (!dmRes?.success) {
            console.error("Errore invio DM Teams:", (dmRes as any)?.error);
          }
        }
      }
    } catch (err) {
      console.error("Errore invio notifiche Teams:", err);
    }
  };

  // ----------------------------------------------------
  // UTILITIES UI / TOOLTIP
  // ----------------------------------------------------

  const handleDeleteEventoDirect = (eventoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEventoToDelete(eventoId);
    setDeleteDialogOpen(true);
  };

  const handleOpenMoreEvents = (date: Date, events: EventoGroup[]) => {
    setMoreEventsDate(date);
    setMoreEventsList(events);
    setMoreEventsOpen(true);
  };

  const getParticipantLabel = (evento: EventoGroup) => {
    if (evento.participantUsers.length === 0) return "Nessun partecipante";
    if (evento.participantUsers.length === 1) {
      const u = evento.participantUsers[0];
      return `${u.cognome} ${u.nome}`;
    }
    return `${evento.participantUsers.length} partecipanti`;
  };

  const getEventoSummary = (evento: EventoGroup): string => {
    const startDate = safeParseISO(evento.data_inizio);

    const ownerName = evento.utente
      ? `${evento.utente.nome} ${evento.utente.cognome}${evento.utente.settore ? ` (${evento.utente.settore})` : ""}`
      : "Non assegnato";

    const clienteNome = evento.cliente?.ragione_sociale || "Nessun cliente";

    const luogo = evento.in_sede
      ? `Sala ${evento.sala ? String(evento.sala) : "??"}`
      : evento.luogo
      ? String(evento.luogo)
      : "Fuori sede";

    const oraInizio = evento.ora_inizio ? String(evento.ora_inizio).substring(0, 5) : "";
    const oraFine = evento.ora_fine ? String(evento.ora_fine).substring(0, 5) : "";

    return [
      `Titolo: ${evento.titolo || "Senza titolo"}`,
      `Data: ${format(startDate, "dd MMMM yyyy", { locale: it })}`,
      `Orario: ${oraInizio}${oraFine ? ` - ${oraFine}` : ""}`,
      `Organizzatore: ${ownerName}`,
      `Cliente: ${clienteNome}`,
      `Luogo: ${luogo}`,
      `Partecipanti interni: ${
        evento.participantUsers.length > 0
          ? evento.participantUsers.map((u) => `${u.cognome} ${u.nome}`).join(", ")
          : "Nessuno"
      }`,
      evento.email_partecipanti_esterni.length > 0
        ? `Partecipanti esterni: ${evento.email_partecipanti_esterni.join(", ")}`
        : null,
      evento.riunione_teams && evento.link_teams ? `Link Teams: ${evento.link_teams}` : null,
      evento.descrizione ? `Note: ${evento.descrizione}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const renderUserPill = (user: UtenteBase, isOrganizer = false) => {
    return (
      <div
        key={user.id}
        className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
          isOrganizer ? "bg-slate-50 border-slate-300 ring-1 ring-slate-200" : "bg-white"
        }`}
      >
        <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
          {getInitials(user.nome, user.cognome)}
        </div>

        <div className="min-w-0">
          <div className="text-xs font-medium leading-none truncate">
            {user.cognome} {user.nome}
            {isOrganizer ? " • organizzatore" : ""}
          </div>

          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${getSettoreBadgeClass(
                user.settore
              )}`}
            >
              {normalizeSettore(user.settore) || "Settore"}
            </span>

            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
              <CheckCircle2 className="h-3 w-3" />
              Accettato
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderAdvancedTooltip = (evento: EventoGroup) => {
    const eventColors = getSettoreEventColor(evento.utente?.settore);
    const badges = getEventoBadges(evento);
    const ownerId = String(evento.utente_id || "");

    return (
      <TooltipContent side="right" className="w-[420px] p-0 rounded-xl overflow-hidden border shadow-xl">
        <div className="bg-white">
          <div className={`border-b px-4 py-3 ${eventColors.chip}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{evento.titolo || "Senza titolo"}</div>
                <div className="text-xs opacity-80 mt-1">
                  {format(safeParseISO(evento.data_inizio), "dd MMMM yyyy", { locale: it })}
                  {" • "}
                  {evento.tutto_giorno
                    ? "Tutto il giorno"
                    : `${evento.ora_inizio ? String(evento.ora_inizio).substring(0, 5) : ""}${
                        evento.ora_fine ? ` - ${String(evento.ora_fine).substring(0, 5)}` : ""
                      }`}
                </div>
              </div>

              <div className={`h-3 w-3 rounded-full mt-1 ${eventColors.dot}`} />
            </div>

            {badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {badges.map((badge) => (
                  <span
                    key={`${evento.gruppo_evento}-${badge.label}`}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${badge.className}`}
                  >
                    {badge.icon}
                    {badge.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 space-y-4 text-sm">
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 text-slate-500" />
                <div>
                  <div className="font-medium">Orario</div>
                  <div className="text-muted-foreground">
                    {evento.tutto_giorno
                      ? "Tutto il giorno"
                      : `${evento.ora_inizio ? String(evento.ora_inizio).substring(0, 5) : ""}${
                          evento.ora_fine ? ` - ${String(evento.ora_fine).substring(0, 5)}` : ""
                        }`}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 mt-0.5 text-slate-500" />
                <div>
                  <div className="font-medium">Cliente</div>
                  <div className="text-muted-foreground">
                    {evento.cliente?.ragione_sociale || "Evento senza cliente"}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-slate-500" />
                <div>
                  <div className="font-medium">Luogo</div>
                  <div className="text-muted-foreground">
                    {evento.in_sede
                      ? `In sede${evento.sala ? ` • ${evento.sala}` : ""}`
                      : evento.luogo || "Fuori sede"}
                  </div>
                </div>
              </div>

              {evento.riunione_teams && evento.link_teams && (
                <div className="flex items-start gap-2">
                  <Link2 className="h-4 w-4 mt-0.5 text-violet-600" />
                  <div className="min-w-0">
                    <div className="font-medium">Link Teams</div>
                    <a
                      href={evento.link_teams}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-700 hover:underline break-all"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {evento.link_teams}
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Partecipanti interni
              </div>
              <div className="grid grid-cols-1 gap-2">
                {evento.participantUsers.length > 0 ? (
                  evento.participantUsers.map((u) => renderUserPill(u, u.id === ownerId))
                ) : (
                  <div className="text-muted-foreground text-sm">Nessun partecipante interno</div>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Partecipanti esterni
              </div>
              {evento.email_partecipanti_esterni.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {evento.email_partecipanti_esterni.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs bg-slate-50 text-slate-700"
                    >
                      {email}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">Nessun partecipante esterno</div>
              )}
            </div>

            {evento.descrizione && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                  Descrizione
                </div>
                <div className="text-sm text-slate-700 whitespace-pre-wrap">{evento.descrizione}</div>
              </div>
            )}
          </div>
        </div>
      </TooltipContent>
    );
  };

  const getEventClasses = (evento: EventoGroup) => {
    const settoreColor = getSettoreEventColor(evento.utente?.settore);

    return {
      card: settoreColor.border,
      box: `${settoreColor.chip} border`,
      badgeText: settoreColor.subtle,
      dot: settoreColor.dot,
    };
  };

  // ----------------------------------------------------
  // DA QUI NELLA PROSSIMA CHAT:
  // - handleSaveEvento
  // - handleDeleteEvento
  // - renderEventCard
  // - renderMonthView
  // - renderWeekView
  // - renderListView
  // - renderRicorrentiView
  // - renderTeamsView
  // - return JSX finale con dialog
  // ----------------------------------------------------

const sendSingleNotifications = async (
  rows: any[],
  ownerUserId: string,
  internalParticipantIds: string[]
) => {
  const { eventoService } = await import("@/services/eventoService");

  const owner = utenti.find((u) => String(u.id) === String(ownerUserId)) || null;

  const targetUserIds = [...new Set(
    (internalParticipantIds ?? [])
      .filter((id) => id && String(id) !== String(ownerUserId))
      .map((id) => String(id))
  )];

  const sentKeys = new Set<string>();

  for (const userId of targetUserIds) {
    const rowForUser = rows.find(
      (r) => String(r?.utente_id || "") === String(userId)
    );

    if (!rowForUser?.id) continue;

    const dedupeKey = `${String(rowForUser.id)}:${String(userId)}`;
    if (sentKeys.has(dedupeKey)) continue;

    sentKeys.add(dedupeKey);

    // 🔴 COSTRUZIONE DATI CORRETTI

   const participantIds = toArrayOfStrings((rowForUser as any)?.partecipanti);

const participantUsers = participantIds
  .map((id) => utenti.find((u) => String(u.id) === String(id)))
  .filter((u): u is UtenteAgenda => Boolean(u));

    // 👉 ESCLUDO ORGANIZZATORE
    const visibleParticipants = participantUsers.filter(
      (u) => String(u!.id) !== String(ownerUserId)
    );

    const payload = {
      ...rowForUser,

      // ✅ FORZO RESPONSABILE CORRETTO
      utente_id: ownerUserId,
      utente: owner || rowForUser.utente,

      responsabile_nome: owner
        ? `${owner.nome} ${owner.cognome}`
        : "",

      // ✅ PARTECIPANTI SENZA ORGANIZZATORE
      partecipanti_notifica: visibleParticipants.map((u) => ({
        id: u!.id,
        nome: u!.nome,
        cognome: u!.cognome,
        email: u!.email,
        settore: u!.settore ?? null,
      })),

      partecipanti_nomi: visibleParticipants.map(
        (u) => `${u!.nome} ${u!.cognome}`
      ),
    };

    await eventoService.sendEventNotification(
      toNotificationPayload(payload as any) as any
    );
  }
};

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
        description: "Seleziona un utente organizzatore",
        variant: "destructive",
      });
      return;
    }

    if (formData.ricorrente) {
      if (!formData.frequenza_giorni || formData.frequenza_giorni <= 0) {
        toast({
          title: "Errore",
          description: "Frequenza obbligatoria per eventi ricorrenti (> 0)",
          variant: "destructive",
        });
        return;
      }

      if (!formData.durata_giorni || formData.durata_giorni <= 0) {
        toast({
          title: "Errore",
          description: "Durata obbligatoria per eventi ricorrenti (> 0)",
          variant: "destructive",
        });
        return;
      }
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

    const internalParticipantIds = allParticipantIds.filter(
      (id) => id !== formData.utente_id
    );

    const externalEmails = [
      ...new Set(formData.email_partecipanti_esterni.filter(Boolean)),
    ];

    let teamsLink = formData.link_teams || "";
    let teamsJoinUrl: string | null = null;

    const ownerStudioId = await getStudioIdForOwner(formData.utente_id);
    const ownerMicrosoftConnectionId = await getMicrosoftConnectionIdForUser(
      formData.utente_id
    );

    if (formData.riunione_teams) {
      if (teamsLink.trim().length > 0) {
        const isUrl = /^https?:\/\/\S+/i.test(teamsLink.trim());

        if (!isUrl) {
          toast({
            title: "Errore",
            description: "Il Link Teams deve essere un URL valido (es. https://...).",
            variant: "destructive",
          });
          return;
        }
      } else if (!editingGruppoEvento) {
        if (!ownerStudioId) {
          toast({
            title: "Errore",
            description: "Impossibile determinare lo studio dell'utente selezionato.",
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
            description: "Collega l'account M365 prima di creare un meeting Teams.",
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
            description: "Collega l'account M365 in Impostazioni → Microsoft 365.",
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
            description: meeting?.error || "Impossibile creare il meeting Teams.",
            variant: "destructive",
          });
          return;
        }

        teamsJoinUrl = meeting.joinUrl ?? null;

        if (!teamsJoinUrl) {
          toast({
            title: "Errore",
            description: "Meeting Teams creato ma link non disponibile.",
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

      const existingUserIds = uniqueStrings(
        existingRows.map((r) => r.utente_id || "")
      );

      const desiredUserIds = allParticipantIds;

      const userIdsToInsert = desiredUserIds.filter(
        (id) => !existingUserIds.includes(id)
      );

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
        ricorrente: formData.ricorrente,
        frequenza_giorni: formData.ricorrente ? formData.frequenza_giorni : null,
        durata_giorni: formData.ricorrente ? formData.durata_giorni : null,
        studio_id: ownerStudioId || currentStudioId || null,
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
            ownerStudioId,
            ownerMicrosoftConnectionId
          )
        );

        const { data, error } = await supabase
          .from("tbagenda")
          .insert(payloads as any)
          .select();

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

        const { error } = await supabase
          .from("tbagenda")
          .delete()
          .in("id", rowIdsToDelete);

        if (error) throw error;
      }

      const finalRows = [...(updatedRows ?? []), ...insertedRows];

      await sendSingleNotifications(
        finalRows,
        formData.utente_id,
        internalParticipantIds
      );

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
        description: "Gruppo evento aggiornato",
      });
       } else {
      if (formData.ricorrente) {
        const startDate = new Date(formData.data_inizio);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + formData.durata_giorni);

        const occurrences: Array<Record<string, unknown>> = [];
        let current = new Date(startDate);

        while (current <= endDate) {
          const gruppoEvento = crypto.randomUUID();

          const occurrenceStartDateTime = formData.tutto_giorno
            ? `${format(current, "yyyy-MM-dd")}T00:00:00+00:00`
            : `${format(current, "yyyy-MM-dd")}T${formData.ora_inizio}:00+00:00`;

          const occurrenceEndDateTime = formData.tutto_giorno
            ? `${format(current, "yyyy-MM-dd")}T23:59:59+00:00`
            : `${format(current, "yyyy-MM-dd")}T${formData.ora_fine}:00+00:00`;

          for (const utenteId of allParticipantIds) {
            occurrences.push(
              buildBasePayload(
                utenteId,
                gruppoEvento,
                occurrenceStartDateTime,
                occurrenceEndDateTime,
                teamsLink || null,
                ownerStudioId,
                ownerMicrosoftConnectionId
              )
            );
          }

          current.setDate(current.getDate() + formData.frequenza_giorni);
        }

        const { data, error } = await supabase
          .from("tbagenda")
          .insert(occurrences as any)
          .select();

        if (error) throw error;

        await sendSingleNotifications(data ?? [], formData.utente_id, internalParticipantIds);

        const organizerRows = (data ?? []).filter(
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
          description: `${data?.length ?? 0} righe evento create e sincronizzate`,
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
            ownerStudioId,
            ownerMicrosoftConnectionId
          )
        );

        const { data, error } = await supabase
          .from("tbagenda")
          .insert(payloads as any)
          .select();

        if (error) throw error;

        await sendSingleNotifications(data ?? [], formData.utente_id, internalParticipantIds);

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
          description: "Evento gruppo creato e sincronizzato",
        });
      }
    }

    setDialogOpen(false);
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
      const gruppo = filteredEvents.find(
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

      const rowsToDelete = eventiRows.filter(
        (r) => String(r.gruppo_evento || r.id) === String(gruppo.gruppo_evento)
      );

    await deleteRowsFromOutlook(
  rowsToDelete.map((r) => ({
    id: String(r.id),
    utente_id: r.utente_id,
    microsoft_connection_id: (r as any).microsoft_connection_id,
    microsoft_event_id: r.microsoft_event_id
  }))
);

      const { error } = await supabase
        .from("tbagenda")
        .delete()
        .eq("gruppo_evento", gruppo.gruppo_evento);

      if (error) throw error;

      setEventiRows((prev) =>
        prev.filter((r) => String(r.gruppo_evento || r.id) !== String(gruppo.gruppo_evento))
      );

      setDeleteDialogOpen(false);
      setDialogOpen(false);
      setEventoToDelete(null);
      setEditingEventoId(null);
      setEditingGruppoEvento(null);

      toast({
        title: "Evento eliminato",
        description: "Il gruppo evento è stato eliminato con successo",
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

  const handleSelezioneSettore = (settore: "Lavoro" | "Fiscale") => {
    const ids = utenti.filter((u) => u.settore === settore).map((u) => u.id);
    const isSelected = ids.some((id) => formData.partecipanti.includes(id));

    if (isSelected) {
      setFormData((prev) => ({
        ...prev,
        partecipanti: prev.partecipanti.filter((p) => !ids.includes(p)),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        partecipanti: [...new Set([...prev.partecipanti, ...ids])].filter((id) => id !== prev.utente_id),
      }));
    }
  };

  const handleSelezioneConsulenza = () => {
    const ids = utenti.filter((u) => u.settore === "Consulenza").map((u) => u.id);
    const isSelected = ids.some((id) => formData.partecipanti.includes(id));

    if (isSelected) {
      setFormData((prev) => ({
        ...prev,
        partecipanti: prev.partecipanti.filter((p) => !ids.includes(p)),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        partecipanti: [...new Set([...prev.partecipanti, ...ids])].filter((id) => id !== prev.utente_id),
      }));
    }
  };

  const handleSelezioneTutti = () => {
    setFormData((prev) => ({
      ...prev,
      partecipanti: utenti.map((u) => u.id).filter((id) => id !== prev.utente_id),
    }));
  };

  const renderEventCard = (evento: EventoGroup, compact = false) => {
    const ownerName = evento.utente ? `${evento.utente.nome} ${evento.utente.cognome}` : "Non assegnato";
    const clienteNome = evento.cliente?.ragione_sociale || "Nessun cliente";
    const styles = getEventClasses(evento);
    const colorClass = styles.card;
    const badges = getEventoBadges(evento);

    return (
      <TooltipProvider key={evento.gruppo_evento}>
        <Tooltip delayDuration={250}>
          <TooltipTrigger asChild>
            <Card
              className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${colorClass}`}
              onClick={() => handleEditEvento(evento)}
            >
              <CardContent className="p-3">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {evento.tutto_giorno
                        ? "Tutto il giorno"
                        : `${evento.ora_inizio ? String(evento.ora_inizio).substring(0, 5) : ""}${
                            evento.ora_fine ? ` - ${String(evento.ora_fine).substring(0, 5)}` : ""
                          }`}
                    </span>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditEvento(evento);
                      }}
                    >
                      <Pencil className="h-4 w-4 text-blue-600" />
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEventoDirect(evento.id, e);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-semibold text-base truncate">{evento.titolo || "(senza titolo)"}</div>

                  {badges.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {badges.map((badge) => (
                        <span
                          key={`${evento.gruppo_evento}-${badge.label}`}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                        >
                          {badge.icon}
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-600" />
                    <span className="font-medium text-sm">{ownerName}</span>
                    {evento.utente?.settore && (
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${getSettoreBadgeClass(
                          evento.utente.settore
                        )}`}
                      >
                        {normalizeSettore(evento.utente.settore)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{getParticipantLabel(evento)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span className="truncate">{clienteNome}</span>
                  </div>

                  {evento.in_sede && evento.sala && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-emerald-600" />
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-medium">
                        {String(evento.sala)}
                      </span>
                    </div>
                  )}

                  {!evento.in_sede && evento.luogo && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-600" />
                      <span className="text-xs text-gray-600 truncate max-w-[240px]">{String(evento.luogo)}</span>
                    </div>
                  )}

                  {!compact && evento.descrizione && (
                    <div className="flex items-center gap-2 text-sm mt-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-muted-foreground truncate">{evento.descrizione}</span>
                    </div>
                  )}

                  {!compact && evento.riunione_teams && evento.link_teams && (
                    <div className="flex items-center gap-2 text-sm mt-2 text-violet-700">
                      <ExternalLink className="h-4 w-4" />
                      <a
                        href={evento.link_teams}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Apri link Teams
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>

          {renderAdvancedTooltip(evento)}
        </Tooltip>
      </TooltipProvider>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { locale: it });
    const endDate = endOfWeek(monthEnd, { locale: it });

    const days: Date[] = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    return (
      <div className="grid grid-cols-7 gap-px bg-gray-200 border rounded-lg overflow-hidden">
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
          <div key={d} className="bg-gray-50 p-2 text-center text-sm font-semibold text-gray-600">
            {d}
          </div>
        ))}

        {days.map((dayItem) => {
          const isCurrentMonth = isSameMonth(dayItem, currentDate);
          const dayEvents = filteredEvents.filter((e) => isSameDay(safeParseISO(e.data_inizio), dayItem));

          return (
            <div
              key={dayItem.toISOString()}
              className={`min-h-[120px] bg-white p-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                !isCurrentMonth ? "text-gray-400 bg-gray-50/50" : ""
              }`}
              onClick={() => handleNuovoEvento(dayItem)}
            >
              <div className="font-semibold text-sm mb-1">{format(dayItem, "d")}</div>

              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((ev) => {
                  const styles = getEventClasses(ev);

                  return (
                    <TooltipProvider key={ev.gruppo_evento}>
                      <Tooltip delayDuration={250}>
                        <TooltipTrigger asChild>
                          <div
                            className={`p-2 rounded border-l-2 ${styles.box} cursor-pointer hover:shadow-sm transition-shadow text-xs group relative`}
                          >
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditEvento(ev);
                              }}
                              className="pr-6"
                            >
                              <div className="truncate font-semibold text-gray-900">
                                {ev.titolo || "(senza titolo)"} {ev.sala ? `(${String(ev.sala)})` : ""}
                              </div>

                              <div className="truncate text-[11px] text-gray-700">
                                👥 {getParticipantLabel(ev)}
                              </div>

                              <div className="truncate text-[11px] text-gray-600">
                                ⏰{" "}
                                {ev.tutto_giorno
                                  ? "Tutto il giorno"
                                  : `${ev.ora_inizio ? String(ev.ora_inizio).substring(0, 5) : ""}${
                                      ev.ora_fine ? ` - ${String(ev.ora_fine).substring(0, 5)}` : ""
                                    }`}
                              </div>
                            </div>

                            <button
                              className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-sm font-bold"
                              onClick={(e) => handleDeleteEventoDirect(ev.id, e)}
                              title="Elimina"
                            >
                              ×
                            </button>
                          </div>
                        </TooltipTrigger>

                        {renderAdvancedTooltip(ev)}
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}

                {dayEvents.length > 3 && (
                  <div
                    className="text-xs text-blue-600 font-medium cursor-pointer hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenMoreEvents(dayItem, dayEvents);
                    }}
                  >
                    +{dayEvents.length - 3} altri
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { locale: it });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const hours = Array.from({ length: 15 }, (_, i) => i + 7);
    const weekGridCols = "grid-cols-[64px_repeat(7,minmax(140px,1fr))]";

    return (
      <div className="border rounded-lg bg-white overflow-hidden h-[calc(100vh-250px)] min-w-[1044px]">
        <div className="overflow-y-auto h-full">
          <div className="sticky top-0 z-20 border-b bg-gray-50">
            <div className={`grid ${weekGridCols}`}>
              <div className="p-3 text-xs font-semibold text-gray-500 text-center border-r border-gray-200 bg-gray-50">
                Ora
              </div>

              {weekDays.map((day, index) => {
                const isWeekend = index === 5 || index === 6;

                return (
                  <div
                    key={day.toISOString()}
                    className={`p-2 text-center border-r border-gray-200 ${
                      isSameDay(day, new Date())
                        ? "bg-blue-50 text-blue-700"
                        : isWeekend
                        ? "bg-gray-100"
                        : "bg-gray-50"
                    }`}
                  >
                    <div className="text-xs font-medium uppercase">{format(day, "EEE", { locale: it })}</div>
                    <div className="text-lg font-bold">{format(day, "d")}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            {hours.map((hour) => (
              <div key={hour} className={`grid ${weekGridCols} min-h-[100px] border-b border-gray-200`}>
                <div className="p-2 text-xs text-gray-400 text-right border-r border-gray-200 font-mono bg-gray-50">
                  {String(hour).padStart(2, "0")}:00
                </div>

                {weekDays.map((day, index) => {
                  const isWeekend = index === 5 || index === 6;

                  const cellEvents = filteredEvents.filter((e) => {
                    const eventDate = safeParseISO(e.data_inizio);

                    if (e.tutto_giorno) return isSameDay(eventDate, day) && hour === 9;
                    if (!e.ora_inizio) return false;

                    const eventHour = parseInt(String(e.ora_inizio).substring(0, 2), 10);
                    return isSameDay(eventDate, day) && eventHour === hour;
                  });

                  return (
                    <div
                      key={`${day.toISOString()}-${hour}`}
                      className={`border-r border-gray-200 p-1 transition-colors cursor-pointer relative ${
                        isWeekend ? "bg-gray-50" : "bg-white"
                      } hover:bg-gray-100`}
                      onClick={() => handleNuovoEvento(day, hour)}
                    >
                      {cellEvents.length > 0 && (
                        <div className="space-y-1">
                          {cellEvents.map((evento) => {
                            const styles = getEventClasses(evento);

                            return (
                              <TooltipProvider key={evento.gruppo_evento}>
                                <Tooltip delayDuration={250}>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={`p-2 rounded border-l-2 ${styles.box} cursor-pointer hover:shadow-sm transition-shadow text-xs group relative`}
                                    >
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditEvento(evento);
                                        }}
                                        className="pr-6"
                                      >
                                        <div className="font-semibold text-gray-900 truncate">
                                          {evento.titolo || "(senza titolo)"}
                                        </div>

                                        <div className="text-gray-600 truncate">👥 {getParticipantLabel(evento)}</div>

                                        {evento.cliente?.ragione_sociale && (
                                          <div className="text-gray-600 truncate">
                                            🏢 {evento.cliente.ragione_sociale}
                                          </div>
                                        )}

                                        {evento.in_sede && evento.sala && (
                                          <div className="text-emerald-700 font-medium mt-1">📍 {String(evento.sala)}</div>
                                        )}

                                        {!evento.in_sede && evento.luogo && (
                                          <div className="text-slate-700 font-medium mt-1 truncate">
                                            📍 {String(evento.luogo)}
                                          </div>
                                        )}

                                        <div className="text-gray-500 mt-1">
                                          ⏰{" "}
                                          {evento.tutto_giorno
                                            ? "Tutto il giorno"
                                            : `${evento.ora_inizio ? String(evento.ora_inizio).substring(0, 5) : ""}${
                                                evento.ora_fine
                                                  ? ` - ${String(evento.ora_fine).substring(0, 5)}`
                                                  : ""
                                              }`}
                                        </div>
                                      </div>

                                      <button
                                        className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-sm font-bold"
                                        onClick={(e) => handleDeleteEventoDirect(evento.id, e)}
                                        title="Elimina evento"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  </TooltipTrigger>

                                  {renderAdvancedTooltip(evento)}
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderListView = () => {
    const now = new Date();
    const pastEvents = filteredEvents.filter((evento) => safeParseISO(evento.data_inizio) < now);

    if (pastEvents.length === 0) {
      return (
        <div className="text-center py-12">
          <CalendarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">Nessun evento scaduto trovato</p>
        </div>
      );
    }

    return <div className="max-h-[600px] overflow-y-auto space-y-3 pr-2">{pastEvents.map((e) => renderEventCard(e, false))}</div>;
  };

  const renderRicorrentiView = () => {
    const now = new Date();
    const ricorrentiEvents = filteredEvents.filter((evento) => {
      const isRecurring = evento.ricorrente === true;
      const eventDate = safeParseISO(evento.data_inizio);
      return isRecurring && eventDate >= now;
    });

    if (ricorrentiEvents.length === 0) {
      return (
        <div className="text-center py-12">
          <CalendarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">Nessun evento ricorrente in essere trovato</p>
        </div>
      );
    }

    return (
      <div className="max-h-[600px] overflow-y-auto space-y-3 pr-2">
        {ricorrentiEvents.map((e) => renderEventCard(e, false))}
      </div>
    );
  };

  const renderTeamsView = () => {
    const loggedUserLabel = loggedUser
      ? `${loggedUser.cognome} ${loggedUser.nome}`
      : "utente loggato";

    if (teamsEvents.length === 0) {
      return (
        <div className="text-center py-12">
          <CalendarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">Nessuna riunione Teams trovata per {loggedUserLabel}</p>
        </div>
      );
    }

    return (
      <div className="max-h-[600px] overflow-y-auto p-4 space-y-4">
        <div className="rounded-lg border bg-violet-50/40 px-4 py-3">
          <div className="text-sm font-semibold text-violet-900">
            Riunioni Teams di {loggedUserLabel}
          </div>
          <div className="text-xs text-violet-700 mt-1">
            Elenco riunioni filtrato automaticamente sull'utente loggato
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr className="border-b">
                <th className="text-left p-3 text-sm font-semibold">Data</th>
                <th className="text-left p-3 text-sm font-semibold">Orario</th>
                <th className="text-left p-3 text-sm font-semibold">Partecipanti</th>
                <th className="text-left p-3 text-sm font-semibold">Descrizione</th>
                <th className="text-left p-3 text-sm font-semibold">Link</th>
              </tr>
            </thead>

            <tbody>
              {teamsEvents.map((evento) => {
                const startDate = safeParseISO(evento.data_inizio);
                const link = String(evento.link_teams || "").trim();

                return (
                  <tr key={evento.gruppo_evento} className="border-b last:border-b-0 hover:bg-violet-50/40">
                    <td className="p-3 text-sm whitespace-nowrap font-medium">
                      {format(startDate, "dd/MM/yyyy", { locale: it })}
                    </td>

                    <td className="p-3 text-sm whitespace-nowrap">
                      {evento.tutto_giorno
                        ? "Tutto il giorno"
                        : `${evento.ora_inizio ? String(evento.ora_inizio).substring(0, 5) : format(startDate, "HH:mm")}${
                            evento.ora_fine ? ` - ${String(evento.ora_fine).substring(0, 5)}` : ""
                          }`}
                    </td>

                    <td className="p-3 text-sm">
                      <div className="font-medium">
                        {evento.participantUsers.map((u) => `${u.cognome} ${u.nome}`).join(", ")}
                      </div>
                      {evento.email_partecipanti_esterni.length > 0 && (
                        <div className="text-muted-foreground text-xs mt-1">
                          Esterni: {evento.email_partecipanti_esterni.join(", ")}
                        </div>
                      )}
                    </td>

                    <td className="p-3 text-sm">
                      <div className="font-medium">{evento.titolo || "Riunione Teams"}</div>
                      {evento.descrizione && (
                        <div className="text-muted-foreground">{String(evento.descrizione)}</div>
                      )}
                    </td>

                    <td className="p-3 text-sm">
                      <Button asChild size="sm" className="bg-violet-700 hover:bg-violet-800">
                        <a href={link} target="_blank" rel="noopener noreferrer">
                          Partecipa alla riunione
                        </a>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="p-10 text-center">Caricamento in corso...</div>;
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-4">
      <div className="hidden md:block">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentDate((prev) => (view === "week" ? subWeeks(prev, 1) : subMonths(prev, 1)))}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <span className="font-bold px-4 min-w-[150px] text-center">
                {format(currentDate, view === "week" ? "'Settimana' w - MMM yyyy" : "MMMM yyyy", {
                  locale: it,
                })}
              </span>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentDate((prev) => (view === "week" ? addWeeks(prev, 1) : addMonths(prev, 1)))}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <Button onClick={() => handleNuovoEvento()} className="gap-2">
              <Plus className="h-4 w-4" /> Nuovo Evento
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[220px] justify-between">
                    {filtroUtenti.length === 0 ? "Tutti gli utenti" : `${filtroUtenti.length} selezionati`}
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-[260px] p-2">
                  <div
                    className="flex items-center gap-2 px-2 py-2 rounded hover:bg-muted cursor-pointer"
                    onClick={() => setFiltroUtenti([])}
                  >
                    <Checkbox checked={filtroUtenti.length === 0} />
                    <span>Tutti gli utenti</span>
                  </div>

                  <div className="my-2 border-t" />

                  <div className="max-h-[260px] overflow-auto">
                    {utenti.map((u) => {
                      const checked = filtroUtenti.includes(u.id);

                      return (
                        <div
                          key={u.id}
                          className="flex items-center gap-2 px-2 py-2 rounded hover:bg-muted cursor-pointer"
                          onClick={() => {
                            setFiltroUtenti((prev) =>
                              prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                            );
                          }}
                        >
                          <Checkbox checked={checked} />
                          <span>
                            {u.cognome} {u.nome}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
              <div className="flex gap-2">
                <Button
                  variant={view === "ricorrenti" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setView("ricorrenti")}
                >
                  <List className="h-4 w-4 mr-2" /> Eventi ricorrenti
                </Button>

                <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}>
                  <List className="h-4 w-4 mr-2" /> Scaduti
                </Button>

                <Button variant={view === "teams" ? "default" : "outline"} size="sm" onClick={() => setView("teams")}>
                  <CalendarIcon className="h-4 w-4 mr-2" /> Riunioni Teams
                </Button>

                <Button variant={view === "month" ? "default" : "outline"} size="sm" onClick={() => setView("month")}>
                  <CalendarIcon className="h-4 w-4 mr-2" /> Mese
                </Button>

                <Button variant={view === "week" ? "default" : "outline"} size="sm" onClick={() => setView("week")}>
                  <CalendarDays className="h-4 w-4 mr-2" /> Settimana
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          {view === "ricorrenti" && renderRicorrentiView()}
          {view === "list" && renderListView()}
          {view === "teams" && renderTeamsView()}
          {view === "month" && renderMonthView()}
          {view === "week" && renderWeekView()}
        </div>
      </div>

      <div className="md:hidden space-y-3 px-1">
        <div className="bg-white p-3 rounded-lg shadow-sm border space-y-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setCurrentDate((prev) => (view === "week" ? subWeeks(prev, 1) : subMonths(prev, 1)))
              }
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <div className="text-center">
              <div className="text-sm text-muted-foreground">Agenda</div>
              <div className="font-bold">{format(currentDate, "EEEE d MMMM yyyy", { locale: it })}</div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setCurrentDate((prev) => (view === "week" ? addWeeks(prev, 1) : addMonths(prev, 1)))
              }
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <Button onClick={() => handleNuovoEvento()} className="w-full gap-2">
            <Plus className="h-4 w-4" /> Nuovo Evento
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={view === "week" ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs px-2"
              onClick={() => setView("week")}
            >
              Settimana
            </Button>

            <Button
              variant={view === "month" ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs px-2"
              onClick={() => setView("month")}
            >
              Mese
            </Button>

            <Button
              variant={view === "list" ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs px-2"
              onClick={() => setView("list")}
            >
              Scaduti
            </Button>

            <Button
              variant={view === "ricorrenti" ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs px-2"
              onClick={() => setView("ricorrenti")}
            >
              Ricorrenti
            </Button>

            <Button
              variant={view === "teams" ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs px-2 col-span-2"
              onClick={() => setView("teams")}
            >
              Riunioni Teams
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-3">
          {view === "ricorrenti" && renderRicorrentiView()}
          {view === "list" && renderListView()}
          {view === "teams" && renderTeamsView()}

          {view === "month" && (
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">{renderMonthView()}</div>
            </div>
          )}

          {view === "week" && (
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">{renderWeekView()}</div>
            </div>
          )}

          {view === "week" && (
            <>
              {filteredEvents
                .filter((e) => isSameDay(safeParseISO(e.data_inizio), currentDate))
                .sort((a, b) => {
                  const aTime = String(a.ora_inizio || "00:00");
                  const bTime = String(b.ora_inizio || "00:00");
                  return aTime.localeCompare(bTime);
                })
                .map((e) => renderEventCard(e, false))}

              {filteredEvents.filter((e) => isSameDay(safeParseISO(e.data_inizio), currentDate)).length === 0 && (
                <div className="text-center py-10 text-gray-500">Nessun evento per questo giorno</div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEventoId ? "Modifica Evento Gruppo" : "Nuovo Evento"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Titolo Evento *</Label>
              <Input
                value={formData.titolo}
                onChange={(e) => setFormData({ ...formData, titolo: e.target.value })}
                placeholder="Es. Riunione Cliente"
              />
            </div>

            <div className="space-y-3 border p-3 rounded-md bg-blue-50">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ricorrente"
                  checked={formData.ricorrente}
                  onCheckedChange={(c: CheckedState) => setFormData({ ...formData, ricorrente: toBool(c) })}
                />
                <Label htmlFor="ricorrente" className="font-semibold">
                  Evento ricorrente
                </Label>
              </div>

              {formData.ricorrente && (
                <div className="ml-6 space-y-3">
                  <div>
                    <Label htmlFor="frequenza">Frequenza (giorni) *</Label>
                    <Input
                      id="frequenza"
                      type="number"
                      min="1"
                      value={formData.frequenza_giorni}
                      onChange={(e) =>
                        setFormData({ ...formData, frequenza_giorni: parseInt(e.target.value, 10) || 1 })
                      }
                      placeholder="Es. 7 per settimanale"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Numero di giorni tra un evento e il successivo
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="durata">Durata (giorni) *</Label>
                    <Input
                      id="durata"
                      type="number"
                      min="1"
                      value={formData.durata_giorni}
                      onChange={(e) =>
                        setFormData({ ...formData, durata_giorni: parseInt(e.target.value, 10) || 1 })
                      }
                      placeholder="Es. 180 per 6 mesi"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Durata complessiva della ricorrenza in giorni dalla data inizio
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Inizio</Label>
                <Input type="date" value={formData.data_inizio} onChange={(e) => handleDataInizioChange(e.target.value)} />
              </div>

              <div>
                <Label>Ora Inizio</Label>
                <Input
                  type="time"
                  disabled={formData.tutto_giorno}
                  value={formData.ora_inizio}
                  onChange={(e) => handleOraInizioChange(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Fine</Label>
                <Input
                  type="date"
                  disabled={formData.ricorrente}
                  value={formData.data_fine}
                  onChange={(e) => setFormData({ ...formData, data_fine: e.target.value })}
                />
                {formData.ricorrente && (
                  <p className="text-xs text-muted-foreground mt-1">Calcolata automaticamente dalla durata</p>
                )}
              </div>

              <div>
                <Label>Ora Fine</Label>
                <Input
                  type="time"
                  disabled={formData.tutto_giorno}
                  value={formData.ora_fine}
                  onChange={(e) => setFormData({ ...formData, ora_fine: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="allday"
                checked={formData.tutto_giorno}
                onCheckedChange={(c: CheckedState) => setFormData({ ...formData, tutto_giorno: toBool(c) })}
              />
              <Label htmlFor="allday">Tutto il giorno</Label>
            </div>

            <div>
              <Label>Utente principale / organizzatore *</Label>
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

            {!formData.evento_generico && (
              <div>
                <Label>Cliente</Label>
                <Select value={formData.cliente_id} onValueChange={(v) => setFormData({ ...formData, cliente_id: v })}>
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

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="evento_generico"
                  checked={formData.evento_generico}
                  onCheckedChange={(c: CheckedState) =>
                    setFormData({
                      ...formData,
                      evento_generico: toBool(c),
                      cliente_id: toBool(c) ? "" : formData.cliente_id,
                    })
                  }
                />
                <Label htmlFor="evento_generico">Evento Generico (No Cliente)</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="in_sede"
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
                <Label htmlFor="in_sede">In Sede</Label>
              </div>

              {formData.in_sede && (
                <div>
                  <Label>Sala</Label>
                  <Select value={formData.sala} onValueChange={(v) => setFormData({ ...formData, sala: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona Sala" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A - Sala riunioni">A - Sala riunioni</SelectItem>
                      <SelectItem value="B - Sala Briefing">B - Sala Briefing</SelectItem>
                      <SelectItem value="C - Stanza personale">C - Stanza personale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!formData.in_sede && (
                <div>
                  <Label>Luogo / Indirizzo</Label>
                  <Input
                    value={formData.luogo}
                    onChange={(e) => setFormData({ ...formData, luogo: e.target.value })}
                    placeholder="Es. Via Roma 10, Milano"
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="riunione_teams"
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
                <Label htmlFor="riunione_teams">Riunione Teams</Label>
              </div>

              {formData.riunione_teams && (
                <div className="space-y-3 border rounded-md p-3 bg-violet-50/40">
                  <div>
                    <Label>Link Teams</Label>
                    <Input
                      value={formData.link_teams}
                      onChange={(e) => setFormData({ ...formData, link_teams: e.target.value })}
                      placeholder="https://teams.microsoft.com/... (se vuoto viene generato automaticamente)"
                    />
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-sm font-medium">Email aggiuntive da contatti</p>
                      <p className="text-xs text-muted-foreground">
                        Seleziona contatti esterni da invitare via email/link
                      </p>
                    </div>

                    <Button type="button" variant="outline" onClick={() => setContactDialogOpen(true)}>
                      <Mail className="h-4 w-4 mr-2" />
                      Seleziona da contatti
                    </Button>
                  </div>

                  {formData.email_partecipanti_esterni.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.email_partecipanti_esterni.map((email) => (
                        <div
                          key={email}
                          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border text-sm"
                        >
                          <span>{email}</span>
                          <button
                            type="button"
                            className="text-red-600 hover:text-red-700"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                email_partecipanti_esterni: prev.email_partecipanti_esterni.filter((e) => e !== email),
                              }))
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label className="mb-2 block">Partecipanti interni</Label>

              <div className="relative mb-2">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca partecipante..."
                  value={searchPartecipanti}
                  onChange={(e) => setSearchPartecipanti(e.target.value)}
                  className="pl-8"
                />
              </div>

              <div className="flex gap-2 mb-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={() => handleSelezioneSettore("Lavoro")}>
                  Settore Lavoro
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => handleSelezioneSettore("Fiscale")}>
                  Settore Fiscale
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleSelezioneConsulenza}>
                  Settore Consulenza
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleSelezioneTutti}>
                  Tutti
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData({ ...formData, partecipanti: [] })}
                >
                  Deseleziona Tutti
                </Button>
              </div>

              <ScrollArea className="h-[150px] border rounded p-2">
                {utenti
                  .filter((u) => {
                    const search = searchPartecipanti.toLowerCase();
                    const fullName = `${u.cognome} ${u.nome}`.toLowerCase();
                    const sector = u.settore ? u.settore.toLowerCase() : "";
                    return fullName.includes(search) || sector.includes(search);
                  })
                  .map((u) => (
                    <div key={u.id} className="flex items-center space-x-2 mb-1">
                      <Checkbox
                        checked={formData.utente_id === u.id || formData.partecipanti.includes(u.id)}
                        onCheckedChange={(checked: CheckedState) => {
                          const isChecked = toBool(checked);

                          if (u.id === formData.utente_id) {
                            return;
                          }

                          const newPart = isChecked
                            ? [...formData.partecipanti, u.id]
                            : formData.partecipanti.filter((id) => id !== u.id);

                          setFormData({ ...formData, partecipanti: [...new Set(newPart)] });
                        }}
                      />
                      <span className="text-sm">
                        {u.cognome} {u.nome} {u.settore && `(${u.settore})`}
                        {u.id === formData.utente_id ? " - organizzatore" : ""}
                      </span>
                    </div>
                  ))}
              </ScrollArea>
            </div>

            <div>
              <Label>Descrizione</Label>
              <Textarea
                value={formData.descrizione}
                onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center">
            {editingEventoId ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setDialogOpen(false);
                  setEventoToDelete(editingEventoId);
                  setDeleteDialogOpen(true);
                }}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Elimina Gruppo Evento
              </Button>
            ) : (
              <div className="mr-auto" />
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

              <Button type="submit" onClick={handleSaveEvento} disabled={savingEvento}>
  {savingEvento
    ? "Salvataggio..."
    : editingEventoId
    ? "Aggiorna Evento"
    : "Crea Evento"}
</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Seleziona email dai contatti</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca nome o email..."
                value={searchContatti}
                onChange={(e) => setSearchContatti(e.target.value)}
                className="pl-8"
              />
            </div>

            <ScrollArea className="h-[320px] border rounded p-2">
              {filteredContactOptions.length === 0 ? (
                <div className="text-sm text-muted-foreground p-2">Nessun contatto trovato</div>
              ) : (
                filteredContactOptions.map((contact) => {
                  const checked = formData.email_partecipanti_esterni.includes(contact.email);

                  return (
                    <div key={contact.id} className="flex items-start gap-3 py-2 border-b last:border-b-0">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c: CheckedState) => handleToggleExternalEmail(contact.email, c)}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          {contact.cognome} {contact.nome}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">{contact.email}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setContactDialogOpen(false)}>
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moreEventsOpen} onOpenChange={setMoreEventsOpen}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Eventi del {moreEventsDate ? format(moreEventsDate as Date, "dd MMMM yyyy", { locale: it }) : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto space-y-3 py-2">
            {moreEventsList.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nessun evento trovato</div>
            ) : (
              moreEventsList
                .slice()
                .sort((a, b) => {
                  const aTime = String(a.ora_inizio || "00:00");
                  const bTime = String(b.ora_inizio || "00:00");
                  return aTime.localeCompare(bTime);
                })
                .map((evento) => {
                  const badges = getEventoBadges(evento);

                  return (
                    <div
                      key={evento.gruppo_evento}
                      className="rounded-lg border p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setMoreEventsOpen(false);
                        handleEditEvento(evento);
                      }}
                    >
                      <div className="font-semibold text-sm">{evento.titolo || "(senza titolo)"}</div>

                      {badges.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {badges.map((badge) => (
                            <span
                              key={`${evento.gruppo_evento}-${badge.label}`}
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                            >
                              {badge.icon}
                              {badge.label}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="text-xs text-gray-600 mt-2">
                        ⏰{" "}
                        {evento.tutto_giorno
                          ? "Tutto il giorno"
                          : `${evento.ora_inizio ? String(evento.ora_inizio).substring(0, 5) : ""}${
                              evento.ora_fine ? ` - ${String(evento.ora_fine).substring(0, 5)}` : ""
                            }`}
                      </div>

                      <div className="text-xs text-gray-700 mt-1">👥 {getParticipantLabel(evento)}</div>

                      {evento.cliente?.ragione_sociale && (
                        <div className="text-xs text-gray-700 mt-1">🏢 {evento.cliente.ragione_sociale}</div>
                      )}

                      {evento.in_sede && evento.sala && (
                        <div className="text-xs text-emerald-700 mt-1">📍 {String(evento.sala)}</div>
                      )}

                      {!evento.in_sede && evento.luogo && (
                        <div className="text-xs text-slate-700 mt-1">📍 {String(evento.luogo)}</div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina Evento</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro? Verrà eliminato l&apos;intero gruppo evento per tutti i partecipanti.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEvento} className="bg-red-600">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
</AlertDialog>
</div>
);
}
