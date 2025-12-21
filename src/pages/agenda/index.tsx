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
import { Calendar, Plus, Edit, Trash2, MapPin, Building2, Clock, Navigation, Users, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [vistaCorrente, setVistaCorrente] = useState<"mensile" | "settimanale">("settimanale");
  const [dataSelezionata, setDataSelezionata] = useState(new Date());
  const [filtroUtente, setFiltroUtente] = useState("__all__");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvento, setEditingEvento] = useState<EventoAgenda | null>(null);

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

  const getEventiPerGiorno = (data: Date) => {
    return eventi.filter(e => {
      const eventoData = new Date(e.data_inizio);
      return (
        eventoData.getDate() === data.getDate() &&
        eventoData.getMonth() === data.getMonth() &&
        eventoData.getFullYear() === data.getFullYear() &&
        (filtroUtente === "__all__" || e.utente_id === filtroUtente)
      );
    });
  };

  const renderCalendarioMensile = () => {
    const anno = dataSelezionata.getFullYear();
    const mese = dataSelezionata.getMonth();
    const primoGiornoMese = new Date(anno, mese, 1);
    const ultimoGiornoMese = new Date(anno, mese + 1, 0);
    const primoGiornoVista = new Date(primoGiornoMese);
    primoGiornoVista.setDate(primoGiornoVista.getDate() - primoGiornoVista.getDay());

    const giorniVista = [];
    const dataCorrente = new Date(primoGiornoVista);

    for (let i = 0; i < 42; i++) {
      giorniVista.push(new Date(dataCorrente));
      dataCorrente.setDate(dataCorrente.getDate() + 1);
    }

    return (
      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {["D", "L", "M", "M", "G", "V", "S"].map((giorno, idx) => (
          <div key={idx} className="text-center font-semibold text-xs md:text-sm py-2 bg-gray-100 rounded">
            {giorno}
          </div>
        ))}
        {giorniVista.map((data, idx) => {
          const eventiGiorno = getEventiPerGiorno(data);
          const fuoriMese = data.getMonth() !== mese;
          const oggi = new Date().toDateString() === data.toDateString();

          return (
            <div
              key={idx}
              className={`min-h-[80px] md:min-h-[100px] border rounded-lg p-1 md:p-2 ${
                fuoriMese ? "bg-gray-50 text-gray-400" : "bg-white"
              } ${oggi ? "ring-2 ring-blue-500" : ""}`}
            >
              <div className="text-xs md:text-sm font-semibold mb-1">{data.getDate()}</div>
              <div className="space-y-1">
                {eventiGiorno.slice(0, 2).map((evento) => (
                  <div
                    key={evento.id}
                    className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                    style={{ backgroundColor: evento.colore || "#3B82F6", color: "white" }}
                    onClick={() => handleEdit(evento)}
                  >
                    {evento.titolo}
                  </div>
                ))}
                {eventiGiorno.length > 2 && (
                  <div className="text-xs text-gray-500">+{eventiGiorno.length - 2}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCalendarioSettimanale = () => {
    const inizioSettimana = new Date(dataSelezionata);
    inizioSettimana.setDate(dataSelezionata.getDate() - dataSelezionata.getDay());

    const giorniSettimana = [];
    for (let i = 0; i < 7; i++) {
      const data = new Date(inizioSettimana);
      data.setDate(inizioSettimana.getDate() + i);
      giorniSettimana.push(data);
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
        {giorniSettimana.map((data) => {
          const eventiGiorno = getEventiPerGiorno(data);
          const oggi = new Date().toDateString() === data.toDateString();

          return (
            <div key={data.toISOString()} className={`border rounded-lg p-3 ${oggi ? "ring-2 ring-blue-500 bg-blue-50" : "bg-white"}`}>
              <div className="text-center mb-3">
                <div className="text-xs text-gray-500">
                  {data.toLocaleDateString("it-IT", { weekday: "short" })}
                </div>
                <div className="text-lg font-bold">{data.getDate()}</div>
              </div>
              <div className="space-y-2">
                {eventiGiorno.map((evento) => {
                  const clienteEvento = clienti.find(c => c.id === evento.cliente_id);
                  const partecipantiEvento = getPartecipantiEvento(evento);
                  
                  return (
                    <div
                      key={evento.id}
                      className="text-xs p-2 rounded cursor-pointer hover:opacity-80 space-y-1"
                      style={{ backgroundColor: evento.colore || "#3B82F6", color: "white" }}
                      onClick={() => handleEdit(evento)}
                    >
                      <div className="font-semibold truncate">{evento.titolo}</div>
                      {!evento.tutto_giorno && (
                        <div className="flex items-center gap-1 opacity-90">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{new Date(evento.data_inizio).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      )}
                      {evento.in_sede && evento.sala && (
                        <div className="flex items-center gap-1 opacity-90">
                          <Building2 className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{evento.sala}</span>
                        </div>
                      )}
                      {evento.luogo && (
                        <div className="flex items-center gap-1 opacity-90">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{evento.luogo}</span>
                        </div>
                      )}
                      {partecipantiEvento.length > 0 && (
                        <div className="flex items-center gap-1 opacity-90">
                          <Users className="h-3 w-3 flex-shrink-0" />
                          <span>{partecipantiEvento.length}</span>
                        </div>
                      )}
                      {clienteEvento && (
                        <div className="text-[10px] opacity-90 truncate">
                          {clienteEvento.ragione_sociale}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
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
            <div className="mb-6 md:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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

            <Card className="mb-6">
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => vistaCorrente === "mensile" ? cambiaMese(-1) : cambiaSettimana(-1)}
                      className="h-10 w-10"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <CardTitle className="text-base md:text-lg">
                      {dataSelezionata.toLocaleDateString("it-IT", { 
                        month: "long", 
                        year: "numeric" 
                      })}
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => vistaCorrente === "mensile" ? cambiaMese(1) : cambiaSettimana(1)}
                      className="h-10 w-10"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setDataSelezionata(new Date())}
                      className="flex-shrink-0"
                    >
                      Oggi
                    </Button>

                    <Select value={filtroUtente} onValueChange={setFiltroUtente}>
                      <SelectTrigger className="flex-1">
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

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={vistaCorrente === "mensile" ? "default" : "outline"}
                        onClick={() => setVistaCorrente("mensile")}
                      >
                        Mensile
                      </Button>
                      <Button
                        variant={vistaCorrente === "settimanale" ? "default" : "outline"}
                        onClick={() => setVistaCorrente("settimanale")}
                      >
                        Settimanale
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {vistaCorrente === "mensile" ? renderCalendarioMensile() : renderCalendarioSettimanale()}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base md:text-lg">Legenda</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: "#3B82F6" }}></div>
                    <span>Evento Generico</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: "#10B981" }}></div>
                    <span>In Sede</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: "#EF4444" }}></div>
                    <span>Fuori Sede</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-600" />
                    <span>Con Sala</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-600" />
                    <span>Con Indirizzo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-600" />
                    <span>Con Partecipanti</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}