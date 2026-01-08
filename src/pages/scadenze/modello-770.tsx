import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { authService } from "@/services/authService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Edit, Trash2, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/router";
import type { Database } from "@/integrations/supabase/types";

type Scadenza770 = Database["public"]["Tables"]["scadenze_770"]["Row"] & {
  tbclienti?: {
    ragione_sociale: string;
  };
};

type Cliente = {
  id: string;
  ragione_sociale: string;
};

export default function Scadenze770Page() {
  const router = useRouter();
  const [scadenze, setScadenze] = useState<Scadenza770[]>([]);
  const [filteredScadenze, setFilteredScadenze] = useState<Scadenza770[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingScadenza, setEditingScadenza] = useState<Scadenza770 | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();

  const [filterAnno, setFilterAnno] = useState<string>("");
  const [filterStato, setFilterStato] = useState<string>("");

  const [formData, setFormData] = useState({
    cliente_id: "",
    anno: new Date().getFullYear(),
    data_scadenza: "",
    stato: "da_fare" as "da_fare" | "in_lavorazione" | "completato",
    note: "",
  });

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  useEffect(() => {
    applyFilters();
  }, [scadenze, filterAnno, filterStato]);

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
    } catch (error) {
      console.error("Auth error:", error);
      router.push("/login");
    }
  };

  const fetchData = async () => {
    if (!currentUser) return;
    setLoading(true);
    await Promise.all([fetchScadenze(), fetchClienti()]);
    setLoading(false);
  };

  const fetchClienti = async () => {
    const { data } = await supabase
      .from("tbclienti")
      .select("id, ragione_sociale")
      .eq("flag_770", true)
      .order("ragione_sociale");
    setClienti(data || []);
  };

  const fetchScadenze = async () => {
    try {
      const { data, error } = await supabase
        .from("scadenze_770")
        .select(`
          *,
          tbclienti(ragione_sociale)
        `)
        .order("anno", { ascending: false })
        .order("data_scadenza", { ascending: true });

      if (error) throw error;

      setScadenze((data || []) as Scadenza770[]);
    } catch (error: any) {
      console.error("Errore caricamento scadenze 770:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare le scadenze 770",
        variant: "destructive",
      });
    }
  };

  const applyFilters = () => {
    let filtered = [...scadenze];

    if (filterAnno) {
      filtered = filtered.filter((s) => s.anno.toString() === filterAnno);
    }

    if (filterStato) {
      filtered = filtered.filter((s) => s.stato === filterStato);
    }

    setFilteredScadenze(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      toast({ title: "Errore", description: "Utente non autenticato", variant: "destructive" });
      return;
    }

    try {
      const scadenzaData = {
        cliente_id: formData.cliente_id,
        anno: formData.anno,
        data_scadenza: formData.data_scadenza,
        stato: formData.stato,
        note: formData.note,
      };

      if (editingScadenza) {
        const { error } = await supabase
          .from("scadenze_770")
          .update(scadenzaData)
          .eq("id", editingScadenza.id);

        if (error) throw error;
        toast({ title: "Successo", description: "Scadenza aggiornata" });
      } else {
        const { error } = await supabase
          .from("scadenze_770")
          .insert(scadenzaData);

        if (error) throw error;
        toast({ title: "Successo", description: "Scadenza creata" });
      }

      setShowDialog(false);
      resetForm();
      fetchScadenze();
    } catch (error: any) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: error.message || "Errore nel salvataggio",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa scadenza?")) return;

    try {
      const { error } = await supabase.from("scadenze_770").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Successo", description: "Scadenza eliminata" });
      fetchScadenze();
    } catch (error: any) {
      toast({ title: "Errore", description: "Impossibile eliminare", variant: "destructive" });
    }
  };

  const handleEdit = (scadenza: Scadenza770) => {
    setEditingScadenza(scadenza);
    setFormData({
      cliente_id: scadenza.cliente_id,
      anno: scadenza.anno,
      data_scadenza: scadenza.data_scadenza,
      stato: scadenza.stato as "da_fare" | "in_lavorazione" | "completato",
      note: scadenza.note || "",
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setEditingScadenza(null);
    setFormData({
      cliente_id: "",
      anno: new Date().getFullYear(),
      data_scadenza: "",
      stato: "da_fare",
      note: "",
    });
  };

  const getStatoColor = (stato: string) => {
    switch (stato) {
      case "completato":
        return "text-green-600 bg-green-50";
      case "in_lavorazione":
        return "text-yellow-600 bg-yellow-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getStatoLabel = (stato: string) => {
    switch (stato) {
      case "completato":
        return "Completato";
      case "in_lavorazione":
        return "In Lavorazione";
      default:
        return "Da Fare";
    }
  };

  const statistiche = {
    totali: filteredScadenze.length,
    daFare: filteredScadenze.filter((s) => s.stato === "da_fare").length,
    inLavorazione: filteredScadenze.filter((s) => s.stato === "in_lavorazione").length,
    completate: filteredScadenze.filter((s) => s.stato === "completato").length,
  };

  const anni = Array.from(
    new Set(scadenze.map((s) => s.anno))
  ).sort((a, b) => b - a);

  if (loading && !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Caricamento...</p>
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
                  <Label htmlFor="cliente">Cliente *</Label>
                  <Select
                    value={formData.cliente_id}
                    onValueChange={(value) => setFormData({ ...formData, cliente_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clienti.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.ragione_sociale}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                <div>
                  <Label htmlFor="stato">Stato *</Label>
                  <Select
                    value={formData.stato}
                    onValueChange={(value: "da_fare" | "in_lavorazione" | "completato") =>
                      setFormData({ ...formData, stato: value })
                    }
                    required
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

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="filter_anno">Anno</Label>
                <Select value={filterAnno} onValueChange={setFilterAnno}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tutti gli anni" />
                  </SelectTrigger>
                  <SelectContent>
                    {anni.map((anno) => (
                      <SelectItem key={anno} value={anno.toString()}>
                        {anno}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filter_stato">Stato</Label>
                <Select value={filterStato} onValueChange={setFilterStato}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tutti gli stati" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="da_fare">Da Fare</SelectItem>
                    <SelectItem value="in_lavorazione">In Lavorazione</SelectItem>
                    <SelectItem value="completato">Completato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setFilterAnno("");
                  setFilterStato("");
                }}
              >
                Cancella Filtri
              </Button>
            </div>
          </CardContent>
        </Card>

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
              <div className="text-2xl font-bold text-gray-600">{statistiche.daFare}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                In Lavorazione
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {statistiche.inLavorazione}
              </div>
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
            <CardTitle>Elenco Scadenze 770</CardTitle>
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
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="inline-block h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </TableCell>
                  </TableRow>
                ) : filteredScadenze.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nessuna scadenza 770 trovata
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredScadenze.map((scadenza) => (
                    <TableRow key={scadenza.id}>
                      <TableCell className="font-medium">
                        {scadenza.tbclienti?.ragione_sociale || "N/D"}
                      </TableCell>
                      <TableCell>{scadenza.anno}</TableCell>
                      <TableCell>
                        {format(parseISO(scadenza.data_scadenza), "dd/MM/yyyy", { locale: it })}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatoColor(
                            scadenza.stato
                          )}`}
                        >
                          {getStatoLabel(scadenza.stato)}
                        </span>
                      </TableCell>
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