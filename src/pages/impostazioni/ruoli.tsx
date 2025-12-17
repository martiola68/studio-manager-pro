import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Edit, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type RuoloOperatore = Database["public"]["Tables"]["tbroperatore"]["Row"];
type RuoloOperatoreInsert = Database["public"]["Tables"]["tbroperatore"]["Insert"];

export default function RuoliPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [ruoli, setRuoli] = useState<RuoloOperatore[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRuolo, setEditingRuolo] = useState<RuoloOperatore | null>(null);
  const [formData, setFormData] = useState({ ruolo: "" });

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: utente } = await supabase
        .from("tbutenti")
        .select("tipo_utente")
        .eq("email", session.user.email)
        .single();

      if (utente?.tipo_utente !== "Admin") {
        router.push("/dashboard");
        return;
      }

      await loadRuoli();
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
  };

  const loadRuoli = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("tbroperatore")
        .select("*")
        .order("ruolo", { ascending: true });

      if (error) throw error;
      setRuoli(data || []);
    } catch (error) {
      console.error("Errore caricamento ruoli:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i ruoli",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.ruolo.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci una descrizione per il ruolo",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingRuolo) {
        const { error } = await supabase
          .from("tbroperatore")
          .update({ ruolo: formData.ruolo })
          .eq("id", editingRuolo.id);

        if (error) throw error;

        toast({
          title: "Successo",
          description: "Ruolo aggiornato con successo"
        });
      } else {
        const { error } = await supabase
          .from("tbroperatore")
          .insert({ ruolo: formData.ruolo });

        if (error) throw error;

        toast({
          title: "Successo",
          description: "Ruolo creato con successo"
        });
      }

      setDialogOpen(false);
      resetForm();
      await loadRuoli();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare il ruolo",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (ruolo: RuoloOperatore) => {
    setEditingRuolo(ruolo);
    setFormData({ ruolo: ruolo.ruolo });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo ruolo? Gli utenti associati perderanno il riferimento.")) return;

    try {
      const { error } = await supabase
        .from("tbroperatore")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Ruolo eliminato con successo"
      });
      await loadRuoli();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il ruolo",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({ ruolo: "" });
    setEditingRuolo(null);
  };

  const filteredRuoli = ruoli.filter(r =>
    r.ruolo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Ruoli Operatori</h1>
                <p className="text-gray-500 mt-1">Gestisci i ruoli per la classificazione degli utenti</p>
              </div>
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    <Shield className="h-4 w-4 mr-2" />
                    Nuovo Ruolo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingRuolo ? "Modifica Ruolo" : "Nuovo Ruolo"}
                    </DialogTitle>
                    <DialogDescription>
                      Inserisci la descrizione del ruolo operatore
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="ruolo">Ruolo *</Label>
                      <Input
                        id="ruolo"
                        placeholder="es. Commercialista, Consulente del Lavoro, Segreteria..."
                        value={formData.ruolo}
                        onChange={(e) => setFormData({ ruolo: e.target.value })}
                        required
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button type="submit" className="flex-1">
                        {editingRuolo ? "Aggiorna" : "Crea"} Ruolo
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setDialogOpen(false)}
                      >
                        Annulla
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Cerca ruolo..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ruolo</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRuoli.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center py-8 text-gray-500">
                          Nessun ruolo trovato
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRuoli.map((ruolo) => (
                        <TableRow key={ruolo.id}>
                          <TableCell className="font-medium">{ruolo.ruolo}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(ruolo)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(ruolo.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
        </main>
      </div>
    </div>
  );
}