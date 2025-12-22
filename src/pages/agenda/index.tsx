import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { eventoService } from "@/services/eventoService";
import { clienteService } from "@/services/clienteService";
import { utenteService } from "@/services/utenteService";
import Header from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, Plus, Edit, Trash2, MapPin, Building2, Clock, Navigation, Users, ChevronLeft, ChevronRight, Search, User, List, Grid3x3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type EventoAgenda = Database["public"]["Tables"]["tbagenda"]["Row"];
type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

const SALE = ["Riunioni", "Briefing", "Stanza Personale"];

export default function AgendaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [eventi, setEventi] = useState<EventoAgenda[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [currentUser, setCurrentUser] = useState<Utente | null>(null);
  const [dataSelezionata, setDataSelezionata] = useState(new Date());
  const [filtroUtente, setFiltroUtente] = useState("__all__");
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvento, setEditingEvento] = useState<EventoAgenda | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  const [formData, setFormData] = useState({
    titolo: "",
    descrizione: "",
    data_inizio: "",
    data_fine: "",
    tutto_giorno: false,
    utente_id: "",
    cliente_id: "",
    evento_generico: false,
    in_sede: true,
    sala: "",
    luogo: "",
    partecipanti: [] as string[],
    invia_a_tutti: false
  });

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const utentiData = await utenteService.getUtenti();
      const utenteCorrente = utentiData.find(u => u.email === session.user.email);
      setCurrentUser(utenteCorrente || null);
      setFormData(prev => ({ ...prev, utente_id: utenteCorrente?.id || "" }));

      await loadData();
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventiData, clientiData, utentiData] = await Promise.all([
        eventoService.getEventi(),
        clienteService.getClienti(),
        utenteService.getUtenti()
      ]);
      setEventi(eventiData);
      setClienti(clientiData);
      setUtenti(utentiData);
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

  const getColoreEvento = (eventoGenerico: boolean, inSede: boolean): string => {
    if (eventoGenerico) {
      return "#3B82F6";
    }
    return inSede ? "#10B981" : "#EF4444";
  };

  const generaFileICS = (evento: any): string => {
    const formatDateICS = (dateString: string): string => {
      const date = new Date(dateString);
      return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Studio Manager Pro//Agenda//IT",
      "BEGIN:VEVENT",
      `UID:${evento.id || Date.now()}@studiomanagerpro.it`,
      `DTSTAMP:${formatDateICS(new Date().toISOString())}`,
      `DTSTART:${formatDateICS(evento.data_inizio)}`,
      `DTEND:${formatDateICS(evento.data_fine)}`,
      `SUMMARY:${evento.titolo}`,
      evento.descrizione ? `DESCRIPTION:${evento.descrizione.replace(/\n/g, "\\n")}` : "",
      evento.luogo ? `LOCATION:${evento.luogo}` : "",
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR"
    ].filter(Boolean).join("\r\n");

    return icsContent;
  };

  const inviaEmailPartecipanti = async (partecipantiIds: string[], eventoData: any) => {
    if (partecipantiIds.length === 0) return;

    try {
      const partecipantiCompleti = utenti.filter(u => partecipantiIds.includes(u.id));
      const clienteData = eventoData.cliente_id 
        ? clienti.find(c => c.id === eventoData.cliente_id)
        : null;

      const googleMapsLink = eventoData.luogo 
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(eventoData.luogo)}`
        : null;

      const icsFile = generaFileICS(eventoData);

      const emailData = {
        destinatari: partecipantiCompleti.map(p => ({
          email: p.email,
          nome: `${p.nome} ${p.cognome}`
        })),
        oggetto: `Nuovo Evento: ${eventoData.titolo}`,
        corpo: {
          titolo: eventoData.titolo,
          descrizione: eventoData.descrizione,
          dataInizio: new Date(eventoData.data_inizio).toLocaleString("it-IT", {
            dateStyle: "full",
            timeStyle: "short"
          }),
          dataFine: new Date(eventoData.data_fine).toLocaleString("it-IT", {
            dateStyle: "full",
            timeStyle: "short"
          }),
          tuttoGiorno: eventoData.tutto_giorno,
          cliente: clienteData ? {
            ragioneSociale: clienteData.ragione_sociale,
            indirizzo: `${clienteData.indirizzo}, ${clienteData.cap} ${clienteData.citta} (${clienteData.provincia})`,
            telefono: "N/D",
            email: clienteData.email
          } : null,
          eventoGenerico: !eventoData.cliente_id,
          inSede: eventoData.in_sede,
          sala: eventoData.sala,
          luogo: eventoData.luogo,
          googleMapsLink: googleMapsLink,
          numeroPartecipanti: partecipantiIds.length,
          tipoEvento: eventoData.evento_generico ? "Evento Generico" : 
                      eventoData.in_sede ? "Appuntamento in Sede" : "Appuntamento Fuori Sede"
        },
        allegati: [
          {
            filename: `evento-${eventoData.titolo.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.ics`,
            content: icsFile,
            contentType: "text/calendar"
          }
        ]
      };

      console.log("📧 Email preparata per invio:", emailData);
      
      return {
        success: true,
        destinatari: partecipantiCompleti.length,
        emailData
      };

    } catch (error) {
      console.error("Errore preparazione email:", error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.titolo || !formData.data_inizio || !formData.data_fine) {
      toast({
        title: "Errore",
        description: "Compila i campi obbligatori (Titolo, Data Inizio, Data Fine)",
        variant: "destructive"
      });
      return;
    }

    if (!formData.evento_generico && !formData.cliente_id) {
      toast({
        title: "Errore",
        description: "Seleziona un cliente oppure attiva 'Evento Generico'",
        variant: "destructive"
      });
      return;
    }

    try {
      const colore = getColoreEvento(formData.evento_generico, formData.in_sede);

      const partecipantiFinal = formData.invia_a_tutti 
        ? utenti.map(u => u.id)
        : formData.partecipanti;

      const dataToSave = {
        titolo: formData.titolo,
        descrizione: formData.descrizione,
        data_inizio: formData.data_inizio,
        data_fine: formData.data_fine,
        tutto_giorno: formData.tutto_giorno,
        utente_id: formData.utente_id || null,
        cliente_id: formData.evento_generico ? null : (formData.cliente_id || null),
        in_sede: formData.in_sede,
        sala: formData.sala || null,
        luogo: formData.luogo || null,
        colore: colore,
        partecipanti: partecipantiFinal
      };

      if (editingEvento) {
        await eventoService.updateEvento(editingEvento.id, dataToSave);
        toast({
          title: "Successo",
          description: "Evento aggiornato con successo"
        });
      } else {
        await eventoService.createEvento(dataToSave);
        toast({
          title: "Successo",
          description: "Evento creato con successo"
        });
      }

      if (partecipantiFinal.length > 0) {
        try {
          const risultatoEmail = await inviaEmailPartecipanti(partecipantiFinal, dataToSave);
          toast({
            title: "Email preparate",
            description: `Sistema pronto per inviare ${risultatoEmail.destinatari} email di notifica`,
          });
        } catch (emailError) {
          console.error("Errore invio email:", emailError);
          toast({
            title: "Attenzione",
            description: "Evento salvato ma errore nell'invio delle email",
            variant: "destructive"
          });
        }
      }

      setDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare l'evento",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (evento: EventoAgenda) => {
    setEditingEvento(evento);
    
    let partecipantiArray: string[] = [];
    let inviaATutti = false;
    
    if (evento.partecipanti) {
      try {
        partecipantiArray = Array.isArray(evento.partecipanti) 
          ? evento.partecipanti.map(p => String(p)) 
          : [];
        
        if (partecipantiArray.length === utenti.length && 
            utenti.every(u => partecipantiArray.includes(u.id))) {
          inviaATutti = true;
        }
      } catch {
        partecipantiArray = [];
      }
    }

    const convertToDatetimeLocal = (isoString: string): string => {
      if (!isoString) return "";
      try {
        const date = new Date(isoString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      } catch {
        return "";
      }
    };

    setFormData({
      titolo: evento.titolo,
      descrizione: evento.descrizione || "",
      data_inizio: convertToDatetimeLocal(evento.data_inizio),
      data_fine: convertToDatetimeLocal(evento.data_fine),
      tutto_giorno: evento.tutto_giorno || false,
      utente_id: evento.utente_id || "",
      cliente_id: evento.cliente_id || "",
      evento_generico: !evento.cliente_id,
      in_sede: evento.in_sede ?? true,
      sala: evento.sala || "",
      luogo: evento.luogo || "",
      partecipanti: partecipantiArray,
      invia_a_tutti: inviaATutti
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo evento?")) return;

    try {
      await eventoService.deleteEvento(id);
      toast({
        title: "Successo",
        description: "Evento eliminato con successo"
      });
      await loadData();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare l'evento",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      titolo: "",
      descrizione: "",
      data_inizio: "",
      data_fine: "",
      tutto_giorno: false,
      utente_id: currentUser?.id || "",
      cliente_id: "",
      evento_generico: false,
      in_sede: true,
      sala: "",
      luogo: "",
      partecipanti: [],
      invia_a_tutti: false
    });
    setEditingEvento(null);
  };

  const apriGoogleMaps = (indirizzo: string) => {
    if (!indirizzo.trim()) {
      toast({
        title: "Indirizzo mancante",
        description: "Inserisci un indirizzo per calcolare il percorso",
        variant: "destructive"
      });
      return;
    }

    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(indirizzo)}`;
    window.open(url, "_blank");
  };

  const togglePartecipante = (utenteId: string) => {
    setFormData(prev => ({
      ...prev,
      partecipanti: prev.partecipanti.includes(utenteId)
        ? prev.partecipanti.filter(id => id !== utenteId)
        : [...prev.partecipanti, utenteId]
    }));
  };

  const getPartecipantiEvento = (evento: EventoAgenda): Utente[] => {
    if (!evento.partecipanti) return [];
    try {
      const partecipantiIds = Array.isArray(evento.partecipanti) 
        ? evento.partecipanti.map(p => String(p)) 
        : [];
      return utenti.filter(u => partecipantiIds.includes(u.id));
    } catch {
      return [];
    }
  };

  const cambiaSettimana = (direzione: number) => {
    const nuovaData = new Date(dataSelezionata);
    nuovaData.setDate(nuovaData.getDate() + (direzione * 7));
    setDataSelezionata(nuovaData);
  };

  const cambiaMese = (direzione: number) => {
    const nuovaData = new Date(dataSelezionata);
    nuovaData.setMonth(nuovaData.getMonth() + direzione);
    setDataSelezionata(nuovaData);
  };

  const getEventiMese = () => {
    const anno = dataSelezionata.getFullYear();
    const mese = dataSelezionata.getMonth();
    
    return eventi.filter(e => {
      const dataEvento = new Date(e.data_inizio);
      const matchData = dataEvento.getFullYear() === anno && dataEvento.getMonth() === mese;
      const matchUtente = filtroUtente === "__all__" || e.utente_id === filtroUtente;
      const matchSearch = searchQuery === "" || 
        e.titolo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.descrizione || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchData && matchUtente && matchSearch;
    });
  };

  const getEventiSettimana = () => {
    const inizioSettimana = new Date(dataSelezionata);
    inizioSettimana.setDate(dataSelezionata.getDate() - dataSelezionata.getDay());
    inizioSettimana.setHours(0, 0, 0, 0);

    const fineSettimana = new Date(inizioSettimana);
    fineSettimana.setDate(inizioSettimana.getDate() + 6);
    fineSettimana.setHours(23, 59, 59, 999);

    return eventi.filter(e => {
      const dataEvento = new Date(e.data_inizio);
      const matchData = dataEvento >= inizioSettimana && dataEvento <= fineSettimana;
      const matchUtente = filtroUtente === "__all__" || e.utente_id === filtroUtente;
      const matchSearch = searchQuery === "" || 
        e.titolo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.descrizione || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchData && matchUtente && matchSearch;
    }).sort((a, b) => new Date(a.data_inizio).getTime() - new Date(b.data_inizio).getTime());
  };

  const getEventiPerGiorno = () => {
    const eventiSettimana = getEventiSettimana();
    const gruppi: { [key: string]: EventoAgenda[] } = {};

    eventiSettimana.forEach(evento => {
      const dataKey = new Date(evento.data_inizio).toLocaleDateString("it-IT", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
      
      if (!gruppi[dataKey]) {
        gruppi[dataKey] = [];
      }
      gruppi[dataKey].push(evento);
    });

    return gruppi;
  };

  const getGiorniMese = () => {
    const anno = dataSelezionata.getFullYear();
    const mese = dataSelezionata.getMonth();
    
    const primoGiorno = new Date(anno, mese, 1);
    const ultimoGiorno = new Date(anno, mese + 1, 0);
    
    const giorni: Date[] = [];
    
    const inizioSettimana = primoGiorno.getDay();
    for (let i = inizioSettimana - 1; i >= 0; i--) {
      const data = new Date(anno, mese, -i);
      giorni.push(data);
    }
    
    for (let giorno = 1; giorno <= ultimoGiorno.getDate(); giorno++) {
      giorni.push(new Date(anno, mese, giorno));
    }
    
    const giorniRimanenti = 42 - giorni.length;
    for (let i = 1; i <= giorniRimanenti; i++) {
      giorni.push(new Date(anno, mese + 1, i));
    }
    
    return giorni;
  };

  const getEventiGiorno = (data: Date) => {
    const eventiMese = getEventiMese();
    return eventiMese.filter(e => {
      const dataEvento = new Date(e.data_inizio);
      return dataEvento.getDate() === data.getDate() &&
             dataEvento.getMonth() === data.getMonth() &&
             dataEvento.getFullYear() === data.getFullYear();
    });
  };

  const getClienteNome = (clienteId: string | null): string => {
    if (!clienteId) return "Evento Generico";
    const cliente = clienti.find(c => c.id === clienteId);
    return cliente ? cliente.ragione_sociale : "Cliente Sconosciuto";
  };

  const getUtenteNome = (utenteId: string | null): string => {
    if (!utenteId) return "-";
    const utente = utenti.find(u => u.id === utenteId);
    return utente ? `${utente.nome} ${utente.cognome}` : "-";
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isSameMonth = (date: Date): boolean => {
    return date.getMonth() === dataSelezionata.getMonth();
  };

  const getWeekRange = () => {
    const inizioSettimana = new Date(dataSelezionata);
    inizioSettimana.setDate(dataSelezionata.getDate() - dataSelezionata.getDay());
    
    const fineSettimana = new Date(inizioSettimana);
    fineSettimana.setDate(inizioSettimana.getDate() + 6);

    const formatDate = (date: Date) => {
      return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
    };

    return `${formatDate(inizioSettimana)} - ${formatDate(fineSettimana)}`;
  };

  const eventiPerGiorno = getEventiPerGiorno();
  const totalEventi = viewMode === "list" ? getEventiSettimana().length : getEventiMese().length;
  const weekRange = getWeekRange();
  const giorniMese = getGiorniMese();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6 md:mb-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Agenda</h1>
                  <p className="text-sm md:text-base text-gray-500 mt-1">Gestione appuntamenti e calendario</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={(open) => {
                  setDialogOpen(open);
                  if (!open) resetForm();
                }}>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Nuovo Evento
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingEvento ? "Modifica Evento" : "Nuovo Evento"}
                      </DialogTitle>
                      <DialogDescription>
                        Inserisci i dettagli dell'evento
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="titolo">Titolo *</Label>
                        <Input
                          id="titolo"
                          value={formData.titolo}
                          onChange={(e) => setFormData({ ...formData, titolo: e.target.value })}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="descrizione">Descrizione</Label>
                        <Textarea
                          id="descrizione"
                          value={formData.descrizione}
                          onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="data_inizio">Data/Ora Inizio *</Label>
                          <Input
                            id="data_inizio"
                            type="datetime-local"
                            value={formData.data_inizio}
                            onChange={(e) => setFormData({ ...formData, data_inizio: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="data_fine">Data/Ora Fine *</Label>
                          <Input
                            id="data_fine"
                            type="datetime-local"
                            value={formData.data_fine}
                            onChange={(e) => setFormData({ ...formData, data_fine: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="tutto_giorno"
                          checked={formData.tutto_giorno}
                          onChange={(e) => setFormData({ ...formData, tutto_giorno: e.target.checked })}
                          className="rounded w-4 h-4"
                        />
                        <Label htmlFor="tutto_giorno" className="cursor-pointer">Tutto il giorno</Label>
                      </div>

                      <div className="border-t pt-4">
                        <div className="flex items-center space-x-2 mb-4">
                          <input
                            type="checkbox"
                            id="evento_generico"
                            checked={formData.evento_generico}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              evento_generico: e.target.checked,
                              cliente_id: e.target.checked ? "" : formData.cliente_id
                            })}
                            className="rounded w-4 h-4"
                          />
                          <Label htmlFor="evento_generico" className="cursor-pointer font-semibold">
                            Evento Generico (senza cliente)
                          </Label>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                          <p className="font-semibold mb-2">ℹ️ Colori automatici:</p>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ backgroundColor: "#3B82F6" }}></div>
                              <span>Blu → Evento generico</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ backgroundColor: "#10B981" }}></div>
                              <span>Verde → In sede</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ backgroundColor: "#EF4444" }}></div>
                              <span>Rosso → Fuori sede</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="utente_id">Utente Responsabile</Label>
                          <Select
                            value={formData.utente_id || "__none__"}
                            onValueChange={(value) => setFormData({ ...formData, utente_id: value === "__none__" ? "" : value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona utente" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nessuno</SelectItem>
                              {utenti.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.nome} {u.cognome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="cliente_id">
                            Cliente {!formData.evento_generico && <span className="text-red-500">*</span>}
                          </Label>
                          <Select
                            value={formData.cliente_id || "__none__"}
                            onValueChange={(value) => setFormData({ ...formData, cliente_id: value === "__none__" ? "" : value })}
                            disabled={formData.evento_generico}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formData.evento_generico ? "Non richiesto" : "Seleziona cliente"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nessuno</SelectItem>
                              {clienti.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.ragione_sociale}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <div className="flex items-center space-x-2 mb-4">
                          <input
                            type="checkbox"
                            id="in_sede"
                            checked={formData.in_sede}
                            onChange={(e) => setFormData({ ...formData, in_sede: e.target.checked })}
                            className="rounded w-4 h-4"
                            disabled={formData.evento_generico}
                          />
                          <Label htmlFor="in_sede" className="cursor-pointer">
                            In Sede {formData.evento_generico && "(non applicabile)"}
                          </Label>
                        </div>

                        {formData.in_sede && !formData.evento_generico && (
                          <div className="space-y-2 mb-4">
                            <Label htmlFor="sala">Sala</Label>
                            <Select
                              value={formData.sala || "__none__"}
                              onValueChange={(value) => setFormData({ ...formData, sala: value === "__none__" ? "" : value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona sala" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Nessuna</SelectItem>
                                {SALE.map((sala) => (
                                  <SelectItem key={sala} value={sala}>
                                    {sala}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="luogo">Indirizzo / Luogo</Label>
                          <div className="flex gap-2">
                            <Input
                              id="luogo"
                              value={formData.luogo}
                              onChange={(e) => setFormData({ ...formData, luogo: e.target.value })}
                              placeholder="Via Roma 1, Milano"
                              className="flex-1"
                            />
                            {formData.luogo && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => apriGoogleMaps(formData.luogo)}
                                className="flex-shrink-0"
                              >
                                <Navigation className="h-4 w-4 mr-2" />
                                Percorso
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <Users className="h-5 w-5 text-blue-600" />
                          Partecipanti (Notifiche Email)
                        </h3>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                          <p className="text-sm text-blue-800">
                            📧 I partecipanti riceveranno un'email con i dettagli
                          </p>
                        </div>

                        <div className="flex items-center space-x-2 mb-4">
                          <input
                            type="checkbox"
                            id="invia_a_tutti"
                            checked={formData.invia_a_tutti}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              invia_a_tutti: e.target.checked,
                              partecipanti: e.target.checked ? [] : formData.partecipanti
                            })}
                            className="rounded w-4 h-4"
                          />
                          <Label htmlFor="invia_a_tutti" className="cursor-pointer font-semibold text-blue-700">
                            📢 Invia a TUTTI ({utenti.length} persone)
                          </Label>
                        </div>

                        {!formData.invia_a_tutti && (
                          <div className="space-y-2">
                            <Label>Seleziona Partecipanti</Label>
                            <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 bg-gray-50">
                              {utenti.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">
                                  Nessun utente disponibile
                                </p>
                              ) : (
                                utenti.map((utente) => (
                                  <div key={utente.id} className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id={`part-${utente.id}`}
                                      checked={formData.partecipanti.includes(utente.id)}
                                      onChange={() => togglePartecipante(utente.id)}
                                      className="rounded w-4 h-4"
                                    />
                                    <Label 
                                      htmlFor={`part-${utente.id}`} 
                                      className="cursor-pointer flex-1 py-1"
                                    >
                                      {utente.nome} {utente.cognome}
                                      {utente.email && (
                                        <span className="text-xs text-gray-500 ml-2">
                                          ({utente.email})
                                        </span>
                                      )}
                                    </Label>
                                  </div>
                                ))
                              )}
                            </div>
                            {formData.partecipanti.length > 0 && (
                              <p className="text-sm text-gray-600 mt-2">
                                ✅ {formData.partecipanti.length} partecipante{formData.partecipanti.length > 1 ? "i" : ""} selezionato{formData.partecipanti.length > 1 ? "i" : ""}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <Button type="submit" className="flex-1">
                          {editingEvento ? "Aggiorna" : "Crea"} Evento
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setDialogOpen(false)}
                        >
                          Annulla
                        </Button>
                        {editingEvento && (
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => {
                              handleDelete(editingEvento.id);
                              setDialogOpen(false);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Stats Card */}
            <Card className="mb-6">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">
                        Appuntamenti {viewMode === "list" ? "questa settimana" : "questo mese"}
                      </p>
                      <p className="text-2xl font-bold text-gray-900">{totalEventi}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="hidden sm:inline">Generico</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="hidden sm:inline">In Sede</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="hidden sm:inline">Fuori Sede</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Filtri + View Toggle + Navigation */}
            <Card className="mb-6">
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <CardTitle className="text-base md:text-lg">
                        {viewMode === "list" ? "Filtri e Navigazione" : "Filtri e Calendario"}
                      </CardTitle>
                      
                      {/* View Mode Toggle */}
                      <div className="flex items-center gap-2 border rounded-lg p-1">
                        <Button
                          variant={viewMode === "calendar" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("calendar")}
                          className="h-8"
                        >
                          <Grid3x3 className="h-4 w-4 mr-2" />
                          Calendario
                        </Button>
                        <Button
                          variant={viewMode === "list" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("list")}
                          className="h-8"
                        >
                          <List className="h-4 w-4 mr-2" />
                          Elenco
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => viewMode === "list" ? cambiaSettimana(-1) : cambiaMese(-1)}
                        className="h-10 w-10"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setDataSelezionata(new Date())}
                        className="px-4"
                      >
                        Oggi
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => viewMode === "list" ? cambiaSettimana(1) : cambiaMese(1)}
                        className="h-10 w-10"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-lg font-semibold text-gray-900">
                      {dataSelezionata.toLocaleDateString("it-IT", { 
                        month: "long", 
                        year: "numeric" 
                      })}
                    </p>
                    {viewMode === "list" && (
                      <p className="text-sm text-gray-600 mt-1">
                        Settimana: {weekRange}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Cerca per titolo o descrizione..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={filtroUtente} onValueChange={setFiltroUtente}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtra per utente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tutti gli utenti</SelectItem>
                      {utenti.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nome} {u.cognome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Vista Calendario Mensile */}
            {viewMode === "calendar" ? (
              <Card>
                <CardContent className="p-4">
                  {/* Header giorni settimana */}
                  <div className="grid grid-cols-7 gap-2 mb-2">
                    {["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"].map((giorno) => (
                      <div key={giorno} className="text-center font-semibold text-sm text-gray-700 py-2">
                        {giorno}
                      </div>
                    ))}
                  </div>

                  {/* Grid calendario */}
                  <div className="grid grid-cols-7 gap-2">
                    {giorniMese.map((data, index) => {
                      const eventiGiorno = getEventiGiorno(data);
                      const isOggi = isToday(data);
                      const stessoMese = isSameMonth(data);

                      return (
                        <div
                          key={index}
                          className={`
                            min-h-[100px] border rounded-lg p-2
                            ${isOggi ? "bg-blue-50 border-blue-500 border-2" : "bg-white"}
                            ${!stessoMese ? "opacity-40" : ""}
                            hover:shadow-md transition-shadow cursor-pointer
                          `}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`
                              text-sm font-semibold
                              ${isOggi ? "bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center" : ""}
                              ${!stessoMese ? "text-gray-400" : "text-gray-700"}
                            `}>
                              {data.getDate()}
                            </span>
                            {eventiGiorno.length > 0 && (
                              <span className="text-xs bg-gray-200 rounded-full px-2 py-0.5">
                                {eventiGiorno.length}
                              </span>
                            )}
                          </div>

                          {/* Eventi del giorno */}
                          <div className="space-y-1">
                            {eventiGiorno.slice(0, 3).map((evento) => (
                              <div
                                key={evento.id}
                                onClick={() => handleEdit(evento)}
                                className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                                style={{ 
                                  backgroundColor: evento.colore || "#3B82F6",
                                  color: "white"
                                }}
                                title={evento.titolo}
                              >
                                {!evento.tutto_giorno && (
                                  <span className="font-semibold mr-1">
                                    {new Date(evento.data_inizio).toLocaleTimeString("it-IT", {
                                      hour: "2-digit",
                                      minute: "2-digit"
                                    })}
                                  </span>
                                )}
                                {evento.titolo}
                              </div>
                            ))}
                            {eventiGiorno.length > 3 && (
                              <div className="text-xs text-gray-500 text-center">
                                +{eventiGiorno.length - 3} altri
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Vista Elenco Timeline */
              <div className="space-y-4">
                {Object.keys(eventiPerGiorno).length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Calendar className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                      <p className="text-gray-500 text-lg">Nessun appuntamento questa settimana</p>
                      <p className="text-gray-400 text-sm mt-2">
                        Clicca su "Nuovo Evento" per aggiungere un appuntamento
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  Object.entries(eventiPerGiorno).map(([dataKey, eventiGiorno]) => {
                    const dataEvento = new Date(eventiGiorno[0].data_inizio);
                    const isOggi = isToday(dataEvento);

                    return (
                      <div key={dataKey}>
                        {/* Header Giorno */}
                        <div className={`flex items-center gap-4 mb-3 ${isOggi ? 'bg-blue-50 border-l-4 border-blue-600 pl-4 py-2 rounded' : ''}`}>
                          <div className="text-center min-w-[80px]">
                            <p className="text-sm text-gray-500 uppercase">
                              {dataEvento.toLocaleDateString("it-IT", { weekday: "short" })}
                            </p>
                            <p className="text-3xl font-bold text-gray-900">
                              {dataEvento.getDate()}
                            </p>
                            <p className="text-xs text-gray-500">
                              {dataEvento.toLocaleDateString("it-IT", { month: "short" })}
                            </p>
                          </div>
                          <div className="flex-1 border-t border-gray-300"></div>
                          <p className="text-sm text-gray-600 font-medium">
                            {eventiGiorno.length} {eventiGiorno.length === 1 ? "appuntamento" : "appuntamenti"}
                          </p>
                        </div>

                        {/* Lista Eventi del Giorno */}
                        <div className="space-y-3 ml-0 md:ml-[100px]">
                          {eventiGiorno.map((evento) => {
                            const cliente = getClienteNome(evento.cliente_id);
                            const responsabile = getUtenteNome(evento.utente_id);
                            const partecipanti = getPartecipantiEvento(evento);
                            const dataInizio = new Date(evento.data_inizio);
                            const dataFine = new Date(evento.data_fine);

                            return (
                              <Card 
                                key={evento.id} 
                                className="hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => handleEdit(evento)}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-4">
                                    {/* Indicatore Colore */}
                                    <div 
                                      className="w-1 h-full rounded-full flex-shrink-0"
                                      style={{ backgroundColor: evento.colore || "#3B82F6", minHeight: "60px" }}
                                    ></div>

                                    {/* Contenuto */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                                        <div className="flex-1 min-w-0">
                                          <h3 className="text-lg font-bold text-gray-900 mb-1">
                                            {evento.titolo}
                                          </h3>
                                          <div className="flex items-center gap-2 text-sm text-blue-700 font-semibold mb-2">
                                            <User className="h-4 w-4 flex-shrink-0" />
                                            <span className="truncate">{cliente}</span>
                                          </div>
                                        </div>

                                        {/* Azioni */}
                                        <div className="flex gap-2 flex-shrink-0">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEdit(evento);
                                            }}
                                            className="h-9 w-9"
                                          >
                                            <Edit className="h-4 w-4 text-blue-600" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDelete(evento.id);
                                            }}
                                            className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Dettagli */}
                                      <div className="space-y-2 text-sm">
                                        {!evento.tutto_giorno && (
                                          <div className="flex items-center gap-2 text-gray-700">
                                            <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                            <span>
                                              {dataInizio.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                                              {" - "}
                                              {dataFine.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                          </div>
                                        )}

                                        {evento.in_sede && evento.sala && (
                                          <div className="flex items-center gap-2 text-gray-700">
                                            <Building2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                                            <span>Sala: {evento.sala}</span>
                                          </div>
                                        )}

                                        {evento.luogo && (
                                          <div className="flex items-center gap-2 text-gray-700">
                                            <MapPin className="h-4 w-4 text-red-600 flex-shrink-0" />
                                            <span className="truncate">{evento.luogo}</span>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                apriGoogleMaps(evento.luogo || "");
                                              }}
                                              className="h-6 px-2 text-xs"
                                            >
                                              <Navigation className="h-3 w-3 mr-1" />
                                              Percorso
                                            </Button>
                                          </div>
                                        )}

                                        {responsabile !== "-" && (
                                          <div className="flex items-center gap-2 text-gray-700">
                                            <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                            <span>Responsabile: {responsabile}</span>
                                          </div>
                                        )}

                                        {partecipanti.length > 0 && (
                                          <div className="flex items-center gap-2 text-gray-700">
                                            <Users className="h-4 w-4 text-purple-600 flex-shrink-0" />
                                            <span>{partecipanti.length} partecipant{partecipanti.length > 1 ? "i" : "e"}</span>
                                          </div>
                                        )}

                                        {evento.descrizione && (
                                          <div className="mt-3 pt-3 border-t">
                                            <p className="text-gray-600 line-clamp-2">
                                              {evento.descrizione}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}