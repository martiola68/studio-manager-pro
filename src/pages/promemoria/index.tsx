import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  ImageIcon, 
  File, 
  X,
  MessageSquare
} from "lucide-react";
import { promemoriaService, type Promemoria, type Allegato } from "@/services/promemoriaService";
import { format, addDays } from "date-fns";
import { it } from "date-fns/locale";

interface Utente {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  settore: string | null;
  responsabile: boolean | null;
  studio_id: string | null;
}

interface TipoPromemoria {
  id: string;
  nome: string;
  colore: string | null;
}

export default function PromemoriaPage() {
  const { toast } = useToast();
  
  const [promemoria, setPromemoria] = useState<Promemoria[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [tipiPromemoria, setTipiPromemoria] = useState<TipoPromemoria[]>([]);
  const [currentUser, setCurrentUser] = useState<Utente | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAllegatiDialogOpen, setIsAllegatiDialogOpen] = useState(false);
  const [isDocViewerOpen, setIsDocViewerOpen] = useState(false);
  
  const [selectedPromemoria, setSelectedPromemoria] = useState<Promemoria | null>(null);
  const [viewAllegatiPromemoria, setViewAllegatiPromemoria] = useState<Promemoria | null>(null);
  const [currentDocUrl, setCurrentDocUrl] = useState<string>("");
  
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [attachmentsToDelete, setAttachmentsToDelete] = useState<string[]>([]);

  const [invioMultiplo, setInvioMultiplo] = useState(false);
  const [searchDestinatari, setSearchDestinatari] = useState("");

  // NUOVI STATI PER SELEZIONE MULTIPLA
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // NUOVO: Stato per filtro destinatario
  const [filtroDestinatario, setFiltroDestinatario] = useState<string>("tutti");

  const [formData, setFormData] = useState({
    titolo: "",
    descrizione: "",
    data_inserimento: new Date(),
    giorni_scadenza: 0,
    data_scadenza: new Date(),
    priorita: "Media",
    working_progress: "Aperto",
    destinatario_id: "",
    destinatari_multipli: [] as string[],
    settore: "",
    tipo_promemoria_id: "",
    invia_teams: false
  });

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
      destinatari_multipli: [],
      settore: "",
      tipo_promemoria_id: "",
      invia_teams: false
    });
    setFilesToUpload([]);
    setAttachmentsToDelete([]);
    setInvioMultiplo(false);
    setSearchDestinatari("");
  };

  const checkUserAndLoad = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from("tbutenti")
        .select("*")
        .eq("id", user.id)
        .single();
      
      if (userProfile) setCurrentUser(userProfile);

      // Determina se l'utente è responsabile
      const isResponsabile = userProfile?.responsabile === true;
      const currentUserId = userProfile?.id;

      const [promemoriaResult, utentiData, tipiData] = await Promise.all([
        promemoriaService.getPromemoria(
          userProfile?.studio_id,
          currentUserId,
          isResponsabile,
          userProfile?.settore
        ),
        supabase.from("tbutenti").select("*").order("cognome"),
        supabase.from("tbtipopromemoria").select("*").order("nome")
      ]);

      if (promemoriaResult) {
        const promemoriaWithAllegati = await Promise.all(
          promemoriaResult.map(async (p) => {
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

  useEffect(() => {
    if (formData.data_inserimento && formData.giorni_scadenza >= 0) {
      const scadenza = addDays(formData.data_inserimento, formData.giorni_scadenza);
      setFormData(prev => ({ ...prev, data_scadenza: scadenza }));
    }
  }, [formData.data_inserimento, formData.giorni_scadenza]);

  // HANDLERS SELEZIONE MULTIPLA
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([]);
      setSelectAll(false);
    } else {
      setSelectedIds(promemoria.map(p => p.id));
      setSelectAll(true);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSelection = prev.includes(id)
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id];
      
      setSelectAll(newSelection.length === promemoria.length);
      return newSelection;
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setIsDeleteDialogOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    try {
      setLoading(true);
      
      for (const id of selectedIds) {
        await promemoriaService.deletePromemoria(id);
      }
      
      toast({
        title: "Successo",
        description: `${selectedIds.length} promemoria eliminati correttamente`
      });
      
      setSelectedIds([]);
      setSelectAll(false);
      setIsDeleteDialogOpen(false);
      checkUserAndLoad();
    } catch (error) {
      console.error(error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare i promemoria selezionati",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewAllegati = (p: Promemoria) => {
    setViewAllegatiPromemoria(p);
    setIsAllegatiDialogOpen(true);
  };

  const handleOpenAllegato = (allegato: Allegato) => {
    const fileExt = allegato.nome.split('.').pop()?.toLowerCase();
    
    if (fileExt === 'pdf' || ['jpg', 'jpeg', 'png', 'gif'].includes(fileExt || '')) {
      window.open(allegato.url, '_blank');
    } 
    else if (['doc', 'docx', 'xls', 'xlsx'].includes(fileExt || '')) {
      setCurrentDocUrl(`https://docs.google.com/viewer?url=${encodeURIComponent(allegato.url)}&embedded=true`);
      setIsDocViewerOpen(true);
    }
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

  const handleSelezioneLavoro = () => {
    const utentiLavoro = utenti.filter(u => u.settore === "Lavoro").map(u => u.id);
    setFormData(prev => ({ ...prev, destinatari_multipli: utentiLavoro }));
  };

  const handleSelezioneFiscale = () => {
    const utentiFiscale = utenti.filter(u => u.settore === "Fiscale").map(u => u.id);
    setFormData(prev => ({ ...prev, destinatari_multipli: utentiFiscale }));
  };

  const handleSelezioneConsulenza = () => {
    const utentiConsulenza = utenti.filter(u => u.settore === "Consulenza").map(u => u.id);
    setFormData(prev => ({ ...prev, destinatari_multipli: utentiConsulenza }));
  };

  const handleSelezioneTutti = () => {
    const tuttiUtenti = utenti.map(u => u.id);
    setFormData(prev => ({ ...prev, destinatari_multipli: tuttiUtenti }));
  };

  const handleDeselezionaTutti = () => {
    setFormData(prev => ({ ...prev, destinatari_multipli: [] }));
  };

  const toggleDestinatario = (userId: string) => {
    setFormData(prev => {
      const isSelected = prev.destinatari_multipli.includes(userId);
      return {
        ...prev,
        destinatari_multipli: isSelected
          ? prev.destinatari_multipli.filter(id => id !== userId)
          : [...prev.destinatari_multipli, userId]
      };
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titolo) return;

    try {
      setLoading(true);
      setIsUploading(true);
      
      // Se invio multiplo, crea un promemoria per ogni destinatario
      if (invioMultiplo && formData.destinatari_multipli.length > 0) {
        for (const destinatarioId of formData.destinatari_multipli) {
          const destinatario = utenti.find(u => u.id === destinatarioId);
          
          const newPromemoria = await promemoriaService.createPromemoria({
            titolo: formData.titolo,
            descrizione: formData.descrizione,
            data_inserimento: format(formData.data_inserimento, "yyyy-MM-dd"),
            giorni_scadenza: formData.giorni_scadenza,
            data_scadenza: format(formData.data_scadenza, "yyyy-MM-dd"),
            priorita: formData.priorita,
            working_progress: formData.working_progress,
            operatore_id: currentUser?.id ?? "",
            destinatario_id: destinatarioId,
            settore: destinatario?.settore || "",
            tipo_promemoria_id: formData.tipo_promemoria_id || null,
            studio_id: currentUser?.studio_id
          });

          // Upload allegati per ogni promemoria creato
          if (filesToUpload.length > 0 && newPromemoria) {
            for (const file of filesToUpload) {
              try {
                await promemoriaService.uploadAllegato(newPromemoria.id, file);
              } catch (err) {
                console.error(`Errore upload ${file.name}`, err);
              }
            }
          }

          // Notifica Teams
          if (formData.invia_teams && newPromemoria && currentUser) {
            try {
              const { teamsService } = await import("@/services/teamsService");
              if (destinatario?.email) {
                await teamsService.sendDirectMessage(
                  currentUser.id,
                  destinatario.email,
                  {
                    content: `📝 <strong>Nuovo Promemoria</strong><br><br>
                      <strong>${formData.titolo}</strong><br>
                      ${formData.descrizione}<br><br>
                      📅 Scadenza: ${format(formData.data_scadenza, "dd/MM/yyyy")}<br>
                      🚨 Priorità: ${formData.priorita}`,
                    contentType: "html",
                    importance: formData.priorita === "Alta" ? "high" : "normal"
                  }
                );
              }
            } catch (err) {
              console.error("Errore notifica Teams:", err);
            }
          }
        }
        
        toast({ 
          title: "Successo", 
          description: `${formData.destinatari_multipli.length} promemoria creati con successo` 
        });
      } else {
        // Invio singolo (come prima)
        const newPromemoria = await promemoriaService.createPromemoria({
          titolo: formData.titolo,
          descrizione: formData.descrizione,
          data_inserimento: format(formData.data_inserimento, "yyyy-MM-dd"),
          giorni_scadenza: formData.giorni_scadenza,
          data_scadenza: format(formData.data_scadenza, "yyyy-MM-dd"),
          priorita: formData.priorita,
          working_progress: formData.working_progress,
          operatore_id: currentUser?.id ?? "",
          destinatario_id: formData.destinatario_id || null,
          settore: formData.settore || "",
          tipo_promemoria_id: formData.tipo_promemoria_id || null,
          studio_id: currentUser?.studio_id
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

        // Notifica Teams singolo
        if (formData.invia_teams && newPromemoria && currentUser && formData.destinatario_id) {
          try {
            const destinatario = utenti.find(u => u.id === formData.destinatario_id);
            if (destinatario?.email) {
              const { teamsService } = await import("@/services/teamsService");
              await teamsService.sendDirectMessage(
                currentUser.id,
                destinatario.email,
                {
                  content: `📝 <strong>Nuovo Promemoria</strong><br><br>
                    <strong>${formData.titolo}</strong><br>
                    ${formData.descrizione}<br><br>
                    📅 Scadenza: ${format(formData.data_scadenza, "dd/MM/yyyy")}<br>
                    🚨 Priorità: ${formData.priorita}`,
                  contentType: "html",
                  importance: formData.priorita === "Alta" ? "high" : "normal"
                }
              );
            }
          } catch (err) {
            console.error("Errore notifica Teams:", err);
          }
        }
        
        toast({ title: "Successo", description: "Promemoria creato" });
      }

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
      destinatari_multipli: [],
      settore: p.settore || "",
      tipo_promemoria_id: p.tipo_promemoria_id || "",
      invia_teams: false
    });
    setIsEditDialogOpen(true);
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPromemoria) return;

    try {
      setLoading(true);
      setIsUploading(true);

      const isRecipientOnly = !!(currentUser && selectedPromemoria && 
        currentUser.id === selectedPromemoria.destinatario_id && 
        currentUser.id !== selectedPromemoria.operatore_id);

      if (isRecipientOnly) {
        await promemoriaService.updatePromemoria(selectedPromemoria.id, {
          working_progress: formData.working_progress
        });
      } else {
        await promemoriaService.updatePromemoria(selectedPromemoria.id, {
          titolo: formData.titolo,
          descrizione: formData.descrizione,
          data_inserimento: format(formData.data_inserimento, "yyyy-MM-dd"),
          giorni_scadenza: formData.giorni_scadenza,
          data_scadenza: format(formData.data_scadenza, "yyyy-MM-dd"),
          priorita: formData.priorita,
          working_progress: formData.working_progress,
          // operatore_id rimosso perché non supportato da updatePromemoria
          destinatario_id: invioMultiplo ? null : (formData.destinatario_id || null),
          settore: formData.settore || undefined,
          tipo_promemoria_id: formData.tipo_promemoria_id || null
        });

        for (const url of attachmentsToDelete) {
          await promemoriaService.deleteAllegato(selectedPromemoria.id, url);
        }

        for (const file of filesToUpload) {
          await promemoriaService.uploadAllegato(selectedPromemoria.id, file);
        }
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

  const handleDestinatarioChange = (val: string) => {
    if (val === "none") {
      setFormData(prev => ({ ...prev, destinatario_id: "", settore: "" }));
    } else {
      const u = utenti.find(u => u.id === val);
      setFormData(prev => ({ ...prev, destinatario_id: val, settore: u?.settore || "" }));
    }
  };

  const utentiFiltrati = utenti.filter(u => {
    const searchLower = searchDestinatari.toLowerCase();
    return (
      u.nome?.toLowerCase().includes(searchLower) ||
      u.cognome?.toLowerCase().includes(searchLower)
    );
  });

  if (loading && promemoria.length === 0) {
    return <div className="p-8 text-center">Caricamento in corso...</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Promemoria</h1>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button 
              onClick={handleBulkDelete}
              variant="destructive"
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Elimina Promemoria ({selectedIds.length})
            </Button>
          )}
          <Button onClick={() => { resetForm(); setIsCreateDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Promemoria
          </Button>
        </div>
      </div>

      {/* FILTRO PER DESTINATARIO */}
      <div className="mb-4 flex items-center gap-4">
        <Label className="text-sm font-medium">Filtra per Destinatario:</Label>
        <Select value={filtroDestinatario} onValueChange={setFiltroDestinatario}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Tutti i destinatari" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti i destinatari</SelectItem>
            {utenti.map(u => (
              <SelectItem key={u.id} value={u.id}>
                {u.nome} {u.cognome} {u.settore ? `(${u.settore})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox 
                checked={selectAll}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
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
          {promemoria
            .filter(p => {
              // Filtra per destinatario specifico se selezionato
              if (filtroDestinatario !== "tutti") {
                return p.destinatario_id === filtroDestinatario;
              }
              return true;
            })
            .map((p) => {
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
                <TableCell>
                  <Checkbox 
                    checked={selectedIds.includes(p.id)}
                    onCheckedChange={() => handleToggleSelect(p.id)}
                  />
                </TableCell>
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
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          {promemoria.length === 0 && (
            <TableRow>
              <TableCell colSpan={11} className="text-center py-8 text-gray-500">
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

            <div className="flex items-center space-x-2 p-4 border rounded-lg bg-gray-50">
              <Checkbox 
                id="invio-multiplo-create" 
                checked={invioMultiplo}
                onCheckedChange={(checked) => {
                  setInvioMultiplo(!!checked);
                  if (checked) {
                    setFormData(prev => ({ ...prev, destinatario_id: "", settore: "" }));
                  } else {
                    setFormData(prev => ({ ...prev, destinatari_multipli: [] }));
                  }
                }}
              />
              <Label htmlFor="invio-multiplo-create" className="cursor-pointer font-medium">
                Invio a più destinatari
              </Label>
            </div>

            {!invioMultiplo ? (
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
            ) : (
              <div className="space-y-4 border rounded-lg p-4">
                <Label>Destinatari Multipli</Label>
                
                <Input
                  placeholder="Cerca destinatari..."
                  value={searchDestinatari}
                  onChange={(e) => setSearchDestinatari(e.target.value)}
                  className="mb-2"
                />

                <div className="flex flex-wrap gap-2 mb-3">
                  <Button type="button" variant="outline" size="sm" onClick={handleSelezioneLavoro}>
                    Settore Lavoro
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleSelezioneFiscale}>
                    Settore Fiscale
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleSelezioneConsulenza}>
                    Settore Consulenza
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleSelezioneTutti}>
                    Tutti
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleDeselezionaTutti}>
                    Deseleziona Tutti
                  </Button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 border rounded p-3 bg-white">
                  {utentiFiltrati.map((u) => (
                    <div key={u.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`dest-${u.id}`}
                        checked={formData.destinatari_multipli.includes(u.id)}
                        onCheckedChange={() => toggleDestinatario(u.id)}
                      />
                      <Label htmlFor={`dest-${u.id}`} className="cursor-pointer flex-1">
                        {u.nome} {u.cognome} {u.settore ? `(${u.settore})` : ''}
                      </Label>
                    </div>
                  ))}
                  {utentiFiltrati.length === 0 && (
                    <p className="text-sm text-gray-500 italic">Nessun utente trovato</p>
                  )}
                </div>
                
                <p className="text-sm text-gray-600">
                  Selezionati: {formData.destinatari_multipli.length} utent{formData.destinatari_multipli.length === 1 ? 'e' : 'i'}
                </p>
              </div>
            )}

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

            <div className="flex items-center space-x-2 py-2">
              <Checkbox 
                id="invia-teams" 
                checked={formData.invia_teams}
                onCheckedChange={(checked) => setFormData(prev => ({...prev, invia_teams: !!checked}))}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="invia-teams" className="flex items-center gap-1 cursor-pointer">
                  <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                  Invia notifica su Teams
                </Label>
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
                disabled={!!(currentUser && selectedPromemoria && currentUser.id === selectedPromemoria.destinatario_id && currentUser.id !== selectedPromemoria.operatore_id)}
              />
            </div>
            <div>
              <Label>Descrizione</Label>
              <Textarea 
                value={formData.descrizione}
                onChange={e => setFormData(prev => ({...prev, descrizione: e.target.value}))}
                disabled={!!(currentUser && selectedPromemoria && currentUser.id === selectedPromemoria.destinatario_id && currentUser.id !== selectedPromemoria.operatore_id)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Inserimento</Label>
                <Input 
                  type="date"
                  value={format(formData.data_inserimento, "yyyy-MM-dd")}
                  onChange={e => setFormData(prev => ({...prev, data_inserimento: new Date(e.target.value)}))}
                  disabled={!!(currentUser && selectedPromemoria && currentUser.id === selectedPromemoria.destinatario_id && currentUser.id !== selectedPromemoria.operatore_id)}
                />
              </div>
              <div>
                <Label>Giorni Scadenza</Label>
                <Input 
                  type="number" 
                  min="0" 
                  value={formData.giorni_scadenza}
                  onChange={e => setFormData(prev => ({...prev, giorni_scadenza: parseInt(e.target.value) || 0}))}
                  disabled={!!(currentUser && selectedPromemoria && currentUser.id === selectedPromemoria.destinatario_id && currentUser.id !== selectedPromemoria.operatore_id)}
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
                <Select 
                  value={formData.destinatario_id || "none"} 
                  onValueChange={handleDestinatarioChange}
                  disabled={!!(currentUser && selectedPromemoria && currentUser.id === selectedPromemoria.destinatario_id && currentUser.id !== selectedPromemoria.operatore_id)}
                >
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
                <Select 
                  value={formData.priorita} 
                  onValueChange={v => setFormData(prev => ({...prev, priorita: v}))}
                  disabled={!!(currentUser && selectedPromemoria && currentUser.id === selectedPromemoria.destinatario_id && currentUser.id !== selectedPromemoria.operatore_id)}
                >
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

            <div className="flex items-center space-x-2 py-2">
              <Checkbox 
                id="invia-teams" 
                checked={formData.invia_teams}
                onCheckedChange={(checked) => setFormData(prev => ({...prev, invia_teams: !!checked}))}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="invia-teams" className="flex items-center gap-1 cursor-pointer">
                  <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                  Invia notifica su Teams
                </Label>
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
                  const isRecipientOnly = !!(currentUser && selectedPromemoria && currentUser.id === selectedPromemoria.destinatario_id && currentUser.id !== selectedPromemoria.operatore_id);
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
                            {!isRecipientOnly && (
                              <Button type="button" variant="ghost" size="sm" onClick={() => markAttachmentForDeletion(a.url)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </>
                        ) : (
                          !isRecipientOnly && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => undoAttachmentDeletion(a.url)}>
                              Ripristina
                            </Button>
                          )
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

            {!(currentUser && selectedPromemoria && currentUser.id === selectedPromemoria.destinatario_id && currentUser.id !== selectedPromemoria.operatore_id) && (
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
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={loading}>{loading ? "Salvataggio..." : "Aggiorna"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG VISUALIZZA ALLEGATI */}
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
              <X className="h-4 w-4" />
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
              {selectedIds.length === 1 
                ? "Sei sicuro di voler eliminare questo promemoria?"
                : `Sei sicuro di voler eliminare ${selectedIds.length} promemoria selezionati?`
              }
              {" "}L'azione è irreversibile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Annulla</Button>
            <Button variant="destructive" onClick={handleBulkDeleteConfirm}>Elimina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}