import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Pencil, 
  Trash2, 
  Plus, 
  Paperclip, 
  Eye, 
  FileText, 
  Image as ImageIcon, 
  File, 
  X,
  Calendar as CalendarIcon
} from "lucide-react";
import { promemoriaService, type Promemoria, type Allegato } from "@/services/promemoriaService";
import { format, addDays } from "date-fns";
import { it } from "date-fns/locale";

// Definizioni tipi locali se non esportati globalmente
interface Utente {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  settore: string | null;
  responsabile: boolean | null;
}

interface TipoPromemoria {
  id: string;
  nome: string;
  colore: string | null;
}

export default function PromemoriaPage() {
  const { toast } = useToast();
  
  // Stati Dati
  const [promemoria, setPromemoria] = useState<Promemoria[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [tipiPromemoria, setTipiPromemoria] = useState<TipoPromemoria[]>([]);
  const [currentUser, setCurrentUser] = useState<Utente | null>(null);
  
  // Stati UI
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAllegatiDialogOpen, setIsAllegatiDialogOpen] = useState(false);
  const [isDocViewerOpen, setIsDocViewerOpen] = useState(false);
  
  // Stati Selezione
  const [selectedPromemoria, setSelectedPromemoria] = useState<Promemoria | null>(null);
  const [viewAllegatiPromemoria, setViewAllegatiPromemoria] = useState<Promemoria | null>(null);
  const [currentDocUrl, setCurrentDocUrl] = useState<string>("");
  
  // Stati File
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [attachmentsToDelete, setAttachmentsToDelete] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    titolo: "",
    descrizione: "",
    data_inserimento: new Date(),
    giorni_scadenza: 0,
    data_scadenza: new Date(),
    priorita: "Media",
    working_progress: "Aperto",
    destinatario_id: "",
    settore: "",
    tipo_promemoria_id: ""
  });

  // Reset form helper
  const resetForm = () => {
    setFormData({
      titolo: "",
      descrizione: "",
      data_inserimento: new Date(),
      giorni_scadenza: 0,
      data_scadenza: new Date(),
      priorita: "Media",
      working_progress: "Aperto",
      destinatario_id: "",
      settore: "",
      tipo_promemoria_id: ""
    });
    setFilesToUpload([]);
    setAttachmentsToDelete([]);
  };

  // Caricamento Iniziale
  const checkUserAndLoad = useCallback(async () => {
    try {
      setLoading(true);
      
      // 1. Get Current User Auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 2. Get User Profile
      const { data: userProfile } = await supabase
        .from("tbutenti")
        .select("*")
        .eq("id", user.id)
        .single();
      
      if (userProfile) setCurrentUser(userProfile);

      // 3. Load Data in parallel
      const [promemoriaResult, utentiData, tipiData] = await Promise.all([
        supabase
          .from("tbpromemoria")
          .select("*")
          .order("data_scadenza", { ascending: true, nullsFirst: false }),
        supabase.from("tbutenti").select("*").order("cognome"),
        supabase.from("tbtipopromemoria").select("*").order("nome")
      ]);

      if (promemoriaResult.data) {
        const promemoriaWithAllegati = await Promise.all(
          promemoriaResult.data.map(async (p) => {
            const allegati = await promemoriaService.getAllegati(p.id);
            return { ...p, allegati };
          })
        );
        setPromemoria(promemoriaWithAllegati);
      }
      if (utentiData.data) setUtenti(utentiData.data);
      if (tipiData.data) setTipiPromemoria(tipiData.data);

    } catch (error) {
      console.error("Errore caricamento dati:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    checkUserAndLoad();
  }, [checkUserAndLoad]);

  // Calcolo Data Scadenza Automatico
  useEffect(() => {
    if (formData.data_inserimento && formData.giorni_scadenza >= 0) {
      const scadenza = addDays(formData.data_inserimento, formData.giorni_scadenza);
      setFormData(prev => ({ ...prev, data_scadenza: scadenza }));
    }
  }, [formData.data_inserimento, formData.giorni_scadenza]);

  // Handlers Allegati
  const handleViewAllegati = (p: Promemoria) => {
    setViewAllegatiPromemoria(p);
    setIsAllegatiDialogOpen(true);
  };

  const handleOpenAllegato = (allegato: Allegato) => {
    const fileExt = allegato.nome.split('.').pop()?.toLowerCase();
    
    // PDF e immagini si aprono direttamente in nuova tab
    if (fileExt === 'pdf' || ['jpg', 'jpeg', 'png', 'gif'].includes(fileExt || '')) {
      window.open(allegato.url, '_blank');
    } 
    // Documenti Office usano Google Docs Viewer
    else if (['doc', 'docx', 'xls', 'xlsx'].includes(fileExt || '')) {
      setCurrentDocUrl(`https://docs.google.com/viewer?url=${encodeURIComponent(allegato.url)}&embedded=true`);
      setIsDocViewerOpen(true);
    }
    // Altri file si aprono in nuova tab
    else {
      window.open(allegato.url, '_blank');
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="h-4 w-4 text-red-500" />;
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return <ImageIcon className="h-4 w-4 text-blue-500" />;
    if (['doc', 'docx'].includes(ext || '')) return <FileText className="h-4 w-4 text-blue-600" />;
    if (['xls', 'xlsx'].includes(ext || '')) return <FileText className="h-4 w-4 text-green-600" />;
    return <File className="h-4 w-4 text-gray-500" />;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFilesToUpload(prev => [...prev, ...newFiles]);
    }
  };

  const removeFileToUpload = (index: number) => {
    setFilesToUpload(prev => prev.filter((_, i) => i !== index));
  };

  const markAttachmentForDeletion = (url: string) => {
    setAttachmentsToDelete(prev => [...prev, url]);
  };

  const undoAttachmentDeletion = (url: string) => {
    setAttachmentsToDelete(prev => prev.filter(u => u !== url));
  };

  // Handlers CRUD
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titolo) return;

    try {
      setLoading(true);
      setIsUploading(true);
      
      const newPromemoria = await promemoriaService.createPromemoria({
        titolo: formData.titolo,
        descrizione: formData.descrizione,
        data_inserimento: format(formData.data_inserimento, "yyyy-MM-dd"),
        giorni_scadenza: formData.giorni_scadenza,
        data_scadenza: format(formData.data_scadenza, "yyyy-MM-dd"),
        priorita: formData.priorita,
        stato: formData.working_progress,
        operatore_id: currentUser?.id ?? "",
        destinatario_id: formData.destinatario_id || null,
        settore: formData.settore || "",
        tipo_promemoria_id: formData.tipo_promemoria_id || null
      });

      if (filesToUpload.length > 0 && newPromemoria) {
        for (const file of filesToUpload) {
          try {
            await promemoriaService.uploadAllegato(newPromemoria.id, file);
          } catch (err) {
            console.error(`Errore upload ${file.name}`, err);
          }
        }
      }

      toast({ title: "Successo", description: "Promemoria creato" });
      setIsCreateDialogOpen(false);
      resetForm();
      checkUserAndLoad();
    } catch (error) {
      console.error(error);
      toast({ title: "Errore", description: "Impossibile creare promemoria", variant: "destructive" });
    } finally {
      setLoading(false);
      setIsUploading(false);
    }
  };

  const handleEdit = useCallback((p: Promemoria) => {
    setSelectedPromemoria(p);
    setFilesToUpload([]);
    setAttachmentsToDelete([]);
    
    setFormData({
      titolo: p.titolo || "",
      descrizione: p.descrizione || "",
      data_inserimento: p.data_inserimento ? new Date(p.data_inserimento) : new Date(),
      giorni_scadenza: p.giorni_scadenza || 0,
      data_scadenza: p.data_scadenza ? new Date(p.data_scadenza) : new Date(),
      priorita: p.priorita || "Media",
      working_progress: p.working_progress || "Aperto",
      destinatario_id: p.destinatario_id || "",
      settore: p.settore || "",
      tipo_promemoria_id: p.tipo_promemoria_id || ""
    });
    setIsEditDialogOpen(true);
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPromemoria) return;

    try {
      setLoading(true);
      setIsUploading(true);

      await promemoriaService.updatePromemoria(selectedPromemoria.id, {
        titolo: formData.titolo,
        descrizione: formData.descrizione,
        data_inserimento: format(formData.data_inserimento, "yyyy-MM-dd"),
        giorni_scadenza: formData.giorni_scadenza,
        data_scadenza: format(formData.data_scadenza, "yyyy-MM-dd"),
        priorita: formData.priorita,
        working_progress: formData.working_progress,
        destinatario_id: formData.destinatario_id || null,
        settore: formData.settore || undefined,
        tipo_promemoria_id: formData.tipo_promemoria_id || null
      });

      // Elimina allegati
      for (const url of attachmentsToDelete) {
        await promemoriaService.deleteAllegato(selectedPromemoria.id, url);
      }

      // Upload nuovi
      for (const file of filesToUpload) {
        await promemoriaService.uploadAllegato(selectedPromemoria.id, file);
      }

      toast({ title: "Successo", description: "Promemoria aggiornato" });
      setIsEditDialogOpen(false);
      setSelectedPromemoria(null);
      resetForm();
      checkUserAndLoad();
    } catch (error) {
      console.error(error);
      toast({ title: "Errore", description: "Impossibile aggiornare", variant: "destructive" });
    } finally {
      setLoading(false);
      setIsUploading(false);
    }
  };

  const handleDeleteClick = (p: Promemoria) => {
    setSelectedPromemoria(p);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedPromemoria) return;
    try {
      setLoading(true);
      await promemoriaService.deletePromemoria(selectedPromemoria.id);
      toast({ title: "Successo", description: "Eliminato correttamente" });
      setIsDeleteDialogOpen(false);
      checkUserAndLoad();
    } catch (error) {
      console.error(error);
      toast({ title: "Errore", description: "Impossibile eliminare", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDestinatarioChange = (val: string) => {
    if (val === "none") {
      setFormData(prev => ({ ...prev, destinatario_id: "", settore: "" }));
    } else {
      const u = utenti.find(u => u.id === val);
      setFormData(prev => ({ ...prev, destinatario_id: val, settore: u?.settore || "" }));
    }
  };

  if (loading && promemoria.length === 0) {
    return <div className="p-8 text-center">Caricamento in corso...</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Promemoria</h1>
        <Button onClick={() => { resetForm(); setIsCreateDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Promemoria
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Titolo</TableHead>
            <TableHead>Descrizione</TableHead>
            <TableHead>Data Scadenza</TableHead>
            <TableHead>Operatore</TableHead>
            <TableHead>Destinatario</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead>Settore</TableHead>
            <TableHead>Allegati</TableHead>
            <TableHead className="text-right">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {promemoria.map((p) => {
            const destinatario = utenti.find(u => u.id === p.destinatario_id);
            const isOverdue = new Date(p.data_scadenza) < new Date() && p.working_progress !== "Completato";
            const isCompleted = p.working_progress === "Completato";
            const isAnnullata = p.working_progress === "Annullata";
            
            return (
              <TableRow 
                key={p.id}
                className={
                  isOverdue ? "bg-red-50" :
                  isCompleted ? "bg-green-50" :
                  isAnnullata ? "bg-gray-100" :
                  ""
                }
              >
                <TableCell>{tipiPromemoria.find(t => t.id === p.tipo_promemoria_id)?.nome || "-"}</TableCell>
                <TableCell className="font-medium">{p.titolo}</TableCell>
                <TableCell>{p.descrizione}</TableCell>
                <TableCell>{p.data_scadenza ? format(new Date(p.data_scadenza), "dd/MM/yyyy") : "-"}</TableCell>
                <TableCell>{utenti.find(u => u.id === p.operatore_id)?.nome || "-"}</TableCell>
                <TableCell>{utenti.find(u => u.id === p.destinatario_id)?.nome || "-"}</TableCell>
                <TableCell>
                  <Badge 
                    variant={
                      p.working_progress === "Completato" ? "default" :
                      p.working_progress === "In lavorazione" ? "secondary" :
                      p.working_progress === "Aperto" ? "outline" :
                      p.working_progress === "Presa visione" ? "outline" :
                      p.working_progress === "Richiesta confronto" ? "secondary" :
                      p.working_progress === "Annullata" ? "destructive" :
                      "outline"
                    }
                    className={
                      p.working_progress === "Aperto" ? "border-blue-500 text-blue-700" :
                      p.working_progress === "In lavorazione" ? "bg-yellow-100 text-yellow-800" :
                      p.working_progress === "Completato" ? "bg-green-100 text-green-800" :
                      p.working_progress === "Presa visione" ? "border-cyan-500 text-cyan-700 bg-cyan-50" :
                      p.working_progress === "Richiesta confronto" ? "bg-purple-100 text-purple-800" :
                      p.working_progress === "Annullata" ? "bg-red-100 text-red-800" :
                      ""
                    }
                  >
                    {p.working_progress}
                  </Badge>
                </TableCell>
                <TableCell>{p.settore}</TableCell>
                <TableCell>
                  {p.allegati && Array.isArray(p.allegati) && p.allegati.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-gray-600">
                        <Paperclip className="h-4 w-4" />
                        {p.allegati.length}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewAllegati(p)}
                        className="h-8 w-8 p-0"
                        title="Visualizza allegati"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(p)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {promemoria.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                Nessun promemoria trovato
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* DIALOG CREAZIONE */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              />
            </div>
            <div>
              <Label>Descrizione</Label>
              <Textarea 
                value={formData.descrizione}
                onChange={e => setFormData(prev => ({...prev, descrizione: e.target.value}))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Inserimento</Label>
                <Input 
                  type="date"
                  value={format(formData.data_inserimento, "yyyy-MM-dd")}
                  onChange={e => setFormData(prev => ({...prev, data_inserimento: new Date(e.target.value)}))}
                />
              </div>
              <div>
                <Label>Giorni Scadenza</Label>
                <Input 
                  type="number" 
                  min="0" 
                  value={formData.giorni_scadenza}
                  onChange={e => setFormData(prev => ({...prev, giorni_scadenza: parseInt(e.target.value) || 0}))} 
                />
              </div>
            </div>

            <div>
              <Label>Data Scadenza (calcolata automaticamente)</Label>
              <Input 
                type="date"
                value={format(formData.data_scadenza, "yyyy-MM-dd")}
                disabled
                className="bg-gray-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Destinatario</Label>
                <Select value={formData.destinatario_id || "none"} onValueChange={handleDestinatarioChange}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
                    {utenti.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.nome} {u.cognome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Settore</Label>
                <Input value={formData.settore} disabled className="bg-gray-100" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priorità</Label>
                <Select value={formData.priorita} onValueChange={v => setFormData(prev => ({...prev, priorita: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bassa">Bassa</SelectItem>
                    <SelectItem value="Media">Media</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Stato</Label>
                <Select value={formData.working_progress} onValueChange={(val) => setFormData({...formData, working_progress: val})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona stato"/>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aperto">Aperto</SelectItem>
                    <SelectItem value="In lavorazione">In lavorazione</SelectItem>
                    <SelectItem value="Completato">Completato</SelectItem>
                    <SelectItem value="Presa visione">Presa visione</SelectItem>
                    <SelectItem value="Richiesta confronto">Richiesta confronto</SelectItem>
                    <SelectItem value="Annullata">Annullata</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Tipo Promemoria</Label>
              <Select value={formData.tipo_promemoria_id} onValueChange={v => setFormData(prev => ({...prev, tipo_promemoria_id: v}))}>
                <SelectTrigger><SelectValue placeholder="Seleziona tipo..." /></SelectTrigger>
                <SelectContent>
                  {tipiPromemoria.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Paperclip className="h-4 w-4" /> Allegati
              </Label>
              <div className="border border-dashed rounded-md p-4 bg-gray-50">
                <Input type="file" multiple onChange={handleFileSelect} className="cursor-pointer mb-2" />
                <div className="space-y-2 mt-2">
                  {filesToUpload.map((file, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded border">
                      <span className="truncate">{file.name}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeFileToUpload(idx)}>
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={loading}>{loading ? "Salvataggio..." : "Crea"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG MODIFICA */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifica Promemoria</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 pt-4">
            <div>
              <Label>Titolo *</Label>
              <Input 
                value={formData.titolo}
                onChange={e => setFormData(prev => ({...prev, titolo: e.target.value}))}
                required
              />
            </div>
            <div>
              <Label>Descrizione</Label>
              <Textarea 
                value={formData.descrizione}
                onChange={e => setFormData(prev => ({...prev, descrizione: e.target.value}))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Inserimento</Label>
                <Input 
                  type="date"
                  value={format(formData.data_inserimento, "yyyy-MM-dd")}
                  onChange={e => setFormData(prev => ({...prev, data_inserimento: new Date(e.target.value)}))}
                />
              </div>
              <div>
                <Label>Giorni Scadenza</Label>
                <Input 
                  type="number" 
                  min="0" 
                  value={formData.giorni_scadenza}
                  onChange={e => setFormData(prev => ({...prev, giorni_scadenza: parseInt(e.target.value) || 0}))} 
                />
              </div>
            </div>

            <div>
              <Label>Data Scadenza (calcolata automaticamente)</Label>
              <Input 
                type="date"
                value={format(formData.data_scadenza, "yyyy-MM-dd")}
                disabled
                className="bg-gray-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Destinatario</Label>
                <Select value={formData.destinatario_id || "none"} onValueChange={handleDestinatarioChange}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
                    {utenti.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.nome} {u.cognome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Settore</Label>
                <Input value={formData.settore} disabled className="bg-gray-100" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priorità</Label>
                <Select value={formData.priorita} onValueChange={v => setFormData(prev => ({...prev, priorita: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bassa">Bassa</SelectItem>
                    <SelectItem value="Media">Media</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Stato</Label>
                <Select value={formData.working_progress} onValueChange={(val) => setFormData({...formData, working_progress: val})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona stato"/>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aperto">Aperto</SelectItem>
                    <SelectItem value="In lavorazione">In lavorazione</SelectItem>
                    <SelectItem value="Completato">Completato</SelectItem>
                    <SelectItem value="Presa visione">Presa visione</SelectItem>
                    <SelectItem value="Richiesta confronto">Richiesta confronto</SelectItem>
                    <SelectItem value="Annullata">Annullata</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Tipo Promemoria</Label>
              <Select value={formData.tipo_promemoria_id} onValueChange={v => setFormData(prev => ({...prev, tipo_promemoria_id: v}))}>
                <SelectTrigger><SelectValue placeholder="Seleziona tipo..." /></SelectTrigger>
                <SelectContent>
                  {tipiPromemoria.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Allegati Esistenti</Label>
              <div className="space-y-2 mt-2">
                {selectedPromemoria?.allegati && (selectedPromemoria.allegati as unknown as Allegato[]).map((a, idx) => {
                  const isDeleted = attachmentsToDelete.includes(a.url);
                  return (
                    <div key={idx} className={`flex justify-between items-center p-2 rounded border ${isDeleted ? 'bg-red-50 opacity-50' : 'bg-white'}`}>
                      <div className="flex items-center gap-2 overflow-hidden">
                        {getFileIcon(a.nome)}
                        <span className={`text-sm truncate ${isDeleted ? 'line-through' : ''}`}>{a.nome}</span>
                      </div>
                      <div className="flex gap-1">
                        {!isDeleted ? (
                          <>
                            <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenAllegato(a)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => markAttachmentForDeletion(a.url)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        ) : (
                          <Button type="button" variant="ghost" size="sm" onClick={() => undoAttachmentDeletion(a.url)}>
                            Ripristina
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!selectedPromemoria?.allegati || (selectedPromemoria.allegati as unknown as Allegato[]).length === 0) && (
                  <p className="text-sm text-gray-400 italic">Nessun allegato presente</p>
                )}
              </div>
            </div>

            <div>
              <Label>Aggiungi Nuovi Allegati</Label>
              <div className="border border-dashed rounded-md p-4 bg-gray-50 mt-1">
                <Input type="file" multiple onChange={handleFileSelect} className="cursor-pointer mb-2" />
                <div className="space-y-2">
                  {filesToUpload.map((file, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded border">
                      <span className="truncate">{file.name}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeFileToUpload(idx)}>
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={loading}>{loading ? "Salvataggio..." : "Aggiorna"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG VISUALIZZA ALLEGATI (SOLO VISUALIZZA) */}
      <Dialog open={isAllegatiDialogOpen} onOpenChange={setIsAllegatiDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Allegati
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            {viewAllegatiPromemoria?.allegati && (viewAllegatiPromemoria.allegati as unknown as Allegato[]).length > 0 ? (
              (viewAllegatiPromemoria.allegati as unknown as Allegato[]).map((allegato, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 overflow-hidden">
                    {getFileIcon(allegato.nome)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{allegato.nome}</p>
                      <p className="text-xs text-gray-500">
                        {(allegato.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenAllegato(allegato)}
                    className="ml-2 shrink-0 gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    Apri
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 italic">Nessun allegato</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAllegatiDialogOpen(false)}>
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VIEWER GOOGLE DOCS */}
      <Dialog open={isDocViewerOpen} onOpenChange={setIsDocViewerOpen}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 flex flex-col gap-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b bg-gray-50">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" /> Anteprima Documento
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setIsDocViewerOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <iframe
            src={currentDocUrl}
            className="flex-1 w-full border-0 bg-gray-100"
            title="Document Viewer"
          />
        </DialogContent>
      </Dialog>

      {/* DIALOG CONFERMA ELIMINAZIONE */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Eliminazione</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare questo promemoria? L'azione è irreversibile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Annulla</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>Elimina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}