import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { contattoService } from "@/services/contattoService";
import Header from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Edit, Trash2, Search, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Contatto = Database["public"]["Tables"]["tbcontatti"]["Row"];

export default function ContattiPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [contatti, setContatti] = useState<Contatto[]>([]);
  const [filteredContatti, setFilteredContatti] = useState<Contatto[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [letterFilter, setLetterFilter] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContatto, setEditingContatto] = useState<Contatto | null>(null);

  const [formData, setFormData] = useState({
    nome: "",
    cognome: "",
    email: "",
    cell: "",
    tel: "",
    note: "",
    cassetto_fiscale: false,
    utente: "",
    password: "",
    pin: "",
    password_iniziale: ""
  });

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  useEffect(() => {
    filterContatti();
  }, [contatti, searchQuery, letterFilter]);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      await loadContatti();
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
  };

  const loadContatti = async () => {
    try {
      setLoading(true);
      const data = await contattoService.getContatti();
      setContatti(data);
    } catch (error) {
      console.error("Errore caricamento contatti:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i contatti",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterContatti = () => {
    let filtered = [...contatti];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.nome.toLowerCase().includes(query) ||
        c.cognome.toLowerCase().includes(query) ||
        (c.email?.toLowerCase() || "").includes(query)
      );
    }

    if (letterFilter) {
      filtered = filtered.filter(c =>
        c.cognome.toUpperCase().startsWith(letterFilter)
      );
    }

    setFilteredContatti(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingContatto) {
        await contattoService.updateContatto(editingContatto.id, formData);
        toast({
          title: "Successo",
          description: "Contatto aggiornato con successo"
        });
      } else {
        await contattoService.createContatto(formData);
        toast({
          title: "Successo",
          description: "Contatto creato con successo"
        });
      }

      setDialogOpen(false);
      resetForm();
      await loadContatti();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare il contatto",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (contatto: Contatto) => {
    setEditingContatto(contatto);
    setFormData({
      nome: contatto.nome,
      cognome: contatto.cognome,
      email: contatto.email || "",
      cell: contatto.cell || "",
      tel: contatto.tel || "",
      note: contatto.note || "",
      cassetto_fiscale: contatto.cassetto_fiscale || false,
      utente: contatto.utente || "",
      password: contatto.password || "",
      pin: contatto.pin || "",
      password_iniziale: contatto.password_iniziale || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo contatto?")) return;

    try {
      await contattoService.deleteContatto(id);
      toast({
        title: "Successo",
        description: "Contatto eliminato con successo"
      });
      await loadContatti();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il contatto",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      cognome: "",
      email: "",
      cell: "",
      tel: "",
      note: "",
      cassetto_fiscale: false,
      utente: "",
      password: "",
      pin: "",
      password_iniziale: ""
    });
    setEditingContatto(null);
  };

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
                <h1 className="text-3xl font-bold text-gray-900">Rubrica Contatti</h1>
                <p className="text-gray-500 mt-1">Gestisci i contatti della rubrica</p>
              </div>
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Nuovo Contatto
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingContatto ? "Modifica Contatto" : "Nuovo Contatto"}
                    </DialogTitle>
                    <DialogDescription>
                      Inserisci i dati del contatto
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
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cell">Cellulare</Label>
                        <Input
                          id="cell"
                          type="tel"
                          value={formData.cell}
                          onChange={(e) => setFormData({ ...formData, cell: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tel">Telefono</Label>
                        <Input
                          id="tel"
                          type="tel"
                          value={formData.tel}
                          onChange={(e) => setFormData({ ...formData, tel: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="note">Note</Label>
                      <Textarea
                        id="note"
                        value={formData.note}
                        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <div className="border-t pt-4">
                      <h3 className="font-semibold mb-3">Credenziali Cassetto Fiscale</h3>
                      
                      <div className="flex items-center space-x-2 mb-4">
                        <input
                          type="checkbox"
                          id="cassetto_fiscale"
                          checked={formData.cassetto_fiscale}
                          onChange={(e) => setFormData({ ...formData, cassetto_fiscale: e.target.checked })}
                          className="rounded"
                        />
                        <Label htmlFor="cassetto_fiscale" className="cursor-pointer">Ha Cassetto Fiscale</Label>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="utente">Utente</Label>
                          <Input
                            id="utente"
                            value={formData.utente}
                            onChange={(e) => setFormData({ ...formData, utente: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pin">PIN</Label>
                          <Input
                            id="pin"
                            value={formData.pin}
                            onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="password">Password</Label>
                          <Input
                            id="password"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="password_iniziale">Password Iniziale</Label>
                          <Input
                            id="password_iniziale"
                            value={formData.password_iniziale}
                            onChange={(e) => setFormData({ ...formData, password_iniziale: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button type="submit" className="flex-1">
                        {editingContatto ? "Aggiorna" : "Crea"} Contatto
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
                <div className="space-y-4">
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

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={letterFilter === "" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLetterFilter("")}
                    >
                      Tutti
                    </Button>
                    {alphabet.map(letter => (
                      <Button
                        key={letter}
                        variant={letterFilter === letter ? "default" : "outline"}
                        size="sm"
                        onClick={() => setLetterFilter(letter)}
                        className="w-10"
                      >
                        {letter}
                      </Button>
                    ))}
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
                      <TableHead>Cellulare</TableHead>
                      <TableHead>Telefono</TableHead>
                      <TableHead>Cassetto Fiscale</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContatti.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          Nessun contatto trovato
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredContatti.map((contatto) => (
                        <TableRow key={contatto.id}>
                          <TableCell className="font-medium">{contatto.nome}</TableCell>
                          <TableCell>{contatto.cognome}</TableCell>
                          <TableCell>{contatto.email || "-"}</TableCell>
                          <TableCell>{contatto.cell || "-"}</TableCell>
                          <TableCell>{contatto.tel || "-"}</TableCell>
                          <TableCell>
                            {contatto.cassetto_fiscale ? (
                              <Badge variant="default">Sì</Badge>
                            ) : (
                              <Badge variant="secondary">No</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(contatto)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(contatto.id)}
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