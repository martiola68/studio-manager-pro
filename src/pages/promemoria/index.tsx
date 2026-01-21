import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { promemoriaService } from "@/services/promemoriaService";
import { utenteService } from "@/services/utenteService";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar as CalendarIcon, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { format, addDays } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Database } from "@/lib/supabase/types";

// Definisco i tipi esatti restituiti dalla query Supabase
type UtenteJoin = Pick<Database["public"]["Tables"]["tbutenti"]["Row"], "id" | "nome" | "cognome" | "settore" | "responsabile">;

type Promemoria = Database["public"]["Tables"]["tbpromemoria"]["Row"] & {
  operatore?: UtenteJoin | null;
  destinatario?: UtenteJoin | null;
};
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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPromemoria, setSelectedPromemoria] = useState<Promemoria | null>(null);
  
  const [formData, setFormData] = useState({
    titolo: "",
    descrizione: "",
    data: undefined as Date | undefined,
    giorni_scadenza: 0,
    data_scadenza: undefined as Date | undefined,
    priorita: "Media",
    working_progress: "Aperto",
    destinatario_id: "",
    settore: ""
  });

  const [isDataCalendarOpen, setIsDataCalendarOpen] = useState(false);
  const [isEditDataCalendarOpen, setIsEditDataCalendarOpen] = useState(false);

  // Calcola automaticamente data_scadenza quando cambiano data o giorni_scadenza
  useEffect(() => {
    if (formData.data && formData.giorni_scadenza >= 0) {
      const scadenza = addDays(formData.data, formData.giorni_scadenza);
      setFormData(prev => ({ ...prev, data_scadenza: scadenza }));
    }
  }, [formData.data, formData.giorni_scadenza]);

  // Helper per verificare se scaduto
  const isScaduto = (p: Promemoria) => {
    if (p.working_progress === "Completato") return false;
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const scadenza = new Date(p.data_scadenza);
    scadenza.setHours(0, 0, 0, 0);
    return scadenza < oggi;
  };

  useEffect(() => {
    checkUserAndLoad();
  }, []);

  useEffect(() => {
    filterData();
  }, [promemoria, searchTerm, filterStato]);

  // Carica promemoria e utenti all'avvio
  useEffect(() => {
    if (currentUser) {
      loadPromemoria();
      loadUtenti();
      
      // ✅ CONTROLLO AUTOMATICO NOTIFICHE SCADENZA
      if (currentUser.studio_id) {
        promemoriaService.controllaEInviaNotificheScadenza(
          currentUser.id,
          currentUser.studio_id
        ).catch(err => {
          console.error("Errore controllo notifiche:", err);
        });
      }
    }
  }, [currentUser]);

  const loadPromemoria = async () => {
    try {
      setLoading(true);
      const data = await promemoriaService.getPromemoria();
      setPromemoria(data || []);
    } catch (error: any) {
      console.error("Errore caricamento promemoria:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i promemoria",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUtenti = async () => {
    try {
      const data = await utenteService.getUtenti();
      setUtenti(data || []);
    } catch (error) {
      console.error("Errore caricamento utenti:", error);
    }
  };

  const checkUserAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const user = await utenteService.getUtenteById(session.user.id);
      setCurrentUser(user);

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

    if (currentUser.responsabile) {
      filtered = filtered.filter(p => 
        p.operatore_id === currentUser.id || 
        p.destinatario_id === currentUser.id ||
        (p.settore === currentUser.settore && currentUser.settore)
      );
    } else {
      filtered = filtered.filter(p => 
        p.operatore_id === currentUser.id || 
        p.destinatario_id === currentUser.id
      );
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        (p.titolo || "").toLowerCase().includes(search) ||
        (p.descrizione || "").toLowerCase().includes(search)
      );
    }

    if (filterStato !== "all") {
      filtered = filtered.filter(p => p.working_progress === filterStato);
    }

    setFilteredPromemoria(filtered);
  };

  const resetForm = useCallback(() => {
    if (!currentUser) return;
    
    // Se utente NON è responsabile → auto-seleziona se stesso come destinatario
    if (!currentUser.responsabile) {
      setFormData({
        titolo: "",
        descrizione: "",
        data: undefined,
        giorni_scadenza: 0,
        data_scadenza: undefined,
        priorita: "Media",
        working_progress: "Aperto",
        destinatario_id: currentUser.id,
        settore: currentUser.settore || ""
      });
    } else {
      // Se responsabile → form vuoto
      setFormData({
        titolo: "",
        descrizione: "",
        data: undefined,
        giorni_scadenza: 0,
        data_scadenza: undefined,
        priorita: "Media",
        working_progress: "Aperto",
        destinatario_id: "",
        settore: ""
      });
    }
  }, [currentUser]);

  const handleOpenCreateDialog = useCallback(() => {
    resetForm();
    setIsDataCalendarOpen(false);
    setIsCreateDialogOpen(true);
  }, [resetForm]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titolo || !formData.data || !formData.data_scadenza) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      await promemoriaService.createPromemoria({
        titolo: formData.titolo,
        descrizione: formData.descrizione,
        data_inserimento: format(formData.data, "yyyy-MM-dd"),
        giorni_scadenza: formData.giorni_scadenza,
        data_scadenza: format(formData.data_scadenza, "yyyy-MM-dd"),
        priorita: formData.priorita,
        stato: formData.working_progress,
        operatore_id: currentUser?.id ?? "",
        destinatario_id: formData.destinatario_id || null,
        settore: formData.settore || ""
      });

      toast({ title: "Successo", description: "Promemoria creato" });
      setIsCreateDialogOpen(false);
      resetForm();
      checkUserAndLoad();
    } catch (error) {
      console.error("Errore creazione:", error);
      toast({ title: "Errore", description: "Impossibile creare promemoria", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = useCallback((promemoria: Promemoria) => {
    setSelectedPromemoria(promemoria);
    setFormData({
      titolo: promemoria.titolo || "",
      descrizione: promemoria.descrizione || "",
      data: promemoria.data_inserimento ? new Date(promemoria.data_inserimento) : undefined,
      giorni_scadenza: promemoria.giorni_scadenza || 0,
      data_scadenza: promemoria.data_scadenza ? new Date(promemoria.data_scadenza) : undefined,
      priorita: promemoria.priorita || "Media",
      working_progress: promemoria.working_progress || "Aperto",
      destinatario_id: promemoria.destinatario_id || "",
      settore: promemoria.settore || ""
    });
    setIsEditDataCalendarOpen(false);
    setIsEditDialogOpen(true);
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPromemoria || !formData.titolo || !formData.data || !formData.data_scadenza) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      await promemoriaService.updatePromemoria(selectedPromemoria.id, {
        titolo: formData.titolo,
        descrizione: formData.descrizione,
        data_inserimento: format(formData.data, "yyyy-MM-dd"),
        giorni_scadenza: formData.giorni_scadenza,
        data_scadenza: format(formData.data_scadenza, "yyyy-MM-dd"),
        priorita: formData.priorita,
        working_progress: formData.working_progress,
        destinatario_id: formData.destinatario_id || null,
        settore: formData.settore || undefined
      });

      toast({ title: "Successo", description: "Promemoria aggiornato" });
      setIsEditDialogOpen(false);
      setSelectedPromemoria(null);
      resetForm();
      checkUserAndLoad();
    } catch (error) {
      console.error("Errore aggiornamento:", error);
      toast({ title: "Errore", description: "Impossibile aggiornare promemoria", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = useCallback((promemoria: Promemoria) => {
    setSelectedPromemoria(promemoria);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!selectedPromemoria) return;

    try {
      setLoading(true);
      await promemoriaService.deletePromemoria(selectedPromemoria.id);
      toast({ title: "Successo", description: "Promemoria eliminato" });
      setIsDeleteDialogOpen(false);
      setSelectedPromemoria(null);
      checkUserAndLoad();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({ title: "Errore", description: "Impossibile eliminare promemoria", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDestinatarioChange = useCallback((val: string) => {
    if (val === "none") {
      setFormData(prev => ({
        ...prev,
        destinatario_id: "",
        settore: ""
      }));
    } else {
      const selectedUser = utenti.find(u => u.id === val);
      setFormData(prev => ({
        ...prev,
        destinatario_id: val,
        settore: selectedUser?.settore || ""
      }));
    }
  }, [utenti]);

  const getStatoBadge = (stato: string) => {
    const styles: Record<string, string> = {
      "Aperto": "bg-blue-100 text-blue-800",
      "In lavorazione": "bg-yellow-100 text-yellow-800",
      "Completato": "bg-green-100 text-green-800",
      "Annullato": "bg-gray-100 text-gray-800",
      "Presa visione": "bg-purple-100 text-purple-800",
      "Richiesta confronto": "bg-orange-100 text-orange-800"
    };
    return <Badge className={styles[stato] || "bg-gray-100 text-gray-800"}>{stato}</Badge>;
  };

  const getPrioritaBadge = (priorita: string) => {
    const styles: Record<string, string> = {
      "Bassa": "bg-gray-100 text-gray-800",
      "Media": "bg-blue-100 text-blue-800",
      "Alta": "bg-red-100 text-red-800"
    };
    return <Badge variant="outline" className={styles[priorita] || ""}>{priorita}</Badge>;
  };

  if (loading && promemoria.length === 0) {
    return <div className="p-8 text-center">Caricamento...</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gestione Promemoria</h1>
          {currentUser && (
            <div className="flex items-center gap-2 mt-2">
              {currentUser.responsabile ? (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  👁️ Modalità Responsabile: Visualizzi tutti i promemoria del settore &quot;{currentUser.settore}&quot;
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                  👤 Modalità Utente: Visualizzi solo i tuoi promemoria
                </Badge>
              )}
            </div>
          )}
        </div>
        <Button onClick={handleOpenCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Nuovo Promemoria
        </Button>
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
          <SelectTrigger className="w-[200px]">
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titolo</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>Scadenza</TableHead>
                <TableHead>Priorità</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Operatore</TableHead>
                <TableHead>Destinatario</TableHead>
                <TableHead>Settore</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPromemoria.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    Nessun promemoria trovato
                  </TableCell>
                </TableRow>
              ) : (
                filteredPromemoria.map(p => {
                  const scaduto = isScaduto(p);
                  const annullato = p.working_progress === "Annullato";
                  
                  // ✅ PRIORITÀ: Annullato > Scaduto > Normale
                  const rowClass = annullato 
                    ? "bg-gray-100" // Darkened from bg-gray-50
                    : scaduto 
                    ? "bg-red-50" 
                    : "";
                  
                  const textClass = annullato 
                    ? "text-gray-500" 
                    : scaduto 
                    ? "text-red-700" 
                    : "";
                  
                  return (
                    <TableRow key={p.id} className={rowClass}>
                      <TableCell className={`font-medium ${textClass}`}>{p.titolo || "Senza titolo"}</TableCell>
                      <TableCell className={`max-w-xs truncate ${textClass}`}>{p.descrizione || "-"}</TableCell>
                      <TableCell className={textClass}>{format(new Date(p.data_scadenza), "dd/MM/yyyy", { locale: it })}</TableCell>
                      <TableCell>{getPrioritaBadge(p.priorita || "Media")}</TableCell>
                      <TableCell>{getStatoBadge(p.working_progress || "Aperto")}</TableCell>
                      <TableCell className={textClass}>
                        {p.operatore ? `${p.operatore.nome} ${p.operatore.cognome}` : "-"}
                      </TableCell>
                      <TableCell className={textClass}>
                        {p.destinatario ? `${p.destinatario.nome} ${p.destinatario.cognome}` : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={textClass}>{p.settore || "Non specificato"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(p)}
                            title="Modifica"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(p)}
                            title="Elimina"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* DIALOG CREAZIONE PROMEMORIA */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuovo Promemoria</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-4">
            <div>
              <Label>Titolo *</Label>
              <Input 
                value={formData.titolo}
                onChange={e => setFormData(prev => ({...prev, titolo: e.target.value}))}
                required
                placeholder="Inserisci titolo promemoria"
              />
            </div>
            
            <div>
              <Label>Descrizione</Label>
              <Input 
                value={formData.descrizione}
                onChange={e => setFormData(prev => ({...prev, descrizione: e.target.value}))}
                placeholder="Dettagli aggiuntivi"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Destinatario</Label>
                {currentUser?.responsabile ? (
                  <Select
                    value={formData.destinatario_id || "none"}
                    onValueChange={handleDestinatarioChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      {utenti.map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nome} {u.cognome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input 
                    value={currentUser ? `${currentUser.nome} ${currentUser.cognome}` : ""} 
                    disabled 
                    className="bg-gray-100" 
                  />
                )}
              </div>
              <div>
                <Label>Settore</Label>
                <Input 
                  value={formData.settore || ""} 
                  disabled 
                  className="bg-gray-100" 
                  placeholder={currentUser?.responsabile ? "Seleziona destinatario" : ""}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Data *</Label>
                <Popover open={isDataCalendarOpen} onOpenChange={setIsDataCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className={`w-full justify-start text-left font-normal ${!formData.data && "text-muted-foreground"}`}
                      type="button"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.data ? format(formData.data, "dd/MM/yyyy") : "Seleziona"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.data}
                      onSelect={(date) => {
                        if (date) {
                          setFormData(prev => ({...prev, data: date}));
                          setIsDataCalendarOpen(false);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Giorni Scadenza *</Label>
                <Input 
                  type="number"
                  min="0"
                  value={formData.giorni_scadenza}
                  onChange={e => setFormData(prev => ({...prev, giorni_scadenza: parseInt(e.target.value) || 0}))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Data Scadenza</Label>
                <Input 
                  value={formData.data_scadenza ? format(formData.data_scadenza, "dd/MM/yyyy") : ""}
                  disabled
                  className="bg-gray-100"
                  placeholder="Calcolata"
                />
              </div>
              <div>
                <Label>Priorità *</Label>
                <Select
                  value={formData.priorita}
                  onValueChange={val => setFormData(prev => ({...prev, priorita: val}))}
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
            </div>

            <div>
              <Label>Stato *</Label>
              <Select
                value={formData.working_progress}
                onValueChange={val => setFormData(prev => ({...prev, working_progress: val}))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aperto">Aperto</SelectItem>
                  <SelectItem value="In lavorazione">In lavorazione</SelectItem>
                  <SelectItem value="Presa visione">Presa visione</SelectItem>
                  <SelectItem value="Richiesta confronto">Richiesta confronto</SelectItem>
                  <SelectItem value="Completato">Completato</SelectItem>
                  <SelectItem value="Annullato">Annullato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsCreateDialogOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Creazione..." : "Crea Promemoria"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG MODIFICA PROMEMORIA */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifica Promemoria</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 pt-4">
            <div>
              <Label>Titolo *</Label>
              <Input 
                value={formData.titolo}
                onChange={e => setFormData(prev => ({...prev, titolo: e.target.value}))}
                required
                placeholder="Inserisci titolo promemoria"
              />
            </div>
            
            <div>
              <Label>Descrizione</Label>
              <Input 
                value={formData.descrizione}
                onChange={e => setFormData(prev => ({...prev, descrizione: e.target.value}))}
                placeholder="Dettagli aggiuntivi"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Destinatario</Label>
                <Select
                  value={formData.destinatario_id || "none"}
                  onValueChange={handleDestinatarioChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
                    {utenti.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome} {u.cognome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Settore</Label>
                <Input 
                  value={formData.settore || ""} 
                  disabled 
                  className="bg-gray-100" 
                  placeholder="Seleziona destinatario"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Data *</Label>
                <Popover open={isEditDataCalendarOpen} onOpenChange={setIsEditDataCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className={`w-full justify-start text-left font-normal ${!formData.data && "text-muted-foreground"}`}
                      type="button"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.data ? format(formData.data, "dd/MM/yyyy") : "Seleziona"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.data}
                      onSelect={(date) => {
                        if (date) {
                          setFormData(prev => ({...prev, data: date}));
                          setIsEditDataCalendarOpen(false);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Giorni Scadenza *</Label>
                <Input 
                  type="number"
                  min="0"
                  value={formData.giorni_scadenza}
                  onChange={e => setFormData(prev => ({...prev, giorni_scadenza: parseInt(e.target.value) || 0}))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Data Scadenza</Label>
                <Input 
                  value={formData.data_scadenza ? format(formData.data_scadenza, "dd/MM/yyyy") : ""}
                  disabled
                  className="bg-gray-100"
                  placeholder="Calcolata"
                />
              </div>
              <div>
                <Label>Priorità *</Label>
                <Select
                  value={formData.priorita}
                  onValueChange={val => setFormData(prev => ({...prev, priorita: val}))}
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
            </div>

            <div>
              <Label>Stato *</Label>
              <Select
                value={formData.working_progress}
                onValueChange={val => setFormData(prev => ({...prev, working_progress: val}))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aperto">Aperto</SelectItem>
                  <SelectItem value="In lavorazione">In lavorazione</SelectItem>
                  <SelectItem value="Presa visione">Presa visione</SelectItem>
                  <SelectItem value="Richiesta confronto">Richiesta confronto</SelectItem>
                  <SelectItem value="Completato">Completato</SelectItem>
                  <SelectItem value="Annullato">Annullato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsEditDialogOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Salvataggio..." : "Salva Modifiche"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG ELIMINAZIONE */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare il promemoria &quot;{selectedPromemoria?.titolo}&quot;?
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedPromemoria(null)}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              {loading ? "Eliminazione..." : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}