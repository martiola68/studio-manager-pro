import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { promemoriaService } from "@/services/promemoriaService";
import { utenteService } from "@/services/utenteService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Plus, Search, CheckCircle2, AlertCircle, Clock, Filter, User } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type Promemoria = any; // Tipizzo any per semplicità qui, ma ideale usare Database types
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

export default function PromemoriaPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [promemoria, setPromemoria] = useState<Promemoria[]>([]);
  const [filteredPromemoria, setFilteredPromemoria] = useState<Promemoria[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [currentUser, setCurrentUser] = useState<Utente | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStato, setFilterStato] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    titolo: "",
    descrizione: "",
    data_scadenza: undefined as Date | undefined,
    priorita: "Media",
    working_progress: "Aperto",
    destinatario_id: "",
    settore: ""
  });

  useEffect(() => {
    checkUserAndLoad();
  }, []);

  useEffect(() => {
    filterData();
  }, [promemoria, searchTerm, filterStato]);

  const checkUserAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const user = await utenteService.getUtenteById(session.user.id);
      setCurrentUser(user);

      // Auto-popola settore se l'utente ne ha uno
      if (user?.settore) {
        setFormData(prev => ({ ...prev, settore: user.settore || "" }));
      }

      const [promData, utentiData] = await Promise.all([
        promemoriaService.getPromemoria(),
        utenteService.getUtenti()
      ]);

      setPromemoria(promData || []);
      setUtenti(utentiData || []);
    } catch (error) {
      console.error("Errore caricamento:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    if (!currentUser) return;

    let filtered = promemoria;

    // FILTRO PERMESSI
    if (currentUser.responsabile) {
      // Responsabile: vede i propri + quelli del proprio settore (gruppo)
      filtered = filtered.filter(p => 
        p.operatore_id === currentUser.id || 
        p.destinatario_id === currentUser.id ||
        (p.settore === currentUser.settore && currentUser.settore)
      );
    } else {
      // Utente normale: vede solo i propri (inseriti o destinati)
      filtered = filtered.filter(p => 
        p.operatore_id === currentUser.id || 
        p.destinatario_id === currentUser.id
      );
    }

    // Filtro ricerca testo
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.titolo.toLowerCase().includes(search) ||
        p.descrizione?.toLowerCase().includes(search)
      );
    }

    // Filtro stato (usare working_progress invece di stato)
    if (filterStato !== "all") {
      filtered = filtered.filter(p => p.working_progress === filterStato);
    }

    setFilteredPromemoria(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titolo || !formData.data_scadenza) return;

    try {
      setLoading(true);
      await promemoriaService.createPromemoria({
        titolo: formData.titolo,
        descrizione: formData.descrizione,
        data_scadenza: format(formData.data_scadenza, "yyyy-MM-dd"),
        priorita: formData.priorita,
        stato: formData.working_progress,
        operatore_id: currentUser?.id ?? "",
        destinatario_id: formData.destinatario_id || null,
        settore: formData.settore || currentUser?.settore || ""
      });

      toast({ title: "Successo", description: "Promemoria creato" });
      setIsDialogOpen(false);
      checkUserAndLoad();
      
      setFormData({
        titolo: "",
        descrizione: "",
        data_scadenza: undefined,
        priorita: "Media",
        working_progress: "Aperto",
        destinatario_id: "",
        settore: currentUser?.settore || ""
      });
    } catch (error) {
      console.error("Errore creazione:", error);
      toast({ title: "Errore", description: "Impossibile creare promemoria", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getStatoBadge = (stato: string) => {
    const styles: Record<string, string> = {
      "Aperto": "bg-blue-100 text-blue-800",
      "In lavorazione": "bg-yellow-100 text-yellow-800",
      "Completato": "bg-green-100 text-green-800",
      "Annullato": "bg-gray-100 text-gray-800",
      "Presa visione": "bg-purple-100 text-purple-800",
      "Richiesta confronto": "bg-orange-100 text-orange-800"
    };
    return <Badge className={styles[stato] || "bg-gray-100"}>{stato}</Badge>;
  };

  if (loading) return <div className="p-8 text-center">Caricamento...</div>;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Promemoria</h1>
          <p className="text-gray-500">Gestione attività e scadenze personali</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nuovo Promemoria
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nuovo Promemoria</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div>
                <Label>Titolo</Label>
                <Input 
                  value={formData.titolo}
                  onChange={e => setFormData({...formData, titolo: e.target.value})}
                  required
                />
              </div>
              
              <div>
                <Label>Descrizione</Label>
                <Input 
                  value={formData.descrizione || ""}
                  onChange={e => setFormData({...formData, descrizione: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Settore</Label>
                  <Input 
                    value={formData.settore} 
                    disabled 
                    className="bg-gray-100" 
                    placeholder="Automatico"
                  />
                </div>
                <div>
                  <Label>Destinatario</Label>
                  <Select
                    value={formData.destinatario_id}
                    onValueChange={val => setFormData({...formData, destinatario_id: val})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nessuno</SelectItem>
                      {utenti.map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nome} {u.cognome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priorità</Label>
                  <Select
                    value={formData.priorita}
                    onValueChange={val => setFormData({...formData, priorita: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bassa">Bassa</SelectItem>
                      <SelectItem value="Media">Media</SelectItem>
                      <SelectItem value="Alta">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Scadenza</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.data_scadenza ? format(formData.data_scadenza, "dd/MM/yyyy") : "Seleziona data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.data_scadenza}
                        onSelect={(date) => {
                          setFormData(prev => ({...prev, data_scadenza: date || undefined}));
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvataggio..." : "Crea Promemoria"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Cerca promemoria..." 
            className="pl-10"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filterStato} onValueChange={setFilterStato}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtra stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="Aperto">Aperto</SelectItem>
            <SelectItem value="In lavorazione">In lavorazione</SelectItem>
            <SelectItem value="Presa visione">Presa visione</SelectItem>
            <SelectItem value="Richiesta confronto">Richiesta confronto</SelectItem>
            <SelectItem value="Completato">Completato</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredPromemoria.map(p => (
          <Card key={p.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-semibold line-clamp-1" title={p.titolo}>
                {p.titolo}
              </CardTitle>
              {getStatoBadge(p.working_progress || "Aperto")}
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4 line-clamp-2">{p.descrizione || "Nessuna descrizione"}</p>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center text-gray-600">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(new Date(p.data_scadenza), "dd MMM yyyy", { locale: it })}
                </div>
                
                <div className="flex items-center text-gray-600">
                  <User className="mr-2 h-4 w-4" />
                  Da: {p.operatore?.nome} {p.operatore?.cognome}
                </div>

                {p.destinatario && (
                  <div className="flex items-center text-blue-600">
                    <User className="mr-2 h-4 w-4" />
                    A: {p.destinatario.nome} {p.destinatario.cognome}
                  </div>
                )}
                
                {p.settore && (
                   <div className="flex items-center text-gray-500 text-xs">
                     <Badge variant="outline">{p.settore}</Badge>
                   </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredPromemoria.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            Nessun promemoria trovato
          </div>
        )}
      </div>
    </div>
  );
}