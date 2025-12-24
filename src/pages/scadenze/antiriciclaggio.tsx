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

type ScadenzaAntiric = Database["public"]["Tables"]["tbscadantiric"]["Row"] & {
  tbclienti?: {
    tipo_prestazione_a: string | null;
    tipo_prestazione_b: string | null;
  };
};
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

const TIPO_PRESTAZIONE_OPTIONS = [
  "Assistenza e consulenza societaria continuativa e generica",
  "Consulenza del Lavoro",
  "Altre attività"
];

export default function ScadenzeAntiriciclaggioPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaAntiric[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");

  // Stats separate per A e B
  const [statsA, setStatsA] = useState({
    totale: 0,
    scadute: 0,
    prossime30gg: 0,
    ok: 0
  });

  const [statsB, setStatsB] = useState({
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
      .select(`
        *,
        tbclienti!inner(
          tipo_prestazione_a,
          tipo_prestazione_b
        )
      `)
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

    // Stats Verifica A
    let scaduteA = 0;
    let prossime30ggA = 0;
    let okA = 0;
    let totaleA = 0;

    // Stats Verifica B
    let scaduteB = 0;
    let prossime30ggB = 0;
    let okB = 0;
    let totaleB = 0;

    scadenzeData.forEach(s => {
      // Calcolo Verifica A
      if (s.data_scadenza) {
        totaleA++;
        const dataScadA = new Date(s.data_scadenza);
        if (dataScadA < oggi) {
          scaduteA++;
        } else if (dataScadA <= tra30gg) {
          prossime30ggA++;
        } else {
          okA++;
        }
      }

      // Calcolo Verifica B
      if (s.scadenza_antiric_b) {
        totaleB++;
        const dataScadB = new Date(s.scadenza_antiric_b);
        if (dataScadB < oggi) {
          scaduteB++;
        } else if (dataScadB <= tra30gg) {
          prossime30ggB++;
        } else {
          okB++;
        }
      }
    });

    setStatsA({
      totale: totaleA,
      scadute: scaduteA,
      prossime30gg: prossime30ggA,
      ok: okA
    });

    setStatsB({
      totale: totaleB,
      scadute: scaduteB,
      prossime30gg: prossime30ggB,
      ok: okB
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

      // Aggiorna anche il cliente se sono campi data o tipo prestazione
      if (field === "data_ultima_verifica" || field === "data_scadenza" || 
          field === "tipo_prestazione_a" || field === "tipo_prestazione_b" ||
          field === "data_ultima_verifica_b" || field === "scadenza_antiric_b") {
        
        const clienteUpdates: any = {};
        if (field === "data_ultima_verifica") clienteUpdates.data_ultima_verifica_antiric = value;
        if (field === "data_scadenza") clienteUpdates.scadenza_antiric = value;
        if (field === "tipo_prestazione_a") clienteUpdates.tipo_prestazione_a = value;
        if (field === "tipo_prestazione_b") clienteUpdates.tipo_prestazione_b = value;
        if (field === "data_ultima_verifica_b") clienteUpdates.data_ultima_verifica_b = value;
        if (field === "scadenza_antiric_b") clienteUpdates.scadenza_antiric_b = value;

        const { error: clienteError } = await supabase
          .from("tbclienti")
          .update(clienteUpdates)
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
    const oggi = new Date();
    const tra30gg = new Date();
    tra30gg.setDate(oggi.getDate() + 30);

    // Priorità alla verifica A
    if (scadenza.data_scadenza) {
      const dataScadA = new Date(scadenza.data_scadenza);
      if (dataScadA < oggi) return "bg-red-50";
      if (dataScadA <= tra30gg) return "bg-yellow-50";
    }

    // Controlla verifica B se A è ok
    if (scadenza.scadenza_antiric_b) {
      const dataScadB = new Date(scadenza.scadenza_antiric_b);
      if (dataScadB < oggi) return "bg-orange-50";
      if (dataScadB <= tra30gg) return "bg-yellow-50";
    }

    return "bg-white hover:bg-gray-50";
  };

  const getStatusBadge = (dataScadenza: string | null) => {
    if (!dataScadenza) {
      return (
        <div className="flex items-center gap-2 text-gray-400">
          <Clock className="h-4 w-4" />
          <span className="text-xs">Non definita</span>
        </div>
      );
    }

    const oggi = new Date();
    const dataScad = new Date(dataScadenza);
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

  const getTipoPrestazione = (scadenza: ScadenzaAntiric, tipo: "a" | "b"): string => {
    if (tipo === "a") {
      return scadenza.tipo_prestazione_a || scadenza.tbclienti?.tipo_prestazione_a || "__none__";
    }
    return scadenza.tipo_prestazione_b || scadenza.tbclienti?.tipo_prestazione_b || "__none__";
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
              <p className="text-gray-500 mt-1">Monitoraggio adeguata verifica clientela A e B</p>
            </div>

            {/* Dashboard Stats - Doppio per A e B */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Stats Verifica A */}
              <Card className="border-l-4 border-l-blue-600">
                <CardHeader>
                  <CardTitle className="text-lg text-blue-900">📋 Verifica A (Principale)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Totale</p>
                      <p className="text-2xl font-bold text-gray-900">{statsA.totale}</p>
                    </div>
                    <div>
                      <p className="text-xs text-red-600 mb-1">Scadute</p>
                      <p className="text-2xl font-bold text-red-600">{statsA.scadute}</p>
                    </div>
                    <div>
                      <p className="text-xs text-yellow-600 mb-1">30gg</p>
                      <p className="text-2xl font-bold text-yellow-600">{statsA.prossime30gg}</p>
                    </div>
                    <div>
                      <p className="text-xs text-green-600 mb-1">OK</p>
                      <p className="text-2xl font-bold text-green-600">{statsA.ok}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stats Verifica B */}
              <Card className="border-l-4 border-l-green-600">
                <CardHeader>
                  <CardTitle className="text-lg text-green-900">📋 Verifica B (Secondaria)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Totale</p>
                      <p className="text-2xl font-bold text-gray-900">{statsB.totale}</p>
                    </div>
                    <div>
                      <p className="text-xs text-red-600 mb-1">Scadute</p>
                      <p className="text-2xl font-bold text-red-600">{statsB.scadute}</p>
                    </div>
                    <div>
                      <p className="text-xs text-yellow-600 mb-1">30gg</p>
                      <p className="text-2xl font-bold text-yellow-600">{statsB.prossime30gg}</p>
                    </div>
                    <div>
                      <p className="text-xs text-green-600 mb-1">OK</p>
                      <p className="text-2xl font-bold text-green-600">{statsB.ok}</p>
                    </div>
                  </div>
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
                        
                        {/* Sezione A */}
                        <TableHead colSpan={4} className="text-center bg-blue-50 border-l-2 border-l-blue-400">
                          📋 Verifica A (Principale)
                        </TableHead>
                        
                        {/* Sezione B */}
                        <TableHead colSpan={4} className="text-center bg-green-50 border-l-2 border-l-green-400">
                          📋 Verifica B (Secondaria)
                        </TableHead>
                        
                        <TableHead className="text-center min-w-[100px]">Azioni</TableHead>
                      </TableRow>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-white z-20 border-r"></TableHead>
                        <TableHead></TableHead>
                        
                        {/* Colonne A */}
                        <TableHead className="text-center min-w-[200px] bg-blue-50">Tipo Prestazione A</TableHead>
                        <TableHead className="text-center min-w-[150px] bg-blue-50">Data Verifica A</TableHead>
                        <TableHead className="text-center min-w-[150px] bg-blue-50">Scadenza A</TableHead>
                        <TableHead className="text-center min-w-[120px] bg-blue-50">Stato A</TableHead>
                        
                        {/* Colonne B */}
                        <TableHead className="text-center min-w-[200px] bg-green-50 border-l-2 border-l-green-400">Tipo Prestazione B</TableHead>
                        <TableHead className="text-center min-w-[150px] bg-green-50">Data Verifica B</TableHead>
                        <TableHead className="text-center min-w-[150px] bg-green-50">Scadenza B</TableHead>
                        <TableHead className="text-center min-w-[120px] bg-green-50">Stato B</TableHead>
                        
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredScadenze.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center py-8 text-gray-500">
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
                            
                            {/* VERIFICA A */}
                            <TableCell className="text-center bg-blue-50/50">
                              <Select
                                value={getTipoPrestazione(scadenza, "a")}
                                onValueChange={(value) => handleUpdateField(
                                  scadenza.id, 
                                  "tipo_prestazione_a", 
                                  value === "__none__" ? null : value
                                )}
                              >
                                <SelectTrigger className="w-full text-xs">
                                  <SelectValue placeholder="Seleziona..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Nessuna</SelectItem>
                                  {TIPO_PRESTAZIONE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-center bg-blue-50/50">
                              <Input
                                type="date"
                                value={scadenza.data_ultima_verifica || ""}
                                onChange={(e) => handleUpdateField(scadenza.id, "data_ultima_verifica", e.target.value)}
                                className="w-40 text-xs mx-auto"
                              />
                            </TableCell>
                            <TableCell className="text-center bg-blue-50/50">
                              <Input
                                type="date"
                                value={scadenza.data_scadenza || ""}
                                onChange={(e) => handleUpdateField(scadenza.id, "data_scadenza", e.target.value)}
                                className="w-40 text-xs mx-auto"
                              />
                            </TableCell>
                            <TableCell className="text-center bg-blue-50/50">
                              {getStatusBadge(scadenza.data_scadenza)}
                            </TableCell>
                            
                            {/* VERIFICA B */}
                            <TableCell className="text-center bg-green-50/50 border-l-2 border-l-green-400">
                              <Select
                                value={getTipoPrestazione(scadenza, "b")}
                                onValueChange={(value) => handleUpdateField(
                                  scadenza.id, 
                                  "tipo_prestazione_b", 
                                  value === "__none__" ? null : value
                                )}
                              >
                                <SelectTrigger className="w-full text-xs">
                                  <SelectValue placeholder="Seleziona..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Nessuna</SelectItem>
                                  {TIPO_PRESTAZIONE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-center bg-green-50/50">
                              <Input
                                type="date"
                                value={scadenza.data_ultima_verifica_b || ""}
                                onChange={(e) => handleUpdateField(scadenza.id, "data_ultima_verifica_b", e.target.value)}
                                className="w-40 text-xs mx-auto"
                              />
                            </TableCell>
                            <TableCell className="text-center bg-green-50/50">
                              <Input
                                type="date"
                                value={scadenza.scadenza_antiric_b || ""}
                                onChange={(e) => handleUpdateField(scadenza.id, "scadenza_antiric_b", e.target.value)}
                                className="w-40 text-xs mx-auto"
                              />
                            </TableCell>
                            <TableCell className="text-center bg-green-50/50">
                              {getStatusBadge(scadenza.scadenza_antiric_b)}
                            </TableCell>
                            
                            {/* Azioni */}
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
                  <div className="font-semibold text-gray-900 mb-2">📋 Legenda Scadenzario Antiriciclaggio:</div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium text-blue-900 mb-2">📋 Verifica A (Principale):</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                        <li>Tipo Prestazione A (importato da cliente)</li>
                        <li>Data Ultima Verifica A</li>
                        <li>Scadenza Antiriciclaggio A</li>
                        <li>Stato verifica (SCADUTA/In scadenza/OK)</li>
                      </ul>
                    </div>
                    
                    <div>
                      <p className="font-medium text-green-900 mb-2">📋 Verifica B (Secondaria):</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                        <li>Tipo Prestazione B (importato da cliente)</li>
                        <li>Data Ultima Verifica B</li>
                        <li>Scadenza Antiriciclaggio B</li>
                        <li>Stato verifica (SCADUTA/In scadenza/OK)</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm flex-wrap pt-3 border-t">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-red-50 border border-red-200 rounded"></div>
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span>SCADUTA A</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-orange-50 border border-orange-200 rounded"></div>
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <span>SCADUTA B (A OK)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-yellow-50 border border-yellow-200 rounded"></div>
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <span>In scadenza (30gg)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-white border border-gray-200 rounded"></div>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Tutte OK</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 pt-3 border-t">
                    <strong>Nota:</strong> I tipi di prestazione vengono importati automaticamente dalla scheda cliente.
                    L'aggiornamento delle date e tipi prestazione in questo scadenzario aggiorna automaticamente anche la scheda del cliente.
                    I campi possono rimanere vuoti. Verifica B è opzionale e indipendente da A.
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