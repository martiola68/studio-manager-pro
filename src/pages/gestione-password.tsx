import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { passwordService, Credenziale, CredenzialeInsert } from "@/services/passwordService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, Eye, EyeOff, Lock, Trash2, Edit, ExternalLink, KeyRound } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import Head from "next/head";
import { TopNavBar } from "@/components/TopNavBar";
import { Sidebar } from "@/components/Sidebar";

export default function GestionePasswordPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [credenziali, setCredenziali] = useState<Credenziale[]>([]);
  const [filteredCredenziali, setFilteredCredenziali] = useState<Credenziale[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const [formData, setFormData] = useState<Partial<CredenzialeInsert>>({
    portale: "",
    indirizzo_url: "",
    login_utente: "",
    login_pw: "",
    login_pin: "",
    note: ""
  });

  // Lista portali predefiniti + quelli esistenti
  const basePortali = ["Entratel", "Telemaco", "Inps", "Inail", "Sister", "Fisconline"];
  const [listaPortali, setListaPortali] = useState<string[]>(basePortali);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterData();
  }, [credenziali, searchTerm]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await passwordService.getCredenziali();
      setCredenziali(data || []);
      
      // Aggiorna lista portali con quelli trovati nel DB
      const dbPortali = Array.from(new Set(data?.map(c => c.portale).filter(Boolean) as string[]));
      setListaPortali(Array.from(new Set([...basePortali, ...dbPortali])).sort());
    } catch (error) {
      console.error("Errore caricamento:", error);
      toast({ title: "Errore", description: "Impossibile caricare le credenziali", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    let filtered = credenziali;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.portale?.toLowerCase().includes(lower) || 
        c.login_utente?.toLowerCase().includes(lower) ||
        c.note?.toLowerCase().includes(lower)
      );
    }
    setFilteredCredenziali(filtered);
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.portale || !formData.login_utente || !formData.login_pw) {
      toast({ title: "Attenzione", description: "Compilare i campi obbligatori", variant: "destructive" });
      return;
    }
    setConfirmOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        ...formData,
        // Assicuro che login_pin e note siano null se vuoti
        login_pin: formData.login_pin || null,
        note: formData.note || null
      };

      if (editingId) {
        // @ts-expect-error - Tipo parziale vs completo: Supabase update accetta partial
        await passwordService.updateCredenziale(editingId, payload);
        toast({ title: "Aggiornato", description: "Credenziale aggiornata con successo" });
      } else {
        // @ts-expect-error - Tipo insert: Supabase insert accetta partial se i campi mancanti sono nullable
        await passwordService.createCredenziale(payload as any);
        toast({ title: "Creato", description: "Nuova credenziale salvata" });
      }
      setIsDialogOpen(false);
      setEditingId(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({ title: "Errore", description: "Errore durante il salvataggio", variant: "destructive" });
    } finally {
      setConfirmOpen(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa credenziale?")) return;
    try {
      await passwordService.deleteCredenziale(id);
      toast({ title: "Eliminato", description: "Credenziale rimossa" });
      loadData();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({ title: "Errore", description: "Impossibile eliminare", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
      portale: "",
      indirizzo_url: "",
      login_utente: "",
      login_pw: "",
      login_pin: "",
      note: ""
    });
  };

  const handleEdit = (credenziale: Credenziale) => {
    setEditingId(credenziale.id);
    setFormData({
      portale: credenziale.portale,
      indirizzo_url: credenziale.indirizzo_url,
      login_utente: credenziale.login_utente,
      login_pw: credenziale.login_pw,
      login_pin: credenziale.login_pin,
      note: credenziale.note
    });
    setIsDialogOpen(true);
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPassword(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <Head>
        <title>Gestione Password | Studio Manager</title>
      </Head>
      
      <Sidebar />

      <div className="flex-1 flex flex-col pl-64 transition-all duration-300">
        <TopNavBar />
        
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="container mx-auto max-w-7xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <KeyRound className="h-8 w-8 text-yellow-600" />
                  Gestione Password
                </h1>
                <p className="text-gray-500">Archivio sicuro credenziali di accesso ai portali</p>
              </div>

              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) { setEditingId(null); resetForm(); }
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-yellow-600 hover:bg-yellow-700 text-white">
                    <Plus className="mr-2 h-4 w-4" /> Nuova Password
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingId ? "Modifica Credenziale" : "Nuova Credenziale"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handlePreSubmit} className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Portale *</Label>
                        <div className="relative">
                           {/* Combobox semplificata con datalist per input libero + suggerimenti */}
                           <Input 
                            list="portali-list"
                            value={formData.portale || ""}
                            onChange={e => setFormData({...formData, portale: e.target.value})}
                            placeholder="Seleziona o scrivi..."
                            required
                           />
                           <datalist id="portali-list">
                             {listaPortali.map(p => <option key={p} value={p} />)}
                           </datalist>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>URL</Label>
                        <Input 
                          value={formData.indirizzo_url || ""}
                          onChange={e => setFormData({...formData, indirizzo_url: e.target.value})}
                          placeholder="https://..."
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Login Utente *</Label>
                      <Input 
                        value={formData.login_utente || ""}
                        onChange={e => setFormData({...formData, login_utente: e.target.value})}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Password *</Label>
                        <Input 
                          type="text" // Visibile in fase di inserimento per comodità, o password
                          value={formData.login_pw || ""}
                          onChange={e => setFormData({...formData, login_pw: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>PIN (Opzionale)</Label>
                        <Input 
                          value={formData.login_pin || ""}
                          onChange={e => setFormData({...formData, login_pin: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Note</Label>
                      <Textarea 
                        value={formData.note || ""}
                        onChange={e => setFormData({...formData, note: e.target.value})}
                        placeholder="Eventuali annotazioni..."
                      />
                    </div>

                    <DialogFooter>
                      <Button type="submit">Salva Credenziale</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="flex mb-6">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                      placeholder="Cerca per portale, utente..." 
                      className="pl-10"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Portale</TableHead>
                        <TableHead>Utente</TableHead>
                        <TableHead>Password</TableHead>
                        <TableHead>PIN</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCredenziali.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            Nessuna credenziale trovata
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCredenziali.map((cred) => (
                          <TableRow key={cred.id}>
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>{cred.portale}</span>
                                {cred.indirizzo_url && (
                                  <a href={cred.indirizzo_url} target="_blank" rel="noopener noreferrer" 
                                     className="text-xs text-blue-500 flex items-center hover:underline">
                                    Vai al sito <ExternalLink className="h-3 w-3 ml-1" />
                                  </a>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{cred.login_utente}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                                  {showPassword[cred.id] ? cred.login_pw : "••••••••"}
                                </span>
                                <Button variant="ghost" size="sm" onClick={() => togglePasswordVisibility(cred.id)}>
                                  {showPassword[cred.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>{cred.login_pin || "-"}</TableCell>
                            <TableCell className="max-w-xs truncate" title={cred.note || ""}>{cred.note || "-"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => handleEdit(cred)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(cred.id)} className="text-red-500 hover:text-red-700">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Conferma salvataggio</AlertDialogTitle>
              <AlertDialogDescription>
                Sei sicuro di voler salvare queste credenziali per il portale <strong>{formData.portale}</strong>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={handleSubmit} className="bg-yellow-600 hover:bg-yellow-700">
                Conferma Inserimento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </div>
  );
}