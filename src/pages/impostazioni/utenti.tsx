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
import { UserPlus, Edit, UserX, Search, Mail, RotateCcw, Loader2, UserCheck, Filter } from "lucide-react";
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
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUtente, setEditingUtente] = useState<Utente | null>(null);
  const [inviting, setInviting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);

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

  const inviteUser = async (email: string, nome: string, cognome: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessione non valida");

      const response = await fetch("/api/auth/invite-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ email, nome, cognome })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Errore durante l'invio dell'invito");
      }

      return data;
    } catch (error) {
      console.error("Errore invito utente:", error);
      throw error;
    }
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
      setInviting(true);

      if (editingUtente) {
        // Modifica utente esistente - solo aggiornamento DB
        await utenteService.updateUtente(editingUtente.id, formData);
        toast({
          title: "✅ Utente aggiornato",
          description: "Le modifiche sono state salvate con successo"
        });
      } else {
        // Nuovo utente - crea su DB + invia invito
        
        // 1. Crea utente nel DB
        await utenteService.createUtente(formData);
        
        // 2. Invia invito via email (crea account Supabase Auth)
        try {
          await inviteUser(formData.email, formData.nome, formData.cognome);
          
          toast({
            title: "✅ Utente creato e invitato!",
            description: `Email di invito inviata a ${formData.email}. L'utente riceverà un link per impostare la password.`,
            duration: 6000
          });
        } catch (inviteError) {
          console.error("Errore invio invito:", inviteError);
          toast({
            title: "⚠️ Utente creato, invio email fallito",
            description: "L'utente è stato creato nel sistema ma l'email di invito non è stata inviata. Puoi reinviare l'invito dalla lista utenti.",
            variant: "destructive",
            duration: 8000
          });
        }
      }

      setDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Impossibile salvare l'utente",
        variant: "destructive"
      });
    } finally {
      setInviting(false);
    }
  };

  const handleResendInvite = async (utente: Utente) => {
    if (!confirm(`Inviare una nuova email di invito a ${utente.email}?`)) return;

    try {
      setResettingPassword(utente.id);
      await inviteUser(utente.email, utente.nome, utente.cognome);
      
      toast({
        title: "✅ Invito reinviato",
        description: `Email di invito inviata a ${utente.email}`,
        duration: 5000
      });
    } catch (error) {
      console.error("Errore reinvio invito:", error);
      toast({
        title: "Errore",
        description: "Impossibile inviare l'invito. Riprova.",
        variant: "destructive"
      });
    } finally {
      setResettingPassword(null);
    }
  };

  const handleResetPassword = async (utente: Utente) => {
    if (!confirm(`Inviare email di reset password a ${utente.email}?`)) return;

    try {
      setResettingPassword(utente.id);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessione non valida");

      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ email: utente.email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Errore durante il reset password");
      }

      toast({
        title: "✅ Email inviata",
        description: `Email di reset password inviata a ${utente.email}`,
        duration: 5000
      });
    } catch (error) {
      console.error("Errore reset password:", error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Impossibile inviare l'email di reset",
        variant: "destructive"
      });
    } finally {
      setResettingPassword(null);
    }
  };

  const handleToggleStatus = async (utente: Utente) => {
    const newStatus = !utente.attivo;
    const action = newStatus ? "riattivare" : "disattivare";
    
    if (!confirm(`Sei sicuro di voler ${action} l'utente ${utente.nome} ${utente.cognome}?\n\n${newStatus ? "L'utente potrà nuovamente accedere al sistema." : "L'utente NON potrà più accedere al sistema, ma tutti i suoi dati e assegnazioni rimarranno intatti."}`)) {
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
      tipo_utente: utente.tipo_utente as "Admin" | "User",
      ruolo_operatore_id: utente.ruolo_operatore_id || "",
      attivo: utente.attivo ?? true
    });
    setDialogOpen(true);
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
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Gestione Utenti</h1>
                <p className="text-gray-500 mt-1">Invita e gestisci gli utenti del sistema</p>
              </div>
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invita Nuovo Utente
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingUtente ? "Modifica Utente" : "Invita Nuovo Utente"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingUtente 
                        ? "Modifica i dati dell'utente" 
                        : "L'utente riceverà un'email con un link per impostare la password"}
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

                    {!editingUtente && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                        <div className="flex items-start gap-2">
                          <Mail className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-blue-900">
                            <p className="font-semibold">📧 Come funziona l'invito:</p>
                            <ol className="list-decimal list-inside mt-2 space-y-1">
                              <li>L'utente riceve un'email con un link sicuro</li>
                              <li>Cliccando il link, imposta la sua password</li>
                              <li>Può subito accedere al sistema</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      <Button type="submit" className="flex-1" disabled={inviting}>
                        {inviting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {editingUtente ? "Aggiornamento..." : "Invio..."}
                          </>
                        ) : (
                          <>
                            {editingUtente ? "Aggiorna" : "Crea e Invita"} Utente
                          </>
                        )}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setDialogOpen(false)}
                        disabled={inviting}
                      >
                        Annulla
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Filtri e Statistiche */}
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
                                  onClick={() => handleResendInvite(utente)}
                                  title="Reinvia invito"
                                  disabled={resettingPassword === utente.id}
                                >
                                  {resettingPassword === utente.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Mail className="h-4 w-4 text-blue-600" />
                                  )}
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
                                  className={isActive ? "text-red-600 hover:text-red-700 hover:bg-red-50" : "text-green-600 hover:text-green-700 hover:bg-green-50"}
                                >
                                  {isActive ? (
                                    <UserX className="h-4 w-4" />
                                  ) : (
                                    <UserCheck className="h-4 w-4" />
                                  )}
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

            <Card className="mt-6">
              <CardContent className="py-4">
                <div className="flex items-start gap-3 text-sm">
                  <Mail className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 mb-2">📧 Azioni disponibili:</p>
                    <ul className="space-y-1 text-gray-700">
                      <li><strong>✏️ Modifica</strong> - Aggiorna dati utente</li>
                      <li><strong>📨 Reinvia Invito</strong> - Invia nuova email di configurazione account</li>
                      <li><strong>🔄 Reset Password</strong> - Invia email per reimpostare password</li>
                      <li><strong>👤 Disattiva/Riattiva</strong> - Gestisce l'accesso al sistema (dati e assegnazioni rimangono intatti)</li>
                    </ul>
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
                      <p className="text-amber-900 text-xs">
                        ℹ️ <strong>Disattivare un utente</strong> è la scelta consigliata invece di eliminarlo: impedisce l'accesso ma mantiene intatti tutti i dati storici (clienti assegnati, scadenze, appuntamenti).
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}