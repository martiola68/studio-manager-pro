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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Pencil, 
  Trash2, 
  Users, 
  MapPin, 
  Clock, 
  Building, 
  List, 
  Grid, 
  CalendarDays,
  Filter
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, startOfDay, parseISO } from "date-fns";
import { it } from "date-fns/locale";

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

// Configurazione sale
const SALE_CONFIG: Record<string, { label: string; color: string }> = {
  "A": { label: "A - Sala riunioni", color: "#3B82F6" },
  "B": { label: "B - Sala Briefing", color: "#8B5CF6" },
  "C": { label: "C - Stanza personale", color: "#F59E0B" }
};

export default function AgendaPage() {
  const { toast } = useToast();
  
  // Stati principali
  const [eventi, setEventi] = useState<EventoWithRelations[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stati UI
  const [view, setView] = useState<"list" | "month" | "week">("week"); // Default view week
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
    evento_generico: false,
    riunione_teams: false,
    link_teams: "",
    partecipanti: [] as string[]
  });

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
      
      // Casting sicuro dei dati
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
    
    // Converti Json[] in string[] in modo sicuro
    let partecipanti: string[] = [];
    if (Array.isArray(evento.partecipanti)) {
      partecipanti = evento.partecipanti.map(p => String(p));
    }

    setEditingEventoId(evento.id);
    setFormData({
      titolo: evento.titolo,
      descrizione: evento.descrizione || "",
      data_inizio: format(startDate, "yyyy-MM-dd"),
      ora_inizio: format(startDate, "HH:mm"),
      data_fine: format(endDate, "yyyy-MM-dd"),
      ora_fine: format(endDate, "HH:mm"),
      tutto_giorno: evento.tutto_giorno || false,
      cliente_id: evento.cliente_id || "",
      utente_id: evento.utente_id,
      in_sede: evento.in_sede || false,
      sala: evento.sala || "",
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

      // Costruzione date ISO
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
        evento_generico: formData.evento_generico,
        riunione_teams: formData.riunione_teams,
        link_teams: formData.link_teams || null,
        partecipanti: formData.partecipanti.length ? formData.partecipanti : null
      };

      if (editingEventoId) {
        const { error } = await supabase.from("tbagenda").update(payload).eq("id", editingEventoId);
        if (error) throw error;
        toast({ title: "Successo", description: "Evento aggiornato" });
      } else {
        const { error } = await supabase.from("tbagenda").insert([payload]);
        if (error) throw error;
        toast({ title: "Successo", description: "Evento creato" });
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
      toast({ title: "Successo", description: "Evento eliminato" });
      setDeleteDialogOpen(false);
      setEventoToDelete(null);
      loadData();
    } catch (error) {
      console.error(error);
      toast({ title: "Errore", description: "Eliminazione fallita", variant: "destructive" });
    }
  };

  // --- UTILITIES ---

  const handleSelezioneSettore = (settore: "Lavoro" | "Fiscale") => {
    const ids = utenti.filter(u => u.settore === settore).map(u => u.id);
    setFormData(prev => ({ ...prev, partecipanti: ids }));
  };

  const getEventColor = (evento: EventoWithRelations) => {
    if (evento.evento_generico) return "#3B82F6"; // Blu
    if (evento.in_sede) return "#10B981"; // Verde
    if (evento.riunione_teams) return "#F97316"; // Arancio
    return "#EF4444"; // Rosso (Fuori sede)
  };

  // Filtro eventi
  const filteredEvents = eventi.filter(e => filtroUtente === "tutti" || e.utente_id === filtroUtente);

  // --- RENDERERS ---

  const renderEventCard = (evento: EventoWithRelations, showDate: boolean = false) => {
    const color = getEventColor(evento);
    const startDate = parseISO(evento.data_inizio);
    const endDate = parseISO(evento.data_fine);
    
    return (
      <Card 
        key={evento.id}
        className="mb-2 cursor-pointer hover:shadow-md transition-shadow border-l-4 overflow-hidden shadow-sm"
        style={{ borderLeftColor: color }}
        onClick={(e) => { e.stopPropagation(); handleEditEvento(evento); }}
      >
        <CardContent className="p-3">
          <div className="flex justify-between items-start">
            <div className="flex-1 overflow-hidden">
              {/* UTENTE (Focus Principale) */}
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="font-bold text-gray-900 truncate">
                  {evento.utente ? `${evento.utente.nome} ${evento.utente.cognome}` : "Utente sconosciuto"}
                </span>
              </div>

              {/* Cliente */}
              {(!evento.evento_generico && evento.cliente) && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Building className="h-3 w-3" />
                  <span className="truncate">{evento.cliente.ragione_sociale}</span>
                </div>
              )}

              {/* Orario e Sala */}
              <div className="flex flex-wrap gap-2 text-xs text-gray-500 mt-1">
                <div className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {showDate && <span className="mr-1">{format(startDate, "dd/MM")}</span>}
                  {evento.tutto_giorno 
                    ? "Tutto il giorno" 
                    : `${format(startDate, "HH:mm")} - ${format(endDate, "HH:mm")}`
                  }
                </div>
                
                {evento.in_sede && evento.sala && (
                  <Badge variant="secondary" className="h-5 px-1 bg-green-100 text-green-700 hover:bg-green-200 border-0">
                    <MapPin className="h-3 w-3 mr-1" />
                    SALA {evento.sala}
                  </Badge>
                )}
              </div>
            </div>

            {/* Azioni */}
            <div className="flex flex-col gap-1 ml-2">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleEditEvento(evento); }}>
                <Pencil className="h-3 w-3 text-blue-600" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEventoToDelete(evento.id); setDeleteDialogOpen(true); }}>
                <Trash2 className="h-3 w-3 text-red-600" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
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
          <div key={d} className="bg-gray-50 p-2 text-center text-sm font-semibold text-gray-600">
            {d}
          </div>
        ))}
        {days.map(dayItem => {
          const isCurrentMonth = isSameMonth(dayItem, currentDate);
          const dayEvents = filteredEvents.filter(e => isSameDay(parseISO(e.data_inizio), dayItem));

          return (
            <div 
              key={dayItem.toISOString()} 
              className={`min-h-[120px] bg-white p-2 cursor-pointer hover:bg-gray-50 transition-colors ${!isCurrentMonth ? 'text-gray-400 bg-gray-50/50' : ''}`}
              onClick={() => handleNuovoEvento(dayItem)}
            >
              <div className="font-semibold text-sm mb-1">{format(dayItem, "d")}</div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(ev => {
                  const color = getEventColor(ev);
                  return (
                    <div 
                      key={ev.id}
                      className="text-xs p-1 rounded truncate border-l-2 text-white font-medium shadow-sm"
                      style={{ backgroundColor: color, borderLeftColor: "rgba(0,0,0,0.2)" }}
                      onClick={(e) => { e.stopPropagation(); handleEditEvento(ev); }}
                    >
                      {ev.utente?.cognome} {ev.sala ? `(Sala ${ev.sala})` : ''}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 font-medium">+{dayEvents.length - 3} altri</div>
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
    const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 - 20:00

    return (
      <div className="border rounded-lg bg-white overflow-hidden flex flex-col h-[calc(100vh-250px)]">
        {/* Header Giorni */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-gray-50">
          <div className="p-3 text-xs font-semibold text-gray-500 text-center border-r">Ora</div>
          {weekDays.map(day => (
            <div key={day.toISOString()} className={`p-2 text-center border-r ${isSameDay(day, new Date()) ? 'bg-blue-50 text-blue-700' : ''}`}>
              <div className="text-xs font-medium uppercase">{format(day, "EEE", { locale: it })}</div>
              <div className="text-lg font-bold">{format(day, "d")}</div>
            </div>
          ))}
        </div>

        {/* Griglia Orari */}
        <div className="overflow-y-auto flex-1">
          {hours.map(hour => (
            <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b min-h-[100px]">
              {/* Colonna Ora */}
              <div className="p-2 text-xs text-gray-400 text-right border-r font-mono">
                {String(hour).padStart(2, '0')}:00
              </div>

              {/* Colonne Giorni */}
              {weekDays.map(day => {
                // Filtra eventi per Giorno E Ora
                const cellEvents = filteredEvents.filter(e => {
                  const eventDate = parseISO(e.data_inizio);
                  const eventHour = parseInt(format(eventDate, "HH"));
                  
                  // Gestione eventi tutto il giorno: mostrali alle 9:00 per convenzione
                  if (e.tutto_giorno) {
                    return isSameDay(eventDate, day) && hour === 9;
                  }
                  
                  return isSameDay(eventDate, day) && eventHour === hour;
                });

                return (
                  <div 
                    key={`${day.toISOString()}-${hour}`} 
                    className="border-r p-1 hover:bg-gray-50 transition-colors cursor-pointer relative"
                    onClick={() => handleNuovoEvento(day, hour)}
                  >
                    {cellEvents.map(ev => {
                      const color = getEventColor(ev);
                      return (
                        <div 
                          key={ev.id}
                          className="text-xs p-2 mb-1 rounded shadow-sm border-l-4 text-white cursor-pointer hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: color, borderLeftColor: "rgba(0,0,0,0.2)" }}
                          onClick={(e) => { e.stopPropagation(); handleEditEvento(ev); }}
                        >
                          <div className="font-bold truncate">
                            {ev.utente ? `${ev.utente.cognome} ${ev.utente.nome?.charAt(0)}.` : 'N/A'}
                          </div>
                          {!ev.evento_generico && ev.cliente && (
                            <div className="truncate opacity-90 text-[10px]">
                              {ev.cliente.ragione_sociale}
                            </div>
                          )}
                          {ev.in_sede && ev.sala && (
                            <div className="mt-1 inline-block bg-white/20 px-1 rounded text-[10px] font-bold">
                              SALA {ev.sala}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) return <div className="p-10 text-center">Caricamento in corso...</div>;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(prev => view === 'week' ? subWeeks(prev, 1) : subMonths(prev, 1))}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="font-bold px-4 min-w-[150px] text-center">
              {format(currentDate, view === 'week' ? "'Settimana' w - MMM yyyy" : "MMMM yyyy", { locale: it })}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(prev => view === 'week' ? addWeeks(prev, 1) : addMonths(prev, 1))}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          
          <Button onClick={() => handleNuovoEvento()} className="gap-2">
            <Plus className="h-4 w-4" /> Nuovo Evento
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {/* Filtro Utente */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <Select value={filtroUtente} onValueChange={setFiltroUtente}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtra utente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">Tutti gli utenti</SelectItem>
                {utenti.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.cognome} {u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* View Toggles */}
          <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
            <Button variant={view === "list" ? "default" : "ghost"} size="sm" onClick={() => setView("list")}>
              <List className="h-4 w-4 mr-2" /> Elenco
            </Button>
            <Button variant={view === "month" ? "default" : "ghost"} size="sm" onClick={() => setView("month")}>
              <Grid className="h-4 w-4 mr-2" /> Mese
            </Button>
            <Button variant={view === "week" ? "default" : "ghost"} size="sm" onClick={() => setView("week")}>
              <CalendarDays className="h-4 w-4 mr-2" /> Settimana
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-sm">
        {view === "list" && (
          <div className="p-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map(e => renderEventCard(e, true))}
            {filteredEvents.length === 0 && <div className="p-8 text-center text-gray-500 col-span-full">Nessun evento</div>}
          </div>
        )}
        {view === "month" && renderMonthView()}
        {view === "week" && renderWeekView()}
      </div>

      {/* Dialog Form */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEventoId ? "Modifica Evento" : "Nuovo Evento"}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div>
              <Label>Titolo Evento *</Label>
              <Input value={formData.titolo} onChange={e => setFormData({...formData, titolo: e.target.value})} placeholder="Es. Riunione Cliente" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Inizio</Label>
                <Input type="date" value={formData.data_inizio} onChange={e => setFormData({...formData, data_inizio: e.target.value})} />
              </div>
              <div>
                <Label>Ora Inizio</Label>
                <Input type="time" disabled={formData.tutto_giorno} value={formData.ora_inizio} onChange={e => setFormData({...formData, ora_inizio: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Fine</Label>
                <Input type="date" value={formData.data_fine} onChange={e => setFormData({...formData, data_fine: e.target.value})} />
              </div>
              <div>
                <Label>Ora Fine</Label>
                <Input type="time" disabled={formData.tutto_giorno} value={formData.ora_fine} onChange={e => setFormData({...formData, ora_fine: e.target.value})} />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="allday" checked={formData.tutto_giorno} onCheckedChange={c => setFormData({...formData, tutto_giorno: !!c})} />
              <Label htmlFor="allday">Tutto il giorno</Label>
            </div>

            <div>
              <Label>Assegna a Utente *</Label>
              <Select value={formData.utente_id} onValueChange={v => setFormData({...formData, utente_id: v})}>
                <SelectTrigger><SelectValue placeholder="Seleziona utente" /></SelectTrigger>
                <SelectContent>
                  {utenti.map(u => <SelectItem key={u.id} value={u.id}>{u.cognome} {u.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {!formData.evento_generico && (
              <div>
                <Label>Cliente</Label>
                <Select value={formData.cliente_id} onValueChange={v => setFormData({...formData, cliente_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleziona cliente" /></SelectTrigger>
                  <SelectContent>
                    {clienti.map(c => <SelectItem key={c.id} value={c.id}>{c.ragione_sociale}</SelectItem>)}
                  </SelectContent>
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

              <div className="flex items-center space-x-2">
                <Checkbox id="teams" checked={formData.riunione_teams} onCheckedChange={c => setFormData({...formData, riunione_teams: !!c})} />
                <Label htmlFor="teams">Riunione Teams</Label>
              </div>
            </div>

            {/* Partecipanti Rapidi */}
            <div>
               <Label className="mb-2 block">Partecipanti</Label>
               <div className="flex gap-2 mb-2">
                 <Button type="button" variant="outline" size="sm" onClick={() => handleSelezioneSettore('Lavoro')}>Settore Lavoro</Button>
                 <Button type="button" variant="outline" size="sm" onClick={() => handleSelezioneSettore('Fiscale')}>Settore Fiscale</Button>
                 <Button type="button" variant="outline" size="sm" onClick={() => setFormData({...formData, partecipanti: []})}>Deseleziona Tutti</Button>
               </div>
               <ScrollArea className="h-[150px] border rounded p-2">
                 {utenti.map(u => (
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleSaveEvento}>{editingEventoId ? "Aggiorna" : "Salva"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Eliminazione */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina Evento</AlertDialogTitle>
            <AlertDialogDescription>Sei sicuro? L'azione è irreversibile.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEvento} className="bg-red-600">Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}