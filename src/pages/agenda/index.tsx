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
import { Calendar, Plus, Edit, Trash2, MapPin, Building2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type EventoAgenda = Database["public"]["Tables"]["tbagenda"]["Row"];
type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

const SALE = ["Riunioni", "Briefing", "Stanza Personale"];
const COLORI_EVENTO = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

export default function AgendaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [eventi, setEventi] = useState<EventoAgenda[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [currentUser, setCurrentUser] = useState<Utente | null>(null);
  const [vistaCorrente, setVistaCorrente] = useState<"mensile" | "settimanale">("mensile");
  const [dataSelezionata, setDataSelezionata] = useState(new Date());
  const [filtroUtente, setFiltroUtente] = useState("");
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
    in_sede: true,
    sala: "",
    luogo: "",
    colore: COLORI_EVENTO[0]
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.titolo || !formData.data_inizio || !formData.data_fine) {
      toast({
        title: "Errore",
        description: "Compila i campi obbligatori",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingEvento) {
        await eventoService.updateEvento(editingEvento.id, formData);
        toast({
          title: "Successo",
          description: "Evento aggiornato con successo"
        });
      } else {
        await eventoService.createEvento(formData);
        toast({
          title: "Successo",
          description: "Evento creato con successo"
        });
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
    setFormData({
      titolo: evento.titolo,
      descrizione: evento.descrizione || "",
      data_inizio: evento.data_inizio,
      data_fine: evento.data_fine,
      tutto_giorno: evento.tutto_giorno || false,
      utente_id: evento.utente_id || "",
      cliente_id: evento.cliente_id || "",
      in_sede: evento.in_sede ?? true,
      sala: evento.sala || "",
      luogo: evento.luogo || "",
      colore: evento.colore || COLORI_EVENTO[0]
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
      in_sede: true,
      sala: "",
      luogo: "",
      colore: COLORI_EVENTO[0]
    });
    setEditingEvento(null);
  };

  const getEventiPerGiorno = (data: Date) => {
    return eventi.filter(e => {
      const eventoData = new Date(e.data_inizio);
      return (
        eventoData.getDate() === data.getDate() &&
        eventoData.getMonth() === data.getMonth() &&
        eventoData.getFullYear() === data.getFullYear() &&
        (!filtroUtente || e.utente_id === filtroUtente)
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
      <div className="grid grid-cols-7 gap-2">
        {["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"].map((giorno) => (
          <div key={giorno} className="text-center font-semibold text-sm py-2 bg-gray-100 rounded">
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
              className={`min-h-[100px] border rounded-lg p-2 ${
                fuoriMese ? "bg-gray-50 text-gray-400" : "bg-white"
              } ${oggi ? "ring-2 ring-blue-500" : ""}`}
            >
              <div className="text-sm font-semibold mb-1">{data.getDate()}</div>
              <div className="space-y-1">
                {eventiGiorno.slice(0, 3).map((evento) => (
                  <div
                    key={evento.id}
                    className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                    style={{ backgroundColor: evento.colore || "#3B82F6", color: "white" }}
                    onClick={() => handleEdit(evento)}
                  >
                    {evento.titolo}
                  </div>
                ))}
                {eventiGiorno.length > 3 && (
                  <div className="text-xs text-gray-500">+{eventiGiorno.length - 3} altri</div>
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
      <div className="grid grid-cols-7 gap-2">
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
                  const utenteEvento = utenti.find(u => u.id === evento.utente_id);
                  const clienteEvento = clienti.find(c => c.id === evento.cliente_id);
                  
                  return (
                    <div
                      key={evento.id}
                      className="text-xs p-2 rounded cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: evento.colore || "#3B82F6", color: "white" }}
                      onClick={() => handleEdit(evento)}
                    >
                      <div className="font-semibold truncate">{evento.titolo}</div>
                      {!evento.tutto_giorno && (
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {new Date(evento.data_inizio).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                      {evento.in_sede && evento.sala && (
                        <div className="flex items-center gap-1 mt-1">
                          <Building2 className="h-3 w-3" />
                          {evento.sala}
                        </div>
                      )}
                      {!evento.in_sede && evento.luogo && (
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {evento.luogo}
                        </div>
                      )}
                      {utenteEvento && (
                        <div className="text-[10px] mt-1 opacity-90">
                          {utenteEvento.nome} {utenteEvento.cognome}
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
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Agenda</h1>
                <p className="text-gray-500 mt-1">Gestione appuntamenti e calendario</p>
              </div>
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Nuovo Evento
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
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

                    <div className="grid grid-cols-2 gap-4">
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
                        className="rounded"
                      />
                      <Label htmlFor="tutto_giorno" className="cursor-pointer">Tutto il giorno</Label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="utente_id">Utente</Label>
                        <Select
                          value={formData.utente_id}
                          onValueChange={(value) => setFormData({ ...formData, utente_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona utente" />
                          </SelectTrigger>
                          <SelectContent>
                            {utenti.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.nome} {u.cognome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cliente_id">Cliente</Label>
                        <Select
                          value={formData.cliente_id}
                          onValueChange={(value) => setFormData({ ...formData, cliente_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Nessuno</SelectItem>
                            {clienti.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.ragione_sociale}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="in_sede"
                        checked={formData.in_sede}
                        onChange={(e) => setFormData({ ...formData, in_sede: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor="in_sede" className="cursor-pointer">In Sede</Label>
                    </div>

                    {formData.in_sede ? (
                      <div className="space-y-2">
                        <Label htmlFor="sala">Sala</Label>
                        <Select
                          value={formData.sala}
                          onValueChange={(value) => setFormData({ ...formData, sala: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona sala" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Nessuna</SelectItem>
                            {SALE.map((sala) => (
                              <SelectItem key={sala} value={sala}>
                                {sala}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="luogo">Luogo</Label>
                        <Input
                          id="luogo"
                          value={formData.luogo}
                          onChange={(e) => setFormData({ ...formData, luogo: e.target.value })}
                          placeholder="Inserisci indirizzo"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Colore</Label>
                      <div className="flex gap-2">
                        {COLORI_EVENTO.map((colore) => (
                          <button
                            key={colore}
                            type="button"
                            className={`w-8 h-8 rounded-full border-2 ${
                              formData.colore === colore ? "border-gray-900" : "border-transparent"
                            }`}
                            style={{ backgroundColor: colore }}
                            onClick={() => setFormData({ ...formData, colore })}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      onClick={() => vistaCorrente === "mensile" ? cambiaMese(-1) : cambiaSettimana(-1)}
                    >
                      ←
                    </Button>
                    <CardTitle>
                      {dataSelezionata.toLocaleDateString("it-IT", { 
                        month: "long", 
                        year: "numeric" 
                      })}
                    </CardTitle>
                    <Button
                      variant="outline"
                      onClick={() => vistaCorrente === "mensile" ? cambiaMese(1) : cambiaSettimana(1)}
                    >
                      →
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDataSelezionata(new Date())}
                    >
                      Oggi
                    </Button>
                  </div>

                  <div className="flex items-center gap-4">
                    <Select value={filtroUtente} onValueChange={setFiltroUtente}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filtra per utente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Tutti gli utenti</SelectItem>
                        {utenti.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.nome} {u.cognome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex gap-2">
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
                <CardTitle>Legenda</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span className="text-sm">In Sede</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded"></div>
                    <span className="text-sm">Fuori Sede</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-600" />
                    <span className="text-sm">Con Sala</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-600" />
                    <span className="text-sm">Con Indirizzo</span>
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