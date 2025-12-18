import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { utenteService } from "@/services/utenteService";
import Header from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Edit, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];
type RuoloOperatore = Database["public"]["Tables"]["tbroperatore"]["Row"];

export default function GestioneUtentiPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [ruoli, setRuoli] = useState<RuoloOperatore[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUtente, setEditingUtente] = useState<Utente | null>(null);

  const [formData, setFormData] = useState({
    nome: "",
    cognome: "",
    email: "",
    tipo_utente: "User" as "Admin" | "User",
    ruolo_operatore_id: "",
    attivo: true
  });

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

      await loadData();
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [utentiData, ruoliData] = await Promise.all([
        utenteService.getUtenti(),
        loadRuoli()
      ]);
      setUtenti(utentiData);
      setRuoli(ruoliData);
    } catch (error) {
      console.error("Errore caricamento dati:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRuoli = async (): Promise<RuoloOperatore[]> => {
    const { data, error } = await supabase
      .from("tbroperatore")
      .select("*")
      .order("ruolo");
    
    if (error) throw error;
    return data || [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingUtente) {
        await utenteService.updateUtente(editingUtente.id, formData);
        toast({
          title: "Successo",
          description: "Utente aggiornato con successo"
        });
      } else {
        await utenteService.createUtente(formData);
        toast({
          title: "Successo",
          description: "Utente creato con successo"
        });
      }

      setDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare l'utente",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (utente: Utente) => {
    setEditingUtente(utente);
    setFormData({
      nome: utente.nome,
      cognome: utente.cognome,
      email: utente.email,
      tipo_utente: utente.tipo_utente as "Admin" | "User",
      ruolo_operatore_id: utente.ruolo_operatore_id || "",
      attivo: utente.attivo ?? true
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo utente?")) return;

    try {
      await utenteService.deleteUtente(id);
      toast({
        title: "Successo",
        description: "Utente eliminato con successo"
      });
      await loadData();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare l'utente",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      cognome: "",
      email: "",
      tipo_utente: "User",
      ruolo_operatore_id: "",
      attivo: true
    });
    setEditingUtente(null);
  };

  const filteredUtenti = utenti.filter(u =>
    u.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.cognome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
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
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Gestione Utenti</h1>
                <p className="text-gray-500 mt-1">Crea e gestisci gli utenti del sistema</p>
              </div>
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Nuovo Utente
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingUtente ? "Modifica Utente" : "Nuovo Utente"}
                    </DialogTitle>
                    <DialogDescription>
                      Inserisci i dati dell'utente
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nome">Nome *</Label>
                        <Input
                          id="nome"
                          value={formData.nome}
                          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cognome">Cognome *</Label>
                        <Input
                          id="cognome"
                          value={formData.cognome}
                          onChange={(e) => setFormData({ ...formData, cognome: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tipo_utente">Tipo Utente *</Label>
                        <Select
                          value={formData.tipo_utente}
                          onValueChange={(value: "Admin" | "User") => 
                            setFormData({ ...formData, tipo_utente: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Admin">Amministratore</SelectItem>
                            <SelectItem value="User">Utente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="ruolo_operatore_id">Ruolo Operatore</Label>
                        <Select
                          value={formData.ruolo_operatore_id || "__none__"}
                          onValueChange={(value) => 
                            setFormData({ ...formData, ruolo_operatore_id: value === "__none__" ? "" : value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona ruolo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Nessuno</SelectItem>
                            {ruoli.map((ruolo) => (
                              <SelectItem key={ruolo.id} value={ruolo.id}>
                                {ruolo.ruolo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="attivo"
                        checked={formData.attivo}
                        onChange={(e) => setFormData({ ...formData, attivo: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor="attivo" className="cursor-pointer">Utente attivo</Label>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button type="submit" className="flex-1">
                        {editingUtente ? "Aggiorna" : "Crea"} Utente
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
                      placeholder="Cerca per nome, cognome o email..."
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
                      <TableHead>Nome</TableHead>
                      <TableHead>Cognome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ruolo</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUtenti.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          Nessun utente trovato
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUtenti.map((utente) => {
                        const ruolo = ruoli.find(r => r.id === utente.ruolo_operatore_id);
                        return (
                          <TableRow key={utente.id}>
                            <TableCell className="font-medium">{utente.nome}</TableCell>
                            <TableCell>{utente.cognome}</TableCell>
                            <TableCell>{utente.email}</TableCell>
                            <TableCell>
                              <Badge variant={utente.tipo_utente === "Admin" ? "default" : "secondary"}>
                                {utente.tipo_utente === "Admin" ? "Amministratore" : "Utente"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {ruolo ? ruolo.ruolo : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={utente.attivo ? "default" : "secondary"}>
                                {utente.attivo ? "Attivo" : "Non attivo"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(utente)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(utente.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
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