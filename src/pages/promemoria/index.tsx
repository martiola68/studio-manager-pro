import { useState, useEffect } from "react";
import Head from "next/head";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { authService } from "@/services/authService";
import { promemoriaService } from "@/services/promemoriaService";
import { tipoPromemoriaService } from "@/services/tipoPromemoriaService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, Trash2, Clock, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/router";
import type { Database } from "@/lib/supabase/types";

type Promemoria = Database["public"]["Tables"]["tbpromemoria"]["Row"] & {
  tbtipopromemoria?: Database["public"]["Tables"]["tbtipopromemoria"]["Row"];
  tbutenti?: Database["public"]["Tables"]["tbutenti"]["Row"];
};

type TipoPromemoria = Database["public"]["Tables"]["tbtipopromemoria"]["Row"];

export default function PromemoriaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [promemoria, setPromemoria] = useState<Promemoria[]>([]);
  const [tipiPromemoria, setTipiPromemoria] = useState<TipoPromemoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPromemoria, setEditingPromemoria] = useState<Promemoria | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [filtroStato, setFiltroStato] = useState<string>("tutti");

  const [formData, setFormData] = useState({
    tipo_promemoria_id: "",
    note: "",
    data_inserimento: format(new Date(), "yyyy-MM-dd"),
    giorni_scadenza: 7,
    working_progress: "In lavorazione",
    da_fatturare: "no",
    fatturato: false,
  });

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchPromemoria();
    }
  }, [currentUser, filtroStato]);

  const checkAuthAndLoad = async () => {
    try {
      const authUser = await authService.getCurrentUser();
      if (!authUser) {
        router.push("/login");
        return;
      }

      const profile = await authService.getUserProfile(authUser.id);
      if (!profile) {
        router.push("/login");
        return;
      }

      setCurrentUser(profile);
      await fetchTipiPromemoria();
    } catch (error) {
      console.error("Auth error:", error);
      router.push("/login");
    }
  };

  const fetchTipiPromemoria = async () => {
    try {
      const data = await tipoPromemoriaService.getTipiPromemoria();
      setTipiPromemoria(data);
    } catch (error) {
      console.error("Errore caricamento tipi promemoria:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i tipi di promemoria",
        variant: "destructive",
      });
    }
  };

  const fetchPromemoria = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      let data = await promemoriaService.getPromemoria(currentUser.id);

      if (filtroStato !== "tutti") {
        data = data.filter((p) => p.working_progress === filtroStato);
      }

      setPromemoria(data);
    } catch (error) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      toast({
        title: "Errore",
        description: "Utente non autenticato",
        variant: "destructive",
      });
      return;
    }

    try {
      const dataScadenza = promemoriaService.calcolaDataScadenza(
        formData.data_inserimento,
        formData.giorni_scadenza
      );

      const promemoriaData = {
        operatore_id: currentUser.id,
        tipo_promemoria_id: formData.tipo_promemoria_id,
        note: formData.note,
        data_inserimento: formData.data_inserimento,
        giorni_scadenza: formData.giorni_scadenza,
        data_scadenza: dataScadenza,
        working_progress: formData.working_progress,
        da_fatturare: formData.da_fatturare === "si",
        fatturato: formData.da_fatturare === "si" ? formData.fatturato : false,
      };

      if (editingPromemoria) {
        await promemoriaService.aggiornaPromemoria(editingPromemoria.id, promemoriaData);
        toast({
          title: "Successo",
          description: "Promemoria aggiornato con successo",
        });
      } else {
        await promemoriaService.creaPromemoria(promemoriaData);
        toast({
          title: "Successo",
          description: "Promemoria creato con successo",
        });
      }

      setShowDialog(false);
      resetForm();
      fetchPromemoria();
    } catch (error: any) {
      console.error("Errore salvataggio promemoria:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare il promemoria",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo promemoria?")) return;

    try {
      await promemoriaService.eliminaPromemoria(id);
      toast({
        title: "Successo",
        description: "Promemoria eliminato con successo",
      });
      fetchPromemoria();
    } catch (error) {
      console.error("Errore eliminazione promemoria:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il promemoria",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (promemoria: Promemoria) => {
    setEditingPromemoria(promemoria);
    setFormData({
      tipo_promemoria_id: promemoria.tipo_promemoria_id,
      note: promemoria.note || "",
      data_inserimento: promemoria.data_inserimento,
      giorni_scadenza: promemoria.giorni_scadenza,
      working_progress: promemoria.working_progress,
      da_fatturare: promemoria.da_fatturare ? "si" : "no",
      fatturato: promemoria.fatturato,
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setEditingPromemoria(null);
    setFormData({
      tipo_promemoria_id: "",
      note: "",
      data_inserimento: format(new Date(), "yyyy-MM-dd"),
      giorni_scadenza: 7,
      working_progress: "In lavorazione",
      da_fatturare: "no",
      fatturato: false,
    });
  };

  const getStatoBadge = (stato: string) => {
    if (stato === "In lavorazione") {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 flex items-center gap-1 w-fit">
          <Clock className="h-3 w-3" />
          In Lavorazione
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1 w-fit">
        <CheckCircle2 className="h-3 w-3" />
        Concluso
      </span>
    );
  };

  const calcolaDataScadenzaPreview = () => {
    if (!formData.data_inserimento || !formData.giorni_scadenza) return "-";
    const dataScadenza = promemoriaService.calcolaDataScadenza(
      formData.data_inserimento,
      formData.giorni_scadenza
    );
    return format(parseISO(dataScadenza), "dd/MM/yyyy", { locale: it });
  };

  const statistiche = {
    totali: promemoria.length,
    inLavorazione: promemoria.filter((p) => p.working_progress === "In lavorazione").length,
    conclusi: promemoria.filter((p) => p.working_progress === "Concluso").length,
    daFatturare: promemoria.filter((p) => p.da_fatturare && !p.fatturato).length,
  };

  if (loading && !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Caricamento promemoria...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Promemoria | Studio Manager</title>
      </Head>

      <div className="flex-1 p-8">
        <div className="max-w-full mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold">Promemoria</h1>
              <p className="text-muted-foreground mt-2">
                Gestione dei promemoria personali
              </p>
            </div>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuovo Promemoria
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingPromemoria ? "Modifica Promemoria" : "Nuovo Promemoria"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Operatore</Label>
                    <Input
                      value={`${currentUser?.nome} ${currentUser?.cognome}`}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div>
                    <Label htmlFor="tipo_promemoria_id">Tipologia *</Label>
                    <Select
                      value={formData.tipo_promemoria_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, tipo_promemoria_id: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona tipologia" />
                      </SelectTrigger>
                      <SelectContent>
                        {tipiPromemoria.map((tipo) => (
                          <SelectItem key={tipo.id} value={tipo.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: tipo.colore || "#3B82F6" }}
                              />
                              {tipo.nome}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="note">Descrizione</Label>
                    <Textarea
                      id="note"
                      value={formData.note}
                      onChange={(e) =>
                        setFormData({ ...formData, note: e.target.value })
                      }
                      placeholder="Descrizione del promemoria"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="data_inserimento">Data *</Label>
                      <Input
                        id="data_inserimento"
                        type="date"
                        value={formData.data_inserimento}
                        onChange={(e) => setFormData({ ...formData, data_inserimento: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="giorni_scadenza">Giorni Scadenza *</Label>
                      <Input
                        id="giorni_scadenza"
                        type="number"
                        value={formData.giorni_scadenza}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            giorni_scadenza: parseInt(e.target.value) || 0,
                          })
                        }
                        min={0}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Data Scadenza (Calcolata)</Label>
                    <Input
                      value={calcolaDataScadenzaPreview()}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div>
                    <Label htmlFor="working_progress">Stato *</Label>
                    <Select
                      value={formData.working_progress}
                      onValueChange={(value: any) =>
                        setFormData({ ...formData, working_progress: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="In lavorazione">In Lavorazione</SelectItem>
                        <SelectItem value="Concluso">Concluso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="da_fatturare">Da Fatturare *</Label>
                      <Select
                        value={formData.da_fatturare}
                        onValueChange={(value: any) =>
                          setFormData({
                            ...formData,
                            da_fatturare: value,
                            fatturato: value === "no" ? false : formData.fatturato,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="si">SI</SelectItem>
                          <SelectItem value="no">NO</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="fatturato">Fatturato</Label>
                      <div className="flex items-center h-10 px-3 border rounded-md bg-background">
                        <Checkbox
                          id="fatturato"
                          checked={formData.fatturato}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, fatturato: checked as boolean })
                          }
                          disabled={formData.da_fatturare !== "si"}
                        />
                        <Label htmlFor="fatturato" className="ml-2 cursor-pointer">
                          {formData.fatturato ? "Sì" : "No"}
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowDialog(false)}
                    >
                      Annulla
                    </Button>
                    <Button type="submit">
                      {editingPromemoria ? "Aggiorna" : "Crea"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Totali
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistiche.totali}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  In Lavorazione
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {statistiche.inLavorazione}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Conclusi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {statistiche.conclusi}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Da Fatturare
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {statistiche.daFatturare}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Elenco Promemoria</CardTitle>
                <Select value={filtroStato} onValueChange={setFiltroStato}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tutti">Tutti gli stati</SelectItem>
                    <SelectItem value="In lavorazione">In Lavorazione</SelectItem>
                    <SelectItem value="Concluso">Concluso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipologia</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Data Scadenza</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Da Fatturare</TableHead>
                    <TableHead>Fatturato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="inline-block h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      </TableCell>
                    </TableRow>
                  ) : promemoria.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Nessun promemoria trovato
                      </TableCell>
                    </TableRow>
                  ) : (
                    promemoria.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor: p.tbtipopromemoria?.colore || "#3B82F6",
                              }}
                            />
                            {p.tbtipopromemoria?.nome || "N/D"}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {p.note || "-"}
                        </TableCell>
                        <TableCell>
                          {format(parseISO(p.data_inserimento), "dd/MM/yyyy", { locale: it })}
                        </TableCell>
                        <TableCell>
                          {format(parseISO(p.data_scadenza), "dd/MM/yyyy", { locale: it })}
                        </TableCell>
                        <TableCell>{getStatoBadge(p.working_progress)}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              p.da_fatturare
                                ? "bg-orange-100 text-orange-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {p.da_fatturare ? "SI" : "NO"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {p.da_fatturare ? (
                            p.fatturato ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(p.id)}
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
        </div>
      </div>
    </>
  );
}