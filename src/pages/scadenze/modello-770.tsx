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
import { Plus, Edit, Trash2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/router";
import type { Database } from "@/integrations/supabase/types";

type Scadenza770 = Database["public"]["Tables"]["tbscad770"]["Row"] & {
  tbtipi_scadenze?: Database["public"]["Tables"]["tbtipi_scadenze"]["Row"];
};

type Cliente = {
  id: string;
  ragione_sociale: string;
};

type TipoScadenza = {
  id: string;
  nome: string;
};

export default function Scadenze770Page() {
  const router = useRouter();
  const [scadenze, setScadenze] = useState<Scadenza770[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [tipiScadenze, setTipiScadenze] = useState<TipoScadenza[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingScadenza, setEditingScadenza] = useState<Scadenza770 | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    cliente_id: "",
    nominativo: "", // Campo readonly popolato dalla scelta cliente
    tipo_scadenza_id: "",
    mod_inviato: false,
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
    await Promise.all([fetchScadenze(), fetchClienti(), fetchTipiScadenze()]);
    setLoading(false);
  };

  const fetchClienti = async () => {
    const { data } = await supabase
      .from("tbclienti")
      .select("id, ragione_sociale")
      .order("ragione_sociale");
    setClienti(data || []);
  };

  const fetchTipiScadenze = async () => {
    const { data } = await supabase
      .from("tbtipi_scadenze")
      .select("id, nome")
      .eq("tipo_scadenza", "770") // Filtra solo tipi scadenza per 770
      .order("nome");
    
    // Se non ci sono tipi specifici, prendi tutti o mostra avviso
    if (!data || data.length === 0) {
      const { data: allTypes } = await supabase
        .from("tbtipi_scadenze")
        .select("id, nome")
        .order("nome");
      setTipiScadenze(allTypes || []);
    } else {
      setTipiScadenze(data);
    }
  };

  const fetchScadenze = async () => {
    try {
      const { data, error } = await supabase
        .from("tbscad770")
        .select(`
          *,
          tbtipi_scadenze(
            id,
            nome,
            data_scadenza
          )
        `)
        .eq("utente_operatore_id", currentUser.id)
        .order("created_at", { ascending: false });

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

  const handleClienteChange = (clienteId: string) => {
    const cliente = clienti.find(c => c.id === clienteId);
    setFormData({
      ...formData,
      cliente_id: clienteId,
      nominativo: cliente?.ragione_sociale || ""
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      toast({ title: "Errore", description: "Utente non autenticato", variant: "destructive" });
      return;
    }

    if (!formData.tipo_scadenza_id) {
        toast({ title: "Attenzione", description: "Seleziona un tipo di scadenza", variant: "destructive" });
        return;
    }

    try {
      const scadenzaData = {
        nominativo: formData.nominativo,
        tipo_scadenza_id: formData.tipo_scadenza_id,
        utente_operatore_id: currentUser.id,
        mod_inviato: formData.mod_inviato,
        note: formData.note,
      };

      if (editingScadenza) {
        const { error } = await supabase
          .from("tbscad770")
          .update(scadenzaData)
          .eq("id", editingScadenza.id);

        if (error) throw error;
        toast({ title: "Successo", description: "Scadenza aggiornata" });
      } else {
        // PER NUOVE SCADENZE: Usiamo l'ID del cliente come ID della scadenza
        // perché la tabella ha un vincolo FK id -> tbclienti.id
        const { error } = await supabase
          .from("tbscad770")
          .insert({
            ...scadenzaData,
            id: formData.cliente_id // CRITICAL: ID deve coincidere con ID cliente
          });

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
        description: error.message || "Errore nel salvataggio. Assicurati che il cliente non abbia già una scadenza 770.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa scadenza?")) return;

    try {
      const { error } = await supabase.from("tbscad770").delete().eq("id", id);
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
      cliente_id: scadenza.id, // ID scadenza = ID cliente
      nominativo: scadenza.nominativo || "",
      tipo_scadenza_id: scadenza.tipo_scadenza_id || "",
      mod_inviato: scadenza.mod_inviato || false,
      note: scadenza.note || "",
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setEditingScadenza(null);
    setFormData({
      cliente_id: "",
      nominativo: "",
      tipo_scadenza_id: "",
      mod_inviato: false,
      note: "",
    });
  };

  const statistiche = {
    totali: scadenze.length,
    daInviare: scadenze.filter((s) => !s.mod_inviato).length,
    inviati: scadenze.filter((s) => s.mod_inviato).length,
  };

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
                
                {/* Selezione Cliente */}
                <div>
                  <Label htmlFor="cliente">Cliente *</Label>
                  {editingScadenza ? (
                    <Input value={formData.nominativo} disabled />
                  ) : (
                    <Select 
                      value={formData.cliente_id} 
                      onValueChange={handleClienteChange}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona un cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clienti.map(cliente => (
                          <SelectItem key={cliente.id} value={cliente.id}>
                            {cliente.ragione_sociale}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Selezione Tipo Scadenza */}
                <div>
                  <Label htmlFor="tipo_scadenza">Tipo Scadenza *</Label>
                  <Select 
                    value={formData.tipo_scadenza_id} 
                    onValueChange={(val) => setFormData({...formData, tipo_scadenza_id: val})}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona scadenza" />
                    </SelectTrigger>
                    <SelectContent>
                      {tipiScadenze.map(tipo => (
                        <SelectItem key={tipo.id} value={tipo.id}>
                          {tipo.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="mod_inviato"
                    checked={formData.mod_inviato}
                    onChange={(e) => setFormData({ ...formData, mod_inviato: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="mod_inviato" className="cursor-pointer">
                    Modello Inviato
                  </Label>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                Da Inviare
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{statistiche.daInviare}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Inviati
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{statistiche.inviati}</div>
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
                  <TableHead>Tipo Scadenza</TableHead>
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
                ) : scadenze.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nessuna scadenza 770 trovata
                    </TableCell>
                  </TableRow>
                ) : (
                  scadenze.map((scadenza) => (
                    <TableRow key={scadenza.id}>
                      <TableCell className="font-medium">
                        {scadenza.nominativo || "N/D"}
                      </TableCell>
                      <TableCell>
                        {scadenza.tbtipi_scadenze?.nome || "N/D"}
                      </TableCell>
                      <TableCell>
                        {scadenza.tbtipi_scadenze?.data_scadenza 
                          ? format(parseISO(scadenza.tbtipi_scadenze.data_scadenza), "dd/MM/yyyy", { locale: it })
                          : "N/D"}
                      </TableCell>
                      <TableCell>
                        {scadenza.mod_inviato ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            Inviato
                          </span>
                        ) : (
                          <span className="text-orange-600">Da Inviare</span>
                        )}
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