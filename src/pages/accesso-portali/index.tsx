import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, ExternalLink, Eye, EyeOff, Key } from "lucide-react";
import { credenzialiAccessoService } from "@/services/credenzialiAccessoService";
import type { Database } from "@/integrations/supabase/types";

type CredenzialeAccesso = Database["public"]["Tables"]["tbcredenziali_accesso"]["Row"];

export default function AccessoPortaliPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [credenziali, setCredenziali] = useState<CredenzialeAccesso[]>([]);
  const [filteredCredenziali, setFilteredCredenziali] = useState<CredenzialeAccesso[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCredenziale, setEditingCredenziale] = useState<CredenzialeAccesso | null>(null);
  const [loading, setLoading] = useState(true);
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
    if (userId) {
      fetchCredenziali();
    }
  }, [userId]);

  useEffect(() => {
    filterCredenziali();
  }, [searchTerm, credenziali]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    setUserId(session.user.id);
  };

  const fetchCredenziali = async () => {
    try {
      setLoading(true);
      const data = await credenzialiAccessoService.getAll();
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

    const term = searchTerm.toLowerCase();
    const filtered = credenziali.filter((cred) =>
      cred.portale.toLowerCase().includes(term) ||
      (cred.indirizzo_url && cred.indirizzo_url.toLowerCase().includes(term)) ||
      (cred.login_utente && cred.login_utente.toLowerCase().includes(term))
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

    let url = credenziale.indirizzo_url || "";
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const toggleShowPassword = (id: string) => {
    setShowPassword((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Key className="w-8 h-8 text-blue-600" />
            Accesso Portali
          </h1>
          <p className="text-gray-500 mt-1">
            Gestione credenziali di accesso ai portali esterni
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="w-4 h-4" />
          Nuova Credenziale
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-gray-400" />
          <Input
            placeholder="Cerca per portale, URL o username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 border-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-gray-400"
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
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                        {cred.portale.substring(0, 2).toUpperCase()}
                      </div>
                      {cred.portale}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {cred.indirizzo_url ? (
                      <a
                        href={cred.indirizzo_url.startsWith("http") ? cred.indirizzo_url : `https://${cred.indirizzo_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {cred.indirizzo_url.replace(/^https?:\/\//, "").substring(0, 30)}
                        {cred.indirizzo_url.length > 30 ? "..." : ""}
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
                        <span className="font-mono text-xs">
                          {showPassword[cred.id] ? cred.login_pw : "••••••••"}
                        </span>
                        <button
                          onClick={() => toggleShowPassword(cred.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {showPassword[cred.id] ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-xs">{cred.login_pin || "-"}</TableCell>
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
                          className="gap-1 h-8 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Login
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(cred)}
                        className="h-8 w-8 p-0"
                      >
                        <Pencil className="w-4 h-4 text-gray-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(cred.id)}
                        className="h-8 w-8 p-0 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 text-gray-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCredenziale ? "Modifica Credenziale" : "Nuova Credenziale"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="portale">Nome Portale *</Label>
              <Input
                id="portale"
                value={formData.portale}
                onChange={(e) => setFormData({ ...formData, portale: e.target.value })}
                placeholder="Es: Agenzia delle Entrate"
              />
            </div>

            <div>
              <Label htmlFor="indirizzo_url">URL Login</Label>
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
                  placeholder="Username"
                  autoComplete="off"
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
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="login_pin">PIN (Opzionale)</Label>
              <Input
                id="login_pin"
                value={formData.login_pin}
                onChange={(e) => setFormData({ ...formData, login_pin: e.target.value })}
                placeholder="Es: 123456"
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
              {editingCredenziale ? "Salva Modifiche" : "Crea Credenziale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}