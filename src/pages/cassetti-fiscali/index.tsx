import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Search, Plus, Copy, Eye, EyeOff, Edit, Trash2, Lock, Unlock } from "lucide-react";
import { cassettiFiscaliService, type CassettoFiscale } from "@/services/cassettiFiscaliService";
import {
  unlockCassetti,
  lockCassetti,
  areCassettiUnlocked,
  encryptCassettoPasswords,
  decryptCassettoPasswords,
  migrateAllCassettiToEncrypted,
} from "@/services/encryptionService";
import { isEncrypted, updateLastActivity, shouldAutoLock } from "@/lib/encryption";

const formSchema = z.object({
  nominativo: z.string().min(2, "Il nominativo è obbligatorio"),
  username: z.string().optional(),
  password1: z.string().optional(),
  pw_attiva1: z.boolean().default(false),
  password2: z.string().optional(),
  pw_attiva2: z.boolean().default(false),
  pin: z.string().optional(),
  pw_iniziale: z.string().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function CassettiFiscaliPage() {
  const [cassetti, setCassetti] = useState<CassettoFiscale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCassetto, setEditingCassetto] = useState<CassettoFiscale | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  
  // Encryption states - SOLO unlock/lock
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [migrating, setMigrating] = useState(false);
  
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nominativo: "",
      username: "",
      password1: "",
      pw_attiva1: true,
      password2: "",
      pw_attiva2: false,
      pin: "",
      pw_iniziale: "",
      note: "",
    },
  });

  const handlePw1Change = (checked: boolean) => {
    form.setValue("pw_attiva1", checked);
    if (checked) form.setValue("pw_attiva2", false);
  };

  const handlePw2Change = (checked: boolean) => {
    form.setValue("pw_attiva2", checked);
    if (checked) form.setValue("pw_attiva1", false);
  };

  // Check encryption status and auto-lock
  useEffect(() => {
    checkEncryptionStatus();
    
    // Auto-lock check every minute
    const autoLockInterval = setInterval(() => {
      if (isUnlocked && shouldAutoLock()) {
        handleLock();
        toast({
          title: "🔒 Cassetti Bloccati",
          description: "Per inattività, è necessario sbloccare nuovamente i cassetti",
          variant: "default",
        });
      }
    }, 60000);
    
    // Update activity on user interaction
    const updateActivity = () => {
      if (isUnlocked) updateLastActivity();
    };
    
    document.addEventListener("mousemove", updateActivity);
    document.addEventListener("keypress", updateActivity);
    document.addEventListener("click", updateActivity);
    
    return () => {
      clearInterval(autoLockInterval);
      document.removeEventListener("mousemove", updateActivity);
      document.removeEventListener("keypress", updateActivity);
      document.removeEventListener("click", updateActivity);
    };
  }, [isUnlocked]);

  const checkEncryptionStatus = async () => {
    try {
      const studioId = localStorage.getItem("studio_id");
      if (!studioId) {
        loadCassetti();
        return;
      }
      
      // Verifica se Master Password è configurata
      const enabled = await isEncryptionEnabled(studioId);
      
      if (!enabled) {
        // Master Password NON configurata - carica cassetti senza protezione
        setIsUnlocked(true);  // Simula unlock per permettere accesso
        loadCassetti();
        return;
      }
      
      // Master Password configurata - verifica se è sbloccata
      const unlocked = areCassettiUnlocked();
      setIsUnlocked(unlocked);
      
      if (!unlocked) {
        // Master Password configurata ma bloccata - mostra unlock dialog
        setShowUnlockDialog(true);
      } else {
        // Master Password configurata e sbloccata - carica cassetti
        loadCassetti();
      }
    } catch (error) {
      console.error("Error checking encryption:", error);
      // In caso di errore, permetti comunque l'accesso
      setIsUnlocked(true);
      loadCassetti();
    }
  };

  const handleUnlock = async () => {
    try {
      const studioId = localStorage.getItem("studio_id");
      if (!studioId) return;
      
      const result = await unlockCassetti(studioId, unlockPassword);
      
      if (result.success) {
        setIsUnlocked(true);
        setShowUnlockDialog(false);
        setUnlockPassword("");
        
        toast({
          title: "🔓 Cassetti Sbloccati",
          description: "Accesso consentito ai cassetti fiscali",
        });
        
        loadCassetti();
      } else {
        toast({
          variant: "destructive",
          title: "Errore",
          description: result.error || "Password errata",
        });
      }
    } catch (error) {
      console.error("Unlock error:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile sbloccare i cassetti",
      });
    }
  };

  const handleLock = () => {
    lockCassetti();
    setIsUnlocked(false);
    setShowUnlockDialog(true);
    setCassetti([]);
  };

  const handleMigrate = async () => {
    try {
      setMigrating(true);
      const studioId = localStorage.getItem("studio_id");
      if (!studioId) return;
      
      const result = await migrateAllCassettiToEncrypted(studioId);
      
      if (result.success) {
        toast({
          title: "✅ Migrazione Completata",
          description: `${result.migrated} cassetti migrati con successo`,
        });
        
        setShowMigrationDialog(false);
        loadCassetti();
      } else {
        toast({
          variant: "destructive",
          title: "Errore",
          description: "Errore durante la migrazione",
        });
      }
    } catch (error) {
      console.error("Migration error:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile migrare i cassetti",
      });
    } finally {
      setMigrating(false);
    }
  };

  useEffect(() => {
    loadCassetti();
  }, []);

  useEffect(() => {
    if (editingCassetto) {
      form.reset({
        nominativo: editingCassetto.nominativo,
        username: editingCassetto.username || "",
        password1: editingCassetto.password1 || "",
        pw_attiva1: editingCassetto.pw_attiva1 || false,
        password2: editingCassetto.password2 || "",
        pw_attiva2: editingCassetto.pw_attiva2 || false,
        pin: editingCassetto.pin || "",
        pw_iniziale: editingCassetto.pw_iniziale || "",
        note: editingCassetto.note || "",
      });
    } else {
      form.reset({
        nominativo: "",
        username: "",
        password1: "",
        pw_attiva1: true,
        password2: "",
        pw_attiva2: false,
        pin: "",
        pw_iniziale: "",
        note: "",
      });
    }
  }, [editingCassetto, form]);

  const loadCassetti = async () => {
    if (!isUnlocked) return;
    
    try {
      const data = await cassettiFiscaliService.getCassettiFiscali();
      
      // Decrypt passwords (Master Password system)
      const decryptedData = await Promise.all(
        data.map(async (cassetto) => {
          try {
            const decrypted = await decryptCassettoPasswords(cassetto);
            return { ...cassetto, ...decrypted };
          } catch (error) {
            console.error("Decrypt error for cassetto:", cassetto.id, error);
            return cassetto;
          }
        })
      );
      setCassetti(decryptedData);
    } catch (error) {
      console.error("Errore caricamento cassetti:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile caricare i cassetti fiscali",
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      // Encrypt passwords (Master Password system)
      const encrypted = await encryptCassettoPasswords({
        password1: values.password1,
        password2: values.password2,
        pin: values.pin,
        pw_iniziale: values.pw_iniziale,
      });
      
      const dataToSave = { ...values, ...encrypted };
      
      if (editingCassetto) {
        await cassettiFiscaliService.update(editingCassetto.id, dataToSave);
        toast({ title: "Successo", description: "Cassetto fiscale aggiornato" });
      } else {
        await cassettiFiscaliService.create(dataToSave);
        toast({ title: "Successo", description: "Nuovo cassetto fiscale creato" });
      }
      
      form.reset({
        nominativo: "",
        username: "",
        password1: "",
        pw_attiva1: true,
        password2: "",
        pw_attiva2: false,
        pin: "",
        pw_iniziale: "",
        note: "",
      });
      
      setDialogOpen(false);
      setEditingCassetto(null);
      await loadCassetti();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile salvare i dati",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo cassetto fiscale?")) return;
    try {
      await cassettiFiscaliService.delete(id);
      toast({ title: "Successo", description: "Cassetto fiscale eliminato" });
      loadCassetti();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile eliminare il cassetto fiscale",
      });
    }
  };

  const copyToClipboard = (text: string | null | undefined, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({
      description: `${label} copiata negli appunti`,
      duration: 2000,
    });
    
    // Auto-clear clipboard after 10 seconds for security
    setTimeout(() => {
      navigator.clipboard.writeText("");
    }, 10000);
  };

  const togglePasswordVisibility = (id: string, field: string) => {
    const key = `${id}_${field}`;
    setVisiblePasswords(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    
    // Auto-hide after 30 seconds
    if (!visiblePasswords[key]) {
      setTimeout(() => {
        setVisiblePasswords(prev => ({
          ...prev,
          [key]: false
        }));
      }, 30000);
    }
  };

  const filteredCassetti = cassetti.filter((cassetto) => {
    if (searchTerm === "") {
      return true;
    }
    
    if (searchTerm.length === 1 && /^[A-Z]$/i.test(searchTerm)) {
      return cassetto.nominativo?.toUpperCase().startsWith(searchTerm.toUpperCase());
    }
    
    return (
      cassetto.nominativo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cassetto.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cassetto.pin?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cassetti Fiscali</h1>
          <p className="text-muted-foreground">Gestione credenziali cassetti fiscali</p>
          <div className="flex items-center gap-2 mt-2">
            {isUnlocked ? (
              <>
                <Unlock className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600">Accessibile</span>
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 text-orange-600" />
                <span className="text-sm text-orange-600">Bloccato - Inserisci Master Password</span>
              </>
            )}
          </div>
        </div>
        <Button 
          onClick={() => { setEditingCassetto(null); setDialogOpen(true); }}
          disabled={!isUnlocked}
        >
          <Plus className="mr-2 h-4 w-4" /> Nuovo Cassetto
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per nominativo o username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
              disabled={!isUnlocked}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              variant={searchTerm === "" ? "default" : "outline"}
              size="sm"
              onClick={() => setSearchTerm("")}
              disabled={!isUnlocked}
            >
              Tutti
            </Button>
            {alphabet.map((letter) => (
              <Button
                key={letter}
                variant={searchTerm.startsWith(letter) ? "default" : "outline"}
                size="sm"
                className="w-8 px-0"
                onClick={() => setSearchTerm(letter)}
                disabled={!isUnlocked}
              >
                {letter}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-md border bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nominativo</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Password 1</TableHead>
                <TableHead>Password 2</TableHead>
                <TableHead>PIN</TableHead>
                <TableHead>Password Iniziale</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : !isUnlocked ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Lock className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-muted-foreground mb-2">Cassetti bloccati. Inserisci la Master Password per visualizzare.</p>
                  </TableCell>
                </TableRow>
              ) : filteredCassetti.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nessun cassetto fiscale trovato
                  </TableCell>
                </TableRow>
              ) : (
                filteredCassetti.map((cassetto) => (
                  <TableRow key={cassetto.id}>
                    <TableCell className="font-medium">{cassetto.nominativo}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{cassetto.username || "-"}</span>
                        {cassetto.username && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(cassetto.username, "Username")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={cassetto.pw_attiva1 ? "bg-blue-50/50" : ""}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">
                          {cassetto.password1 ? (
                            visiblePasswords[`${cassetto.id}_pw1`] ? cassetto.password1 : "••••••••"
                          ) : "-"}
                        </span>
                        {cassetto.password1 && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => togglePasswordVisibility(cassetto.id, "pw1")}
                            >
                              {visiblePasswords[`${cassetto.id}_pw1`] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(cassetto.password1, "Password 1")}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={cassetto.pw_attiva2 ? "bg-blue-50/50" : ""}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">
                          {cassetto.password2 ? (
                            visiblePasswords[`${cassetto.id}_pw2`] ? cassetto.password2 : "••••••••"
                          ) : "-"}
                        </span>
                        {cassetto.password2 && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => togglePasswordVisibility(cassetto.id, "pw2")}
                            >
                              {visiblePasswords[`${cassetto.id}_pw2`] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(cassetto.password2, "Password 2")}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">
                          {cassetto.pin ? (
                            visiblePasswords[`${cassetto.id}_pin`] ? cassetto.pin : "••••"
                          ) : "-"}
                        </span>
                        {cassetto.pin && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => togglePasswordVisibility(cassetto.id, "pin")}
                            >
                              {visiblePasswords[`${cassetto.id}_pin`] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(cassetto.pin, "PIN")}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">
                          {cassetto.pw_iniziale ? (
                            visiblePasswords[`${cassetto.id}_pw_init`] ? cassetto.pw_iniziale : "••••••••"
                          ) : "-"}
                        </span>
                        {cassetto.pw_iniziale && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => togglePasswordVisibility(cassetto.id, "pw_init")}
                            >
                              {visiblePasswords[`${cassetto.id}_pw_init`] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(cassetto.pw_iniziale, "Password Iniziale")}
                            >
                              <Copy className="h-3 w-3" />
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
                          onClick={() => { setEditingCassetto(cassetto); setDialogOpen(true); }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(cassetto.id)}
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
        </div>
      </div>

      {/* Unlock Dialog */}
      <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🔒 Sblocca Cassetti Fiscali</DialogTitle>
            <DialogDescription>
              Inserisci la Master Password per accedere alle credenziali dei cassetti fiscali.
              <br />
              <span className="text-sm text-orange-600 mt-2 block">
                💡 Se non hai ancora configurato la Master Password, vai in: <strong>Impostazioni → Dati Studio</strong>
              </span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Master Password</label>
              <Input
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Inserisci Master Password"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleUnlock();
                  }
                }}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={handleUnlock}>
              <Unlock className="mr-2 h-4 w-4" /> Sblocca
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Migration Dialog */}
      <Dialog open={showMigrationDialog} onOpenChange={setShowMigrationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🔄 Migrazione Necessaria</DialogTitle>
            <DialogDescription>
              Sono presenti cassetti con password non criptate. È necessario migrarle al sistema Master Password.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Questa operazione cifrerà tutte le password esistenti utilizzando la Master Password.
              L'operazione è sicura e reversibile.
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-sm text-yellow-800">
                ⚠️ Durante la migrazione, i cassetti potrebbero non essere accessibili per qualche secondo.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMigrationDialog(false)} disabled={migrating}>
              Dopo
            </Button>
            <Button onClick={handleMigrate} disabled={migrating}>
              {migrating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Migrazione in corso...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Migra Ora
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCassetto ? "Modifica Cassetto Fiscale" : "Nuovo Cassetto Fiscale"}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="nominativo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nominativo / Cliente</FormLabel>
                    <FormControl>
                      <Input placeholder="Es. Mario Rossi" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Username..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="pin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PIN</FormLabel>
                      <FormControl>
                        <Input placeholder="PIN..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className={`p-4 border rounded-md ${form.watch("pw_attiva1") ? "bg-blue-50 border-blue-200" : "bg-gray-50"}`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Password 1</h4>
                  <FormField
                    control={form.control}
                    name="pw_attiva1"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={handlePw1Change}
                          />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer">
                          Attiva
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="password1"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input 
                          placeholder="Password 1..." 
                          {...field} 
                          disabled={!form.watch("pw_attiva1") && form.watch("pw_attiva2")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className={`p-4 border rounded-md ${form.watch("pw_attiva2") ? "bg-blue-50 border-blue-200" : "bg-gray-50"}`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Password 2</h4>
                  <FormField
                    control={form.control}
                    name="pw_attiva2"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={handlePw2Change}
                          />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer">
                          Attiva
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="password2"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input 
                          placeholder="Password 2..." 
                          {...field}
                          disabled={!form.watch("pw_attiva2") && form.watch("pw_attiva1")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="pw_iniziale"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password Iniziale</FormLabel>
                    <FormControl>
                      <Input placeholder="Password iniziale..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Note aggiuntive..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Annulla
                </Button>
                <Button type="submit">
                  {editingCassetto ? "Salva Modifiche" : "Crea Cassetto"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}