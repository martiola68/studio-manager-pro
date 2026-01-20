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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar as CalendarIcon, Plus, Search, Pencil, Trash2, User } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type Promemoria = any;
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
        p.titolo.toLowerCase().includes(search) ||
        p.descrizione?.toLowerCase().includes(search)
      );
    }

    if (filterStato !== "all") {
      filtered = filtered.filter(p => p.working_progress === filterStato);
    }

    setFilteredPromemoria(filtered);
  };

  const resetForm = () => {
    setFormData({
      titolo: "",
      descrizione: "",
      data_scadenza: undefined,
      priorita: "Media",
      working_progress: "Aperto",
      destinatario_id: "",
      settore: currentUser?.settore || ""
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
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

  const handleEdit = (promemoria: Promemoria) => {
    setSelectedPromemoria(promemoria);
    setFormData({
      titolo: promemoria.titolo,
      descrizione: promemoria.descrizione || "",
      data_scadenza: new Date(promemoria.data_scadenza),
      priorita: promemoria.priorita,
      working_progress: promemoria.working_progress,
      destinatario_id: promemoria.destinatario_id || "",
      settore: promemoria.settore || ""
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPromemoria || !formData.titolo || !formData.data_scadenza) return;

    try {
      setLoading(true);
      await promemoriaService.updatePromemoria(selectedPromemoria.id, {
        titolo: formData.titolo,
        descrizione: formData.descrizione,
        data_scadenza: format(formData.data_scadenza, "yyyy-MM-dd"),
        priorita: formData.priorita,
        working_progress: formData.working_progress,
        destinatario_id: formData.destinatario_id || null,
        settore: formData.settore
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

  const handleDeleteClick = (promemoria: Promemoria) => {
    setSelectedPromemoria(promemoria);
    setIsDeleteDialogOpen(true);
  };

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

  const FormFields = () => (
    <>
      <div>
        <Label>Titolo *</Label>
        <Input 
          value={formData.titolo}
          onChange={e => setFormData({...formData, titolo: e.target.value})}
          required
          placeholder="Inserisci titolo promemoria"
        />
      </div>
      
      <div>
        <Label>Descrizione</Label>
        <Input 
          value={formData.descrizione || ""}
          onChange={e => setFormData({...formData, descrizione: e.target.value})}
          placeholder="Dettagli aggiuntivi"
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
            value={formData.destinatario_id || "none"}
            onValueChange={val => setFormData({...formData, destinatario_id: val === "none" ? "" : val})}
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
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Priorità *</Label>
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
          <Label>Stato *</Label>
          <Select
            value={formData.working_progress}
            onValueChange={val => setFormData({...formData, working_progress: val})}
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
        <div>
          <Label>Scadenza *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.data_scadenza ? format(formData.data_scadenza, "dd/MM/yyyy") : "Seleziona"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formData.data_scadenza}
                onSelect={(date) => setFormData(prev => ({...prev, data_scadenza: date || undefined}))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </>
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Promemoria</h1>
          <p className="text-gray-500">Gestione attività e scadenze personali</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nuovo Promemoria
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nuovo Promemoria</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <FormFields />
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
                filteredPromemoria.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.titolo}</TableCell>
                    <TableCell className="max-w-xs truncate">{p.descrizione || "-"}</TableCell>
                    <TableCell>{format(new Date(p.data_scadenza), "dd/MM/yyyy", { locale: it })}</TableCell>
                    <TableCell>{getPrioritaBadge(p.priorita)}</TableCell>
                    <TableCell>{getStatoBadge(p.working_progress || "Aperto")}</TableCell>
                    <TableCell>
                      {p.operatore ? `${p.operatore.nome} ${p.operatore.cognome}` : "-"}
                    </TableCell>
                    <TableCell>
                      {p.destinatario ? `${p.destinatario.nome} ${p.destinatario.cognome}` : "-"}
                    </TableCell>
                    <TableCell>
                      {p.settore ? <Badge variant="outline">{p.settore}</Badge> : "-"}
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifica Promemoria</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 pt-4">
            <FormFields />
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