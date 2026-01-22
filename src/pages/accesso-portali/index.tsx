import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/router";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import TopNavBar from "@/components/TopNavBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, ExternalLink, Eye, EyeOff, Key } from "lucide-react";
import { credenzialiAccessoService } from "@/services/credenzialiAccessoService";

type CredenzialeAccesso = {
  id: string;
  portale: string;
  indirizzo_url: string | null;
  login_utente: string | null;
  login_pw: string | null;
  login_pin: string | null;
  note: string | null;
  studio_id: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export default function AccessoPortaliPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [credenziali, setCredenziali] = useState<CredenzialeAccesso[]>([]);
  const [filteredCredenziali, setFilteredCredenziali] = useState<CredenzialeAccesso[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCredenziale, setEditingCredenziale] = useState<CredenzialeAccesso | null>(null);
  const [loading, setLoading] = useState(true);
  const [studioId, setStudioId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<{ [key: string]: boolean }>({});

  const [formData, setFormData] = useState({
    portale: "",
    indirizzo_url: "",
    login_utente: "",
    login_pw: "",
    login_pin: "",
    note: "",
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (studioId) {
      fetchCredenziali();
    }
  }, [studioId]);

  useEffect(() => {
    filterCredenziali();
  }, [searchTerm, credenziali]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    const { data: utente } = await supabase
      .from("tbutenti")
      .select("studio_id")
      .eq("id", session.user.id)
      .single();

    if (utente) {
      setStudioId(utente.studio_id);
      setUserId(session.user.id);
    }
  };

  const fetchCredenziali = async () => {
    if (!studioId) return;

    try {
      setLoading(true);
      const data = await credenzialiAccessoService.getAll(studioId);
      setCredenziali(data);
    } catch (error) {
      console.error("Errore nel caricamento delle credenziali:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare le credenziali di accesso",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterCredenziali = () => {
    if (!searchTerm.trim()) {
      setFilteredCredenziali(credenziali);
      return;
    }

    const filtered = credenziali.filter((cred) =>
      cred.portale.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cred.indirizzo_url && cred.indirizzo_url.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (cred.login_utente && cred.login_utente.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredCredenziali(filtered);
  };

  const handleOpenDialog = (credenziale?: CredenzialeAccesso) => {
    if (credenziale) {
      setEditingCredenziale(credenziale);
      setFormData({
        portale: credenziale.portale,
        indirizzo_url: credenziale.indirizzo_url || "",
        login_utente: credenziale.login_utente || "",
        login_pw: credenziale.login_pw || "",
        login_pin: credenziale.login_pin || "",
        note: credenziale.note || "",
      });
    } else {
      setEditingCredenziale(null);
      setFormData({
        portale: "",
        indirizzo_url: "",
        login_utente: "",
        login_pw: "",
        login_pin: "",
        note: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCredenziale(null);
    setFormData({
      portale: "",
      indirizzo_url: "",
      login_utente: "",
      login_pw: "",
      login_pin: "",
      note: "",
    });
  };

  const handleSave = async () => {
    if (!formData.portale.trim()) {
      toast({
        title: "Errore",
        description: "Il nome del portale è obbligatorio",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingCredenziale) {
        await credenzialiAccessoService.update(editingCredenziale.id, formData);
        toast({
          title: "Successo",
          description: "Credenziale aggiornata con successo",
        });
      } else {
        await credenzialiAccessoService.create({
          ...formData,
          studio_id: studioId,
          created_by: userId,
        });
        toast({
          title: "Successo",
          description: "Credenziale creata con successo",
        });
      }

      handleCloseDialog();
      fetchCredenziali();
    } catch (error) {
      console.error("Errore nel salvataggio:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare la credenziale",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa credenziale?")) return;

    try {
      await credenzialiAccessoService.delete(id);
      toast({
        title: "Successo",
        description: "Credenziale eliminata con successo",
      });
      fetchCredenziali();
    } catch (error) {
      console.error("Errore nell'eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare la credenziale",
        variant: "destructive",
      });
    }
  };

  const handleLogin = (credenziale: CredenzialeAccesso) => {
    if (!credenziale.indirizzo_url) {
      toast({
        title: "Attenzione",
        description: "URL non disponibile per questo portale",
        variant: "destructive",
      });
      return;
    }

    window.open(credenziale.indirizzo_url, "_blank", "noopener,noreferrer");
  };

  const toggleShowPassword = (id: string) => {
    setShowPassword((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <TopNavBar />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <Key className="w-8 h-8 text-blue-600" />
                  Accesso Portali
                </h1>
                <p className="text-gray-600 mt-1">
                  Gestione credenziali di accesso ai portali esterni
                </p>
              </div>
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="w-4 h-4" />
                Nuova Credenziale
              </Button>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Cerca per portale, URL o username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Portale</TableHead>
                    <TableHead className="w-[250px]">URL</TableHead>
                    <TableHead className="w-[150px]">Username</TableHead>
                    <TableHead className="w-[150px]">Password</TableHead>
                    <TableHead className="w-[100px]">PIN</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right w-[200px]">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        Caricamento in corso...
                      </TableCell>
                    </TableRow>
                  ) : filteredCredenziali.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        {searchTerm ? "Nessuna credenziale trovata" : "Nessuna credenziale inserita"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCredenziali.map((cred) => (
                      <TableRow key={cred.id}>
                        <TableCell className="font-medium">{cred.portale}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {cred.indirizzo_url ? (
                            <a
                              href={cred.indirizzo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              {cred.indirizzo_url.substring(0, 40)}
                              {cred.indirizzo_url.length > 40 ? "..." : ""}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{cred.login_utente || "-"}</TableCell>
                        <TableCell className="text-sm">
                          {cred.login_pw ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono">
                                {showPassword[cred.id] ? cred.login_pw : "••••••••"}
                              </span>
                              <button
                                onClick={() => toggleShowPassword(cred.id)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                {showPassword[cred.id] ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{cred.login_pin || "-"}</TableCell>
                        <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">
                          {cred.note || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {cred.indirizzo_url && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleLogin(cred)}
                                className="gap-1"
                              >
                                <ExternalLink className="w-4 h-4" />
                                Login
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(cred)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(cred.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                💡 <strong>Suggerimento:</strong> Usa il pulsante "Login" per aprire direttamente il portale in una nuova scheda del browser.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCredenziale ? "Modifica Credenziale" : "Nuova Credenziale"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="portale">Nome Portale *</Label>
              <Input
                id="portale"
                value={formData.portale}
                onChange={(e) => setFormData({ ...formData, portale: e.target.value })}
                placeholder="Es: Agenzia delle Entrate, INPS, ecc."
              />
            </div>

            <div>
              <Label htmlFor="indirizzo_url">URL Portale</Label>
              <Input
                id="indirizzo_url"
                type="url"
                value={formData.indirizzo_url}
                onChange={(e) => setFormData({ ...formData, indirizzo_url: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="login_utente">Username</Label>
                <Input
                  id="login_utente"
                  value={formData.login_utente}
                  onChange={(e) => setFormData({ ...formData, login_utente: e.target.value })}
                  placeholder="Username di accesso"
                />
              </div>

              <div>
                <Label htmlFor="login_pw">Password</Label>
                <Input
                  id="login_pw"
                  type="password"
                  value={formData.login_pw}
                  onChange={(e) => setFormData({ ...formData, login_pw: e.target.value })}
                  placeholder="Password"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="login_pin">PIN</Label>
              <Input
                id="login_pin"
                value={formData.login_pin}
                onChange={(e) => setFormData({ ...formData, login_pin: e.target.value })}
                placeholder="PIN (se richiesto)"
              />
            </div>

            <div>
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="Note aggiuntive..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Annulla
            </Button>
            <Button onClick={handleSave}>
              {editingCredenziale ? "Aggiorna" : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}