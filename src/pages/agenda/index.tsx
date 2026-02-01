import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
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
  Calendar,
  Building2,
  FileText,
  Search,
  Map
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type React from "react";

// DEFINIZIONE TIPI CORRETTA
type ClienteBase = Pick<Database["public"]["Tables"]["tbclienti"]["Row"], "id" | "ragione_sociale" | "codice_fiscale" | "partita_iva">;
type UtenteBase = Pick<Database["public"]["Tables"]["tbutenti"]["Row"], "id" | "nome" | "cognome" | "email" | "settore">;

// Tipo personalizzato per l'evento con le relazioni popolate
type EventoWithRelations = Omit<Database["public"]["Tables"]["tbagenda"]["Row"], "cliente_id" | "utente_id"> & {
  cliente_id: string | null;
  utente_id: string;
  cliente: ClienteBase | null;
  utente: UtenteBase | null;
};

type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];
type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];

export default function AgendaPage() {
  const { toast } = useToast();
  
  // Stati principali
  const [eventi, setEventi] = useState<EventoWithRelations[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stati UI
  const [view, setView] = useState<"list" | "month" | "week">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filtroUtente, setFiltroUtente] = useState<string>("tutti");
  
  // Stati dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventoToDelete, setEventoToDelete] = useState<string | null>(null);
  const [editingEventoId, setEditingEventoId] = useState<string | null>(null);
  
  // Stati form
  const [formData, setFormData] = useState({
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
    partecipanti: [] as string[]
  });

  // Stato per ricerca partecipanti
  const [searchPartecipanti, setSearchPartecipanti] = useState("");

  // Helper per formattare orari con timezone italiano
  const formatTimeWithTimezone = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Rome"
      });
    } catch (e) {
      return "00:00";
    }
  };

  // Caricamento dati
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carica eventi
      const { data: eventiData, error: eventiError } = await supabase
        .from("tbagenda")
        .select(`
          *,
          cliente:cliente_id(id, ragione_sociale, codice_fiscale, partita_iva),
          utente:utente_id(id, nome, cognome, email, settore)
        `)
        .order("data_inizio", { ascending: true });

      if (eventiError) throw eventiError;
      
      const typedEventi = (eventiData || []) as unknown as EventoWithRelations[];
      setEventi(typedEventi);

      // Carica clienti
      const { data: clientiData, error: clientiError } = await supabase
        .from("tbclienti")
        .select("*")
        .eq("attivo", true)
        .order("ragione_sociale");

      if (clientiError) throw clientiError;
      setClienti(clientiData || []);

      // Carica utenti
      const { data: utentiData, error: utentiError } = await supabase
        .from("tbutenti")
        .select("*")
        .eq("attivo", true)
        .order("cognome", { ascending: true });

      if (utentiError) throw utentiError;
      setUtenti(utentiData || []);

    } catch (error) {
      console.error("Errore caricamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // --- GESTIONE FORM ---

  const resetForm = () => {
    setEditingEventoId(null);
    setSearchPartecipanti("");
    setFormData({
      titolo: "",
      descrizione: "",
      data_inizio: format(new Date(), "yyyy-MM-dd"),
      ora_inizio: "09:00",
      data_fine: format(new Date(), "yyyy-MM-dd"),
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
      partecipanti: []
    });
  };

  const handleNuovoEvento = (date?: Date, hour?: number) => {
    resetForm();
    if (date) {
      const dateStr = format(date, "yyyy-MM-dd");
      let startHour = "09:00";
      let endHour = "10:00";
      
      if (hour !== undefined) {
        startHour = `${String(hour).padStart(2, '0')}:00`;
        endHour = `${String(hour + 1).padStart(2, '0')}:00`;
      }

      setFormData(prev => ({
        ...prev,
        data_inizio: dateStr,
        data_fine: dateStr,
        ora_inizio: startHour,
        ora_fine: endHour
      }));
    }
    setDialogOpen(true);
  };

  const handleEditEvento = (evento: EventoWithRelations) => {
    const startDate = parseISO(evento.data_inizio);
    const endDate = parseISO(evento.data_fine);
    
    let partecipanti: string[] = [];
    if (Array.isArray(evento.partecipanti)) {
      partecipanti = evento.partecipanti.map(p => String(p));
    }

    setEditingEventoId(evento.id);
    setSearchPartecipanti("");
    setFormData({
      titolo: evento.titolo,
      descrizione: evento.descrizione || "",
      data_inizio: format(startDate, "yyyy-MM-dd"),
      ora_inizio: formatTimeWithTimezone(evento.data_inizio),
      data_fine: format(endDate, "yyyy-MM-dd"),
      ora_fine: formatTimeWithTimezone(evento.data_fine),
      tutto_giorno: evento.tutto_giorno || false,
      cliente_id: evento.cliente_id || "",
      utente_id: evento.utente_id,
      in_sede: evento.in_sede || false,
      sala: evento.sala || "",
      luogo: evento.luogo || "",
      evento_generico: evento.evento_generico || false,
      riunione_teams: evento.riunione_teams || false,
      link_teams: evento.link_teams || "",
      partecipanti: partecipanti
    });
    setDialogOpen(true);
  };

  const handleSaveEvento = async () => {
    try {
      if (!formData.titolo.trim()) {
        toast({ title: "Errore", description: "Titolo obbligatorio", variant: "destructive" });
        return;
      }
      if (!formData.utente_id) {
        toast({ title: "Errore", description: "Seleziona un utente", variant: "destructive" });
        return;
      }

      const startDateTime = formData.tutto_giorno 
        ? `${formData.data_inizio}T00:00:00` 
        : `${formData.data_inizio}T${formData.ora_inizio}:00`;
        
      const endDateTime = formData.tutto_giorno 
        ? `${formData.data_fine || formData.data_inizio}T23:59:59` 
        : `${formData.data_fine || formData.data_inizio}T${formData.ora_fine}:00`;

      const payload = {
        titolo: formData.titolo,
        descrizione: formData.descrizione || null,
        data_inizio: startDateTime,
        data_fine: endDateTime,
        tutto_giorno: formData.tutto_giorno,
        cliente_id: formData.cliente_id || null,
        utente_id: formData.utente_id,
        in_sede: formData.in_sede,
        sala: formData.in_sede ? formData.sala : null,
        luogo: !formData.in_sede ? formData.luogo : null,
        evento_generico: formData.evento_generico,
        riunione_teams: formData.riunione_teams,
        link_teams: formData.link_teams || null,
        partecipanti: formData.partecipanti.length ? formData.partecipanti : null
      };

      let eventoSalvato;

      if (editingEventoId) {
        const { data, error } = await supabase.from("tbagenda").update(payload).eq("id", editingEventoId).select().single();
        if (error) throw error;
        eventoSalvato = data;
        toast({ title: "Successo", description: "Evento aggiornato" });
      } else {
        const { data, error } = await supabase.from("tbagenda").insert([payload]).select().single();
        if (error) throw error;
        eventoSalvato = data;
        toast({ title: "Successo", description: "Evento creato" });
      }

      // INVIO NOTIFICA EMAIL
      if (eventoSalvato) {
         const { eventoService } = await import("@/services/eventoService");
         await eventoService.sendEventNotification(eventoSalvato);
      }

      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error(error);
      toast({ title: "Errore", description: "Salvataggio fallito", variant: "destructive" });
    }
  };

  const handleDeleteEvento = async () => {
    if (!eventoToDelete) return;
    try {
      const { error } = await supabase.from("tbagenda").delete().eq("id", eventoToDelete);
      if (error) throw error;
      setEventi(prevEventi => prevEventi.filter(e => e.id !== eventoToDelete));
      setDeleteDialogOpen(false);
      setDialogOpen(false);
      setEventoToDelete(null);
      setEditingEventoId(null);
      toast({ title: "Evento eliminato", description: "L'evento è stato eliminato con successo" });
    } catch (error: any) {
      console.error("Errore eliminazione evento:", error);
      toast({ title: "Errore", description: "Impossibile eliminare l'evento", variant: "destructive" });
      setDeleteDialogOpen(false);
      setEventoToDelete(null);
    }
  };

  const handleDeleteEventoDirect = (eventoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEventoToDelete(eventoId);
    setDeleteDialogOpen(true);
  };

  // --- UTILITIES ---

  const handleSelezioneSettore = (settore: "Lavoro" | "Fiscale") => {
    const ids = utenti.filter(u => u.settore === settore).map(u => u.id);
    const isSelected = ids.some(id => formData.partecipanti.includes(id));
    if (isSelected) {
      setFormData(prev => ({ ...prev, partecipanti: prev.partecipanti.filter(p => !ids.includes(p)) }));
    } else {
      setFormData(prev => ({ ...prev, partecipanti: [...new Set([...prev.partecipanti, ...ids])] }));
    }
  };

  const handleSelezioneConsulenza = () => {
    const ids = utenti.filter(u => u.settore === "Consulenza").map(u => u.id);
    const isSelected = ids.some(id => formData.partecipanti.includes(id));
    if (isSelected) {
      setFormData(prev => ({ ...prev, partecipanti: prev.partecipanti.filter(p => !ids.includes(p)) }));
    } else {
      setFormData(prev => ({ ...prev, partecipanti: [...new Set([...prev.partecipanti, ...ids])] }));
    }
  };

  const handleSelezioneTutti = () => {
    const ids = utenti.map(u => u.id);
    setFormData(prev => ({ ...prev, partecipanti: ids }));
  };

  const getEventColor = (evento: EventoWithRelations) => {
    if (evento.evento_generico) return "#3B82F6"; 
    if (evento.in_sede) return "#10B981"; 
    if (evento.riunione_teams) return "#F97316"; 
    return "#EF4444"; 
  };

  const getEventoSummary = (evento: EventoWithRelations): string => {
    const startDate = parseISO(evento.data_inizio);
    const endDate = parseISO(evento.data_fine);
    
    const utenteNome = evento.utente 
      ? `${evento.utente.nome} ${evento.utente.cognome}${evento.utente.settore ? ` (${evento.utente.settore})` : ""}`
      : "Non assegnato";
    
    const clienteNome = evento.cliente?.ragione_sociale || "Nessun cliente";
    
    const luogo = evento.in_sede 
      ? `Sala ${evento.sala || "??"} (In Sede)` 
      : (evento.luogo || "Fuori Sede"); // Mostra luogo se presente
    
    const tipo = evento.evento_generico 
      ? "Evento Generico" 
      : evento.riunione_teams 
        ? "Riunione Teams" 
        : "Appuntamento";
    
    let summary = `📝 ${evento.titolo || "Senza titolo"}\n\n`;
    summary += `📅 ${format(startDate, "dd MMMM yyyy", { locale: it })}\n`;
    summary += `⏰ ${format(startDate, "HH:mm")} - ${format(endDate, "HH:mm")}\n\n`;
    summary += `👤 Assegnato a: ${utenteNome}\n\n`;
    summary += `🏢 Cliente: ${clienteNome}\n\n`;
    summary += `📍 Luogo: ${luogo}\n\n`;
    summary += `🔵 Tipo: ${tipo}\n`;
    
    if (evento.riunione_teams) {
      summary += `💻 Riunione Teams: Sì\n`;
      if (evento.link_teams) {
        summary += `🔗 Link: ${evento.link_teams}\n`;
      }
    }
    
    if (evento.descrizione) {
      summary += `\n📝 Note:\n${evento.descrizione}`;
    }
    
    return summary;
  };

  const filteredEvents = eventi.filter(e => filtroUtente === "tutti" || e.utente_id === filtroUtente);

  // --- RENDERERS ---

  const renderEventCard = (evento: EventoWithRelations, compact: boolean = false) => {
    if (!evento) return null;

    const startDate = parseISO(evento.data_inizio);
    const endDate = parseISO(evento.data_fine);
    const utenteNome = evento.utente ? `${evento.utente.nome} ${evento.utente.cognome}` : "Non assegnato";
    const clienteNome = evento.cliente?.ragione_sociale || "Nessun cliente";
    const colorClass = evento.evento_generico ? "border-l-blue-500" : evento.in_sede ? "border-l-green-500" : "border-l-red-500";

    return (
      <TooltipProvider key={evento.id}>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Card className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${colorClass}`} onClick={() => handleEditEvento(evento)}>
              <CardContent className="p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{formatTimeWithTimezone(evento.data_inizio)} - {formatTimeWithTimezone(evento.data_fine)}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEditEvento(evento); }}>
                      <Pencil className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEventoToDelete(evento.id); setDeleteDialogOpen(true); }}>
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
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">SALA {evento.sala}</span>
                    </div>
                  )}
                  {!evento.in_sede && evento.luogo && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-red-600" />
                      <span className="text-xs text-gray-600 truncate max-w-[200px]">{evento.luogo}</span>
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
          <TooltipContent side="right" className="max-w-sm p-4 text-sm whitespace-pre-line">{getEventoSummary(evento)}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { locale: it });
    const endDate = endOfWeek(monthEnd, { locale: it });
    
    const days = [];
    let day = startDate;
    while (day <= endDate) { days.push(day); day = addDays(day, 1); }

    return (
      <div className="grid grid-cols-7 gap-px bg-gray-200 border rounded-lg overflow-hidden">
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map(d => (
          <div key={d} className="bg-gray-50 p-2 text-center text-sm font-semibold text-gray-600">{d}</div>
        ))}
        {days.map(dayItem => {
          const isCurrentMonth = isSameMonth(dayItem, currentDate);
          const dayEvents = filteredEvents.filter(e => isSameDay(parseISO(e.data_inizio), dayItem));

          return (
            <div key={dayItem.toISOString()} className={`min-h-[120px] bg-white p-2 cursor-pointer hover:bg-gray-50 transition-colors ${!isCurrentMonth ? 'text-gray-400 bg-gray-50/50' : ''}`} onClick={() => handleNuovoEvento(dayItem)}>
              <div className="font-semibold text-sm mb-1">{format(dayItem, "d")}</div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(ev => (
                  <TooltipProvider key={ev.id}>
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <div className="text-xs p-1 rounded truncate border-l-2 text-white font-medium shadow-sm cursor-pointer hover:opacity-90 transition-opacity group relative"
                            style={{ backgroundColor: getEventColor(ev), borderLeftColor: "rgba(0,0,0,0.2)" }}>
                          <span onClick={(e) => { e.stopPropagation(); handleEditEvento(ev); }}>
                            {ev.utente?.cognome} {ev.sala ? `(Sala ${ev.sala})` : ''}
                          </span>
                          <button className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-sm font-bold"
                            onClick={(e) => handleDeleteEventoDirect(ev.id, e)} title="Elimina">×</button>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-sm p-4 text-sm whitespace-pre-line">{getEventoSummary(ev)}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
                {dayEvents.length > 3 && <div className="text-xs text-gray-500 font-medium">+{dayEvents.length - 3} altri</div>}
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
    const hours = Array.from({ length: 13 }, (_, i) => i + 8);

    return (
      <div className="border rounded-lg bg-white overflow-hidden flex flex-col h-[calc(100vh-250px)]">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-gray-50">
          <div className="p-3 text-xs font-semibold text-gray-500 text-center border-r">Ora</div>
          {weekDays.map(day => (
            <div key={day.toISOString()} className={`p-2 text-center border-r ${isSameDay(day, new Date()) ? 'bg-blue-50 text-blue-700' : ''}`}>
              <div className="text-xs font-medium uppercase">{format(day, "EEE", { locale: it })}</div>
              <div className="text-lg font-bold">{format(day, "d")}</div>
            </div>
          ))}
        </div>
        <div className="overflow-y-auto flex-1">
          {hours.map(hour => (
            <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b min-h-[100px]">
              <div className="p-2 text-xs text-gray-400 text-right border-r font-mono">{String(hour).padStart(2, '0')}:00</div>
              {weekDays.map(day => {
                const cellEvents = filteredEvents.filter(e => {
                  const eventDate = parseISO(e.data_inizio);
                  const eventTime = formatTimeWithTimezone(e.data_inizio);
                  const eventHour = parseInt(eventTime.split(':')[0]);
                  if (e.tutto_giorno) return isSameDay(eventDate, day) && hour === 9;
                  return isSameDay(eventDate, day) && eventHour === hour;
                });

                return (
                  <div key={`${day.toISOString()}-${hour}`} className="border-r p-1 hover:bg-gray-50 transition-colors cursor-pointer relative" onClick={() => handleNuovoEvento(day, hour)}>
                    {cellEvents.length > 0 && (
                      <div className="space-y-1">
                        {cellEvents.map((evento) => (
                          <TooltipProvider key={evento.id}>
                            <Tooltip delayDuration={300}>
                              <TooltipTrigger asChild>
                                <div className={`p-2 rounded border-l-2 ${evento.evento_generico ? "bg-blue-50 border-blue-500" : evento.in_sede ? "bg-green-50 border-green-500" : "bg-red-50 border-red-500"} cursor-pointer hover:shadow-sm transition-shadow text-xs group relative`}>
                                  <div onClick={(e) => { e.stopPropagation(); handleEditEvento(evento); }} className="pr-6">
                                    <div className="font-semibold text-gray-900">👤 {evento.utente ? `${evento.utente.nome?.charAt(0)}. ${evento.utente.cognome}` : "?"}</div>
                                    <div className="text-gray-600 truncate">🏢 {evento.cliente?.ragione_sociale || ""}</div>
                                    {evento.in_sede && evento.sala && <div className="text-green-700 font-medium mt-1">📍 SALA {evento.sala}</div>}
                                    {!evento.in_sede && evento.luogo && <div className="text-red-700 font-medium mt-1 truncate">📍 {evento.luogo}</div>}
                                    <div className="text-gray-500 mt-1">⏰ {formatTimeWithTimezone(evento.data_inizio)}</div>
                                  </div>
                                  <button className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-sm font-bold"
                                    onClick={(e) => handleDeleteEventoDirect(evento.id, e)} title="Elimina evento">×</button>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-sm p-4 text-sm whitespace-pre-line">{getEventoSummary(evento)}</TooltipContent>
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
    );
  };

  const renderListView = () => {
    const now = new Date();
    const pastEvents = filteredEvents.filter(evento => parseISO(evento.data_inizio) < now);
    if (pastEvents.length === 0) return <div className="text-center py-12"><Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" /><p className="text-gray-500">Nessun evento scaduto trovato</p></div>;
    return <div className="max-h-[600px] overflow-y-auto space-y-3 pr-2">{pastEvents.map((evento) => renderEventCard(evento, false))}</div>;
  };

  if (loading) return <div className="p-10 text-center">Caricamento in corso...</div>;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(prev => view === 'week' ? subWeeks(prev, 1) : subMonths(prev, 1))}><ChevronLeft className="h-5 w-5" /></Button>
            <span className="font-bold px-4 min-w-[150px] text-center">{format(currentDate, view === 'week' ? "'Settimana' w - MMM yyyy" : "MMMM yyyy", { locale: it })}</span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(prev => view === 'week' ? addWeeks(prev, 1) : addMonths(prev, 1))}><ChevronRight className="h-5 w-5" /></Button>
          </div>
          <Button onClick={() => handleNuovoEvento()} className="gap-2"><Plus className="h-4 w-4" /> Nuovo Evento</Button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <Select value={filtroUtente} onValueChange={setFiltroUtente}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filtra utente" /></SelectTrigger>
              <SelectContent><SelectItem value="tutti">Tutti gli utenti</SelectItem>{utenti.map(u => <SelectItem key={u.id} value={u.id}>{u.cognome} {u.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
            <div className="flex gap-2">
              <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}><List className="h-4 w-4 mr-2" /> Scaduti</Button>
              <Button variant={view === "month" ? "default" : "outline"} size="sm" onClick={() => setView("month")}><Calendar className="h-4 w-4 mr-2" /> Mese</Button>
              <Button variant={view === "week" ? "default" : "outline"} size="sm" onClick={() => setView("week")}><CalendarDays className="h-4 w-4 mr-2" /> Settimana</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        {view === "list" && renderListView()}
        {view === "month" && renderMonthView()}
        {view === "week" && renderWeekView()}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingEventoId ? "Modifica Evento" : "Nuovo Evento"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Titolo Evento *</Label><Input value={formData.titolo} onChange={e => setFormData({...formData, titolo: e.target.value})} placeholder="Es. Riunione Cliente" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data Inizio</Label><Input type="date" value={formData.data_inizio} onChange={e => setFormData({...formData, data_inizio: e.target.value})} /></div>
              <div><Label>Ora Inizio</Label><Input type="time" disabled={formData.tutto_giorno} value={formData.ora_inizio} onChange={e => setFormData({...formData, ora_inizio: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data Fine</Label><Input type="date" value={formData.data_fine} onChange={e => setFormData({...formData, data_fine: e.target.value})} /></div>
              <div><Label>Ora Fine</Label><Input type="time" disabled={formData.tutto_giorno} value={formData.ora_fine} onChange={e => setFormData({...formData, ora_fine: e.target.value})} /></div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="allday" checked={formData.tutto_giorno} onCheckedChange={c => setFormData({...formData, tutto_giorno: !!c})} />
              <Label htmlFor="allday">Tutto il giorno</Label>
            </div>
            <div>
              <Label>Assegna a Utente *</Label>
              <Select value={formData.utente_id} onValueChange={v => setFormData({...formData, utente_id: v})}>
                <SelectTrigger><SelectValue placeholder="Seleziona utente" /></SelectTrigger>
                <SelectContent>{utenti.map(u => <SelectItem key={u.id} value={u.id}>{u.cognome} {u.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {!formData.evento_generico && (
              <div>
                <Label>Cliente</Label>
                <Select value={formData.cliente_id} onValueChange={v => setFormData({...formData, cliente_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleziona cliente" /></SelectTrigger>
                  <SelectContent>{clienti.map(c => <SelectItem key={c.id} value={c.id}>{c.ragione_sociale}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-3 border p-3 rounded-md bg-gray-50">
              <div className="flex items-center space-x-2">
                <Checkbox id="generico" checked={formData.evento_generico} onCheckedChange={c => setFormData({...formData, evento_generico: !!c})} />
                <Label htmlFor="generico">Evento Generico (No Cliente)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="sede" checked={formData.in_sede} onCheckedChange={c => setFormData({...formData, in_sede: !!c})} />
                <Label htmlFor="sede">In Sede</Label>
              </div>
              {formData.in_sede && (
                <div className="ml-6">
                  <Label>Sala</Label>
                  <Select value={formData.sala} onValueChange={v => setFormData({...formData, sala: v})}>
                    <SelectTrigger><SelectValue placeholder="Seleziona Sala" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A - Sala riunioni</SelectItem>
                      <SelectItem value="B">B - Sala Briefing</SelectItem>
                      <SelectItem value="C">C - Stanza personale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {!formData.in_sede && (
                <div className="ml-6 flex gap-2 items-end">
                   <div className="flex-1">
                      <Label htmlFor="luogo">Luogo / Indirizzo</Label>
                      <Input 
                        id="luogo" 
                        value={formData.luogo} 
                        onChange={e => setFormData({...formData, luogo: e.target.value})} 
                        placeholder="Es. Via Roma 10, Milano" 
                      />
                   </div>
                   <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    title="Apri in Mappa"
                    disabled={!formData.luogo}
                    onClick={() => {
                      if (!formData.luogo) return;
                      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.luogo)}`, '_blank');
                    }}
                   >
                     <Map className="h-4 w-4" />
                   </Button>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox id="riunione_teams" checked={formData.riunione_teams} onCheckedChange={(checked) => setFormData({ ...formData, riunione_teams: !!checked })} />
                <Label htmlFor="riunione_teams">Riunione Teams</Label>
              </div>
              {formData.riunione_teams && (
                <div className="space-y-2">
                  <Label htmlFor="link_teams">Link Teams</Label>
                  <Input id="link_teams" type="url" placeholder="https://teams.microsoft.com/..." value={formData.link_teams} onChange={(e) => setFormData({ ...formData, link_teams: e.target.value })} />
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
                 <Button type="button" variant="outline" size="sm" onClick={() => handleSelezioneSettore('Lavoro')}>Settore Lavoro</Button>
                 <Button type="button" variant="outline" size="sm" onClick={() => handleSelezioneSettore('Fiscale')}>Settore Fiscale</Button>
                 <Button type="button" variant="outline" size="sm" onClick={handleSelezioneConsulenza}>Settore Consulenza</Button>
                 <Button type="button" variant="outline" size="sm" onClick={handleSelezioneTutti}>Tutti</Button>
                 <Button type="button" variant="outline" size="sm" onClick={() => setFormData({...formData, partecipanti: []})}>Deseleziona Tutti</Button>
               </div>
               <ScrollArea className="h-[150px] border rounded p-2">
                 {utenti
                   .filter(u => {
                     const search = searchPartecipanti.toLowerCase();
                     const fullName = `${u.cognome} ${u.nome}`.toLowerCase();
                     const sector = u.settore ? u.settore.toLowerCase() : "";
                     return fullName.includes(search) || sector.includes(search);
                   })
                   .map(u => (
                   <div key={u.id} className="flex items-center space-x-2 mb-1">
                     <Checkbox 
                       checked={formData.partecipanti.includes(u.id)}
                       onCheckedChange={(checked) => {
                         const newPart = checked 
                           ? [...formData.partecipanti, u.id]
                           : formData.partecipanti.filter(id => id !== u.id);
                         setFormData({...formData, partecipanti: newPart});
                       }}
                     />
                     <span className="text-sm">{u.cognome} {u.nome} {u.settore && `(${u.settore})`}</span>
                   </div>
                 ))}
               </ScrollArea>
            </div>
            <div>
              <Label>Descrizione</Label>
              <Textarea value={formData.descrizione} onChange={e => setFormData({...formData, descrizione: e.target.value})} />
            </div>
          </div>
          <DialogFooter className="flex justify-between items-center">
            <Button type="button" variant="destructive" onClick={() => { setDialogOpen(false); setEventoToDelete(editingEventoId!); setDeleteDialogOpen(true); }} className="mr-auto"><Trash2 className="h-4 w-4 mr-2" /> Elimina Evento</Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingEventoId(null); }}>Annulla</Button>
              <Button type="submit" onClick={handleSaveEvento}>{editingEventoId ? "Aggiorna Evento" : "Crea Evento"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Elimina Evento</AlertDialogTitle><AlertDialogDescription>Sei sicuro? L'azione è irreversibile.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction onClick={handleDeleteEvento} className="bg-red-600">Elimina</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}