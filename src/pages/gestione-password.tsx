import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { passwordService, Credenziale, CredenzialeInsert } from "@/services/passwordService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, Eye, EyeOff, Lock, Trash2, Edit, ExternalLink, KeyRound, Unlock, Copy } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import Head from "next/head";
import { TopNavBar } from "@/components/TopNavBar";
import { Sidebar } from "@/components/Sidebar";
import { 
  isEncryptionEnabled, 
  isEncryptionLocked,
  encryptCredenzialiAccesso,
  decryptCredenzialiAccesso,
  unlockCassetti,
  lockCassetti
} from "@/services/encryptionService";
import { useStudio } from "@/contexts/StudioContext";

export default function GestionePasswordPage() {
  const { toast } = useToast();
  const { studioId } = useStudio();
  const [loading, setLoading] = useState(true);
  const [credenziali, setCredenziali] = useState<Credenziale[]>([]);
  const [filteredCredenziali, setFilteredCredenziali] = useState<Credenziale[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [showPin, setShowPin] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCredenziale, setEditingCredenziale] = useState<any>(null);
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

  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [encryptionLocked, setEncryptionLocked] = useState(true);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");

  useEffect(() => {
    loadData();
    checkEncryptionStatus();
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

  const checkEncryptionStatus = async () => {
    const enabled = await isEncryptionEnabled();
    const locked = await isEncryptionLocked();
    setEncryptionEnabled(enabled);
    setEncryptionLocked(locked);
  };

  const handleUnlockCassetti = () => {
    setShowUnlockDialog(true);
  };

  const handleConfirmUnlock = async () => {
    try {
      const result = await unlockCassetti(studioId || "", unlockPassword);
      if (result.success) {
        setEncryptionLocked(false);
        setShowUnlockDialog(false);
        setUnlockPassword("");
        toast({
          title: "Sbloccato",
          description: "Dati sensibili sbloccati con successo",
        });
        loadData();
      } else {
        toast({
          title: "Errore",
          description: result.error || "Password errata",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante lo sblocco",
        variant: "destructive",
      });
    }
  };

  const handleLockCassetti = () => {
    lockCassetti();
    setEncryptionLocked(true);
    setShowPassword({});
    setShowPin({});
    toast({
      title: "Bloccato",
      description: "Dati sensibili bloccati",
    });
    loadData();
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

  const handleSave = async () => {
    try {
      let dataToSave = { ...formData, studio_id: studioId };

      // Encrypt passwords if encryption is enabled and unlocked
      if (encryptionEnabled && !encryptionLocked) {
        try {
          const encrypted = await encryptCredenzialiAccesso({
            login_pw: dataToSave.login_pw,
            login_pin: dataToSave.login_pin,
          });
          
          dataToSave = { 
            ...dataToSave, 
            login_pw: encrypted.login_pw || dataToSave.login_pw,
            login_pin: encrypted.login_pin || dataToSave.login_pin,
          };
        } catch (error: any) {
          console.error("Encryption error:", error);
          toast({
            title: "Errore Encryption",
            description: "Impossibile cifrare i dati. Verifica di aver sbloccato la protezione.",
            variant: "destructive",
          });
          return;
        }
      }
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

  const handleEdit = async (credenziale: any) => {
    setEditingCredenziale(credenziale);
    
    let credenzialeData = { ...credenziale };
    
    // Decrypt passwords if encryption is enabled and unlocked
    if (encryptionEnabled && !encryptionLocked) {
      try {
        const decrypted = await decryptCredenzialiAccesso({
          login_pw: credenziale.login_pw,
          login_pin: credenziale.login_pin,
        });
        
        credenzialeData = { ...credenzialeData, ...decrypted };
      } catch (error) {
        console.error("Decryption error:", error);
      }
    }
    
    setFormData({
      portale: credenzialeData.portale || "",
      login_utente: credenzialeData.login_utente || "",
      login_pw: credenzialeData.login_pw || "",
      login_pin: credenzialeData.login_pin || "",
      note: credenzialeData.note || ""
    });
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPassword(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const togglePinVisibility = (id: string) => {
    setShowPin(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiato!",
      description: "Testo copiato negli appunti",
    });
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
                <h1 className="text-3xl font-bold">Gestione Password</h1>
                <p className="text-muted-foreground mt-1">Gestisci le credenziali di accesso ai portali</p>
              </div>
              <div className="flex gap-2">
                {encryptionEnabled && (
                  <Button
                    variant="outline"
                    onClick={encryptionLocked ? handleUnlockCassetti : handleLockCassetti}
                    className={encryptionLocked ? "border-orange-600 text-orange-600" : "border-green-600 text-green-600"}
                  >
                    {encryptionLocked ? (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        Sblocca Dati
                      </>
                    ) : (
                      <>
                        <Unlock className="h-4 w-4 mr-2" />
                        Blocca Dati
                      </>
                    )}
                  </Button>
                )}
                <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" /> Nuova Password
                </Button>
              </div>
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
                                {encryptionEnabled && encryptionLocked ? (
                                  <span className="font-mono">••••••••</span>
                                ) : showPassword[cred.id] ? (
                                  <span className="font-mono">{cred.login_pw}</span>
                                ) : (
                                  <span className="font-mono">••••••••</span>
                                )}
                                {!encryptionLocked && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => togglePasswordVisibility(cred.id)}
                                    >
                                      {showPassword[cred.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => copyToClipboard(cred.login_pw)}
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {encryptionEnabled && encryptionLocked ? (
                                  <span className="font-mono">••••</span>
                                ) : showPin[cred.id] ? (
                                  <span className="font-mono">{cred.login_pin || "-"}</span>
                                ) : (
                                  <span className="font-mono">••••</span>
                                )}
                                {!encryptionLocked && cred.login_pin && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => togglePinVisibility(cred.id)}
                                    >
                                      {showPin[cred.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => copyToClipboard(cred.login_pin)}
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
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
              <AlertDialogAction onClick={handleSave} className="bg-yellow-600 hover:bg-yellow-700">
                Conferma Inserimento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>

      <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sblocca Dati Sensibili</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Inserisci la password principale dello studio per visualizzare e modificare i dati sensibili (password, PIN, ecc).
            </p>
            <div className="space-y-2">
              <Label htmlFor="unlock-password">Password Principale</Label>
              <Input
                id="unlock-password"
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Inserisci password..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowUnlockDialog(false)}>
                Annulla
              </Button>
              <Button onClick={handleConfirmUnlock}>
                Sblocca
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}