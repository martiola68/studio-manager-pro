import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Calendar, User, Save, RefreshCw, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Scadenza770 = {
  id: string;
  nominativo: string;
  anno: number;
  settore?: string;
  utente_professionista_id?: string;
  utente_operatore_id?: string;
  utente_payroll_id?: string;
  professionista_payroll_id?: string;
  tipo_invio?: string;
  modelli_770?: string;
  inviato?: boolean;
  registrato?: boolean;
  emendato?: boolean;
  data_invio?: string;
  data_registrato?: string;
  data_emendato?: string;
  note?: string;
  created_at?: string;
};

type Utente = {
  id: string;
  nome: string;
  cognome: string;
};

export default function Modello770Page() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<Scadenza770[]>([]);
  const [filteredScadenze, setFilteredScadenze] = useState<Scadenza770[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAnno, setSelectedAnno] = useState<number>(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState("fiscale");
  const [editingScadenza, setEditingScadenza] = useState<Scadenza770 | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
    loadUtenti();
  }, [selectedAnno]);

  useEffect(() => {
    filterData();
  }, [scadenze, searchTerm, activeTab]);

  const loadUtenti = async () => {
    try {
      const { data, error } = await supabase
        .from("tbutenti")
        .select("id, nome, cognome")
        .eq("attivo", true)
        .order("cognome");

      if (error) throw error;
      setUtenti(data || []);
    } catch (error) {
      console.error("Errore caricamento utenti:", error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("tbscad770")
        .select("*")
        .eq("anno", selectedAnno)
        .order("nominativo");

      if (error) throw error;
      setScadenze(data || []);
    } catch (error) {
      console.error("Errore caricamento 770:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    let filtered = scadenze;

    if (activeTab === "fiscale") {
      filtered = filtered.filter(s => 
        s.settore === "Fiscale" || s.settore === "Fiscale & Lavoro" || !s.settore
      );
    } else {
      filtered = filtered.filter(s => 
        s.settore === "Lavoro" || s.settore === "Fiscale & Lavoro"
      );
    }

    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.nominativo?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredScadenze(filtered);
  };

  const handleSyncClienti = async () => {
    try {
      setLoading(true);
      
      const { data: clienti, error: clientiError } = await supabase
        .from("tbclienti")
        .select("id, ragione_sociale, settore")
        .eq("flag_770", true)
        .eq("attivo", true);

      if (clientiError) throw clientiError;

      if (!clienti || clienti.length === 0) {
        toast({
          title: "Nessun cliente trovato",
          description: "Nessun cliente attivo ha il flag 770 abilitato.",
        });
        return;
      }

      let insertedCount = 0;

      for (const cliente of clienti) {
        const exists = scadenze.some(s => s.id === cliente.id && s.anno === selectedAnno);
        
        if (!exists) {
          const { error: insertError } = await supabase
            .from("tbscad770")
            .insert({
              id: cliente.id,
              nominativo: cliente.ragione_sociale,
              anno: selectedAnno,
              settore: cliente.settore || "Fiscale"
            });

          if (insertError) {
            console.error(`Errore inserimento per ${cliente.ragione_sociale}:`, insertError);
          } else {
            insertedCount++;
          }
        }
      }

      if (insertedCount > 0) {
        toast({
          title: "Sincronizzazione completata",
          description: `Inseriti ${insertedCount} nuovi clienti nello scadenzario ${selectedAnno}.`,
        });
        await loadData();
      } else {
        toast({
          title: "Sincronizzazione completata",
          description: "Tutti i clienti con flag 770 sono già presenti nello scadenzario.",
        });
      }

    } catch (error) {
      console.error("Errore sincronizzazione:", error);
      toast({
        title: "Errore",
        description: "Errore durante la sincronizzazione clienti",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingScadenza) return;

    try {
      const { error } = await supabase
        .from("tbscad770")
        .update({
          nominativo: editingScadenza.nominativo,
          settore: editingScadenza.settore,
          utente_professionista_id: editingScadenza.utente_professionista_id,
          utente_operatore_id: editingScadenza.utente_operatore_id,
          utente_payroll_id: editingScadenza.utente_payroll_id,
          professionista_payroll_id: editingScadenza.professionista_payroll_id,
          tipo_invio: editingScadenza.tipo_invio,
          modelli_770: editingScadenza.modelli_770,
          inviato: editingScadenza.inviato,
          registrato: editingScadenza.registrato,
          emendato: editingScadenza.emendato,
          data_invio: editingScadenza.data_invio,
          data_registrato: editingScadenza.data_registrato,
          data_emendato: editingScadenza.data_emendato,
          note: editingScadenza.note
        })
        .eq("id", editingScadenza.id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Scadenza aggiornata con successo"
      });

      setDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare le modifiche",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa scadenza?")) return;

    try {
      const { error } = await supabase
        .from("tbscad770")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Scadenza eliminata con successo"
      });

      await loadData();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare la scadenza",
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (scadenza: Scadenza770) => {
    setEditingScadenza({ ...scadenza });
    setDialogOpen(true);
  };

  const getUtenteNome = (utenteId?: string) => {
    if (!utenteId) return "-";
    const utente = utenti.find(u => u.id === utenteId);
    return utente ? `${utente.nome} ${utente.cognome}` : "-";
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario 770</h1>
          <p className="text-gray-500">Gestione Modello 770</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2 bg-white p-2 rounded-md border">
            <span className="text-sm font-medium">Anno:</span>
            <Select 
              value={selectedAnno.toString()} 
              onValueChange={(val) => setSelectedAnno(parseInt(val))}
            >
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button onClick={handleSyncClienti} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Sincronizza Clienti
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Cerca cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="fiscale">770 Rep Fiscale</TabsTrigger>
          <TabsTrigger value="lavoro">770 Rep Lavoro</TabsTrigger>
        </TabsList>

        <TabsContent value="fiscale">
          <Card>
            <CardHeader>
              <CardTitle>Reparto Fiscale (Settore: Fiscale, Fiscale & Lavoro)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Settore</TableHead>
                    <TableHead>Professionista</TableHead>
                    <TableHead>Operatore</TableHead>
                    <TableHead>Inviato</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredScadenze.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        Nessuna scadenza trovata
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredScadenze.map((scadenza) => (
                      <TableRow key={scadenza.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openEditDialog(scadenza)}>
                        <TableCell className="font-medium">{scadenza.nominativo}</TableCell>
                        <TableCell>{scadenza.settore || "-"}</TableCell>
                        <TableCell>{getUtenteNome(scadenza.utente_professionista_id)}</TableCell>
                        <TableCell>{getUtenteNome(scadenza.utente_operatore_id)}</TableCell>
                        <TableCell>
                          {scadenza.inviato ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(scadenza);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(scadenza.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
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
        </TabsContent>

        <TabsContent value="lavoro">
          <Card>
            <CardHeader>
              <CardTitle>Reparto Lavoro (Settore: Lavoro, Fiscale & Lavoro)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Settore</TableHead>
                    <TableHead>Professionista Payroll</TableHead>
                    <TableHead>Operatore Payroll</TableHead>
                    <TableHead>Inviato</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredScadenze.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        Nessuna scadenza trovata
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredScadenze.map((scadenza) => (
                      <TableRow key={scadenza.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openEditDialog(scadenza)}>
                        <TableCell className="font-medium">{scadenza.nominativo}</TableCell>
                        <TableCell>{scadenza.settore || "-"}</TableCell>
                        <TableCell>{getUtenteNome(scadenza.professionista_payroll_id)}</TableCell>
                        <TableCell>{getUtenteNome(scadenza.utente_payroll_id)}</TableCell>
                        <TableCell>
                          {scadenza.inviato ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(scadenza);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(scadenza.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
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
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Scadenza 770</DialogTitle>
          </DialogHeader>
          
          {editingScadenza && (
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nominativo</Label>
                  <Input
                    value={editingScadenza.nominativo}
                    onChange={(e) => setEditingScadenza({ ...editingScadenza, nominativo: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Settore</Label>
                  <Select
                    value={editingScadenza.settore || ""}
                    onValueChange={(val) => setEditingScadenza({ ...editingScadenza, settore: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona settore" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fiscale">Fiscale</SelectItem>
                      <SelectItem value="Lavoro">Lavoro</SelectItem>
                      <SelectItem value="Fiscale & Lavoro">Fiscale & Lavoro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Reparto Fiscale</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Professionista Fiscale</Label>
                    <Select
                      value={editingScadenza.utente_professionista_id || ""}
                      onValueChange={(val) => setEditingScadenza({ ...editingScadenza, utente_professionista_id: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona professionista" />
                      </SelectTrigger>
                      <SelectContent>
                        {utenti.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.nome} {u.cognome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Operatore Fiscale</Label>
                    <Select
                      value={editingScadenza.utente_operatore_id || ""}
                      onValueChange={(val) => setEditingScadenza({ ...editingScadenza, utente_operatore_id: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona operatore" />
                      </SelectTrigger>
                      <SelectContent>
                        {utenti.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.nome} {u.cognome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Reparto Lavoro (Payroll)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Professionista Payroll</Label>
                    <Select
                      value={editingScadenza.professionista_payroll_id || ""}
                      onValueChange={(val) => setEditingScadenza({ ...editingScadenza, professionista_payroll_id: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona professionista payroll" />
                      </SelectTrigger>
                      <SelectContent>
                        {utenti.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.nome} {u.cognome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Operatore Payroll</Label>
                    <Select
                      value={editingScadenza.utente_payroll_id || ""}
                      onValueChange={(val) => setEditingScadenza({ ...editingScadenza, utente_payroll_id: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona operatore payroll" />
                      </SelectTrigger>
                      <SelectContent>
                        {utenti.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.nome} {u.cognome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Dettagli Invio</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo Invio</Label>
                    <Select
                      value={editingScadenza.tipo_invio || ""}
                      onValueChange={(val) => setEditingScadenza({ ...editingScadenza, tipo_invio: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona tipo invio" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ordinario">Ordinario</SelectItem>
                        <SelectItem value="Correttivo">Correttivo</SelectItem>
                        <SelectItem value="Integrativo">Integrativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Modelli 770</Label>
                    <Input
                      value={editingScadenza.modelli_770 || ""}
                      onChange={(e) => setEditingScadenza({ ...editingScadenza, modelli_770: e.target.value })}
                      placeholder="Es: 770 Semplificato, 770 Ordinario"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Stato e Date</h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={editingScadenza.inviato || false}
                      onCheckedChange={(checked) => setEditingScadenza({ ...editingScadenza, inviato: checked as boolean })}
                    />
                    <Label>Inviato</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={editingScadenza.registrato || false}
                      onCheckedChange={(checked) => setEditingScadenza({ ...editingScadenza, registrato: checked as boolean })}
                    />
                    <Label>Registrato</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={editingScadenza.emendato || false}
                      onCheckedChange={(checked) => setEditingScadenza({ ...editingScadenza, emendato: checked as boolean })}
                    />
                    <Label>Emendato</Label>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Data Invio</Label>
                    <Input
                      type="date"
                      value={editingScadenza.data_invio || ""}
                      onChange={(e) => setEditingScadenza({ ...editingScadenza, data_invio: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Data Registrato</Label>
                    <Input
                      type="date"
                      value={editingScadenza.data_registrato || ""}
                      onChange={(e) => setEditingScadenza({ ...editingScadenza, data_registrato: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Data Emendato</Label>
                    <Input
                      type="date"
                      value={editingScadenza.data_emendato || ""}
                      onChange={(e) => setEditingScadenza({ ...editingScadenza, data_emendato: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Note</Label>
                <Textarea
                  value={editingScadenza.note || ""}
                  onChange={(e) => setEditingScadenza({ ...editingScadenza, note: e.target.value })}
                  rows={4}
                  placeholder="Inserisci eventuali note..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={handleSave}>
                  <Save className="mr-2 h-4 w-4" />
                  Salva
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}