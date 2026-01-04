import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { contattoService } from "@/services/contattoService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Copy, ExternalLink, FolderKey, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Contatto = Database["public"]["Tables"]["tbcontatti"]["Row"];

const CASSETTO_FISCALE_URL = "https://iampe.agenziaentrate.gov.it/sam/UI/Login?realm=/agenziaentrate";

export default function CassettiFiscaliPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [contatti, setContatti] = useState<Contatto[]>([]);
  const [filteredContatti, setFilteredContatti] = useState<Contatto[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [letterFilter, setLetterFilter] = useState<string>("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  useEffect(() => {
    filterContatti();
  }, [contatti, searchQuery, letterFilter]);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      await loadContatti();
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
  };

  const loadContatti = async () => {
    try {
      setLoading(true);
      const data = await contattoService.getContatti();
      const contattiCassetto = data.filter(c => c.cassetto_fiscale === true);
      setContatti(contattiCassetto);
    } catch (error) {
      console.error("Errore caricamento contatti:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i contatti",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterContatti = () => {
    let filtered = [...contatti];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.nome.toLowerCase().includes(query) ||
        c.cognome.toLowerCase().includes(query) ||
        (c.utente?.toLowerCase() || "").includes(query)
      );
    }

    if (letterFilter) {
      filtered = filtered.filter(c =>
        c.cognome.toUpperCase().startsWith(letterFilter)
      );
    }

    setFilteredContatti(filtered);
  };

  const copyToClipboard = async (text: string | null, fieldName: string, contattoId: string) => {
    if (!text) {
      toast({
        title: "Campo vuoto",
        description: `Il campo ${fieldName} non è compilato`,
        variant: "destructive"
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      
      setCopiedField(`${contattoId}-${fieldName}`);
      setTimeout(() => setCopiedField(null), 2000);

      toast({
        title: "✅ Copiato!",
        description: `${fieldName} copiato negli appunti`,
        duration: 2000
      });
    } catch (error) {
      console.error("Errore copia:", error);
      toast({
        title: "Errore",
        description: "Impossibile copiare negli appunti",
        variant: "destructive"
      });
    }
  };

  const apriCassettoFiscale = () => {
    window.open(CASSETTO_FISCALE_URL, "_blank", "noopener,noreferrer");
  };

  const getCopiedButtonContent = (contattoId: string, fieldName: string, defaultIcon: React.ReactNode, label: string) => {
    const key = `${contattoId}-${fieldName}`;
    const isCopied = copiedField === key;
    
    return (
      <>
        {isCopied ? <CheckCircle className="h-3 w-3 text-green-600" /> : defaultIcon}
        <span className="text-xs">{isCopied ? "Copiato!" : label}</span>
      </>
    );
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Cassetti Fiscali</h1>
          <p className="text-gray-500 mt-1">Gestione accessi e documenti fiscali</p>
        </div>
        <Button 
          onClick={apriCassettoFiscale}
          className="bg-green-600 hover:bg-green-700"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Apri Fisconline/Entratel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="border-l-4 border-l-blue-600">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Totale Cassetti Fiscali
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{contatti.length}</div>
            <p className="text-xs text-gray-500 mt-1">Contatti con accesso attivo</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-600">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Con Credenziali Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {contatti.filter(c => c.utente && c.password && c.pin).length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Utente, PIN e Password compilati</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-600">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Credenziali Incomplete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {contatti.filter(c => !c.utente || !c.password || !c.pin).length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Dati mancanti o parziali</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cerca per nome, cognome o utente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={letterFilter === "" ? "default" : "outline"}
                size="sm"
                onClick={() => setLetterFilter("")}
              >
                Tutti
              </Button>
              {alphabet.map(letter => {
                const count = contatti.filter(c => c.cognome.toUpperCase().startsWith(letter)).length;
                return (
                  <Button
                    key={letter}
                    variant={letterFilter === letter ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLetterFilter(letter)}
                    className="w-10 relative"
                    disabled={count === 0}
                  >
                    {letter}
                    {count > 0 && (
                      <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                        {count}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredContatti.length === 0 ? (
            <div className="text-center py-12">
              <FolderKey className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg mb-2">Nessun cassetto fiscale trovato</p>
              <p className="text-gray-400 text-sm">
                {searchQuery || letterFilter 
                  ? "Prova a modificare i filtri di ricerca"
                  : "Aggiungi contatti con cassetto fiscale attivo dalla rubrica"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Nome</TableHead>
                  <TableHead className="w-[180px]">Cognome</TableHead>
                  <TableHead className="w-[200px]">Utente</TableHead>
                  <TableHead className="w-[120px]">PIN</TableHead>
                  <TableHead className="w-[150px]">Password</TableHead>
                  <TableHead className="w-[100px]">Stato</TableHead>
                  <TableHead className="text-right w-[300px]">Azioni Rapide</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContatti.map((contatto) => {
                  const hasUtente = !!contatto.utente;
                  const hasPin = !!contatto.pin;
                  const hasPassword = !!contatto.password;
                  const isComplete = hasUtente && hasPin && hasPassword;
                  
                  return (
                    <TableRow key={contatto.id}>
                      <TableCell className="font-medium">{contatto.nome}</TableCell>
                      <TableCell className="font-medium">{contatto.cognome}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {contatto.utente || "-"}
                        </code>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {contatto.pin ? "••••" : "-"}
                        </code>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {contatto.password ? "••••••••" : "-"}
                        </code>
                      </TableCell>
                      <TableCell>
                        {isComplete ? (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Completo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                            Parziale
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 justify-end flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(contatto.utente, "Utente", contatto.id)}
                            disabled={!hasUtente}
                            className="gap-1 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                          >
                            {getCopiedButtonContent(contatto.id, "utente", <Copy className="h-3 w-3" />, "Utente")}
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(contatto.pin, "PIN", contatto.id)}
                            disabled={!hasPin}
                            className="gap-1 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300"
                          >
                            {getCopiedButtonContent(contatto.id, "pin", <Copy className="h-3 w-3" />, "PIN")}
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(contatto.password, "Password", contatto.id)}
                            disabled={!hasPassword}
                            className="gap-1 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300"
                          >
                            {getCopiedButtonContent(contatto.id, "password", <Copy className="h-3 w-3" />, "Password")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 border-l-4 border-l-blue-600">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <FolderKey className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-gray-900">💡 Come usare i Cassetti Fiscali:</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-700">
                <li>Clicca <strong>"Apri Fisconline/Entratel"</strong> in alto per aprire il portale Agenzia Entrate</li>
                <li><strong className="text-blue-600">⚠️ IMPORTANTE:</strong> Nel portale, clicca sulla scheda <strong>"Fisconline/Entratel"</strong></li>
                <li>Trova il contatto nella tabella sotto</li>
                <li>Clicca <strong>"Copia Utente"</strong>, poi incolla nel campo Utente del cassetto fiscale</li>
                <li>Clicca <strong>"Copia PIN"</strong>, poi incolla nel campo PIN del cassetto fiscale</li>
                <li>Clicca <strong>"Copia Password"</strong>, poi incolla nel campo Password del cassetto fiscale</li>
                <li>Effettua il login nel cassetto fiscale</li>
              </ol>
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
                <p className="text-blue-900 text-xs mb-2">
                  <strong>⚡ Tip:</strong> Dopo aver cliccato "Copia", vedrai il pulsante cambiare in "Copiato!" per 2 secondi. 
                  Questo conferma che il valore è negli appunti e pronto per essere incollato.
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded p-3 mt-2">
                <p className="text-amber-900 text-xs">
                  <strong>🎯 Ricorda:</strong> Il portale si apre alla pagina generale dell'Agenzia delle Entrate. 
                  Devi cliccare sulla scheda <strong>"Fisconline/Entratel"</strong> per accedere all'area di login del cassetto fiscale.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}