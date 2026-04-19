import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { format, addDays } from "date-fns";
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
  MessageSquare,
} from "lucide-react";

import { sendEmail } from "@/services/emailService";
import {
  promemoriaService,
  type Promemoria,
  type Allegato,
} from "@/services/promemoriaService";

interface Utente {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  settore: string | null;
  responsabile: boolean | null;
  studio_id: string | null;
  microsoft_connection_id?: string | null;
}

interface TipoPromemoria {
  id: string;
  nome: string;
  colore: string | null;
}

type FiltroVistaPromemoria = "tutti" | "miei" | "creati";

interface FormDataState {
  titolo: string;
  descrizione: string;
  data_inserimento: Date;
  giorni_scadenza: number;
  data_scadenza: Date;
  priorita: string;
  working_progress: string;
  destinatario_id: string;
  destinatari_multipli: string[];
  settore: string;
  tipo_promemoria_id: string;
  invia_teams: boolean;
}

const DEFAULT_FORM_DATA: FormDataState = {
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
  invia_teams: false,
};

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
  const [isConfrontoDialogOpen, setIsConfrontoDialogOpen] = useState(false);

  const [selectedPromemoria, setSelectedPromemoria] = useState<Promemoria | null>(null);
  const [viewAllegatiPromemoria, setViewAllegatiPromemoria] = useState<Promemoria | null>(null);
  const [currentDocUrl, setCurrentDocUrl] = useState("");

  const [motivazioneConfronto, setMotivazioneConfronto] = useState("");

  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [attachmentsToDelete, setAttachmentsToDelete] = useState<string[]>([]);

  const [invioMultiplo, setInvioMultiplo] = useState(false);
  const [searchDestinatari, setSearchDestinatari] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  const [filtroOperatore, setFiltroOperatore] = useState("tutti");
  const [visualizzaTuttiSettore, setVisualizzaTuttiSettore] = useState(false);
  const [filtroVistaPromemoria, setFiltroVistaPromemoria] =
    useState<FiltroVistaPromemoria>("tutti");

  const [formData, setFormData] = useState<FormDataState>(DEFAULT_FORM_DATA);

  const isResponsabileSettore =
    currentUser?.responsabile === true && !!currentUser?.settore;

  const isRecipientOnly = useMemo(() => {
    if (!currentUser || !selectedPromemoria) return false;
    return (
      currentUser.id === selectedPromemoria.destinatario_id &&
      currentUser.id !== selectedPromemoria.operatore_id
    );
  }, [currentUser, selectedPromemoria]);

  const resetForm = useCallback(() => {
    setFormData({
      ...DEFAULT_FORM_DATA,
      data_inserimento: new Date(),
      data_scadenza: new Date(),
    });
    setFilesToUpload([]);
    setAttachmentsToDelete([]);
    setInvioMultiplo(false);
    setSearchDestinatari("");
  }, []);

  const getPrioritaOrder = (priorita?: string | null) => {
    switch ((priorita || "").toLowerCase()) {
      case "alta":
        return 0;
      case "media":
        return 1;
      case "bassa":
        return 2;
      default:
        return 3;
    }
  };

  const getUtenteById = useCallback(
    (id?: string | null) => utenti.find((u) => u.id === id),
    [utenti]
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCurrentUser(null);
        setPromemoria([]);
        setUtenti([]);
        setTipiPromemoria([]);
        return;
      }

      const { data: userProfile, error: userError } = await supabase
        .from("tbutenti")
        .select("*")
        .eq("id", user.id)
        .single();

      if (userError) throw userError;

      setCurrentUser(userProfile ?? null);

      if (userProfile?.responsabile !== true) {
        setVisualizzaTuttiSettore(false);
      }

      const isResponsabile = userProfile?.responsabile === true;
      const currentUserId = userProfile?.id ?? null;
      const studioId = userProfile?.studio_id ?? null;
      const settore = userProfile?.settore ?? null;

      const [promemoriaResult, utentiResult, tipiResult] = await Promise.all([
        promemoriaService.getPromemoria(studioId, currentUserId, isResponsabile, settore),
        supabase.from("tbutenti").select("*").order("cognome"),
        supabase.from("tbtipopromemoria").select("*").order("nome"),
      ]);

      const promemoriaConAllegati = await Promise.all(
        (promemoriaResult || []).map(async (item) => {
          const allegati = await promemoriaService.getAllegati(item.id);
          return { ...item, allegati };
        })
      );

      setPromemoria(promemoriaConAllegati);
      setUtenti((utentiResult.data as Utente[]) || []);
      setTipiPromemoria((tipiResult.data as TipoPromemoria[]) || []);
    } catch (error) {
      console.error("Errore caricamento dati:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (formData.data_inserimento && formData.giorni_scadenza >= 0) {
      const scadenza = addDays(formData.data_inserimento, formData.giorni_scadenza);
      setFormData((prev) => ({
        ...prev,
        data_scadenza: scadenza,
      }));
    }
  }, [formData.data_inserimento, formData.giorni_scadenza]);

  const utentiFiltrati = useMemo(() => {
    const term = searchDestinatari.trim().toLowerCase();

    if (!term) return utenti;

    return utenti.filter((u) => {
      const fullName = `${u.nome || ""} ${u.cognome || ""}`.toLowerCase();
      return (
        fullName.includes(term) ||
        (u.nome || "").toLowerCase().includes(term) ||
        (u.cognome || "").toLowerCase().includes(term) ||
        (u.email || "").toLowerCase().includes(term)
      );
    });
  }, [utenti, searchDestinatari]);

  const promemoriaFiltrati = useMemo(() => {
    return promemoria.filter((p) => {
      const operatorePromemoria = getUtenteById(p.operatore_id);

      if (visualizzaTuttiSettore && isResponsabileSettore) {
        if (operatorePromemoria?.settore !== currentUser?.settore) return false;
        if (filtroOperatore !== "tutti" && p.operatore_id !== filtroOperatore) return false;
        return true;
      }

      if (filtroOperatore !== "tutti" && p.operatore_id !== filtroOperatore) return false;

      if (filtroVistaPromemoria === "miei") {
        return p.destinatario_id === currentUser?.id;
      }

      if (filtroVistaPromemoria === "creati") {
        return p.operatore_id === currentUser?.id && p.destinatario_id !== currentUser?.id;
      }

      return (
        p.destinatario_id === currentUser?.id || p.operatore_id === currentUser?.id
      );
    });
  }, [
    promemoria,
    getUtenteById,
    visualizzaTuttiSettore,
    isResponsabileSettore,
    currentUser,
    filtroOperatore,
    filtroVistaPromemoria,
  ]);

  useEffect(() => {
    if (promemoriaFiltrati.length === 0) {
      setSelectAll(false);
      if (selectedIds.length > 0) setSelectedIds([]);
      return;
    }

    const visibleIds = promemoriaFiltrati.map((p) => p.id);
    const allVisibleSelected = visibleIds.every((id) => selectedIds.includes(id));
    setSelectAll(allVisibleSelected);
  }, [promemoriaFiltrati, selectedIds]);

  const handleSelectAll = () => {
    const visibleIds = promemoriaFiltrati.map((p) => p.id);

    if (selectAll) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      setSelectAll(false);
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
      setSelectAll(true);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setIsDeleteDialogOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.length === 0) return;

    try {
      setLoading(true);

      for (const id of selectedIds) {
        await promemoriaService.deletePromemoria(id);
      }

      toast({
        title: "Successo",
        description: `${selectedIds.length} promemoria eliminati correttamente`,
      });

      setSelectedIds([]);
      setSelectAll(false);
      setIsDeleteDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error("Errore eliminazione multipla:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare i promemoria selezionati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewAllegati = (item: Promemoria) => {
    setViewAllegatiPromemoria(item);
    setIsAllegatiDialogOpen(true);
  };

  const handleOpenAllegato = (allegato: Allegato) => {
    const fileExt = allegato.nome.split(".").pop()?.toLowerCase();

    if (fileExt === "pdf" || ["jpg", "jpeg", "png", "gif", "webp"].includes(fileExt || "")) {
      window.open(allegato.url, "_blank");
      return;
    }

    if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(fileExt || "")) {
      setCurrentDocUrl(
        `https://docs.google.com/gview?url=${encodeURIComponent(allegato.url)}&embedded=true`
      );
      setIsDocViewerOpen(true);
      return;
    }

    window.open(allegato.url, "_blank");
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();

    if (ext === "pdf") return <FileText className="h-4 w-4 text-red-500" />;
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) {
      return <ImageIcon className="h-4 w-4 text-blue-500" />;
    }
    if (["doc", "docx"].includes(ext || "")) {
      return <FileText className="h-4 w-4 text-blue-600" />;
    }
    if (["xls", "xlsx"].includes(ext || "")) {
      return <FileText className="h-4 w-4 text-green-600" />;
    }
    return <File className="h-4 w-4 text-gray-500" />;
  };

  const sendPromemoriaCreationEmail = async (destinatario?: Utente) => {
    if (!destinatario?.email || !currentUser) return;

    try {
      const priorityBadgeStyle =
        formData.priorita === "Alta"
          ? "display:inline-block; padding:4px 10px; border-radius:999px; background:#fee2e2; color:#b91c1c; border:1px solid #f87171; font-weight:700; font-size:12px;"
          : formData.priorita === "Media"
          ? "display:inline-block; padding:4px 10px; border-radius:999px; background:#ffedd5; color:#c2410c; border:1px solid #fb923c; font-weight:700; font-size:12px;"
          : "display:inline-block; padding:4px 10px; border-radius:999px; background:#dcfce7; color:#15803d; border:1px solid #4ade80; font-weight:700; font-size:12px;";

      const html = `
        <div style="font-family: Arial, sans-serif; font-size: 14px; color: #111;">
          <p>Gentile ${destinatario.nome || ""} ${destinatario.cognome || ""},</p>
          <p>ti è stato assegnato un nuovo promemoria.</p>

          <div style="margin: 12px 0 16px 0;">
            <div style="margin-bottom: 10px;">
              <span style="${priorityBadgeStyle}">${formData.priorita}</span>
            </div>

            <div style="font-size: 20px; font-weight: 700; line-height: 1.3; margin-bottom: 12px;">
              ${formData.titolo}
            </div>

            <p style="margin: 0 0 6px 0;"><strong>Descrizione:</strong> ${formData.descrizione || "-"}</p>
            <p style="margin: 0 0 6px 0;"><strong>Data inserimento:</strong> ${format(formData.data_inserimento, "dd/MM/yyyy")}</p>
            <p style="margin: 0 0 6px 0;"><strong>Data scadenza:</strong> ${format(formData.data_scadenza, "dd/MM/yyyy")}</p>
            <p style="margin: 0 0 6px 0;"><strong>Stato:</strong> ${formData.working_progress}</p>
            <p style="margin: 0;"><strong>Operatore:</strong> ${currentUser.nome || ""} ${currentUser.cognome || ""}</p>
          </div>

          <p>Accedi al gestionale per visualizzare il dettaglio del promemoria.</p>
        </div>
      `;

      const text = `
Nuovo promemoria assegnato

Titolo: ${formData.titolo}
Descrizione: ${formData.descrizione || "-"}
Data inserimento: ${format(formData.data_inserimento, "dd/MM/yyyy")}
Data scadenza: ${format(formData.data_scadenza, "dd/MM/yyyy")}
Priorità: ${formData.priorita}
Stato: ${formData.working_progress}
Operatore: ${currentUser.nome || ""} ${currentUser.cognome || ""}
      `.trim();

      const result = await sendEmail({
        to: destinatario.email,
        subject: `Nuovo promemoria: ${formData.titolo}`,
        html,
        text,
        sendMode: "studio",
      });

      if (!result?.success) {
        console.error("Errore invio email promemoria:", result?.error);
      }
    } catch (err) {
      console.error("Errore invio email promemoria:", err);
    }
  };

  const sendTeamsNotification = async (destinatario?: Utente) => {
    if (!formData.invia_teams || !destinatario?.email || !currentUser) return;

    try {
      const { teamsService } = await import("@/services/teamsService");

      await teamsService.sendDirectMessage(currentUser.id, destinatario.email, {
        content: `📝 <strong>Nuovo Promemoria</strong><br><br>
<strong>${formData.titolo}</strong><br>
${formData.descrizione || "-"}<br><br>
📅 Scadenza: ${format(formData.data_scadenza, "dd/MM/yyyy")}<br>
🚨 Priorità: ${formData.priorita}`,
        contentType: "html",
        importance: formData.priorita === "Alta" ? "high" : "normal",
      });
    } catch (err) {
      console.error("Errore notifica Teams:", err);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    setFilesToUpload((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const removeFileToUpload = (index: number) => {
    setFilesToUpload((prev) => prev.filter((_, i) => i !== index));
  };

  const markAttachmentForDeletion = (url: string) => {
    setAttachmentsToDelete((prev) => (prev.includes(url) ? prev : [...prev, url]));
  };

  const undoAttachmentDeletion = (url: string) => {
    setAttachmentsToDelete((prev) => prev.filter((u) => u !== url));
  };

  const selezionaUtentiPerSettore = (settore: string) => {
    const ids = utenti.filter((u) => u.settore === settore).map((u) => u.id);
    setFormData((prev) => ({ ...prev, destinatari_multipli: ids }));
  };

  const handleSelezioneTutti = () => {
    setFormData((prev) => ({
      ...prev,
      destinatari_multipli: utenti.map((u) => u.id),
    }));
  };

  const handleDeselezionaTutti = () => {
    setFormData((prev) => ({ ...prev, destinatari_multipli: [] }));
  };

  const toggleDestinatario = (userId: string) => {
    setFormData((prev) => {
      const exists = prev.destinatari_multipli.includes(userId);
      return {
        ...prev,
        destinatari_multipli: exists
          ? prev.destinatari_multipli.filter((id) => id !== userId)
          : [...prev.destinatari_multipli, userId],
      };
    });
  };

  const handleDestinatarioChange = (value: string) => {
    if (value === "none") {
      setFormData((prev) => ({ ...prev, destinatario_id: "", settore: "" }));
      return;
    }

    const u = utenti.find((item) => item.id === value);
    setFormData((prev) => ({
      ...prev,
      destinatario_id: value,
      settore: u?.settore || "",
    }));
  };

  const validateCreate = () => {
    if (!formData.titolo.trim()) {
      toast({
        title: "Titolo obbligatorio",
        description: "Inserisci il titolo del promemoria.",
        variant: "destructive",
      });
      return false;
    }

    if (invioMultiplo && formData.destinatari_multipli.length === 0) {
      toast({
        title: "Destinatari obbligatori",
        description: "Seleziona almeno un destinatario.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateCreate()) return;

    try {
      setLoading(true);
      setIsUploading(true);

      if (invioMultiplo) {
        for (const destinatarioId of formData.destinatari_multipli) {
          const destinatario = getUtenteById(destinatarioId);

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
            studio_id: currentUser?.studio_id ?? null,
          });

          if (newPromemoria && filesToUpload.length > 0) {
            for (const file of filesToUpload) {
              try {
                await promemoriaService.uploadAllegato(newPromemoria.id, file);
              } catch (err) {
                console.error(`Errore upload file ${file.name}:`, err);
              }
            }
          }

          await sendPromemoriaCreationEmail(destinatario);
          await sendTeamsNotification(destinatario);
        }

        toast({
          title: "Successo",
          description: `${formData.destinatari_multipli.length} promemoria creati con successo`,
        });
      } else {
        const destinatario = getUtenteById(formData.destinatario_id);

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
          studio_id: currentUser?.studio_id ?? null,
        });

        if (newPromemoria && filesToUpload.length > 0) {
          for (const file of filesToUpload) {
            try {
              await promemoriaService.uploadAllegato(newPromemoria.id, file);
            } catch (err) {
              console.error(`Errore upload file ${file.name}:`, err);
            }
          }
        }

        await sendPromemoriaCreationEmail(destinatario);
        await sendTeamsNotification(destinatario);

        toast({
          title: "Successo",
          description: "Promemoria creato",
        });
      }

      setIsCreateDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Errore creazione promemoria:", error);
      toast({
        title: "Errore",
        description: "Impossibile creare promemoria",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setIsUploading(false);
    }
  };

  const handleEdit = useCallback((item: Promemoria) => {
    setSelectedPromemoria(item);
    setFilesToUpload([]);
    setAttachmentsToDelete([]);
    setInvioMultiplo(false);
    setSearchDestinatari("");

    setFormData({
      titolo: item.titolo || "",
      descrizione: item.descrizione || "",
      data_inserimento: item.data_inserimento ? new Date(item.data_inserimento) : new Date(),
      giorni_scadenza: item.giorni_scadenza || 0,
      data_scadenza: item.data_scadenza ? new Date(item.data_scadenza) : new Date(),
      priorita: item.priorita || "Media",
      working_progress: item.working_progress || "Aperto",
      destinatario_id: item.destinatario_id || "",
      destinatari_multipli: [],
      settore: item.settore || "",
      tipo_promemoria_id: item.tipo_promemoria_id || "",
      invia_teams: false,
    });

    setIsEditDialogOpen(true);
  }, []);

  const sendRichiestaConfrontoEmail = async (
    promemoriaItem: Promemoria,
    motivazione: string
  ) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch("/api/promemoria/richiesta-confronto-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || ""}`,
      },
      body: JSON.stringify({
        promemoriaId: promemoriaItem.id,
        motivazione,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result?.details || result?.error || "Impossibile inviare la richiesta di confronto."
      );
    }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPromemoria) return;

    if (isRecipientOnly && formData.working_progress === "Richiesta confronto") {
      setMotivazioneConfronto("");
      setIsConfrontoDialogOpen(true);
      return;
    }

    try {
      setLoading(true);
      setIsUploading(true);

      if (isRecipientOnly) {
        await promemoriaService.updatePromemoria(selectedPromemoria.id, {
          working_progress: formData.working_progress,
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
          destinatario_id: formData.destinatario_id || null,
          settore: formData.settore || "",
          tipo_promemoria_id: formData.tipo_promemoria_id || null,
        });

        for (const url of attachmentsToDelete) {
          try {
            await promemoriaService.deleteAllegato(selectedPromemoria.id, url);
          } catch (err) {
            console.error("Errore eliminazione allegato:", err);
          }
        }

        for (const file of filesToUpload) {
          try {
            await promemoriaService.uploadAllegato(selectedPromemoria.id, file);
          } catch (err) {
            console.error("Errore upload allegato:", err);
          }
        }
      }

      toast({
        title: "Successo",
        description: "Promemoria aggiornato",
      });

      setIsEditDialogOpen(false);
      setSelectedPromemoria(null);
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Errore aggiornamento promemoria:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il promemoria",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setIsUploading(false);
    }
  };

  const handleConfermaRichiestaConfronto = async () => {
    if (!selectedPromemoria) return;

    if (!motivazioneConfronto.trim()) {
      toast({
        title: "Motivazione obbligatoria",
        description: "Inserisci la motivazione della richiesta di confronto.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      await promemoriaService.updatePromemoria(selectedPromemoria.id, {
        working_progress: "Richiesta confronto",
      });

      await sendRichiestaConfrontoEmail(selectedPromemoria, motivazioneConfronto.trim());

      toast({
        title: "Successo",
        description: "Richiesta confronto inviata correttamente.",
      });

      setIsConfrontoDialogOpen(false);
      setMotivazioneConfronto("");
      setIsEditDialogOpen(false);
      setSelectedPromemoria(null);
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Errore richiesta confronto:", error);
      toast({
        title: "Errore",
        description: "Impossibile inviare la richiesta di confronto.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sortedPromemoria = useMemo(() => {
    return [...promemoriaFiltrati].sort((a, b) => {
      const prioritaDiff = getPrioritaOrder(a.priorita) - getPrioritaOrder(b.priorita);
      if (prioritaDiff !== 0) return prioritaDiff;

      const dataA = a.data_scadenza
        ? new Date(a.data_scadenza).getTime()
        : Number.MAX_SAFE_INTEGER;
      const dataB = b.data_scadenza
        ? new Date(b.data_scadenza).getTime()
        : Number.MAX_SAFE_INTEGER;

      return dataA - dataB;
    });
  }, [promemoriaFiltrati]);

  if (loading && promemoria.length === 0) {
    return <div className="p-8 text-center">Caricamento in corso...</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Promemoria</h1>

        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button onClick={handleBulkDelete} variant="destructive" className="gap-2">
              <Trash2 className="h-4 w-4" />
              Elimina Promemoria ({selectedIds.length})
            </Button>
          )}

          <Button
            onClick={() => {
              resetForm();
              setIsCreateDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Promemoria
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-6">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="vista-miei-promemoria"
            checked={filtroVistaPromemoria === "miei"}
            onCheckedChange={(checked) => {
              if (checked) {
                setFiltroVistaPromemoria("miei");
                setVisualizzaTuttiSettore(false);
              } else {
                setFiltroVistaPromemoria("tutti");
              }
            }}
          />
          <Label htmlFor="vista-miei-promemoria" className="cursor-pointer">
            Visualizza i miei promemoria
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="vista-promemoria-creati"
            checked={filtroVistaPromemoria === "creati"}
            onCheckedChange={(checked) => {
              if (checked) {
                setFiltroVistaPromemoria("creati");
                setVisualizzaTuttiSettore(false);
              } else {
                setFiltroVistaPromemoria("tutti");
              }
            }}
          />
          <Label htmlFor="vista-promemoria-creati" className="cursor-pointer">
            Visualizza i promemoria che ho inviato
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="vista-promemoria-tutti"
            checked={filtroVistaPromemoria === "tutti" && !visualizzaTuttiSettore}
            onCheckedChange={(checked) => {
              if (checked) {
                setFiltroVistaPromemoria("tutti");
                setVisualizzaTuttiSettore(false);
              }
            }}
          />
          <Label htmlFor="vista-promemoria-tutti" className="cursor-pointer">
            Visualizza tutto
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="visualizza-tutti-settore"
            checked={visualizzaTuttiSettore}
            disabled={!isResponsabileSettore}
            onCheckedChange={(checked) => {
              const isChecked = !!checked;
              setVisualizzaTuttiSettore(isChecked);
              if (isChecked) {
                setFiltroVistaPromemoria("tutti");
              }
            }}
          />
          <Label
            htmlFor="visualizza-tutti-settore"
            className={
              !isResponsabileSettore
                ? "cursor-not-allowed opacity-60 text-red-600"
                : "cursor-pointer font-medium text-red-600"
            }
          >
            Visualizza tutti i promemoria del proprio settore
          </Label>
        </div>

        {visualizzaTuttiSettore && isResponsabileSettore && (
          <div className="min-w-[260px]">
            <Label className="mb-1 block">Filtra per operatore</Label>
            <Select value={filtroOperatore} onValueChange={setFiltroOperatore}>
              <SelectTrigger>
                <SelectValue placeholder="Tutti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">Tutti</SelectItem>
                {utenti
                  .filter((u) => u.settore === currentUser?.settore)
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} {u.cognome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox checked={selectAll} onCheckedChange={handleSelectAll} />
            </TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Priorità</TableHead>
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
          {sortedPromemoria.map((p) => {
            const isOverdue =
              !!p.data_scadenza &&
              new Date(p.data_scadenza) < new Date() &&
              p.working_progress !== "Completato";

            const isCompleted = p.working_progress === "Completato";
            const isAnnullata = p.working_progress === "Annullata";

            const operatore = getUtenteById(p.operatore_id);
            const destinatario = getUtenteById(p.destinatario_id);
            const tipo = tipiPromemoria.find((t) => t.id === p.tipo_promemoria_id);

            return (
              <TableRow
                key={p.id}
                className={
                  isOverdue
                    ? "bg-red-50"
                    : isCompleted
                    ? "bg-green-50"
                    : isAnnullata
                    ? "bg-gray-100"
                    : ""
                }
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(p.id)}
                    onCheckedChange={() => handleToggleSelect(p.id)}
                  />
                </TableCell>

                <TableCell>{tipo?.nome || "-"}</TableCell>

                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      p.priorita === "Alta"
                        ? "border-red-500 bg-red-50 text-red-700"
                        : p.priorita === "Media"
                        ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                        : p.priorita === "Bassa"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : ""
                    }
                  >
                    {p.priorita || "-"}
                  </Badge>
                </TableCell>

                <TableCell className="font-medium">{p.titolo || "-"}</TableCell>
                <TableCell>{p.descrizione || "-"}</TableCell>
                <TableCell>
                  {p.data_scadenza ? format(new Date(p.data_scadenza), "dd/MM/yyyy") : "-"}
                </TableCell>
                <TableCell>
                  {operatore ? `${operatore.nome} ${operatore.cognome}` : "-"}
                </TableCell>
                <TableCell>
                  {destinatario ? `${destinatario.nome} ${destinatario.cognome}` : "-"}
                </TableCell>

                <TableCell>
                  <Badge
                    variant={
                      p.working_progress === "Completato"
                        ? "default"
                        : p.working_progress === "Annullata"
                        ? "destructive"
                        : p.working_progress === "In lavorazione" ||
                          p.working_progress === "Richiesta confronto"
                        ? "secondary"
                        : "outline"
                    }
                    className={
                      p.working_progress === "Aperto"
                        ? "border-blue-500 text-blue-700"
                        : p.working_progress === "In lavorazione"
                        ? "bg-yellow-100 text-yellow-800"
                        : p.working_progress === "Completato"
                        ? "bg-green-100 text-green-800"
                        : p.working_progress === "Presa visione"
                        ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                        : p.working_progress === "Richiesta confronto"
                        ? "bg-purple-100 text-purple-800"
                        : p.working_progress === "Annullata"
                        ? "bg-red-100 text-red-800"
                        : ""
                    }
                  >
                    {p.working_progress || "-"}
                  </Badge>
                </TableCell>

                <TableCell>{p.settore || "-"}</TableCell>

                <TableCell>
                  {Array.isArray(p.allegati) && p.allegati.length > 0 ? (
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

          {sortedPromemoria.length === 0 && (
            <TableRow>
              <TableCell colSpan={12} className="py-8 text-center text-gray-500">
                Nessun promemoria trovato
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuovo Promemoria</DialogTitle>
          </DialogHeader>

         <form onSubmit={handleCreate} className="space-y-4 pt-4">
  <div>
    <Label>Titolo *</Label>
    <Input
      value={formData.titolo}
      onChange={(e) =>
        setFormData((prev) => ({
          ...prev,
          titolo: e.target.value,
        }))
      }
      required
    />
  </div>

  <div>
    <Label>Descrizione</Label>
    <Textarea
      value={formData.descrizione}
      onChange={(e) =>
        setFormData((prev) => ({
          ...prev,
          descrizione: e.target.value,
        }))
      }
    />
  </div>

  <div className="grid grid-cols-2 gap-4">
    <div>
      <Label>Data Inserimento</Label>
      <Input
        type="date"
        value={format(formData.data_inserimento, "yyyy-MM-dd")}
        onChange={(e) =>
          setFormData((prev) => ({
            ...prev,
            data_inserimento: new Date(e.target.value),
          }))
        }
      />
    </div>

    <div>
      <Label>Giorni Scadenza</Label>
      <Input
        type="number"
        min="0"
        value={formData.giorni_scadenza}
        onChange={(e) =>
          setFormData((prev) => ({
            ...prev,
            giorni_scadenza: parseInt(e.target.value, 10) || 0,
          }))
        }
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
        const value = !!checked;
        setInvioMultiplo(value);

        if (value) {
          setFormData((prev) => ({
            ...prev,
            destinatario_id: "",
            settore: "",
          }));
        } else {
          setFormData((prev) => ({
            ...prev,
            destinatari_multipli: [],
          }));
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
        <Select
          value={formData.destinatario_id || "none"}
          onValueChange={handleDestinatarioChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleziona..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nessuno</SelectItem>
            {utenti.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.nome} {u.cognome}
              </SelectItem>
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
              {u.nome} {u.cognome} {u.settore ? `(${u.settore})` : ""}
            </Label>
          </div>
        ))}

        {utentiFiltrati.length === 0 && (
          <p className="text-sm text-gray-500 italic">Nessun utente trovato</p>
        )}
      </div>

      <p className="text-sm text-gray-600">
        Selezionati: {formData.destinatari_multipli.length} utent
        {formData.destinatari_multipli.length === 1 ? "e" : "i"}
      </p>
    </div>
  )}

  <div className="grid grid-cols-2 gap-4">
    <div>
      <Label>Priorità</Label>
      <Select
        value={formData.priorita}
        onValueChange={(v) =>
          setFormData((prev) => ({
            ...prev,
            priorita: v,
          }))
        }
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
      <Label>Stato</Label>
      <Select
        value={formData.working_progress}
        onValueChange={(val) =>
          setFormData((prev) => ({
            ...prev,
            working_progress: val,
          }))
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Seleziona stato" />
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
      id="invia-teams-create"
      checked={formData.invia_teams}
      onCheckedChange={(checked) =>
        setFormData((prev) => ({
          ...prev,
          invia_teams: !!checked,
        }))
      }
    />
    <div className="grid gap-1.5 leading-none">
      <Label htmlFor="invia-teams-create" className="flex items-center gap-1 cursor-pointer">
        <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
        Invia notifica su Teams
      </Label>
    </div>
  </div>

  <div>
    <Label>Tipo Promemoria</Label>
    <Select
      value={formData.tipo_promemoria_id}
      onValueChange={(v) =>
        setFormData((prev) => ({
          ...prev,
          tipo_promemoria_id: v,
        }))
      }
    >
      <SelectTrigger>
        <SelectValue placeholder="Seleziona tipo..." />
      </SelectTrigger>
      <SelectContent>
        {tipiPromemoria.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  <div>
    <Label className="flex items-center gap-2 mb-2">
      <Paperclip className="h-4 w-4" /> Allegati
    </Label>

    <div className="border border-dashed rounded-md p-4 bg-gray-50">
      <Input
        type="file"
        multiple
        onChange={handleFileSelect}
        className="cursor-pointer mb-2"
      />

      <div className="space-y-2 mt-2">
        {filesToUpload.map((file, idx) => (
          <div
            key={idx}
            className="flex justify-between items-center text-sm bg-white p-2 rounded border"
          >
            <span className="truncate">{file.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeFileToUpload(idx)}
            >
              <X className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  </div>

  <DialogFooter>
    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
      Annulla
    </Button>
    <Button type="submit" disabled={loading || isUploading}>
      {loading || isUploading ? "Salvataggio..." : "Crea"}
    </Button>
  </DialogFooter>
</form>
          </DialogContent>
        </Dialog>

        {/* DIALOG DELETE */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Conferma eliminazione</DialogTitle>
              <DialogDescription>
                Eliminare {selectedIds.length} promemoria?
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Annulla
              </Button>
              <Button variant="destructive" onClick={handleBulkDeleteConfirm}>
                Elimina
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    );
}
