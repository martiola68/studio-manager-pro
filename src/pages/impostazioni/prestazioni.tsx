import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Briefcase, Edit, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Prestazione = Database["public"]["Tables"]["tbprestazioni"]["Row"];

export default function PrestazioniPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [prestazioni, setPrestazioni] = useState<Prestazione[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrestazione, setEditingPrestazione] = useState<Prestazione | null>(null);
  const [formData, setFormData] = useState({ descrizione: "" });

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

      await loadPrestazioni();
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
  };

  const loadPrestazioni = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("tbprestazioni")
        .select("*")
        .order("descrizione", { ascending: true });

      if (error) throw error;
      setPrestazioni(data || []);
    } catch (error) {
      console.error("Errore caricamento prestazioni:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare le prestazioni",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.descrizione.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci una descrizione per la prestazione",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingPrestazione) {
        const { error } = await supabase
          .from("tbprestazioni")
          .update({ descrizione: formData.descrizione })
          .eq("id", editingPrestazione.id);

        if (error) throw error;

        toast({
          title: "Successo",
          description: "Prestazione aggiornata con successo"
        });
      } else {
        const { error } = await supabase
          .from("tbprestazioni")
          .insert({ descrizione: formData.descrizione });

        if (error) throw error;

        toast({
          title: "Successo",
          description: "Prestazione creata con successo"
        });
      }

      setDialogOpen(false);
      resetForm();
      await loadPrestazioni();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare la prestazione",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (prestazione: Prestazione) => {
    setEditingPrestazione(prestazione);
    setFormData({ descrizione: prestazione.descrizione });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa prestazione? I clienti associati perderanno il riferimento.")) return;

    try {
      const { error } = await supabase
        .from("tbprestazioni")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Prestazione eliminata con successo"
      });
      await loadPrestazioni();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare la prestazione",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({ descrizione: "" });
    setEditingPrestazione(null);
  };

  const filteredPrestazioni = prestazioni.filter(p =>
    p.descrizione.toLowerCase().includes(searchQuery.toLowerCase())
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
                <h1 className="text-3xl font-bold text-gray-900">Tipi Prestazione</h1>
                <p className="text-gray-500 mt-1">Gestisci i servizi professionali offerti dallo studio</p>
              </div>
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Briefcase className="h-4 w-4 mr-2" />
                    Nuova Prestazione
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingPrestazione ? "Modifica Prestazione" : "Nuova Prestazione"}
                    </DialogTitle>
                    <DialogDescription>
                      Inserisci la descrizione del tipo di prestazione
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="descrizione">Descrizione *</Label>
                      <Input
                        id="descrizione"
                        placeholder="es. Assistenza totale, Consulenza fiscale..."
                        value={formData.descrizione}
                        onChange={(e) => setFormData({ descrizione: e.target.value })}
                        required
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button type="submit" className="flex-1">
                        {editingPrestazione ? "Aggiorna" : "Crea"} Prestazione
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
                      placeholder="Cerca prestazione..."
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
                      <TableHead>Descrizione</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPrestazioni.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center py-8 text-gray-500">
                          Nessuna prestazione trovata
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPrestazioni.map((prestazione) => (
                        <TableRow key={prestazione.id}>
                          <TableCell className="font-medium">{prestazione.descrizione}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(prestazione)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(prestazione.id)}
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