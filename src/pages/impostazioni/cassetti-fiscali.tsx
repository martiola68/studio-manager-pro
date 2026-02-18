import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { cassettiFiscaliService } from "@/services/cassettiFiscaliService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, EyeOff, Edit, Trash2, Plus, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type CassettoFiscale = Database["public"]["Tables"]["tbcassetti_fiscali"]["Row"];

export default function CassettiFiscaliImpostazioniPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [cassetti, setCassetti] = useState<CassettoFiscale[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCassetto, setEditingCassetto] = useState<CassettoFiscale | null>(null);
  const [visibleFields, setVisibleFields] = useState<Record<string, Set<string>>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nominativo: "",
    username: "",
    password1: "",
    pw_attiva1: true,
    password2: "",
    pw_attiva2: false,
    pin: "",
    pw_iniziale: "",
    note: ""
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
      await loadCassetti();
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
  };

  const loadCassetti = async () => {
    try {
      setLoading(true);
      const data = await cassettiFiscaliService.getCassettiFiscali();
      setCassetti(((data ?? []) as unknown) as CassettoFiscale[]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nominativo || !formData.username) {
      toast({
        title: "Errore",
        description: "Compila i campi obbligatori (Nominativo e Username)",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingCassetto) {
        await cassettiFiscaliService.update(editingCassetto.id, formData);
        toast({
          title: "Successo",
          description: "Cassetto fiscale aggiornato"
        });
      } else {
        await cassettiFiscaliService.create(formData);
        toast({
          title: "Successo",
          description: "Cassetto fiscale creato"
        });
      }

      setDialogOpen(false);
      resetForm();
      await loadCassetti();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare il cassetto fiscale",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (cassetto: CassettoFiscale) => {
    setEditingCassetto(cassetto);
    setFormData({
      nominativo: cassetto.nominativo,
      username: cassetto.username || "",
      password1: cassetto.password1 || "",
      pw_attiva1: cassetto.pw_attiva1 ?? true,
      password2: cassetto.password2 || "",
      pw_attiva2: cassetto.pw_attiva2 ?? false,
      pin: cassetto.pin || "",
      pw_iniziale: cassetto.pw_iniziale || "",
      note: cassetto.note || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo cassetto fiscale?")) return;

    try {
      await cassettiFiscaliService.delete(id);
      toast({
        title: "Successo",
        description: "Cassetto fiscale eliminato"
      });
      await loadCassetti();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il cassetto fiscale",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      nominativo: "",
      username: "",
      password1: "",
      pw_attiva1: true,
      password2: "",
      pw_attiva2: false,
      pin: "",
      pw_iniziale: "",
      note: ""
    });
    setEditingCassetto(null);
  };

  const toggleVisibility = (cassettoId: string, field: string) => {
    setVisibleFields(prev => {
      const newVisible = { ...prev };
      if (!newVisible[cassettoId]) {
        newVisible[cassettoId] = new Set();
      }
      if (newVisible[cassettoId].has(field)) {
        newVisible[cassettoId].delete(field);
      } else {
        newVisible[cassettoId].add(field);
      }
      return newVisible;
    });
  };

  const isVisible = (cassettoId: string, field: string): boolean => {
    return visibleFields[cassettoId]?.has(field) ?? false;
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast({
        title: "Copiato!",
        description: "Testo copiato negli appunti"
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile copiare",
        variant: "destructive"
      });
    }
  };

  const handlePasswordToggle = (field: "pw_attiva1" | "pw_attiva2") => {
    if (field === "pw_attiva1") {
      setFormData({
        ...formData,
        pw_attiva1: true,
        pw_attiva2: false
      });
    } else {
      setFormData({
        ...formData,
        pw_attiva1: false,
        pw_attiva2: true
      });
    }
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
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestione Cassetti Fiscali</h1>
          <p className="text-gray-500 mt-1">Configurazione credenziali di accesso</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Nuovo Cassetto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCassetto ? "Modifica Cassetto Fiscale" : "Nuovo Cassetto Fiscale"}
              </DialogTitle>
              <DialogDescription>
                Inserisci le credenziali di accesso al cassetto fiscale
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nominativo">Nominativo *</Label>
                <Input
                  id="nominativo"
                  value={formData.nominativo}
                  onChange={(e) => setFormData({ ...formData, nominativo: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password1">Password 1</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="password1"
                      type="password"
                      value={formData.password1}
                      onChange={(e) => setFormData({ ...formData, password1: e.target.value })}
                      className={formData.pw_attiva1 ? "bg-blue-300 border-blue-400" : ""}
                    />
                    <input
                      type="checkbox"
                      checked={formData.pw_attiva1}
                      onChange={() => handlePasswordToggle("pw_attiva1")}
                      className="rounded"
                      title="Attiva Password 1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password2">Password 2</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="password2"
                      type="password"
                      value={formData.password2}
                      onChange={(e) => setFormData({ ...formData, password2: e.target.value })}
                      className={formData.pw_attiva2 ? "bg-blue-300 border-blue-400" : ""}
                    />
                    <input
                      type="checkbox"
                      checked={formData.pw_attiva2}
                      onChange={() => handlePasswordToggle("pw_attiva2")}
                      className="rounded"
                      title="Attiva Password 2"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pin">PIN</Label>
                  <Input
                    id="pin"
                    type="password"
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pw_iniziale">Password Iniziale</Label>
                  <Input
                    id="pw_iniziale"
                    type="password"
                    value={formData.pw_iniziale}
                    onChange={(e) => setFormData({ ...formData, pw_iniziale: e.target.value })}
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

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1">
                  {editingCassetto ? "Aggiorna" : "Crea"}
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
          <CardTitle>Elenco Cassetti Fiscali ({cassetti.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nominativo</TableHead>
                <TableHead>Username</TableHead>
                <TableHead className="text-center">Password 1</TableHead>
                <TableHead className="text-center">Password 2</TableHead>
                <TableHead className="text-center">PIN</TableHead>
                <TableHead className="text-center">PW Iniziale</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cassetti.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    Nessun cassetto fiscale configurato
                  </TableCell>
                </TableRow>
              ) : (
                cassetti.map((cassetto) => (
                  <TableRow key={cassetto.id}>
                    <TableCell className="font-medium">{cassetto.nominativo}</TableCell>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        <span>{cassetto.username}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleCopy(cassetto.username || "", `username-${cassetto.id}`)}
                        >
                          {copiedField === `username-${cassetto.id}` ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-2 justify-center p-2 rounded ${cassetto.pw_attiva1 ? 'bg-blue-300' : 'bg-gray-50'}`}>
                        <span className="font-mono text-sm">
                          {cassetto.password1 ? (isVisible(cassetto.id, "password1") ? cassetto.password1 : "••••••••") : "-"}
                        </span>
                        {cassetto.password1 && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => toggleVisibility(cassetto.id, "password1")}
                            >
                              {isVisible(cassetto.id, "password1") ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleCopy(cassetto.password1 || "", `password1-${cassetto.id}`)}
                            >
                              {copiedField === `password1-${cassetto.id}` ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-2 justify-center p-2 rounded ${cassetto.pw_attiva2 ? 'bg-blue-300' : 'bg-gray-50'}`}>
                        <span className="font-mono text-sm">
                          {cassetto.password2 ? (isVisible(cassetto.id, "password2") ? cassetto.password2 : "••••••••") : "-"}
                        </span>
                        {cassetto.password2 && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => toggleVisibility(cassetto.id, "password2")}
                            >
                              {isVisible(cassetto.id, "password2") ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleCopy(cassetto.password2 || "", `password2-${cassetto.id}`)}
                            >
                              {copiedField === `password2-${cassetto.id}` ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 justify-center">
                        <span className="font-mono text-sm">
                          {cassetto.pin ? (isVisible(cassetto.id, "pin") ? cassetto.pin : "••••") : "-"}
                        </span>
                        {cassetto.pin && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => toggleVisibility(cassetto.id, "pin")}
                            >
                              {isVisible(cassetto.id, "pin") ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleCopy(cassetto.pin || "", `pin-${cassetto.id}`)}
                            >
                              {copiedField === `pin-${cassetto.id}` ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 justify-center">
                        <span className="font-mono text-sm">
                          {cassetto.pw_iniziale ? (isVisible(cassetto.id, "pw_iniziale") ? cassetto.pw_iniziale : "••••••••") : "-"}
                        </span>
                        {cassetto.pw_iniziale && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => toggleVisibility(cassetto.id, "pw_iniziale")}
                            >
                              {isVisible(cassetto.id, "pw_iniziale") ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleCopy(cassetto.pw_iniziale || "", `pw_iniziale-${cassetto.id}`)}
                            >
                              {copiedField === `pw_iniziale-${cassetto.id}` ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(cassetto)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(cassetto.id)}
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
  );
}
