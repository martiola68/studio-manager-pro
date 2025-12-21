import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Trash2, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type ScadenzaAntiric = Database["public"]["Tables"]["tbscadantiric"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

export default function ScadenzeAntiriciclaggioPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaAntiric[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");

  // Stats
  const [stats, setStats] = useState({
    totale: 0,
    scadute: 0,
    prossime30gg: 0,
    ok: 0
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
      await loadData();
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [scadenzeData, utentiData] = await Promise.all([
        loadScadenze(),
        loadUtenti()
      ]);
      setScadenze(scadenzeData);
      setUtenti(utentiData);
      calculateStats(scadenzeData);
    } catch (error) {
      console.error("Errore caricamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadScadenze = async (): Promise<ScadenzaAntiric[]> => {
    const { data, error } = await supabase
      .from("tbscadantiric")
      .select("*")
      .order("nominativo", { ascending: true });
    
    if (error) throw error;
    return data || [];
  };

  const loadUtenti = async (): Promise<Utente[]> => {
    const { data, error } = await supabase
      .from("tbutenti")
      .select("*")
      .order("cognome", { ascending: true });
    
    if (error) throw error;
    return data || [];
  };

  const calculateStats = (scadenzeData: ScadenzaAntiric[]) => {
    const oggi = new Date();
    const tra30gg = new Date();
    tra30gg.setDate(oggi.getDate() + 30);

    let scadute = 0;
    let prossime30gg = 0;
    let ok = 0;

    scadenzeData.forEach(s => {
      if (s.data_scadenza) {
        const dataScad = new Date(s.data_scadenza);
        if (dataScad < oggi) {
          scadute++;
        } else if (dataScad <= tra30gg) {
          prossime30gg++;
        } else {
          ok++;
        }
      }
    });

    setStats({
      totale: scadenzeData.length,
      scadute,
      prossime30gg,
      ok
    });
  };

  const handleUpdateField = async (scadenzaId: string, field: string, value: any) => {
    try {
      const updates: any = {};
      updates[field] = value || null;
      
      const { error } = await supabase
        .from("tbscadantiric")
        .update(updates)
        .eq("id", scadenzaId);

      if (error) throw error;

      // Se aggiorno data_ultima_verifica o data_scadenza, aggiorno anche il cliente
      if (field === "data_ultima_verifica" || field === "data_scadenza") {
        const { error: clienteError } = await supabase
          .from("tbclienti")
          .update({
            data_ultima_verifica_antiric: field === "data_ultima_verifica" ? value : undefined,
            scadenza_antiric: field === "data_scadenza" ? value : undefined
          })
          .eq("id", scadenzaId);

        if (clienteError) {
          console.error("Errore aggiornamento cliente:", clienteError);
        }
      }

      await loadData();
    } catch (error) {
      console.error("Errore aggiornamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il campo",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo record?")) return;

    try {
      const { error } = await supabase
        .from("tbscadantiric")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Record eliminato"
      });
      await loadData();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il record",
        variant: "destructive"
      });
    }
  };

  const getRowColor = (scadenza: ScadenzaAntiric): string => {
    if (!scadenza.data_scadenza) return "bg-gray-50";
    
    const oggi = new Date();
    const dataScad = new Date(scadenza.data_scadenza);
    const tra30gg = new Date();
    tra30gg.setDate(oggi.getDate() + 30);

    if (dataScad < oggi) return "bg-red-50"; // Scaduta
    if (dataScad <= tra30gg) return "bg-yellow-50"; // Prossima scadenza
    return "bg-white hover:bg-gray-50"; // OK
  };

  const getStatusBadge = (scadenza: ScadenzaAntiric) => {
    if (!scadenza.data_scadenza) {
      return (
        <div className="flex items-center gap-2 text-gray-400">
          <Clock className="h-4 w-4" />
          <span className="text-xs">Non definita</span>
        </div>
      );
    }

    const oggi = new Date();
    const dataScad = new Date(scadenza.data_scadenza);
    const tra30gg = new Date();
    tra30gg.setDate(oggi.getDate() + 30);

    if (dataScad < oggi) {
      return (
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs font-semibold">SCADUTA</span>
        </div>
      );
    }
    
    if (dataScad <= tra30gg) {
      return (
        <div className="flex items-center gap-2 text-yellow-600">
          <Clock className="h-4 w-4" />
          <span className="text-xs font-semibold">In scadenza</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle className="h-4 w-4" />
        <span className="text-xs">OK</span>
      </div>
    );
  };

  const filteredScadenze = scadenze.filter(s => {
    const matchSearch = s.nominativo.toLowerCase().includes(searchQuery.toLowerCase());
    const matchOperatore = filterOperatore === "__all__" || s.utente_operatore_id === filterOperatore;
    return matchSearch && matchOperatore;
  });

  const getUtenteNome = (utenteId: string | null): string => {
    if (!utenteId) return "-";
    const utente = utenti.find(u => u.id === utenteId);
    return utente ? `${utente.nome} ${utente.cognome}` : "-";
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
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-full mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Scadenzario Antiriciclaggio</h1>
              <p className="text-gray-500 mt-1">Monitoraggio adeguata verifica clientela</p>
            </div>

            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Totale Clienti</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{stats.totale}</div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-red-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Verifiche Scadute
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">{stats.scadute}</div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-yellow-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-yellow-600 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    In Scadenza (30gg)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-600">{stats.prossime30gg}</div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    In Regola
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{stats.ok}</div>
                </CardContent>
              </Card>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Filtri e Ricerca</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cerca Nominativo</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Cerca..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Utente Operatore</Label>
                    <Select value={filterOperatore} onValueChange={setFilterOperatore}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tutti" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Tutti</SelectItem>
                        {utenti.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.nome} {u.cognome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto overflow-y-auto max-h-[600px] border rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="sticky left-0 bg-white z-20 min-w-[200px] border-r">Nominativo</TableHead>
                        <TableHead className="min-w-[150px]">Operatore</TableHead>
                        <TableHead className="text-center min-w-[150px]">Data Ultima Verifica</TableHead>
                        <TableHead className="text-center min-w-[150px]">Data Scadenza</TableHead>
                        <TableHead className="text-center min-w-[150px]">Stato</TableHead>
                        <TableHead className="text-center min-w-[100px]">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredScadenze.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            Nessuna scadenza trovata
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredScadenze.map((scadenza) => (
                          <TableRow key={scadenza.id} className={getRowColor(scadenza)}>
                            <TableCell className="font-medium sticky left-0 bg-inherit z-10 border-r">
                              {scadenza.nominativo}
                            </TableCell>
                            <TableCell className="text-sm">
                              {getUtenteNome(scadenza.utente_operatore_id)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="date"
                                value={scadenza.data_ultima_verifica || ""}
                                onChange={(e) => handleUpdateField(scadenza.id, "data_ultima_verifica", e.target.value)}
                                className="w-40 text-xs mx-auto"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="date"
                                value={scadenza.data_scadenza || ""}
                                onChange={(e) => handleUpdateField(scadenza.id, "data_scadenza", e.target.value)}
                                className="w-40 text-xs mx-auto"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              {getStatusBadge(scadenza)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(scadenza.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
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

            {/* Legenda */}
            <Card className="mt-4">
              <CardContent className="py-4">
                <div className="space-y-3">
                  <div className="font-semibold text-gray-900 mb-2">📋 Legenda Stati Verifica:</div>
                  
                  <div className="flex items-center gap-6 text-sm flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-red-50 border border-red-200 rounded"></div>
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span>SCADUTA - Verifica urgente richiesta</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-yellow-50 border border-yellow-200 rounded"></div>
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <span>In scadenza entro 30 giorni</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-white border border-gray-200 rounded"></div>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>In regola (oltre 30 giorni)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gray-50 border border-gray-300 rounded"></div>
                      <span className="text-gray-500">Scadenza non definita</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 pt-3 border-t">
                    <strong>Nota:</strong> L'aggiornamento delle date in questo scadenzario aggiorna automaticamente anche la scheda del cliente.
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