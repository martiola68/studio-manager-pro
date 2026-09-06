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

      let canManageCatalog = systemAdmin === true;

      if (!canManageCatalog && user.email) {
        const { data: adminProfile } = await supabase
          .from("tbutenti")
          .select("nome, cognome, tipo_utente, attivo")
          .eq("email", user.email)
          .maybeSingle();

        const role = String(adminProfile?.tipo_utente || "").trim().toUpperCase();
        const nome = String(adminProfile?.nome || "").trim().toUpperCase();
        const cognome = String(adminProfile?.cognome || "").trim().toUpperCase();
        canManageCatalog =
          adminProfile?.attivo !== false &&
          (role === "ADMIN" || role === "AMMINISTRATORE") &&
          nome === "MARIO" &&
          cognome === "ARTIOLA";
      }

      setCanManageSystem(canManageCatalog);
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

  const canEditTipo = (tipo: TipoScadenzaCatalogo) => tipo.origine === "P" || canManageSystem;

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
      toast({ title: "Errore", description: "Impossibile modificare lo stato", variant: "destructive" });
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

  const getTipoLabel = (tipo: string) => TIPI_SCADENZA_OPTIONS.find((item) => item.value === tipo)?.label || tipo;

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
      <style jsx global>{`
        .tipi-scadenze-page .tipo-origine-system {
          background: rgb(15 23 42) !important;
          border-color: rgb(15 23 42) !important;
          color: white !important;
        }
        .tipi-scadenze-page .tipo-origine-personal {
          background: rgb(254 243 199) !important;
          border-color: rgb(252 211 77) !important;
          color: rgb(120 53 15) !important;
        }
        .tipi-scadenze-page [role="switch"] {
          min-width: 40px !important;
          width: 40px !important;
          height: 22px !important;
          min-height: 22px !important;
          border: 1px solid rgb(148 163 184) !important;
          background: rgb(203 213 225) !important;
        }
        .tipi-scadenze-page [role="switch"][data-state="checked"] {
          background: rgb(3 105 161) !important;
          border-color: rgb(3 105 161) !important;
        }
        .tipi-scadenze-page [role="switch"] > span {
          display: block !important;
          width: 18px !important;
          height: 18px !important;
          border-radius: 9999px !important;
          background: white !important;
          box-shadow: 0 1px 2px rgb(15 23 42 / .25) !important;
        }
      `}</style>
      <div className="tipi-scadenze-page max-w-7xl mx-auto p-4 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestione Tipi Scadenze</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Scadenze di sistema condivise e scadenze personali dello studio</p>
          </div>
          <Button onClick={() => handleOpenDialog()}><Plus className="w-4 h-4 mr-2" />Nuovo Tipo Scadenza</Button>
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
                          <Badge className={tipo.origine === "S" ? "tipo-origine-system" : "tipo-origine-personal"}>
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
            <DialogDescription>{editingTipo?.origine === "S" ? "Scadenza di sistema: la modifica sarà visibile a tutti gli studi." : "Le nuove scadenze sono personali dello studio che le crea."}</DialogDescription>
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
                  <Input value="P · Personale dello studio" disabled />
                )}
              </div>
            )}

            <div className="grid gap-2"><Label>Nome</Label><Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Es. Comunicazione IVA" /></div>
            <div className="grid gap-2"><Label>Descrizione</Label><Textarea value={formData.descrizione} onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Data Scadenza</Label><Input type="date" value={formData.data_scadenza} onChange={(e) => setFormData({ ...formData, data_scadenza: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Tipo Scadenza</Label><Select value={formData.tipo_scadenza} onValueChange={(value) => setFormData({ ...formData, tipo_scadenza: value })}><SelectTrigger><SelectValue placeholder="Seleziona tipo" /></SelectTrigger><SelectContent>{TIPI_SCADENZA_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
            </div>

            <div className="grid gap-3 rounded-lg border p-4">
              <div className="flex items-center space-x-2"><Checkbox id="ricorrente" checked={formData.ricorrente} onCheckedChange={(checked) => setFormData({ ...formData, ricorrente: Boolean(checked) })} /><Label htmlFor="ricorrente">Ricorrente annuale</Label></div>
              <div className="flex items-center space-x-2"><Checkbox id="settore-fiscale" checked={formData.settore_fiscale} onCheckedChange={(checked) => setFormData({ ...formData, settore_fiscale: Boolean(checked) })} /><Label htmlFor="settore-fiscale">Settore Fiscale</Label></div>
              <div className="flex items-center space-x-2"><Checkbox id="settore-lavoro" checked={formData.settore_lavoro} onCheckedChange={(checked) => setFormData({ ...formData, settore_lavoro: Boolean(checked) })} /><Label htmlFor="settore-lavoro">Settore Lavoro</Label></div>
              <div className="flex items-center space-x-2"><Checkbox id="settore-consulenza" checked={formData.settore_consulenza} onCheckedChange={(checked) => setFormData({ ...formData, settore_consulenza: Boolean(checked) })} /><Label htmlFor="settore-consulenza">Settore Consulenza</Label></div>
              <div className="flex items-center space-x-2"><Checkbox id="ha-scadenzario" checked={formData.ha_scadenzario} onCheckedChange={(checked) => setFormData({ ...formData, ha_scadenzario: Boolean(checked) })} /><Label htmlFor="ha-scadenzario">Ha scadenzario dedicato</Label></div>
              <div className="flex items-center space-x-2"><Checkbox id="attivo" checked={formData.attivo} onCheckedChange={(checked) => setFormData({ ...formData, attivo: Boolean(checked) })} /><Label htmlFor="attivo">Attivo</Label></div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Annulla</Button>
            <Button onClick={handleSave} disabled={!formData.nome.trim() || !formData.data_scadenza || !formData.tipo_scadenza}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Conferma eliminazione</AlertDialogTitle><AlertDialogDescription>Vuoi eliminare il tipo di scadenza “{deletingTipo?.nome}”? L'operazione non può essere annullata.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => setDeletingTipo(null)}>Annulla</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Elimina</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
