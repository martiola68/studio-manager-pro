import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { eventoService } from "@/services/eventoService";
import { utenteService } from "@/services/utenteService";
import { clienteService } from "@/services/clienteService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarIcon, Plus, List, CalendarDays, Users, MapPin, Link as LinkIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils"; // Added missing import
import type { Database } from "@/lib/supabase/types";

type Evento = Database["public"]["Tables"]["tbagenda"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];
type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];

const SALE_CONFIG: Record<string, { nome: string; colore: string }> = {
  "sala1": { nome: "Sala 1", colore: "#3B82F6" },
  "sala2": { nome: "Sala 2", colore: "#10B981" },
  "sala3": { nome: "Sala 3", colore: "#F59E0B" },
  "sala4": { nome: "Sala 4", colore: "#EF4444" }
};

export default function AgendaPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [eventi, setEventi] = useState<Evento[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [currentUser, setCurrentUser] = useState<Utente | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvento, setEditingEvento] = useState<Evento | null>(null);
  const [selectedPartecipanti, setSelectedPartecipanti] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    titolo: "",
    descrizione: "",
    data_inizio: "",
    data_fine: "",
    tutto_giorno: false,
    evento_generico: false,
    riunione_teams: false,
    link_teams: "",
    cliente_id: null as string | null,
    in_sede: true,
    sala: null as string | null,
    luogo: "",
    invia_a_tutti: false,
    utente_id: "",
    colore: "#3B82F6"
  });

  useEffect(() => {
    checkUserAndLoad();
  }, []);

  const checkUserAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const user = await utenteService.getUtenteById(session.user.id);
      setCurrentUser(user);
      setFormData(prev => ({ ...prev, utente_id: user?.id || "" }));

      const [eventiData, utentiData, clientiData] = await Promise.all([
        eventoService.getEventi(),
        utenteService.getUtenti(),
        clienteService.getClienti()
      ]);

      setEventi(eventiData || []);
      setUtenti(utentiData || []);
      setClienti(clientiData || []);
    } catch (error) {
      console.error("Errore caricamento:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSalaLabel = (salaId: string | null) => {
    if (!salaId) return "";
    return SALE_CONFIG[salaId]?.nome || salaId;
  };

  const getColoreEvento = (evento: Evento) => {
    if (evento.riunione_teams) return "#F97316"; // Orange for Teams
    if (evento.evento_generico) return "#3B82F6";
    if (evento.in_sede) return "#10B981";
    return "#EF4444";
  };

  const eventiConDettagli = eventi.map(evento => {
    const cliente = clienti.find(c => c.id === evento.cliente_id);
    const utente = utenti.find(u => u.id === evento.utente_id);
    return {
      ...evento,
      cliente_nome: cliente?.ragione_sociale || "",
      utente_nome: utente ? `${utente.nome} ${utente.cognome}` : "",
      colore: getColoreEvento(evento)
    };
  });

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const eventiDelGiorno = (giorno: Date) => {
    return eventiConDettagli.filter(e => {
      const dataEvento = parseISO(e.data_inizio);
      return isSameDay(dataEvento, giorno);
    });
  };

  const openDialog = (evento?: Evento) => {
    if (evento) {
      setEditingEvento(evento);
      setFormData({
        titolo: evento.titolo,
        descrizione: evento.descrizione || "",
        data_inizio: evento.data_inizio.split("T")[0],
        data_fine: evento.data_fine.split("T")[0],
        tutto_giorno: evento.tutto_giorno || false,
        evento_generico: evento.evento_generico || false,
        riunione_teams: evento.riunione_teams || false,
        link_teams: evento.link_teams || "",
        cliente_id: evento.cliente_id,
        in_sede: evento.in_sede ?? true,
        sala: evento.sala,
        luogo: evento.luogo || "",
        invia_a_tutti: false,
        utente_id: evento.utente_id || "",
        colore: evento.colore || "#3B82F6"
      });
    } else {
      setFormData({
        titolo: "",
        descrizione: "",
        data_inizio: format(new Date(), "yyyy-MM-dd"),
        data_fine: format(new Date(), "yyyy-MM-dd"),
        tutto_giorno: false,
        evento_generico: false,
        riunione_teams: false,
        link_teams: "",
        cliente_id: null,
        in_sede: true,
        sala: null,
        luogo: "",
        invia_a_tutti: false,
        utente_id: currentUser?.id || "",
        colore: "#3B82F6"
      });
      setSelectedPartecipanti([]);
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingEvento(null);
    setSelectedPartecipanti([]);
  };

  const toggleSettoreParticipants = (settore: "Fiscale" | "Lavoro") => {
    const utentiSettore = utenti
      .filter(u => u.settore === settore || u.settore === "Fiscale & lavoro")
      .map(u => u.id);
    
    // Add only new ones, avoiding duplicates is handled by Set in state update if needed,
    // but here we just want to ensure all from this sector are selected.
    setSelectedPartecipanti(prev => {
      const newSet = new Set([...prev, ...utentiSettore]);
      return Array.from(newSet);
    });
  };

  const deselectAllParticipants = () => {
    setSelectedPartecipanti([]);
  };

  const togglePartecipante = (utenteId: string) => {
    setSelectedPartecipanti(prev => 
      prev.includes(utenteId) 
        ? prev.filter(id => id !== utenteId)
        : [...prev, utenteId]
    );
  };

  const handleSubmit = async () => {
    try {
      if (!formData.data_inizio || !formData.data_fine) {
        toast({ title: "Errore", description: "Date mancanti", variant: "destructive" });
        return;
      }

      const eventoData = {
        titolo: formData.titolo,
        descrizione: formData.descrizione,
        data_inizio: new Date(formData.data_inizio).toISOString(),
        data_fine: new Date(formData.data_fine).toISOString(),
        tutto_giorno: formData.tutto_giorno,
        evento_generico: formData.evento_generico,
        riunione_teams: formData.riunione_teams,
        link_teams: formData.riunione_teams ? formData.link_teams : null,
        cliente_id: formData.cliente_id,
        in_sede: formData.in_sede,
        sala: formData.sala,
        luogo: formData.luogo,
        utente_id: formData.utente_id,
        colore: formData.colore,
        studio_id: currentUser?.studio_id || null // Handle potential missing studio_id
      };

      if (editingEvento) {
        await eventoService.updateEvento(editingEvento.id, eventoData);
        toast({ title: "Successo", description: "Evento aggiornato" });
      } else {
        await eventoService.createEvento(eventoData);
        toast({ title: "Successo", description: "Evento creato" });
      }

      closeDialog();
      checkUserAndLoad();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({ title: "Errore", description: "Impossibile salvare", variant: "destructive" });
    }
  };

  if (loading) return <div className="p-8 text-center">Caricamento...</div>;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Agenda</h1>
          <p className="text-gray-500">Gestione appuntamenti e calendario</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setViewMode(viewMode === "calendar" ? "list" : "calendar")}>
            {viewMode === "calendar" ? <List className="mr-2 h-4 w-4" /> : <CalendarDays className="mr-2 h-4 w-4" />}
            {viewMode === "calendar" ? "Vista Lista" : "Vista Calendario"}
          </Button>
          <Button onClick={() => openDialog()}>
            <Plus className="mr-2 h-4 w-4" /> Nuovo Evento
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Sistema Colori
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500" />
              <span className="text-sm">Blu — Evento generico</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500" />
              <span className="text-sm">Verde — In sede</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500" />
              <span className="text-sm">Rosso — Fuori sede</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#F97316]" />
              <span className="text-sm">Arancio — Riunione Teams</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {viewMode === "calendar" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <Button variant="outline" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>←</Button>
            <CardTitle>{format(currentMonth, "MMMM yyyy", { locale: it })}</CardTitle>
            <Button variant="outline" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>→</Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map(day => (
                <div key={day} className="text-center font-semibold text-sm p-2">{day}</div>
              ))}
              {daysInMonth.map(day => {
                const eventiGiorno = eventiDelGiorno(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-[100px] border rounded p-2 cursor-pointer hover:bg-gray-50",
                      !isSameMonth(day, currentMonth) && "bg-gray-100 text-gray-400"
                    )}
                    onClick={() => openDialog()}
                  >
                    <div className="font-semibold text-sm mb-1">{format(day, "d")}</div>
                    <div className="space-y-1">
                      {eventiGiorno.map(e => (
                        <div
                          key={e.id}
                          className="text-xs p-1 rounded text-white truncate"
                          style={{ backgroundColor: e.colore }}
                          title={e.titolo}
                        >
                          {e.titolo}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {eventiConDettagli.map(e => (
                <div
                  key={e.id}
                  className="flex items-center gap-4 p-4 border rounded hover:bg-gray-50 cursor-pointer"
                  onClick={() => openDialog(e)}
                >
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: e.colore }} />
                  <div className="flex-1">
                    <div className="font-semibold">{e.titolo}</div>
                    <div className="text-sm text-gray-500">
                      {format(parseISO(e.data_inizio), "dd/MM/yyyy", { locale: it })}
                    </div>
                  </div>
                  {e.cliente_nome && <Badge>{e.cliente_nome}</Badge>}
                  {e.riunione_teams && <Badge variant="outline"><LinkIcon className="h-3 w-3" /></Badge>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvento ? "Modifica Evento" : "Nuovo Evento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Titolo</Label>
              <Input
                value={formData.titolo}
                onChange={e => setFormData({ ...formData, titolo: e.target.value })}
                placeholder="Titolo evento"
              />
            </div>

            <div>
              <Label>Descrizione</Label>
              <Textarea
                value={formData.descrizione}
                onChange={e => setFormData({ ...formData, descrizione: e.target.value })}
                placeholder="Descrizione evento"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Inizio</Label>
                <Input
                  type="date"
                  value={formData.data_inizio}
                  onChange={e => setFormData({ ...formData, data_inizio: e.target.value })}
                />
              </div>
              <div>
                <Label>Data Fine</Label>
                <Input
                  type="date"
                  value={formData.data_fine}
                  onChange={e => setFormData({ ...formData, data_fine: e.target.value })}
                />
              </div>
            </div>

            {/* Layout in una riga singola come richiesto */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="tutto_giorno"
                  checked={formData.tutto_giorno}
                  onCheckedChange={checked => setFormData({ ...formData, tutto_giorno: checked as boolean })}
                />
                <Label htmlFor="tutto_giorno">Tutto il giorno</Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="evento_generico"
                  checked={formData.evento_generico}
                  onCheckedChange={checked => setFormData({ ...formData, evento_generico: checked as boolean })}
                />
                <Label htmlFor="evento_generico">Evento Generico (senza cliente)</Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="riunione_teams"
                  checked={formData.riunione_teams}
                  onCheckedChange={checked => setFormData({ ...formData, riunione_teams: checked as boolean })}
                />
                <Label htmlFor="riunione_teams">Riunione Teams</Label>
              </div>
            </div>

            {/* Link Teams sempre visibile ma disabilitato se non spuntato */}
            <div>
              <Label htmlFor="link_teams">Link Teams</Label>
              <Input
                id="link_teams"
                type="url"
                placeholder="https://teams.microsoft.com/..."
                value={formData.link_teams}
                onChange={e => setFormData({ ...formData, link_teams: e.target.value })}
                disabled={!formData.riunione_teams}
                className={!formData.riunione_teams ? "bg-gray-100 cursor-not-allowed opacity-50" : ""}
              />
            </div>

            {!formData.evento_generico && (
              <div>
                <Label>Cliente</Label>
                <Select
                  value={formData.cliente_id || ""}
                  onValueChange={val => setFormData({ ...formData, cliente_id: val || null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clienti.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.ragione_sociale}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="in_sede"
                  checked={formData.in_sede}
                  onCheckedChange={checked => setFormData({ ...formData, in_sede: checked as boolean })}
                />
                <Label htmlFor="in_sede">In Sede</Label>
              </div>

              {formData.in_sede ? (
                <div>
                  <Label>Sala</Label>
                  <Select
                    value={formData.sala || ""}
                    onValueChange={val => setFormData({ ...formData, sala: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona sala" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SALE_CONFIG).map(([id, info]) => (
                        <SelectItem key={id} value={id}>{info.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label>Luogo</Label>
                  <Input
                    value={formData.luogo}
                    onChange={e => setFormData({ ...formData, luogo: e.target.value })}
                    placeholder="Indirizzo o luogo"
                  />
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5" />
                <Label className="text-base font-semibold">Partecipanti (Notifiche Email)</Label>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-sm text-blue-800">
                ℹ️ I partecipanti riceveranno un'email con i dettagli
              </div>

              <div className="flex items-center gap-2 mb-4">
                <Checkbox
                  id="invia_a_tutti"
                  checked={formData.invia_a_tutti}
                  onCheckedChange={checked => setFormData({ ...formData, invia_a_tutti: checked as boolean })}
                />
                <Label htmlFor="invia_a_tutti" className="font-semibold">
                  🚀 Invia a TUTTI ({utenti.length} persone)
                </Label>
              </div>

              {/* Pulsanti selezione rapida */}
              <div className="mb-3">
                <Label className="mb-2 block font-medium">Selezione rapida partecipanti</Label>
                <div className="flex gap-2 mb-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSettoreParticipants("Lavoro")}
                  >
                    Settore Lavoro
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSettoreParticipants("Fiscale")}
                  >
                    Settore Fiscale
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={deselectAllParticipants}
                  >
                    Deseleziona Tutti
                  </Button>
                </div>

                <ScrollArea className="h-[200px] border rounded-md p-4">
                  <div className="space-y-2">
                    {utenti.map(u => (
                      <div key={u.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`user-${u.id}`}
                          checked={selectedPartecipanti.includes(u.id)}
                          onCheckedChange={() => togglePartecipante(u.id)}
                        />
                        <Label htmlFor={`user-${u.id}`} className="cursor-pointer flex-1">
                          {u.nome} {u.cognome}
                          {u.settore && (
                            <span className="ml-2 text-xs text-gray-500">({u.settore})</span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSubmit} className="flex-1">
                {editingEvento ? "Aggiorna" : "Crea"} Evento
              </Button>
              <Button variant="outline" onClick={closeDialog}>
                Annulla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}