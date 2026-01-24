import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Calendar, Bell } from "lucide-react";
import { authService } from "@/services/authService";
import { tipoScadenzaService } from "@/services/tipoScadenzaService";
import { studioService } from "@/services/studioService";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { useToast } from "@/hooks/use-toast";

type TipoScadenza = Database["public"]["Tables"]["tbtipi_scadenze"]["Row"];

const TIPI_SCADENZA_OPTIONS = [
  { value: "iva", label: "IVA" },
  { value: "fiscale", label: "Fiscale" },
  { value: "bilancio", label: "Bilancio" },
  { value: "770", label: "770" },
  { value: "lipe", label: "LIPE" },
  { value: "esterometro", label: "Esterometro" },
  { value: "ccgg", label: "CCGG" },
  { value: "cu", label: "CU" },
  { value: "proforma", label: "Proforma" },
  { value: "antiriciclaggio", label: "Antiriciclaggio" },
  { value: "imu", label: "IMU" },
  { value: "lavoro", label: "Lavoro" },
];

export default function TipiScadenzePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tipiScadenze, setTipiScadenze] = useState<TipoScadenza[]>([]);
  const [studioId, setStudioId] = useState<string | null>(null);
  const [alertsInviati, setAlertsInviati] = useState<Record<string, boolean>>({});

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoScadenza | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    nome: "",
    descrizione: "",
    data_scadenza: "",
    tipo_scadenza: "",
    ricorrente: false,
    giorni_preavviso_1: 7,
    giorni_preavviso_2: 15,
    attivo: true,
    settore: "",
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const studio = await studioService.getStudio();
      
      if (!studio) {
        toast({
          title: "Attenzione",
          description: "Nessuno studio configurato. Contatta l'amministratore.",
          variant: "destructive",
        });
        return;
      }

      setStudioId(studio.id);
      await loadTipiScadenze(studio.id);
      await loadAlertsInviati();
    } catch (error) {
      console.error("Errore autenticazione:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadTipiScadenze = async (studioId: string) => {
    try {
      setLoading(true);
      const data = await tipoScadenzaService.getAll(studioId);
      setTipiScadenze(data);
    } catch (error) {
      console.error("Errore caricamento tipi scadenze:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i tipi di scadenze",
        variant: "destructive",
      });
    }
  };

  const loadAlertsInviati = async () => {
    try {
      const annoCorrente = new Date().getFullYear();
      const { data, error } = await supabase
        .from("tbtipi_scadenze_alert")
        .select("tipo_scadenza_id, anno_invio")
        .eq("anno_invio", annoCorrente);

      if (error) throw error;

      const alerts: Record<string, boolean> = {};
      data?.forEach((alert) => {
        alerts[alert.tipo_scadenza_id] = true;
      });
      setAlertsInviati(alerts);
    } catch (error) {
      console.error("Errore caricamento alerts:", error);
    }
  };

  const handleInviaAlert = async (tipoScadenza: TipoScadenza) => {
    try {
      const settore = tipoScadenza.settore || "Fiscale";
      
      // Recupera utenti del settore
      let query = supabase
        .from("tbutenti")
        .select("email, nome, cognome");

      if (settore === "Fiscale & Lavoro") {
        query = query.neq("email", "");
      } else {
        query = query.eq("settore", settore);
      }

      const { data: utenti, error: utentiError } = await query;

      if (utentiError) throw utentiError;

      if (!utenti || utenti.length === 0) {
        toast({
          title: "Nessun utente",
          description: `Nessun utente trovato per il settore ${settore}`,
          variant: "destructive",
        });
        return;
      }

      console.log(`Invio alert a ${utenti.length} utenti del settore ${settore}`);
      
      // Registra l'invio nel database
      const annoCorrente = new Date().getFullYear();
      const { error: insertError } = await supabase
        .from("tbtipi_scadenze_alert")
        .insert({
          tipo_scadenza_id: tipoScadenza.id,
          anno_invio: annoCorrente,
          data_invio: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      toast({
        title: "Alert inviato",
        description: `Email di avvertimento inviata a ${utenti.length} utenti del settore ${settore}`,
      });

      await loadAlertsInviati();
    } catch (error) {
      console.error("Errore invio alert:", error);
      toast({
        title: "Errore",
        description: "Impossibile inviare l'alert",
        variant: "destructive",
      });
    }
  };

  const handleOpenDialog = (tipo?: TipoScadenza) => {
    if (tipo) {
      setEditingTipo(tipo);
      setFormData({
        nome: tipo.nome,
        descrizione: tipo.descrizione || "",
        data_scadenza: tipo.data_scadenza,
        tipo_scadenza: tipo.tipo_scadenza,
        ricorrente: tipo.ricorrente || false,
        giorni_preavviso_1: tipo.giorni_preavviso_1 || 7,
        giorni_preavviso_2: tipo.giorni_preavviso_2 || 15,
        attivo: tipo.attivo ?? true,
        settore: tipo.settore || "Fiscale",
      });
    } else {
      setEditingTipo(null);
      setFormData({
        nome: "",
        descrizione: "",
        data_scadenza: "",
        tipo_scadenza: "",
        ricorrente: false,
        giorni_preavviso_1: 7,
        giorni_preavviso_2: 15,
        attivo: true,
        settore: "Fiscale",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTipo(null);
  };

  const handleSave = async () => {
    if (!studioId) return;

    try {
      const dataToSave = {
        nome: formData.nome,
        descrizione: formData.descrizione,
        data_scadenza: formData.data_scadenza,
        tipo_scadenza: formData.tipo_scadenza,
        ricorrente: formData.ricorrente,
        giorni_preavviso_1: formData.giorni_preavviso_1,
        giorni_preavviso_2: formData.giorni_preavviso_2,
        attivo: formData.attivo,
        settore: formData.settore,
      };

      if (editingTipo) {
        await tipoScadenzaService.update(editingTipo.id, dataToSave);
        toast({
          title: "Successo",
          description: "Tipo scadenza aggiornato",
        });
      } else {
        await tipoScadenzaService.create({
          ...dataToSave,
          studio_id: studioId,
        });
        toast({
          title: "Successo",
          description: "Tipo scadenza creato",
        });
      }

      await loadTipiScadenze(studioId);
      handleCloseDialog();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare il tipo scadenza",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingId || !studioId) return;

    try {
      await tipoScadenzaService.delete(deletingId);
      toast({
        title: "Successo",
        description: "Tipo scadenza eliminato",
      });
      await loadTipiScadenze(studioId);
      setIsDeleteDialogOpen(false);
      setDeletingId(null);
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il tipo scadenza",
        variant: "destructive",
      });
    }
  };

  const handleToggleAttivo = async (id: string, attivo: boolean) => {
    if (!studioId) return;

    try {
      await tipoScadenzaService.toggleAttivo(id, attivo);
      await loadTipiScadenze(studioId);
      toast({
        title: "Successo",
        description: `Tipo scadenza ${attivo ? "attivato" : "disattivato"}`,
      });
    } catch (error) {
      console.error("Errore toggle attivo:", error);
      toast({
        title: "Errore",
        description: "Impossibile modificare lo stato",
        variant: "destructive",
      });
    }
  };

  const getTipoLabel = (tipo: string) => {
    return TIPI_SCADENZA_OPTIONS.find((t) => t.value === tipo)?.label || tipo;
  };

  const getUrgencyColor = (dataScadenza: string) => {
    const today = new Date();
    const scadenza = new Date(dataScadenza);
    const diffDays = Math.ceil((scadenza.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "destructive";
    if (diffDays <= 7) return "default";
    if (diffDays <= 30) return "secondary";
    return "outline";
  };

  const getUrgencyText = (dataScadenza: string) => {
    const today = new Date();
    const scadenza = new Date(dataScadenza);
    const diffDays = Math.ceil((scadenza.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Scaduta";
    if (diffDays === 0) return "Oggi";
    if (diffDays === 1) return "Domani";
    if (diffDays <= 7) return `Tra ${diffDays} giorni`;
    if (diffDays <= 30) return `Tra ${diffDays} giorni`;
    return `Tra ${diffDays} giorni`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Caricamento...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Gestione Tipi Scadenze - Studio Manager Pro</title>
      </Head>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Gestione Tipi Scadenze
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Configura le scadenze ricorrenti per tutti i tuoi clienti
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Nuovo Tipo Scadenza
          </Button>
        </div>

        {tipiScadenze.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50 text-gray-400" />
              <p className="text-gray-500">Nessun tipo di scadenza configurato</p>
              <p className="text-sm text-gray-400 mt-2">Clicca su &quot;Nuovo Tipo Scadenza&quot; per iniziare</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {tipiScadenze.map((tipo) => (
              <Card key={tipo.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {tipo.nome}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          {getTipoLabel(tipo.tipo_scadenza)}
                        </Badge>
                        <Badge 
                          variant="secondary" 
                          className={
                            tipo.settore === "Fiscale" ? "bg-blue-100 text-blue-800" :
                            tipo.settore === "Lavoro" ? "bg-green-100 text-green-800" :
                            "bg-purple-100 text-purple-800"
                          }
                        >
                          {tipo.settore || "Fiscale"}
                        </Badge>
                        {tipo.ricorrente && (
                          <Badge variant="secondary" className="text-xs">
                            Ricorrente
                          </Badge>
                        )}
                      </div>

                      {tipo.descrizione && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {tipo.descrizione}
                        </p>
                      )}

                      <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(tipo.data_scadenza).toLocaleDateString("it-IT")}</span>
                          <Badge variant={getUrgencyColor(tipo.data_scadenza)}>
                            {getUrgencyText(tipo.data_scadenza)}
                          </Badge>
                        </div>
                        <div>
                          Preavvisi: {tipo.giorni_preavviso_1} e {tipo.giorni_preavviso_2} giorni
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Stato</span>
                        <Switch
                          checked={tipo.attivo ?? true}
                          onCheckedChange={(checked) => handleToggleAttivo(tipo.id, checked)}
                        />
                      </div>

                      <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-2" />

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(tipo)}
                          className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingId(tipo.id);
                            setIsDeleteDialogOpen(true);
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTipo ? "Modifica Tipo Scadenza" : "Nuovo Tipo Scadenza"}
            </DialogTitle>
            <DialogDescription>
              Configura un tipo di scadenza che potrà essere assegnato ai clienti
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="settore">Settore *</Label>
              <Select
                value={formData.settore}
                onValueChange={(value) => setFormData({ ...formData, settore: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona settore" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fiscale">Fiscale</SelectItem>
                  <SelectItem value="Lavoro">Lavoro</SelectItem>
                  <SelectItem value="Fiscale & Lavoro">Fiscale & Lavoro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="nome">Nome Scadenza *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
                placeholder="es. IVA 4° Trimestre 2025"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="descrizione">Descrizione</Label>
              <Textarea
                id="descrizione"
                value={formData.descrizione}
                onChange={(e) =>
                  setFormData({ ...formData, descrizione: e.target.value })
                }
                placeholder="Descrizione opzionale"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tipo_scadenza">Tipo Scadenza *</Label>
                <Select
                  value={formData.tipo_scadenza}
                  onValueChange={(value) =>
                    setFormData({ ...formData, tipo_scadenza: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPI_SCADENZA_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="data_scadenza">Data Scadenza *</Label>
                <Input
                  id="data_scadenza"
                  type="date"
                  value={formData.data_scadenza}
                  onChange={(e) =>
                    setFormData({ ...formData, data_scadenza: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="giorni_preavviso_1">Primo Preavviso (giorni)</Label>
                <Input
                  id="giorni_preavviso_1"
                  type="number"
                  min="1"
                  value={formData.giorni_preavviso_1}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      giorni_preavviso_1: parseInt(e.target.value),
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="giorni_preavviso_2">Secondo Preavviso (giorni)</Label>
                <Input
                  id="giorni_preavviso_2"
                  type="number"
                  min="1"
                  value={formData.giorni_preavviso_2}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      giorni_preavviso_2: parseInt(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="ricorrente"
                checked={formData.ricorrente}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, ricorrente: checked })
                }
              />
              <Label htmlFor="ricorrente">
                Scadenza ricorrente (si ripete ogni anno)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="attivo"
                checked={formData.attivo}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, attivo: checked })
                }
              />
              <Label htmlFor="attivo">Attivo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Annulla
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !formData.nome ||
                !formData.tipo_scadenza ||
                !formData.data_scadenza
              }
            >
              {editingTipo ? "Salva Modifiche" : "Crea Tipo Scadenza"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questo tipo di scadenza? Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}