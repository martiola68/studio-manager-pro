import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { contattoService } from "@/services/contattoService";
import { clienteService } from "@/services/clienteService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Copy, Check, Eye, EyeOff, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Contatto = Database["public"]["Tables"]["tbcontatti"]["Row"];
type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];

export default function CassettiFiscaliPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [contatti, setContatti] = useState<Contatto[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [filteredContatti, setFilteredContatti] = useState<Contatto[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
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
    password_iniziale: "",
    cliente_id: null as string | null
  });

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  useEffect(() => {
    filterContatti();
  }, [contatti, clienti, searchQuery, letterFilter]);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await import("@/lib/supabase/client").then(m => m.supabase.auth.getSession());
      
      if (!session) {
        router.push("/login");
        return;
      }

      await loadData();
    } catch (error) {
      console.error("Error checking auth:", error);
      router.push("/login");
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [contattiData, clientiData] = await Promise.all([
        contattoService.getContatti(),
        clienteService.getClienti()
      ]);
      
      const contattiConCassetto = contattiData.filter(c => c.cassetto_fiscale);
      setContatti(contattiConCassetto);
      setClienti(clientiData);
      setFilteredContatti(contattiConCassetto);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getClienteNome = (clienteId: string | null): string => {
    if (!clienteId) return "-";
    const cliente = clienti.find(c => c.id === clienteId);
    return cliente ? cliente.ragione_sociale : "-";
  };

  const filterContatti = () => {
    let filtered = [...contatti];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(contatto => {
        const nomeCompleto = `${contatto.nome || ""} ${contatto.cognome || ""}`.toLowerCase();
        const email = (contatto.email || "").toLowerCase();
        const utente = (contatto.utente || "").toLowerCase();
        const clienteNome = getClienteNome(contatto.cliente_id).toLowerCase();
        
        return nomeCompleto.includes(query) || 
               email.includes(query) || 
               utente.includes(query) ||
               clienteNome.includes(query);
      });
    }

    if (letterFilter) {
      filtered = filtered.filter(contatto =>
        (contatto.cognome || "").toUpperCase().startsWith(letterFilter)
      );
    }

    setFilteredContatti(filtered);
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast({
        title: "Copiato!",
        description: "Testo copiato negli appunti"
      });
    } catch (error) {
      console.error("Error copying:", error);
      toast({
        title: "Errore",
        description: "Impossibile copiare il testo",
        variant: "destructive"
      });
    }
  };

  const togglePasswordVisibility = (contattoId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [contattoId]: !prev[contattoId]
    }));
  };

  const handleEditContatto = (contatto: Contatto) => {
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
      password_iniziale: contatto.password_iniziale || "",
      cliente_id: contatto.cliente_id || null
    });
    setDialogOpen(true);
  };

  const handleSocietaClick = (clienteId: string | null) => {
    if (!clienteId) return;
    
    const cliente = clienti.find(c => c.id === clienteId);

    if (cliente) {
      setSearchQuery(cliente.ragione_sociale);
    }
  };

  const handleSaveContatto = async () => {
    if (!editingContatto) return;

    try {
      const updateData = {
        ...formData,
        cliente_id: formData.cliente_id || null,
        utente: formData.cassetto_fiscale ? formData.utente : null,
        password: formData.cassetto_fiscale ? formData.password : null,
        pin: formData.cassetto_fiscale ? formData.pin : null,
        password_iniziale: formData.cassetto_fiscale ? formData.password_iniziale : null
      };

      await contattoService.updateContatto(editingContatto.id, updateData);
      
      setDialogOpen(false);
      setEditingContatto(null);
      await loadData();
    } catch (error) {
      console.error("Errore nel salvataggio:", error);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingContatto(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Cassetti Fiscali - Studio Manager Pro</title>
      </Head>

      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Cassetti Fiscali</h1>
            <p className="text-muted-foreground">
              Gestisci gli accessi ai cassetti fiscali dei tuoi contatti
            </p>
          </div>
          <Badge variant="secondary" className="w-fit">
            {filteredContatti.length} {filteredContatti.length === 1 ? "cassetto" : "cassetti"}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ricerca e Filtri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per nome, cognome, email, username o società..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant={letterFilter === null ? "default" : "outline"}
                onClick={() => setLetterFilter(null)}
              >
                Tutti
              </Button>
              {alphabet.map(letter => (
                <Button
                  key={letter}
                  size="sm"
                  variant={letterFilter === letter ? "default" : "outline"}
                  onClick={() => setLetterFilter(letter)}
                  className="w-8 h-8 p-0"
                >
                  {letter}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px] text-center">Lettera</TableHead>
                    <TableHead>Contatto</TableHead>
                    <TableHead>Società</TableHead>
                    <TableHead>Username Cassetto</TableHead>
                    <TableHead>Password Cassetto</TableHead>
                    <TableHead>PIN Cassetto</TableHead>
                    <TableHead>Password Iniziale</TableHead>
                    <TableHead className="w-[100px] text-center">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContatti.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nessun cassetto fiscale trovato
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredContatti.map((contatto) => (
                      <TableRow key={contatto.id}>
                        <TableCell className="text-center font-semibold text-lg">
                          {contatto.cognome?.[0]?.toUpperCase() || "?"}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{contatto.cognome} {contatto.nome}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {contatto.cliente_id ? (
                            <span
                              onClick={() => handleSocietaClick(contatto.cliente_id)}
                              className="cursor-pointer hover:bg-accent/50 px-2 py-1 rounded transition-colors"
                              title="Clicca per filtrare"
                            >
                              {getClienteNome(contatto.cliente_id)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {contatto.utente || "-"}
                            </code>
                            {contatto.utente && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => copyToClipboard(contatto.utente!, `utente-${contatto.id}`)}
                              >
                                {copiedField === `utente-${contatto.id}` ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {visiblePasswords[contatto.id] 
                                ? (contatto.password || "-")
                                : "••••••••"}
                            </code>
                            {contatto.password && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => togglePasswordVisibility(contatto.id)}
                                >
                                  {visiblePasswords[contatto.id] ? (
                                    <EyeOff className="h-3 w-3" />
                                  ) : (
                                    <Eye className="h-3 w-3" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => copyToClipboard(contatto.password!, `password-${contatto.id}`)}
                                >
                                  {copiedField === `password-${contatto.id}` ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {contatto.pin || "-"}
                            </code>
                            {contatto.pin && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => copyToClipboard(contatto.pin!, `pin-${contatto.id}`)}
                              >
                                {copiedField === `pin-${contatto.id}` ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {visiblePasswords[`init-${contatto.id}`]
                                ? (contatto.password_iniziale || "-")
                                : "••••••••"}
                            </code>
                            {contatto.password_iniziale && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => togglePasswordVisibility(`init-${contatto.id}`)}
                                >
                                  {visiblePasswords[`init-${contatto.id}`] ? (
                                    <EyeOff className="h-3 w-3" />
                                  ) : (
                                    <Eye className="h-3 w-3" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => copyToClipboard(contatto.password_iniziale!, `pass-init-${contatto.id}`)}
                                >
                                  {copiedField === `pass-init-${contatto.id}` ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditContatto(contatto)}
                            className="h-8 px-3"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Modifica
                          </Button>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Contatto</DialogTitle>
            <DialogDescription>
              Modifica le informazioni del contatto e del cassetto fiscale
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nome">Nome *</Label>
                <Input
                  id="edit-nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-cognome">Cognome *</Label>
                <Input
                  id="edit-cognome"
                  value={formData.cognome}
                  onChange={(e) => setFormData({ ...formData, cognome: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-cell">Cellulare</Label>
                <Input
                  id="edit-cell"
                  value={formData.cell}
                  onChange={(e) => setFormData({ ...formData, cell: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tel">Telefono</Label>
              <Input
                id="edit-tel"
                value={formData.tel}
                onChange={(e) => setFormData({ ...formData, tel: e.target.value })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-cassetto"
                checked={formData.cassetto_fiscale}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, cassetto_fiscale: checked === true })
                }
              />
              <Label htmlFor="edit-cassetto" className="cursor-pointer">
                Ha cassetto fiscale
              </Label>
            </div>

            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h3 className="font-semibold text-sm">Credenziali Cassetto Fiscale</h3>
              
              <div className="space-y-2">
                <Label htmlFor="edit-utente">Username Cassetto</Label>
                <Input
                  id="edit-utente"
                  value={formData.utente}
                  onChange={(e) => setFormData({ ...formData, utente: e.target.value })}
                  disabled={!formData.cassetto_fiscale}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-password">Password Cassetto</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={!formData.cassetto_fiscale}
                  autoComplete="new-password"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-pin">PIN Cassetto</Label>
                  <Input
                    id="edit-pin"
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                    disabled={!formData.cassetto_fiscale}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-password-iniziale">Password Iniziale</Label>
                  <Input
                    id="edit-password-iniziale"
                    type="password"
                    value={formData.password_iniziale}
                    onChange={(e) =>
                      setFormData({ ...formData, password_iniziale: e.target.value })
                    }
                    disabled={!formData.cassetto_fiscale}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-cliente">Società</Label>
              <Select
                value={formData.cliente_id || undefined}
                onValueChange={(value) =>
                  setFormData({ ...formData, cliente_id: value })
                }
              >
                <SelectTrigger id="edit-cliente">
                  <SelectValue placeholder="Seleziona società..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuna società</SelectItem>
                  {clienti.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.ragione_sociale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-note">Note</Label>
              <Textarea
                id="edit-note"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Annulla
            </Button>
            <Button onClick={handleSaveContatto}>
              Salva modifiche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}