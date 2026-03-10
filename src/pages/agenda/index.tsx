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

// --------------------
// TIPI
// --------------------

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
};

// Estendo la row agenda con le relazioni e campi ricorrenza usati nel file
type AgendaRow = Database["public"]["Tables"]["tbagenda"]["Row"];

type EventoWithRelations = Omit<AgendaRow, "cliente_id" | "utente_id"> & {
  cliente_id: string | null;
  utente_id: string;

  cliente: ClienteBase | null;
  utente: UtenteBase | null;

  // campi usati nel file (se non sono presenti in Row, restano opzionali)
  ricorrente?: boolean | null;
  frequenza_giorni?: number | null;
  durata_giorni?: number | null;

  // partecipanti potrebbe essere json/array: lo usiamo come array di string
  partecipanti?: unknown;
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
  ricorrente: boolean;
  frequenza_giorni: number;
  durata_giorni: number;
};

// --------------------
// HELPERS
// --------------------

const toNotificationPayload = (e: Record<string, unknown>) => ({
  ...e,
  durata_giorni: (e as any)?.durata_giorni ?? null,
  evento_generico: (e as any)?.evento_generico ?? null,
  frequenza_giorni: (e as any)?.frequenza_giorni ?? null,
  link_teams: (e as any)?.link_teams ?? null,

  frequenza_settimane: (e as any)?.frequenza_settimane ?? null,
  frequenza_mesi: (e as any)?.frequenza_mesi ?? null,
  giorno_mese: (e as any)?.giorno_mese ?? null,
  giorni_settimana: (e as any)?.giorni_settimana ?? null,
  ricorrenza_fine: (e as any)?.ricorrenza_fine ?? null,
  ricorrenza_count: (e as any)?.ricorrenza_count ?? null,
  outlook_event_id: (e as any)?.outlook_event_id ?? null,
});

// Helper per orari: se arriva già "HH:mm" la restituisce; altrimenti formatta in Europe/Rome
const formatTimeWithTimezone = (value: string): string => {
  if (/^\d{2}:\d{2}$/.test(value)) return value;

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "00:00";
    return date.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Rome",
    });
  } catch {
    return "00:00";
  }
};

const safeParseISO = (value: string | null | undefined): Date => {
  if (!value) return new Date();
  try {
    return parseISO(value);
  } catch {
    return new Date();
  }
};

const toBool = (c: CheckedState) => c === true;

// --------------------
// COMPONENT
// --------------------

