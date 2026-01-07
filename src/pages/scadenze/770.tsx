import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Cliente } from "@/types";

interface Scadenza770 {
  id: string;
  cliente_id: string;
  anno: number;
  data_scadenza: string;
  stato: "da_fare" | "in_lavorazione" | "completato";
  note?: string;
  created_at: string;
  cliente?: Cliente;
}

export default function Scadenze770Page() {
  const [scadenze, setScadenze] = useState<Scadenza770[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingScadenza, setEditingScadenza] = useState<Scadenza770 | null>(null);
  const [annoCorrente] = useState(new Date().getFullYear());
  const [filtroAnno, setFiltroAnno] = useState<number>(annoCorrente);
  const [filtroStato, setFiltroStato] = useState<string>("tutti");
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    cliente_id: "",
    anno: annoCorrente,
    data_scadenza: "",
    stato: "da_fare" as const,
    note: "",
  });

  useEffect(() => {
    fetchScadenze();
  }, [filtroAnno, filtroStato]);

  const fetchScadenze = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from("scadenze_770")
        .select(`
          *,
          tbclienti!scadenze_770_cliente_id_fkey (
            id,
            RagioneSociale,
            CodiceFiscale,
            PartitaIva
          )
        `)
        .eq("anno", filtroAnno)
        .order("data_scadenza", { ascending: true });

      if (filtroStato !== "tutti") {
        query = query.eq("stato", filtroStato);
      }

      const { data, error } = await query;

      if (error) throw error;

      const scadenzeConClienti = (data || []).map((s: any) => ({
        ...s,
        cliente: Array.isArray(s.tbclienti) ? s.tbclienti[0] : s.tbclienti,
      }));

      setScadenze(scadenzeConClienti as Scadenza770[]);
    } catch (error: any) {
      console.error("Errore nel caricamento delle scadenze 770:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare le scadenze 770",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingScadenza) {
        const { error } = await supabase
          .from("scadenze_770")
          .update({
            cliente_id: formData.cliente_id,
            anno: formData.anno,
            data_scadenza: formData.data_scadenza,
            stato: formData.stato,
            note: formData.note,
          })
          .eq("id", editingScadenza.id);

        if (error) throw error;

        toast({
          title: "Successo",
          description: "Scadenza 770 aggiornata con successo",
        });
      } else {
        const { error } = await supabase.from("scadenze_770").insert([
          {
            cliente_id: formData.cliente_id,
            anno: formData.anno,
            data_scadenza: formData.data_scadenza,
            stato: formData.stato,
            note: formData.note,
          },
        ]);

        if (error) throw error;

        toast({
          title: "Successo",
          description: "Scadenza 770 creata con successo",
        });
      }

      setShowDialog(false);
      resetForm();
      fetchScadenze();
    } catch (error: any) {
      console.error("Errore nel salvataggio della scadenza 770:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare la scadenza 770",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa scadenza 770?")) return;

    try {
      const { error } = await supabase.from("scadenze_770").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Scadenza 770 eliminata con successo",
      });

      fetchScadenze();
    } catch (error: any) {
      console.error("Errore nell'eliminazione della scadenza 770:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare la scadenza 770",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (scadenza: Scadenza770) => {
    setEditingScadenza(scadenza);
    setFormData({
      cliente_id: scadenza.cliente_id,
      anno: scadenza.anno,
      data_scadenza: scadenza.data_scadenza,
      stato: scadenza.stato,
      note: scadenza.note || "",
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setEditingScadenza(null);
    setFormData({
      cliente_id: "",
      anno: annoCorrente,
      data_scadenza: "",
      stato: "da_fare" as "da_fare" | "in_lavorazione" | "completato",
      note: "",
    });
  };

  const getStatoBadge = (stato: string) => {
    const styles = {
      da_fare: "bg-yellow-100 text-yellow-800",
      in_lavorazione: "bg-blue-100 text-blue-800",
      completato: "bg-green-100 text-green-800",
    };
    const labels = {
      da_fare: "Da Fare",
      in_lavorazione: "In Lavorazione",
      completato: "Completato",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[stato as keyof typeof styles]}`}>
        {labels[stato as keyof typeof labels]}
      </span>
    );
  };

  const statistiche = {
    totali: scadenze.length,
    daFare: scadenze.filter((s) => s.stato === "da_fare").length,
    inLavorazione: scadenze.filter((s) => s.stato === "in_lavorazione").length,
    completate: scadenze.filter((s) => s.stato === "completato").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Caricamento scadenze 770...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8">
      <div className="max-w-full mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Scadenze Modello 770</h1>
            <p className="text-muted-foreground mt-2">
              Gestione delle scadenze per il Modello 770
            </p>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Nuova Scadenza
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingScadenza ? "Modifica Scadenza 770" : "Nuova Scadenza 770"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="cliente_id">Cliente *</Label>
                  <Input
                    id="cliente_id"
                    value={formData.cliente_id}
                    onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
                    placeholder="ID Cliente"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="anno">Anno *</Label>
                    <Input
                      id="anno"
                      type="number"
                      value={formData.anno}
                      onChange={(e) => setFormData({ ...formData, anno: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="data_scadenza">Data Scadenza *</Label>
                    <Input
                      id="data_scadenza"
                      type="date"
                      value={formData.data_scadenza}
                      onChange={(e) => setFormData({ ...formData, data_scadenza: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="stato">Stato *</Label>
                  <Select
                    value={formData.stato}
                    onValueChange={(value: any) => setFormData({ ...formData, stato: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="da_fare">Da Fare</SelectItem>
                      <SelectItem value="in_lavorazione">In Lavorazione</SelectItem>
                      <SelectItem value="completato">Completato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="note">Note</Label>
                  <Input
                    id="note"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="Note aggiuntive"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                    Annulla
                  </Button>
                  <Button type="submit">
                    {editingScadenza ? "Aggiorna" : "Crea"}
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
                Da Fare
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{statistiche.daFare}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                In Lavorazione
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{statistiche.inLavorazione}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{statistiche.completate}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Elenco Scadenze 770</CardTitle>
              <div className="flex gap-4">
                <Select value={filtroAnno.toString()} onValueChange={(v) => setFiltroAnno(parseInt(v))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[annoCorrente - 1, annoCorrente, annoCorrente + 1].map((anno) => (
                      <SelectItem key={anno} value={anno.toString()}>
                        {anno}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filtroStato} onValueChange={setFiltroStato}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tutti">Tutti gli stati</SelectItem>
                    <SelectItem value="da_fare">Da Fare</SelectItem>
                    <SelectItem value="in_lavorazione">In Lavorazione</SelectItem>
                    <SelectItem value="completato">Completato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Anno</TableHead>
                  <TableHead>Data Scadenza</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scadenze.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nessuna scadenza 770 trovata
                    </TableCell>
                  </TableRow>
                ) : (
                  scadenze.map((scadenza) => (
                    <TableRow key={scadenza.id}>
                      <TableCell className="font-medium">
                        {scadenza.cliente?.RagioneSociale || "N/D"}
                      </TableCell>
                      <TableCell>{scadenza.anno}</TableCell>
                      <TableCell>
                        {format(parseISO(scadenza.data_scadenza), "dd/MM/yyyy", { locale: it })}
                      </TableCell>
                      <TableCell>{getStatoBadge(scadenza.stato)}</TableCell>
                      <TableCell className="max-w-xs truncate">{scadenza.note || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(scadenza)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(scadenza.id)}
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
  );
}