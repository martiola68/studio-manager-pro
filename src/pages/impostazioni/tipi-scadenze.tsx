import { useEffect, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Calendar, RotateCcw } from "lucide-react";
import { authService } from "@/services/authService";
import {
  tipoScadenzaService,
  type TipoScadenzaCatalogo,
} from "@/services/tipoScadenzaService";
import { studioService } from "@/services/studioService";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

const EMPTY_FORM = {
  origine: "P" as "S" | "P",
  nome: "",
  descrizione: "",
  data_scadenza: "",
  tipo_scadenza: "",
  ricorrente: false,
  attivo: true,
  settore_fiscale: false,
  settore_lavoro: false,
  settore_consulenza: false,
  ha_scadenzario: false,
};

export default function TipiScadenzePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tipiScadenze, setTipiScadenze] = useState<TipoScadenzaCatalogo[]>([]);
  const [studioId, setStudioId] = useState<string | null>(null);
  const [canManageSystem, setCanManageSystem] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoScadenzaCatalogo | null>(null);
  const [deletingTipo, setDeletingTipo] = useState<TipoScadenzaCatalogo | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    void checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      const { data: systemAdmin, error: systemAdminError } = await (supabase as any).rpc(
        "is_system_catalog_admin",
      );
      if (systemAdminError) {
        console.warn("Verifica amministratore catalogo non disponibile:", systemAdminError);
      }
      setCanManageSystem(systemAdmin === true);

      await loadTipiScadenze(studio.id);
    } catch (error) {
      console.error("Errore autenticazione:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadTipiScadenze = async (currentStudioId: string) => {
    try {
      const data = await tipoScadenzaService.getAll(currentStudioId);
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

  const canEditTipo = (tipo: TipoScadenzaCatalogo) =>
    tipo.origine === "P" || canManageSystem;

  const handleOpenDialog = (tipo?: TipoScadenzaCatalogo) => {
    if (tipo) {
      if (!canEditTipo(tipo)) return;
      setEditingTipo(tipo);
      setFormData({
        origine: tipo.origine,
        nome: tipo.nome,
        descrizione: tipo.descrizione || "",
        data_scadenza: tipo.data_scadenza,
        tipo_scadenza: tipo.tipo_scadenza,
        ricorrente: tipo.ricorrente || false,
        attivo: tipo.attivo_effettivo ?? tipo.attivo ?? true,
        settore_fiscale: tipo.settore_fiscale || false,
        settore_lavoro: tipo.settore_lavoro || false,
        settore_consulenza: tipo.settore_consulenza || false,
        ha_scadenzario: tipo.ha_scadenzario || false,
      });
    } else {
      setEditingTipo(null);
      setFormData({ ...EMPTY_FORM, origine: "P" });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTipo(null);
    setFormData({ ...EMPTY_FORM });
  };

  const handleSave = async () => {
    if (!studioId) return;

    try {
      const origine = editingTipo?.origine || (canManageSystem ? formData.origine : "P");
      const dataToSave = {
        nome: formData.nome.trim(),
        descrizione: formData.descrizione.trim(),
        data_scadenza: formData.data_scadenza,
        tipo_scadenza: formData.tipo_scadenza,
        ricorrente: formData.ricorrente,
        attivo: formData.attivo,
        settore_fiscale: formData.settore_fiscale,
        settore_lavoro: formData.settore_lavoro,
        settore_consulenza: formData.settore_consulenza,
        ha_scadenzario: formData.ha_scadenzario,
      };

      if (editingTipo) {
        if (!canEditTipo(editingTipo)) throw new Error("Scadenza di sistema non modificabile.");
        await tipoScadenzaService.update(editingTipo.id, dataToSave);
        toast({ title: "Successo", description: "Tipo scadenza aggiornato" });
      } else {
        await tipoScadenzaService.create({
          ...dataToSave,
          studio_id: studioId,
          origine,
          // Mantenuti solo per compatibilità con il cron esistente; non sono più configurabili dalla UI.
          giorni_preavviso_1: 15,
          giorni_preavviso_2: 7,
        } as any);
        toast({
          title: "Successo",
          description: origine === "S" ? "Scadenza di sistema creata" : "Scadenza personale creata",
        });
      }

      await loadTipiScadenze(studioId);
      handleCloseDialog();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Impossibile salvare il tipo scadenza",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingTipo || !studioId) return;
    try {
      if (!canEditTipo(deletingTipo)) throw new Error("Scadenza di sistema non eliminabile.");
      await tipoScadenzaService.delete(deletingTipo.id);
      toast({ title: "Successo", description: "Tipo scadenza eliminato" });
      await loadTipiScadenze(studioId);
      setIsDeleteDialogOpen(false);
      setDeletingTipo(null);
    } catch (error) {
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Impossibile eliminare il tipo scadenza",
        variant: "destructive",
      });
    }
  };

  const handleToggleAttivo = async (tipo: TipoScadenzaCatalogo, attivo: boolean) => {
    if (!studioId) return;
    try {
      await tipoScadenzaService.toggleAttivo(tipo, studioId, attivo);
      await loadTipiScadenze(studioId);
      toast({
        title: "Successo",
        description: `Tipo scadenza ${attivo ? "attivato" : "disattivato"} per questo studio`,
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile modificare lo stato",
        variant: "destructive",
      });
    }
  };

  const handleRinnovaScadenza = async (tipo: TipoScadenzaCatalogo) => {
    if (!studioId || !canEditTipo(tipo)) return;
    try {
      const dataAttuale = new Date(`${tipo.data_scadenza}T00:00:00`);
      dataAttuale.setFullYear(dataAttuale.getFullYear() + 1);
      const nuovaDataStr = dataAttuale.toISOString().split("T")[0];
      await tipoScadenzaService.update(tipo.id, { data_scadenza: nuovaDataStr });
      toast({
        title: "Scadenza rinnovata",
        description: `Data aggiornata a ${dataAttuale.toLocaleDateString("it-IT")}`,
      });
      await loadTipiScadenze(studioId);
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile rinnovare la scadenza", variant: "destructive" });
    }
  };

  const getTipoLabel = (tipo: string) =>
    TIPI_SCADENZA_OPTIONS.find((item) => item.value === tipo)?.label || tipo;

  const getUrgencyColor = (dataScadenza: string) => {
    const today = new Date();
    const scadenza = new Date(`${dataScadenza}T00:00:00`);
    const diffDays = Math.ceil((scadenza.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return "destructive" as const;
    if (diffDays <= 7) return "default" as const;
    if (diffDays <= 30) return "secondary" as const;
    return "outline" as const;
  };

  const getUrgencyText = (dataScadenza: string) => {
    const today = new Date();
    const scadenza = new Date(`${dataScadenza}T00:00:00`);
    const diffDays = Math.ceil((scadenza.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return "Scaduta";
    if (diffDays === 0) return "Oggi";
    if (diffDays === 1) return "Domani";
    return `Tra ${diffDays} giorni`;
  };

  const getSettoriBadges = (tipo: TipoScadenzaCatalogo) => {
    const badges = [];
    if (tipo.settore_fiscale) badges.push(<Badge key="f" variant="secondary" className="bg-blue-100 text-blue-800">Fiscale</Badge>);
    if (tipo.settore_lavoro) badges.push(<Badge key="l" variant="secondary" className="bg-green-100 text-green-800">Lavoro</Badge>);
    if (tipo.settore_consulenza) badges.push(<Badge key="c" variant="secondary" className="bg-purple-100 text-purple-800">Consulenza</Badge>);
    return badges;
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-lg">Caricamento...</div></div>;
  }

  return (
    <>
      <Head><title>Gestione Tipi Scadenze - Studio Manager Pro</title></Head>
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestione Tipi Scadenze</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Scadenze di sistema condivise e scadenze personali dello studio
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />Nuovo Tipo Scadenza
          </Button>
        </div>

        {tipiScadenze.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><Calendar className="w-12 h-12 mx-auto mb-4 opacity-50 text-gray-400" /><p className="text-gray-500">Nessun tipo di scadenza configurato</p></CardContent></Card>
        ) : (
          <div className="grid gap-4">
            {tipiScadenze.map((tipo) => {
              const editable = canEditTipo(tipo);
              return (
                <Card key={tipo.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{tipo.nome}</h3>
                          <Badge className={tipo.origine === "S" ? "bg-slate-900 text-white" : "bg-amber-100 text-amber-900"}>
                            {tipo.origine === "S" ? "S · Sistema" : "P · Personale"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{getTipoLabel(tipo.tipo_scadenza)}</Badge>
                          {getSettoriBadges(tipo)}
                          {tipo.ricorrente && <Badge variant="secondary" className="text-xs">Ricorrente</Badge>}
                        </div>
                        {tipo.descrizione && <p className="text-sm text-gray-600 dark:text-gray-400">{tipo.descrizione}</p>}
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(`${tipo.data_scadenza}T00:00:00`).toLocaleDateString("it-IT")}</span>
                          <Badge variant={getUrgencyColor(tipo.data_scadenza)}>{getUrgencyText(tipo.data_scadenza)}</Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-500">Stato</span>
                          <Switch checked={tipo.attivo_effettivo ?? tipo.attivo ?? true} onCheckedChange={(checked) => handleToggleAttivo(tipo, checked)} />
                        </div>
                        {editable && (
                          <>
                            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-2" />
                            <div className="flex items-center gap-1">
                              {new Date(`${tipo.data_scadenza}T00:00:00`) < new Date() && (
                                <Button variant="ghost" size="icon" onClick={() => handleRinnovaScadenza(tipo)} title="Rinnova scadenza (+1 anno)"><RotateCcw className="w-4 h-4 text-blue-600" /></Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(tipo)} title="Modifica"><Pencil className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => { setDeletingTipo(tipo); setIsDeleteDialogOpen(true); }} title="Elimina"><Trash2 className="w-4 h-4 text-red-600" /></Button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTipo ? "Modifica Tipo Scadenza" : "Nuovo Tipo Scadenza"}</DialogTitle>
            <DialogDescription>
              {editingTipo?.origine === "S"
                ? "Scadenza di sistema: la modifica sarà visibile a tutti gli studi."
                : "Le nuove scadenze sono personali dello studio che le crea."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {!editingTipo && (
              <div className="grid gap-2">
                <Label>Origine</Label>
                {canManageSystem ? (
                  <Select value={formData.origine} onValueChange={(value) => setFormData({ ...formData, origine: value as "S" | "P" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="P">P · Personale dello studio</SelectItem>
                      <SelectItem value="S">S · Sistema - visibile a tutti gli studi</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="rounded-md border bg-amber-50 px-3 py-2 text-sm text-amber-900"><strong>P · Personale</strong> — visibile e modificabile solo dal tuo studio.</div>
                )}
              </div>
            )}

            {editingTipo && (
              <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm">
                <strong>{editingTipo.origine === "S" ? "S · Sistema" : "P · Personale"}</strong>
                {editingTipo.origine === "S" && " — condivisa con tutti gli studi"}
              </div>
            )}

            <div className="grid gap-2">
              <Label>Settori *</Label>
              <div className="space-y-3 p-4 border rounded-md bg-gray-50 dark:bg-gray-800">
                {[
                  ["settore_fiscale", "Settore Fiscale"],
                  ["settore_lavoro", "Settore Lavoro"],
                  ["settore_consulenza", "Settore Consulenza"],
                ].map(([key, label]) => (
                  <div className="flex items-center space-x-2" key={key}>
                    <Checkbox id={key} checked={Boolean((formData as any)[key])} onCheckedChange={(checked) => setFormData({ ...formData, [key]: !!checked })} />
                    <Label htmlFor={key} className="font-normal cursor-pointer">{label}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2"><Label htmlFor="nome">Nome Scadenza *</Label><Input id="nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="es. IVA 4° Trimestre" /></div>
            <div className="grid gap-2"><Label htmlFor="descrizione">Descrizione</Label><Textarea id="descrizione" value={formData.descrizione} onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })} placeholder="Descrizione opzionale" rows={3} /></div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tipo_scadenza">Tipo Scadenza *</Label>
                <Select value={formData.tipo_scadenza} onValueChange={(value) => setFormData({ ...formData, tipo_scadenza: value })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona tipo" /></SelectTrigger>
                  <SelectContent>{TIPI_SCADENZA_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2"><Switch id="ha_scadenzario" checked={formData.ha_scadenzario} onCheckedChange={(checked) => setFormData({ ...formData, ha_scadenzario: checked })} /><Label htmlFor="ha_scadenzario">Scadenza collegata a scadenzario operativo</Label></div>
              <div className="grid gap-2"><Label htmlFor="data_scadenza">Data Scadenza *</Label><Input id="data_scadenza" type="date" value={formData.data_scadenza} onChange={(e) => setFormData({ ...formData, data_scadenza: e.target.value })} /></div>
            </div>

            <div className="flex items-center space-x-2"><Switch id="ricorrente" checked={formData.ricorrente} onCheckedChange={(checked) => setFormData({ ...formData, ricorrente: checked })} /><Label htmlFor="ricorrente">Scadenza ricorrente (si ripete ogni anno)</Label></div>
            <div className="flex items-center space-x-2"><Switch id="attivo" checked={formData.attivo} onCheckedChange={(checked) => setFormData({ ...formData, attivo: checked })} /><Label htmlFor="attivo">Attivo</Label></div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Annulla</Button>
            <Button onClick={handleSave} disabled={!formData.nome || !formData.tipo_scadenza || !formData.data_scadenza}>
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
              {deletingTipo?.origine === "S"
                ? "Questa è una scadenza di sistema: eliminandola verrà rimossa per tutti gli studi. Continuare?"
                : "Sei sicuro di voler eliminare questa scadenza personale?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
