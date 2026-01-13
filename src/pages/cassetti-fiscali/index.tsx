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

  const handleEditContatto = (contattoId: string) => {
    router.push(`/contatti?edit=${contattoId}`);
  };

  const handleSocietaClick = (clienteId: string | null) => {
    if (!clienteId) return;
    const cliente = clienti.find(c => c.id === clienteId);
    if (cliente) {
      setSearchQuery(cliente.ragione_sociale);
    }
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
                    <TableHead className="w-[200px]">Contatto</TableHead>
                    <TableHead className="w-[200px]">Società</TableHead>
                    <TableHead className="w-[200px]">Email</TableHead>
                    <TableHead className="w-[150px]">Username</TableHead>
                    <TableHead className="w-[150px]">Password</TableHead>
                    <TableHead className="w-[100px]">PIN</TableHead>
                    <TableHead className="w-[150px]">Password Iniziale</TableHead>
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
                        <TableCell className="font-medium">
                          {contatto.cognome} {contatto.nome}
                        </TableCell>
                        <TableCell>
                          {contatto.cliente_id ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-1 text-sm text-primary hover:text-primary/80 hover:underline"
                              onClick={() => handleSocietaClick(contatto.cliente_id)}
                            >
                              {getClienteNome(contatto.cliente_id)}
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm truncate max-w-[150px]">
                              {contatto.email || "-"}
                            </span>
                            {contatto.email && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => copyToClipboard(contatto.email!, `email-${contatto.id}`)}
                              >
                                {copiedField === `email-${contatto.id}` ? (
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
                            onClick={() => handleEditContatto(contatto.id)}
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
    </>
  );
}