export default function AgendaPage() {
  const { toast } = useToast();

  // Stati principali
  const [eventi, setEventi] = useState<EventoWithRelations[]>([]);
  const [clienti, setClienti] = useState<ClienteAgenda[]>([]);
  const [utenti, setUtenti] = useState<UtenteAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Stati UI
  const [view, setView] = useState<"list" | "month" | "week" | "ricorrenti">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filtroUtenti, setFiltroUtenti] = useState<string[]>([]);

  // Stati dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventoToDelete, setEventoToDelete] = useState<string | null>(null);
  const [editingEventoId, setEditingEventoId] = useState<string | null>(null);

  // Stato per ricerca partecipanti
  const [searchPartecipanti, setSearchPartecipanti] = useState("");

  // Stati form
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
    ricorrente: false,
    frequenza_giorni: 7,
    durata_giorni: 180,
  });

    // stato popup eventi multipli
    const [moreEventsOpen, setMoreEventsOpen] = useState(false);
    const [moreEventsDate, setMoreEventsDate] = useState<Date | null>(null);
    const [moreEventsList, setMoreEventsList] = useState<EventoWithRelations[]>([]);
  
  // --------------------
  // LOAD DATA
  // --------------------

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    const supabase = getSupabaseClient();

    try {
      setLoading(true);

      // Carica utente corrente
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.email) {
        const { data: userData, error: userErr } = await supabase
          .from("tbutenti")
          .select("id")
          .eq("email", session.user.email)
          .single();

        if (!userErr && userData?.id) setCurrentUserId(userData.id);
      }

      // Carica eventi (con relazioni)
      const { data: eventiData, error: eventiError } = await supabase
        .from("tbagenda")
        .select(
          `
          *,
          cliente:cliente_id(id, ragione_sociale, codice_fiscale, partita_iva),
          utente:utente_id(id, nome, cognome, email, settore)
        `
        )
        .order("data_inizio", { ascending: true });

      if (eventiError) throw eventiError;

      setEventi(((eventiData ?? []) as unknown) as EventoWithRelations[]);

      // Carica clienti
      const { data: clientiData, error: clientiError } = await supabase
        .from("tbclienti")
        .select("*")
        .eq("attivo", true)
        .order("ragione_sociale");

      if (clientiError) throw clientiError;
      setClienti(((clientiData ?? []) as unknown) as ClienteAgenda[]);

      // Carica utenti
      const { data: utentiData, error: utentiError } = await supabase
        .from("tbutenti")
        .select(
          `
          id,
          nome,
          cognome,
          email,
          settore,
          tipo_utente,
          ruolo_operatore_id,
          attivo,
          created_at,
          updated_at
        `
        )
        .eq("attivo", true)
        .order("cognome", { ascending: true });

      if (utentiError) throw utentiError;
      setUtenti(((utentiData ?? []) as unknown) as UtenteAgenda[]);
    } catch (error) {
      console.error("Errore caricamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // --------------------
  // FORM
  // --------------------

  const resetForm = () => {
    setEditingEventoId(null);
    setSearchPartecipanti("");
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
        endHour = `${String(hour + 1).padStart(2, "0")}:00`;
      }

      setFormData((prev) => ({
        ...prev,
        data_inizio: dateStr,
        data_fine: dateStr,
        ora_inizio: startHour,
        ora_fine: endHour,
      }));
    }

    setDialogOpen(true);
  };

  const handleEditEvento = (evento: EventoWithRelations) => {
    const startDate = safeParseISO(evento.data_inizio as any);
    const endDate = safeParseISO(evento.data_fine as any);

    let partecipanti: string[] = [];
    if (Array.isArray(evento.partecipanti)) {
      partecipanti = evento.partecipanti.map((p) => String(p));
    }

    setEditingEventoId(String(evento.id));
    setSearchPartecipanti("");

    setFormData({
      titolo: evento.titolo ?? "",
      descrizione: (evento.descrizione as string) || "",
      data_inizio: format(startDate, "yyyy-MM-dd"),
      ora_inizio: evento.ora_inizio ? String(evento.ora_inizio).substring(0, 5) : "09:00",
      data_fine: format(endDate, "yyyy-MM-dd"),
      ora_fine: evento.ora_fine ? String(evento.ora_fine).substring(0, 5) : "10:00",
      tutto_giorno: Boolean(evento.tutto_giorno),
      cliente_id: evento.cliente_id || "",
      utente_id: evento.utente_id,
      in_sede: Boolean(evento.in_sede),
      sala: evento.in_sede ? (evento.sala ? String(evento.sala) : "") : "",
      luogo: !evento.in_sede ? (evento.luogo ? String(evento.luogo) : "") : "",
      evento_generico: Boolean((evento as any).evento_generico),
      riunione_teams: Boolean((evento as any).riunione_teams),
      link_teams: ((evento as any).link_teams as string) || "",
      partecipanti,
      ricorrente: Boolean((evento as any).ricorrente),
      frequenza_giorni: Number((evento as any).frequenza_giorni ?? 7),
      durata_giorni: Number((evento as any).durata_giorni ?? 180),
    });

    setDialogOpen(true);
  };

  const handleSaveEvento = async () => {
    const supabase = getSupabaseClient();

    try {
      // --------------------
      // VALIDAZIONI BASE
      // --------------------
      if (!formData.titolo.trim()) {
        toast({ title: "Errore", description: "Titolo obbligatorio", variant: "destructive" });
        return;
      }
      if (!formData.utente_id) {
        toast({ title: "Errore", description: "Seleziona un utente", variant: "destructive" });
        return;
      }

      // Validazione eventi ricorrenti
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

      // ===============================
      // DATE EVENTO (UNICA DEFINIZIONE)
      // ===============================
      const startDateTimeISO = formData.tutto_giorno
        ? new Date(formData.data_inizio).toISOString()
        : new Date(`${formData.data_inizio}T${formData.ora_inizio}`).toISOString();

      const endDateTimeISO = formData.tutto_giorno
        ? new Date(formData.data_fine || formData.data_inizio).toISOString()
        : new Date(`${formData.data_fine || formData.data_inizio}T${formData.ora_fine}`).toISOString();

// =========================
// TEAMS (UNICO BLOCCO) ✅  — senza currentStudioId
// =========================
let teamsLink = formData.link_teams || "";
let teamsJoinUrl: string | null = null;
let teamsMeetingId: string | null = null;

if (formData.riunione_teams) {
  // 1) Se l’utente ha incollato un link manuale, lo validiamo e basta
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
  } else {
    // 2) Link vuoto -> creiamo meeting via M365 usando studioId + utente loggato (token owner)

    if (!currentUserId) {
      toast({
        title: "⚠️ Errore Autenticazione",
        description: "Impossibile identificare l'utente loggato. Ricarica la pagina.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    const supabase = getSupabaseClient();

    // ✅ studioId ricavato dal DB (tbutenti) usando l'utente loggato
    const { data: uRow, error: uErr } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", currentUserId)
      .maybeSingle();

    if (uErr || !uRow?.studio_id) {
      toast({
        title: "Errore",
        description: "Impossibile determinare lo studio dell'utente loggato.",
        variant: "destructive",
      });
      return;
    }

    const studioId = uRow.studio_id as string;

    // (opzionale) check session supabase per chiamare /api/microsoft365/status se il tuo endpoint lo richiede
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

    // status con Bearer token (il tuo endpoint lo richiede)
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

    // date ISO usate per meeting
    const startDateTimeISO = formData.tutto_giorno
      ? new Date(formData.data_inizio).toISOString()
      : new Date(`${formData.data_inizio}T${formData.ora_inizio}`).toISOString();

    const endDateTimeISO = formData.tutto_giorno
      ? new Date(formData.data_fine || formData.data_inizio).toISOString()
      : new Date(`${formData.data_fine || formData.data_inizio}T${formData.ora_fine}`).toISOString();

    const { teamsService } = await import("@/services/teamsService");

    // ✅ createTeamsMeeting(studioId, userId, ...)
    const meeting = await teamsService.createTeamsMeeting(
      studioId,
      currentUserId,
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
    teamsMeetingId = meeting.id ?? null;

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
}
      // ===============================
      // PAYLOAD BASE
      // ===============================
      const basePayload: Partial<AgendaRow> & Record<string, unknown> = {
        titolo: formData.titolo,
        descrizione: formData.descrizione || null,

        data_inizio: startDateTimeISO,
        data_fine: endDateTimeISO,
        ora_inizio: formData.tutto_giorno ? null : (formData.ora_inizio as any),
        ora_fine: formData.tutto_giorno ? null : (formData.ora_fine as any),
        tutto_giorno: formData.tutto_giorno as any,

        cliente_id: formData.cliente_id || null,
        utente_id: formData.utente_id as any,

        in_sede: formData.in_sede as any,
        sala: formData.in_sede ? formData.sala : null,
        luogo: !formData.in_sede ? formData.luogo : null,

        evento_generico: formData.evento_generico,
        riunione_teams: formData.riunione_teams,
        link_teams: teamsLink || null,

        partecipanti: formData.partecipanti.length ? formData.partecipanti : null,

        ricorrente: formData.ricorrente,
        frequenza_giorni: formData.ricorrente ? formData.frequenza_giorni : null,
       
      };

      if (editingEventoId) {
        // UPDATE
        const { data, error } = await supabase
          .from("tbagenda")
          .update(basePayload as any)
          .eq("id", editingEventoId)
          .select()
          .single();

        if (error) throw error;

        const { eventoService } = await import("@/services/eventoService");
        await eventoService.sendEventNotification(toNotificationPayload(data as any) as any);

        // Sync Outlook (non bloccare)
        try {
          await calendarSyncService.syncEventToOutlook(formData.utente_id, editingEventoId);
        } catch (syncError) {
          console.error("Errore sincronizzazione Outlook:", syncError);
        }

        toast({ title: "Successo", description: "Evento aggiornato" });
      } else {
        // CREATE
        if (formData.ricorrente) {
          const startDate = new Date(formData.data_inizio);
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + formData.durata_giorni);

          const occurrences: Array<Record<string, unknown>> = [];
          let current = new Date(startDate);

          while (current <= endDate) {
            const occurrenceStartDateTime = formData.tutto_giorno
              ? `${format(current, "yyyy-MM-dd")}T00:00:00+00:00`
              : `${format(current, "yyyy-MM-dd")}T${formData.ora_inizio}:00+00:00`;

            const occurrenceEndDateTime = formData.tutto_giorno
              ? `${format(current, "yyyy-MM-dd")}T23:59:59+00:00`
              : `${format(current, "yyyy-MM-dd")}T${formData.ora_fine}:00+00:00`;

            occurrences.push({
              ...basePayload,
              data_inizio: occurrenceStartDateTime,
              data_fine: occurrenceEndDateTime,

            });

            current = new Date(current);
            current.setDate(current.getDate() + formData.frequenza_giorni);
          }

          const { data, error } = await supabase.from("tbagenda").insert(occurrences as any).select();
          if (error) throw error;

          const { eventoService } = await import("@/services/eventoService");
          for (const occurrence of data ?? []) {
            await eventoService.sendEventNotification(toNotificationPayload(occurrence as any) as any);
          }

          // Sync Outlook (non bloccare)
          try {
            for (const occurrence of data ?? []) {
              await calendarSyncService.syncEventToOutlook(formData.utente_id, String((occurrence as any).id));
            }
          } catch (syncError) {
            console.error("Errore sincronizzazione Outlook eventi ricorrenti:", syncError);
          }

          toast({
            title: "Successo",
            description: `${occurrences.length} eventi ricorrenti creati`,
          });

        } else {
          const { data, error } = await supabase.from("tbagenda").insert([basePayload as any]).select().single();
          if (error) throw error;

          const { eventoService } = await import("@/services/eventoService");
          await eventoService.sendEventNotification(toNotificationPayload(data as any) as any);

          // Sync Outlook (non bloccare)
          try {
            await calendarSyncService.syncEventToOutlook(formData.utente_id, String((data as any).id));
          } catch (syncError) {
            console.error("Errore sincronizzazione Outlook:", syncError);
          }

          // Notifica Teams ai partecipanti
if (formData.riunione_teams && teamsLink) {
  try {
    const supabase = getSupabaseClient();

    // sender = utente loggato (token owner M365)
    if (!currentUserId) {
      console.error("Errore invio notifiche Teams: currentUserId mancante.");
    } else {
      // studioId dallo user loggato
      const { data: uRow, error: uErr } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", currentUserId)
        .maybeSingle();

      if (uErr || !uRow?.studio_id) {
        console.error("Errore invio notifiche Teams: studioId non trovato.", uErr);
      } else {
        const studioId = uRow.studio_id as string;

        const { teamsService } = await import("@/services/teamsService");
        for (const pId of formData.partecipanti) {
          const user = utenti.find((u) => u.id === pId);
          if (user?.email) {
            const dmRes = await teamsService.sendDirectMessage(
              studioId,
              currentUserId,
              user.email,
              {
                content: `<strong>Nuova riunione Teams:</strong> ${formData.titolo}<br><br>📅 ${formData.data_inizio} alle ${formData.ora_inizio}<br><br><a href="${teamsLink}">Clicca qui per partecipare</a>`,
                contentType: "html",
              }
            );

            if (!dmRes?.success) {
              console.error("Errore invio DM Teams:", (dmRes as any)?.error);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Errore invio notifiche Teams:", err);
  }
}

toast({ title: "Successo", description: "Evento creato" });
}
}

setDialogOpen(false);
void loadData();
} catch (error) {
console.error(error);
toast({ title: "Errore", description: "Salvataggio fallito", variant: "destructive" });
}
};
const handleDeleteEvento = async () => {
const supabase = getSupabaseClient();
if (!eventoToDelete) return;

try {
// Cancella da Outlook prima del DB (non bloccare)
if (currentUserId) {
  try {
    await calendarSyncService.deleteEventFromOutlook(currentUserId, eventoToDelete);
  } catch (syncError) {
    console.error("Errore cancellazione Outlook:", syncError);
  }
}

const { error } = await supabase.from("tbagenda").delete().eq("id", eventoToDelete);
if (error) throw error;

setEventi((prev) => prev.filter((e) => String(e.id) !== eventoToDelete));
setDeleteDialogOpen(false);
setDialogOpen(false);
setEventoToDelete(null);
setEditingEventoId(null);

toast({
  title: "Evento eliminato",
  description: "L'evento è stato eliminato con successo",
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

  const handleDeleteEventoDirect = (eventoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEventoToDelete(eventoId);
    setDeleteDialogOpen(true);
  };

  // --------------------
  // UTILITIES
  // --------------------

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
        partecipanti: [...new Set([...prev.partecipanti, ...ids])],
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
        partecipanti: [...new Set([...prev.partecipanti, ...ids])],
      }));
    }
  };

  const handleSelezioneTutti = () => {
    setFormData((prev) => ({ ...prev, partecipanti: utenti.map((u) => u.id) }));
  };

  const getEventColor = (evento: EventoWithRelations) => {
    if ((evento as any).evento_generico) return "#3B82F6";
    if (evento.in_sede) return "#10B981";
    if ((evento as any).riunione_teams) return "#F97316";
    return "#EF4444";
  };

  const getEventoSummary = (evento: EventoWithRelations): string => {
    const startDate = safeParseISO(evento.data_inizio as any);

    const utenteNome = evento.utente
      ? `${evento.utente.nome} ${evento.utente.cognome}${evento.utente.settore ? ` (${evento.utente.settore})` : ""}`
      : "Non assegnato";

    const clienteNome = evento.cliente?.ragione_sociale || "Nessun cliente";

    const luogo = evento.in_sede
      ? `Sala ${evento.sala ? String(evento.sala) : "??"} (In Sede)`
      : (evento.luogo ? String(evento.luogo) : "Fuori Sede");

    const tipo = (evento as any).evento_generico
      ? "Evento Generico"
      : (evento as any).riunione_teams
      ? "Riunione Teams"
      : "Appuntamento";

   const oraInizio = evento.ora_inizio ? String(evento.ora_inizio).substring(0, 5) : "";
const oraFine = evento.ora_fine ? String(evento.ora_fine).substring(0, 5) : "";

    let summary = `📝 ${evento.titolo || "Senza titolo"}\n\n`;
    summary += `📅 ${format(startDate, "dd MMMM yyyy", { locale: it })}\n`;
    summary += `⏰ ${oraInizio} - ${oraFine}\n\n`;
    summary += `👤 Assegnato a: ${utenteNome}\n\n`;
    summary += `🏢 Cliente: ${clienteNome}\n\n`;
    summary += `📍 Luogo: ${luogo}\n\n`;
    summary += `🔵 Tipo: ${tipo}\n`;

    if ((evento as any).riunione_teams) {
      summary += `💻 Riunione Teams: Sì\n`;
      if ((evento as any).link_teams) summary += `🔗 Link: ${(evento as any).link_teams}\n`;
    }

    if (evento.descrizione) {
      summary += `\n📝 Note:\n${String(evento.descrizione)}`;
    }

    return summary;
      };

  const filteredEvents = useMemo(() => {
    return eventi.filter((e) => filtroUtenti.length === 0 || filtroUtenti.includes(e.utente_id));
      }, [eventi, filtroUtenti]);

  const handleOpenMoreEvents = (date: Date, events: EventoWithRelations[]) => {
  setMoreEventsDate(date);
  setMoreEventsList(events);
  setMoreEventsOpen(true);
    };
  
  // --------------------
  // RENDERERS
  // --------------------

  const renderEventCard = (evento: EventoWithRelations, compact = false) => {
    const utenteNome = evento.utente ? `${evento.utente.nome} ${evento.utente.cognome}` : "Non assegnato";
    const clienteNome = evento.cliente?.ragione_sociale || "Nessun cliente";
    const colorClass = (evento as any).evento_generico
      ? "border-l-blue-500"
      : evento.in_sede
      ? "border-l-green-500"
      : "border-l-red-500";

    return (
      <TooltipProvider key={String(evento.id)}>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Card
              className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${colorClass}`}
              onClick={() => handleEditEvento(evento)}
            >
              <CardContent className="p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                     {evento.ora_inizio && String(evento.ora_inizio).substring(0, 5)}
                      {evento.ora_fine && ` - ${String(evento.ora_fine).substring(0, 5)}`}
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
                        handleDeleteEventoDirect(String(evento.id), e);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold text-base">{utenteNome}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span>{clienteNome}</span>
                  </div>

                  {evento.in_sede && evento.sala && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-green-600" />
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                        SALA {String(evento.sala)}
                      </span>
                    </div>
                  )}

                  {!evento.in_sede && evento.luogo && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-red-600" />
                      <span className="text-xs text-gray-600 truncate max-w-[200px]">{String(evento.luogo)}</span>
                    </div>
                  )}

                  {!compact && evento.titolo && (
                    <div className="flex items-center gap-2 text-sm mt-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-muted-foreground">{evento.titolo}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>

          <TooltipContent side="right" className="max-w-sm p-4 text-sm whitespace-pre-line">
            {getEventoSummary(evento)}
          </TooltipContent>
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
          const dayEvents = filteredEvents.filter((e) => isSameDay(safeParseISO(e.data_inizio as any), dayItem));

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
                {dayEvents.slice(0, 3).map((ev) => (
                  <TooltipProvider key={String(ev.id)}>
  <Tooltip delayDuration={300}>
    <TooltipTrigger asChild>
      <div
  className={`p-2 rounded border-l-2 ${
  (ev as any).evento_generico
    ? "bg-blue-50 border-blue-500 text-gray-900"
    : ev.in_sede
    ? "bg-green-50 border-green-500 text-gray-900"
    : "bg-red-50 border-red-500 text-gray-900"
} cursor-pointer hover:shadow-sm transition-shadow text-xs group relative`}
>
      <div
  onClick={(e) => {
    e.stopPropagation();
    handleEditEvento(ev);
  }}
  className="pr-6"
>
  <div className="truncate font-semibold text-gray-900">
    {ev.titolo || "(senza titolo)"} {ev.sala ? `(Sala ${String(ev.sala)})` : ""}
  </div>

  {ev.utente && (
    <div className="truncate text-[11px] text-gray-700">
      👤 {ev.utente.nome?.charAt(0)}. {ev.utente.cognome}
    </div>
  )}

  <div className="truncate text-[11px] text-gray-600">
    ⏰ {ev.ora_inizio ? String(ev.ora_inizio).substring(0, 5) : ""}
    {ev.ora_fine ? ` - ${String(ev.ora_fine).substring(0, 5)}` : ""}
  </div>
</div>

        <button
          className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-sm font-bold"
          onClick={(e) => handleDeleteEventoDirect(String(ev.id), e)}
          title="Elimina"
        >
          ×
        </button>
      </div>
    </TooltipTrigger>

    <TooltipContent side="right" className="max-w-sm p-4 text-sm whitespace-pre-line">
      {getEventoSummary(ev)}
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
                ))}

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

  // stessa larghezza per header e body
  const weekGridCols = "grid-cols-[64px_repeat(7,minmax(140px,1fr))]";

 return (
  <div className="border rounded-lg bg-white overflow-hidden h-[calc(100vh-250px)] min-w-[1044px]">
    <div className="overflow-y-auto h-full">
      {/* HEADER */}
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
                <div className="text-xs font-medium uppercase">
                  {format(day, "EEE", { locale: it })}
                </div>

                <div className="text-lg font-bold">
                  {format(day, "d")}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BODY */}
      <div>
        {hours.map((hour) => (
          <div
            key={hour}
            className={`grid ${weekGridCols} min-h-[100px] border-b border-gray-200`}
          >
            <div className="p-2 text-xs text-gray-400 text-right border-r border-gray-200 font-mono bg-gray-50">
              {String(hour).padStart(2, "0")}:00
            </div>

            {weekDays.map((day, index) => {
              const isWeekend = index === 5 || index === 6;

              const cellEvents = filteredEvents.filter((e) => {
                const eventDate = safeParseISO(e.data_inizio as any);

                if (e.tutto_giorno) return isSameDay(eventDate, day) && hour === 9;

                if (!e.ora_inizio) return false;
                const eventHour = parseInt(String(e.ora_inizio).substring(0, 2));
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
                      {cellEvents.map((evento) => (
                        <TooltipProvider key={String(evento.id)}>
                          <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                              <div
                                className={`p-2 rounded border-l-2 ${
                                  (evento as any).evento_generico
                                    ? "bg-blue-50 border-blue-500"
                                    : evento.in_sede
                                    ? "bg-green-50 border-green-500"
                                    : "bg-red-50 border-red-500"
                                } cursor-pointer hover:shadow-sm transition-shadow text-xs group relative`}
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

                                  {evento.utente && (
                                    <div className="text-gray-600 truncate">
                                      👤 {evento.utente.nome?.charAt(0)}. {evento.utente.cognome}
                                    </div>
                                  )}

                                  {evento.cliente?.ragione_sociale && (
                                    <div className="text-gray-600 truncate">
                                      🏢 {evento.cliente.ragione_sociale}
                                    </div>
                                  )}

                                  {evento.in_sede && evento.sala && (
                                    <div className="text-green-700 font-medium mt-1">
                                      📍 SALA {String(evento.sala)}
                                    </div>
                                  )}

                                  {!evento.in_sede && evento.luogo && (
                                    <div className="text-red-700 font-medium mt-1 truncate">
                                      📍 {String(evento.luogo)}
                                    </div>
                                  )}

                                  <div className="text-gray-500 mt-1">
                                    ⏰ {evento.ora_inizio ? String(evento.ora_inizio).substring(0, 5) : ""}
                                    {evento.ora_fine ? ` - ${String(evento.ora_fine).substring(0, 5)}` : ""}
                                  </div>
                                </div>

                                <button
                                  className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-sm font-bold"
                                  onClick={(e) => handleDeleteEventoDirect(String(evento.id), e)}
                                  title="Elimina evento"
                                >
                                  ×
                                </button>
                              </div>
                            </TooltipTrigger>

                            <TooltipContent side="right" className="max-w-sm p-4 text-sm whitespace-pre-line">
                              {getEventoSummary(evento)}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
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
  const renderListView = () => {
    const now = new Date();
    const pastEvents = filteredEvents.filter((evento) => safeParseISO(evento.data_inizio as any) < now);

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
      const isRecurring = (evento as any).ricorrente === true;
      const eventDate = safeParseISO(evento.data_inizio as any);
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

  // --------------------
  // RENDER
  // --------------------

  if (loading) return <div className="p-10 text-center">Caricamento in corso...</div>;

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
              {format(currentDate, view === "week" ? "'Settimana' w - MMM yyyy" : "MMMM yyyy", { locale: it })}
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
                <Button variant="outline" className="w-[200px] justify-between">
                  {filtroUtenti.length === 0 ? "Tutti gli utenti" : `${filtroUtenti.length} selezionati`}
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-[260px] p-2">
                <div
                  className="flex items-center gap-2 px-2 py-2 rounded hover:bg-muted cursor-pointer"
                  onClick={() => setFiltroUtenti([])}
                >
                  <Checkbox checked={filtroUtenti.length === 0} onCheckedChange={() => setFiltroUtenti([])} />
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
              <Button variant={view === "ricorrenti" ? "default" : "outline"} size="sm" onClick={() => setView("ricorrenti")}>
                <List className="h-4 w-4 mr-2" /> Eventi ricorrenti
              </Button>

              <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}>
                <List className="h-4 w-4 mr-2" /> Scaduti
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
        {view === "month" && renderMonthView()}
        {view === "week" && renderWeekView()}
      </div>
    </div>
    
     {/* MOBILE */}
<div className="md:hidden space-y-3 px-1">
  <div className="bg-white p-3 rounded-lg shadow-sm border space-y-3">
    <div className="flex items-center justify-between">
      <Button
        variant="ghost"
        size="icon"
        onClick={() =>
          setCurrentDate((prev) =>
            view === "week" ? subWeeks(prev, 1) : subMonths(prev, 1)
          )
        }
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      <div className="text-center">
        <div className="text-sm text-muted-foreground">Agenda</div>
        <div className="font-bold">
          {format(currentDate, "EEEE d MMMM yyyy", { locale: it })}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={() =>
          setCurrentDate((prev) =>
            view === "week" ? addWeeks(prev, 1) : addMonths(prev, 1)
          )
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
    </div>
  </div>

  <div className="bg-white rounded-lg shadow-sm p-3">
    {view === "ricorrenti" && renderRicorrentiView()}
    {view === "list" && renderListView()}

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
      .filter((e) => isSameDay(safeParseISO(e.data_inizio as any), currentDate))
      .sort((a, b) => {
        const aTime = String(a.ora_inizio || "00:00");
        const bTime = String(b.ora_inizio || "00:00");
        return aTime.localeCompare(bTime);
      })
      .map((e) => renderEventCard(e, false))}

    {filteredEvents.filter((e) =>
      isSameDay(safeParseISO(e.data_inizio as any), currentDate)
    ).length === 0 && (
      <div className="text-center py-10 text-gray-500">
        Nessun evento per questo giorno
      </div>
    )}
  </>
)}
  </div>
</div>
      
      {/* Dialog Nuovo/Modifica Evento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEventoId ? "Modifica Evento" : "Nuovo Evento"}</DialogTitle>
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
                    <p className="text-xs text-muted-foreground mt-1">Numero di giorni tra un evento e il successivo</p>
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
                <Input
                  type="date"
                  value={formData.data_inizio}
                  onChange={(e) => setFormData({ ...formData, data_inizio: e.target.value })}
                />
              </div>

              <div>
                <Label>Ora Inizio</Label>
                <Input
                  type="time"
                  disabled={formData.tutto_giorno}
                  value={formData.ora_inizio}
                  onChange={(e) => setFormData({ ...formData, ora_inizio: e.target.value })}
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
                {formData.ricorrente && <p className="text-xs text-muted-foreground mt-1">Calcolata automaticamente dalla durata</p>}
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
              <Label>Assegna a Utente *</Label>
              <Select value={formData.utente_id} onValueChange={(v) => setFormData({ ...formData, utente_id: v })}>
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
                    })
                  }
                />
                <Label htmlFor="riunione_teams">Riunione Teams</Label>
              </div>

              {formData.riunione_teams && (
                <div>
                  <Label>Link Teams</Label>
                  <Input
                    value={formData.link_teams}
                    onChange={(e) => setFormData({ ...formData, link_teams: e.target.value })}
                    placeholder="https://teams.microsoft.com/..."
                  />
                </div>
              )}
            </div>

            <div>
              <Label className="mb-2 block">Partecipanti</Label>

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
                        checked={formData.partecipanti.includes(u.id)}
                        onCheckedChange={(checked: CheckedState) => {
                          const isChecked = toBool(checked);
                          const newPart = isChecked
                            ? [...formData.partecipanti, u.id]
                            : formData.partecipanti.filter((id) => id !== u.id);

                          setFormData({ ...formData, partecipanti: newPart });
                        }}
                      />
                      <span className="text-sm">
                        {u.cognome} {u.nome} {u.settore && `(${u.settore})`}
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
            {/* Mostra elimina solo in MODIFICA: evita editingEventoId! */}
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
                <Trash2 className="h-4 w-4 mr-2" /> Elimina Evento
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
                  setEditingEventoId(null);
                }}
              >
                Annulla
              </Button>

              <Button type="submit" onClick={handleSaveEvento}>
                {editingEventoId ? "Aggiorna Evento" : "Crea Evento"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moreEventsOpen} onOpenChange={setMoreEventsOpen}>
  <DialogContent className="max-w-xl max-h-[80vh] overflow-hidden">
    <DialogHeader>
      <DialogTitle>
        Eventi del{" "}
        {moreEventsDate ? format(moreEventsDate as Date, "dd MMMM yyyy", { locale: it }) : ""}
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
          .map((evento) => (
            <div
              key={String(evento.id)}
              className="rounded-lg border p-3 hover:bg-gray-50 cursor-pointer"
              onClick={() => {
                setMoreEventsOpen(false);
                handleEditEvento(evento);
              }}
            >
              <div className="font-semibold text-sm">
                {evento.titolo || "(senza titolo)"}
              </div>

              <div className="text-xs text-gray-600 mt-1">
                ⏰ {evento.ora_inizio ? String(evento.ora_inizio).substring(0, 5) : ""}
                {evento.ora_fine ? ` - ${String(evento.ora_fine).substring(0, 5)}` : ""}
              </div>

              {evento.utente && (
                <div className="text-xs text-gray-700 mt-1">
                  👤 {evento.utente.nome} {evento.utente.cognome}
                </div>
              )}

              {evento.cliente?.ragione_sociale && (
                <div className="text-xs text-gray-700 mt-1">
                  🏢 {evento.cliente.ragione_sociale}
                </div>
              )}

              {evento.in_sede && evento.sala && (
                <div className="text-xs text-green-700 mt-1">
                  📍 Sala {String(evento.sala)}
                </div>
              )}

              {!evento.in_sede && evento.luogo && (
                <div className="text-xs text-red-700 mt-1">
                  📍 {String(evento.luogo)}
                </div>
              )}
            </div>
          ))
      )}
    </div>
  </DialogContent>
</Dialog>
    
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina Evento</AlertDialogTitle>
            <AlertDialogDescription>Sei sicuro? L&apos;azione è irreversibile.</AlertDialogDescription>
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
