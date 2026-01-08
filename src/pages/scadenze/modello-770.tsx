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

export default function Scadenze770Page() {
  const router = useRouter();
  const [scadenze, setScadenze] = useState<Scadenza770[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingScadenza, setEditingScadenza] = useState<Scadenza770 | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nominativo: "",
    tipo_scadenza_id: "",
    mod_inviato: false,
    note: "",
  });

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchScadenze();
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

  const fetchScadenze = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

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

        toast({
          title: "Successo",
          description: "Scadenza 770 aggiornata con successo",
        });
      } else {
        const { error } = await supabase
          .from("tbscad770")
          .insert(scadenzaData);

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
      console.error("Errore salvataggio scadenza 770:", error);
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
      const { error } = await supabase
        .from("tbscad770")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Scadenza 770 eliminata con successo",
      });

      fetchScadenze();
    } catch (error: any) {
      console.error("Errore eliminazione scadenza 770:", error);
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
                  <Label htmlFor="nominativo">Nominativo Cliente *</Label>
                  <Input
                    id="nominativo"
                    value={formData.nominativo}
                    onChange={(e) => setFormData({ ...formData, nominativo: e.target.value })}
                    placeholder="Nome/Ragione Sociale"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="tipo_scadenza_id">Tipo Scadenza *</Label>
                  <Input
                    id="tipo_scadenza_id"
                    value={formData.tipo_scadenza_id}
                    onChange={(e) => setFormData({ ...formData, tipo_scadenza_id: e.target.value })}
                    placeholder="ID Tipo Scadenza"
                    required
                  />
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