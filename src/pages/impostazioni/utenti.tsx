import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { authService } from "@/services/authService";
import { utenteService } from "@/services/utenteService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Edit, UserX, Search, RotateCcw, Loader2, UserCheck, Filter, Key, Eye, EyeOff, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/supabase/types";

type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];
type RuoloOperatore = Database["public"]["Tables"]["tbroperatore"]["Row"];

const generateSecurePassword = (): string => {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%&*";
  
  const all = uppercase + lowercase + numbers + symbols;
  
  let password = "";
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  for (let i = password.length; i < 12; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  
  return password.split("").sort(() => Math.random() - 0.5).join("");
};

export default function GestioneUtentiPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [ruoli, setRuoli] = useState<RuoloOperatore[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUtente, setEditingUtente] = useState<Utente | null>(null);
  const [creating, setCreating] = useState(false);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [useAutoPassword, setUseAutoPassword] = useState(true);
  
  const [formData, setFormData] = useState({
    nome: "",
    cognome: "",
    email: "",
    password: "",
    tipo_utente: "User" as "Admin" | "User",
    ruolo_operatore_id: "",
    attivo: true,
    settore: "" as "Fiscale" | "Lavoro" | "Fiscale & lavoro" | "",
    responsabile: false
  });

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user.email) {
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
      
      // Ordino per settore e poi per cognome
      const sortedData = utentiData.sort((a: Utente, b: Utente) => {
        // Prima ordino per settore
        const settoreOrder: Record<string, number> = { 'Fiscale': 1, 'Lavoro': 2, 'Fiscale & lavoro': 3 };
        const settoreA = a.settore ? (settoreOrder[a.settore] || 999) : 999;
        const settoreB = b.settore ? (settoreOrder[b.settore] || 999) : 999;
        
        if (settoreA !== settoreB) {
          return settoreA - settoreB;
        }
        
        // Poi ordino per cognome
        return (a.cognome || '').localeCompare(b.cognome || '');
      });
      
      setUtenti(sortedData);
      setRuoli(ruoliData);
    } catch (error) {
      console.error('Errore caricamento dati:', error);
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

  const handleGeneratePassword = () => {
    const newPassword = generateSecurePassword();
    setFormData({ ...formData, password: newPassword });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome || !formData.cognome || !formData.email) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive"
      });
      return;
    }

    try {
      setCreating(true);

      if (editingUtente) {
        await utenteService.updateUtente(editingUtente.id, {
          nome: formData.nome,
          cognome: formData.cognome,
          email: formData.email,
          tipo_utente: formData.tipo_utente,
          ruolo_operatore_id: formData.ruolo_operatore_id || null,
          attivo: formData.attivo,
          settore: formData.settore || null,
          responsabile: formData.responsabile
        });
        
        toast({
          title: "✅ Utente aggiornato",
          description: "Le modifiche sono state salvate con successo"
        });
        
        setDialogOpen(false);
        resetForm();
        await loadData();
      } else {
        const utentiEsistenti = await utenteService.getUtenti();
        const utenteEsistente = utentiEsistenti.find(u => u.email.toLowerCase() === formData.email.toLowerCase());

        if (utenteEsistente) {
          toast({
            title: "⚠️ Utente già esistente",
            description: `Un utente con email ${formData.email} esiste già nel sistema`,
            variant: "destructive"
          });
          return;
        }

        const passwordToUse = useAutoPassword ? "" : formData.password;

        if (!useAutoPassword && (!passwordToUse || passwordToUse.length < 8)) {
          toast({
            title: "Errore",
            description: "La password deve essere di almeno 8 caratteri",
            variant: "destructive"
          });
          return;
        }

        const response = await fetch("/api/auth/create-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: formData.email,
            password: passwordToUse,
            nome: formData.nome,
            cognome: formData.cognome,
            useAutoPassword,
            tipo_utente: formData.tipo_utente,
            ruolo_operatore_id: formData.ruolo_operatore_id || null,
            attivo: formData.attivo,
            settore: formData.settore || null,
            responsabile: formData.responsabile
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.details || result.error || "Errore creazione utente");
        }

        await supabase
          .from("tbutenti")
          .update({
            tipo_utente: formData.tipo_utente,
            ruolo_operatore_id: formData.ruolo_operatore_id || null,
            attivo: formData.attivo,
            settore: formData.settore || null,
            responsabile: formData.responsabile
          })
          .eq("id", result.userId);
        
        const message = useAutoPassword 
          ? `Password generata: ${result.password}\n\nComunica questa password all'utente.`
          : `Utente creato con la password fornita.`;
        
        alert(`✅ UTENTE CREATO!\n\nEmail: ${formData.email}\n${message}`);
        
        if (useAutoPassword) {
          try {
            await navigator.clipboard.writeText(result.password);
            toast({
              title: "✅ Password copiata!",
              description: "La password è stata copiata negli appunti"
            });
          } catch {
            // Ignore clipboard errors
          }
        }
        
        setDialogOpen(false);
        resetForm();
        await loadData();
        
        toast({
          title: "✅ Utente creato con successo!",
          description: useAutoPassword ? "Password copiata negli appunti" : "Utente pronto per il login",
          duration: 5000
        });
      }
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Impossibile salvare l'utente",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (utente: Utente) => {
    const newPassword = prompt(
      `🔑 RESET PASSWORD PER: ${utente.nome} ${utente.cognome}\n\n` +
      `Inserisci la nuova password (min 8 caratteri):\n\n` +
      `Oppure lascia vuoto per generare una password automatica.`
    );

    if (newPassword === null) return;

    try {
      setResettingPassword(utente.id);

      const response = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: utente.id,
          userEmail: utente.email,
          password: newPassword.trim() || null,
          useAutoPassword: newPassword.trim() === ""
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || "Errore reset password");
      }

      const passwordToShow = result.tempPassword;

      const message = `✅ PASSWORD RESETTATA!\n\nUtente: ${utente.nome} ${utente.cognome}\nEmail: ${utente.email}\n\nNuova Password:\n━━━━━━━━━━━━━━━━━━━━━━\n${passwordToShow}\n━━━━━━━━━━━━━━━━━━━━━━\n\n✅ Comunica questa password all'utente`;

      try {
        await navigator.clipboard.writeText(passwordToShow);
        alert(message + "\n\n✅ Password copiata negli appunti!");
      } catch {
        alert(message);
      }

      toast({
        title: "✅ Password resettata",
        description: `Nuova password impostata per ${utente.nome} ${utente.cognome}`
      });

    } catch (error: any) {
      console.error("Errore reset password:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile resettare la password",
        variant: "destructive"
      });
    } finally {
      setResettingPassword(null);
    }
  };

  const handleDeleteUser = async (utente: Utente) => {
    if (utente.tipo_utente === "Admin") {
      toast({
        title: "Operazione non consentita",
        description: "Non è possibile eliminare un amministratore",
        variant: "destructive"
      });
      return;
    }

    if (!confirm(`⚠️ ELIMINARE UTENTE?\n\nUtente: ${utente.nome} ${utente.cognome}\nEmail: ${utente.email}\n\nQuesta operazione eliminerà:\n- L'account di accesso\n- I dati dell'utente\n\nQuesta azione NON può essere annullata!`)) {
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: utente.id
        })
      });

      if (!response.ok) {
        console.error("Errore eliminazione Auth");
      }

      await utenteService.deleteUtente(utente.id);

      toast({
        title: "✅ Utente eliminato",
        description: `${utente.nome} ${utente.cognome} è stato eliminato dal sistema`
      });

      await loadData();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare l'utente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (utente: Utente) => {
    const newStatus = !utente.attivo;
    const action = newStatus ? "riattivare" : "disattivare";
    
    if (!confirm(`Sei sicuro di voler ${action} l'utente ${utente.nome} ${utente.cognome}?`)) {
      return;
    }

    try {
      await utenteService.updateUtente(utente.id, { attivo: newStatus });
      
      toast({
        title: newStatus ? "✅ Utente riattivato" : "✅ Utente disattivato",
        description: newStatus 
          ? `${utente.nome} ${utente.cognome} può nuovamente accedere al sistema`
          : `${utente.nome} ${utente.cognome} non può più accedere al sistema`,
      });
      
      await loadData();
    } catch (error) {
      console.error("Errore cambio stato:", error);
      toast({
        title: "Errore",
        description: "Impossibile modificare lo stato dell'utente",
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
      password: "",
      tipo_utente: utente.tipo_utente as "Admin" | "User",
      ruolo_operatore_id: utente.ruolo_operatore_id || "",
      attivo: utente.attivo ?? true,
      settore: (utente.settore as "Fiscale" | "Lavoro" | "Fiscale & lavoro") || "",
      responsabile: utente.responsabile ?? false
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      cognome: "",
      email: "",
      password: "",
      tipo_utente: "User",
      ruolo_operatore_id: "",
      attivo: true,
      settore: "",
      responsabile: false
    });
    setEditingUtente(null);
    setUseAutoPassword(true);
    setShowPassword(false);
  };

  const filteredUtenti = utenti.filter(u => {
    const matchSearch = 
      u.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.cognome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchStatus = 
      filterStatus === "all" ? true :
      filterStatus === "active" ? (u.attivo ?? true) :
      !(u.attivo ?? true);
    
    return matchSearch && matchStatus;
  });

  const activeCount = utenti.filter(u => u.attivo ?? true).length;
  const inactiveCount = utenti.filter(u => !(u.attivo ?? true)).length;

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
                {editingUtente ? "Modifica Utente" : "Crea Nuovo Utente"}
              </DialogTitle>
              <DialogDescription>
                {editingUtente 
                  ? "Modifica i dati dell'utente" 
                  : "Compila i campi per creare un nuovo utente"}
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
                  disabled={!!editingUtente}
                />
                {editingUtente && (
                  <p className="text-xs text-gray-500">L'email non può essere modificata</p>
                )}
              </div>

              {!editingUtente && (
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label>Password *</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="useAutoPassword"
                        checked={useAutoPassword}
                        onChange={(e) => {
                          setUseAutoPassword(e.target.checked);
                          if (e.target.checked) {
                            setFormData({ ...formData, password: "" });
                          }
                        }}
                        className="rounded"
                      />
                      <Label htmlFor="useAutoPassword" className="cursor-pointer text-sm">
                        Genera automaticamente
                      </Label>
                    </div>
                  </div>

                  {!useAutoPassword && (
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Inserisci password (min 8 caratteri)"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required={!useAutoPassword}
                          minLength={8}
                          className="pr-20"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowPassword(!showPassword)}
                            className="h-8 w-8"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleGeneratePassword}
                            className="h-8 w-8"
                            title="Genera password"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        Min 8 caratteri. Click sull'icona 🔑 per generare una password sicura.
                      </p>
                    </div>
                  )}

                  {useAutoPassword && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-900">
                      ℹ️ Una password sicura verrà generata automaticamente e mostrata dopo la creazione
                    </div>
                  )}
                </div>
              )}

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

              <div className="space-y-2">
                <Label htmlFor="settore">Settore</Label>
                <Select
                  value={formData.settore}
                  onValueChange={(value: "Fiscale" | "Lavoro" | "Fiscale & lavoro") => 
                    setFormData({ ...formData, settore: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona settore" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fiscale">Fiscale</SelectItem>
                    <SelectItem value="Lavoro">Lavoro</SelectItem>
                    <SelectItem value="Fiscale & lavoro">Fiscale & Lavoro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="responsabile"
                    checked={formData.responsabile}
                    onChange={(e) => setFormData({ ...formData, responsabile: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Label htmlFor="responsabile" className="cursor-pointer font-medium">Responsabile (può vedere promemoria del gruppo)</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="attivo"
                    checked={formData.attivo}
                    onChange={(e) => setFormData({ ...formData, attivo: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Label htmlFor="attivo" className="cursor-pointer">Utente attivo</Label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {editingUtente ? "Aggiornamento..." : "Creazione..."}
                    </>
                  ) : (
                    <>
                      {editingUtente ? "Aggiorna Utente" : "Crea Utente"}
                    </>
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setDialogOpen(false)}
                  disabled={creating}
                >
                  Annulla
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filtri e Ricerca</CardTitle>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-600" />
                <span className="font-semibold">{activeCount} Attivi</span>
              </div>
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-gray-400" />
                <span className="font-semibold">{inactiveCount} Disattivati</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select value={filterStatus} onValueChange={(value: "all" | "active" | "inactive") => setFilterStatus(value)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli utenti</SelectItem>
                  <SelectItem value="active">Solo attivi</SelectItem>
                  <SelectItem value="inactive">Solo disattivati</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cognome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Settore</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUtenti.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    Nessun utente trovato
                  </TableCell>
                </TableRow>
              ) : (
                filteredUtenti.map((utente) => {
                  const ruolo = ruoli.find(r => r.id === utente.ruolo_operatore_id);
                  const isActive = utente.attivo ?? true;
                  
                  return (
                    <TableRow key={utente.id} className={!isActive ? "opacity-60 bg-gray-50" : ""}>
                      <TableCell className="font-medium">{utente.nome}</TableCell>
                      <TableCell>{utente.cognome}</TableCell>
                      <TableCell>{utente.email}</TableCell>
                      <TableCell>
                        <Badge variant={utente.tipo_utente === "Admin" ? "default" : "secondary"}>
                          {utente.tipo_utente === "Admin" ? "Amministratore" : "Utente"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {utente.settore ? (
                          <Badge variant="outline">{utente.settore}</Badge>
                        ) : "-"}
                        {utente.responsabile && (
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded border border-yellow-200">Resp.</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {ruolo ? ruolo.ruolo : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isActive ? "default" : "secondary"}>
                          {isActive ? "✓ Attivo" : "○ Disattivato"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(utente)}
                            title="Modifica utente"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleResetPassword(utente)}
                            title="Reset password"
                            disabled={resettingPassword === utente.id}
                          >
                            {resettingPassword === utente.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4 text-orange-600" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleStatus(utente)}
                            title={isActive ? "Disattiva utente" : "Riattiva utente"}
                            className={isActive ? "text-gray-600 hover:text-gray-700" : "text-green-600 hover:text-green-700 hover:bg-green-50"}
                          >
                            {isActive ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </Button>
                          {utente.tipo_utente !== "Admin" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteUser(utente)}
                              title="Elimina utente"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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

      <Card className="mt-6">
        <CardContent className="py-4">
          <div className="flex items-start gap-3 text-sm">
            <Key className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900 mb-2">🔑 Gestione Password:</p>
              <ul className="space-y-1 text-gray-700">
                <li><strong>✏️ Creazione</strong> - Puoi inserire manualmente una password o generarla automaticamente</li>
                <li><strong>🔄 Reset</strong> - Ti verrà chiesto di inserire la nuova password (o lascia vuoto per generarla)</li>
                <li><strong>🗑️ Elimina</strong> - Rimuove completamente l'utente dal sistema (solo utenti non-admin)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}