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
import { Textarea } from "@/components/ui/textarea";
import { Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Scadenza770 = Database["public"]["Tables"]["tbscad770"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

const TIPO_INVIO_OPTIONS = ["Totale", "Invio Separato"];
const MODELLI_770_OPTIONS = [
  "Solo aut",
  "Solo cap",
  "Solo Dip",
  "Aut+Dip",
  "Aut+Cap",
  "Aut+Dip+Cap",
  "Dip+Cap"
];

export default function Scadenze770Page() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<Scadenza770[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [filterProfessionista, setFilterProfessionista] = useState("__all__");
  const [filterConferma, setFilterConferma] = useState("__all__");

  // Stats
  const [stats, setStats] = useState({
    totale: 0,
    confermate: 0,
    nonConfermate: 0
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
      
      // Calculate stats
      const confermate = scadenzeData.filter(s => s.conferma_riga).length;
      setStats({
        totale: scadenzeData.length,
        confermate,
        nonConfermate: scadenzeData.length - confermate
      });
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

  const loadScadenze = async (): Promise<Scadenza770[]> => {
    const { data, error } = await supabase
      .from("tbscad770")
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

  const handleToggleField = async (scadenzaId: string, field: string, currentValue: boolean | null) => {
    try {
      const updates: any = {};
      updates[field] = !currentValue;
      
      const { error } = await supabase
        .from("tbscad770")
        .update(updates)
        .eq("id", scadenzaId);

      if (error) throw error;

      await loadData();
      toast({
        title: "Successo",
        description: "Campo aggiornato"
      });
    } catch (error) {
      console.error("Errore aggiornamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il campo",
        variant: "destructive"
      });
    }
  };

  const handleUpdateField = async (scadenzaId: string, field: string, value: any) => {
    try {
      const updates: any = {};
      updates[field] = value || null;
      
      const { error } = await supabase
        .from("tbscad770")
        .update(updates)
        .eq("id", scadenzaId);

      if (error) throw error;

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
        .from("tbscad770")
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

  const filteredScadenze = scadenze.filter(s => {
    const matchSearch = s.nominativo.toLowerCase().includes(searchQuery.toLowerCase());
    const matchOperatore = filterOperatore === "__all__" || s.utente_operatore_id === filterOperatore;
    const matchProfessionista = filterProfessionista === "__all__" || s.utente_professionista_id === filterProfessionista;
    const matchConferma = filterConferma === "__all__" || 
      (filterConferma === "true" ? s.conferma_riga : !s.conferma_riga);
    return matchSearch && matchOperatore && matchProfessionista && matchConferma;
  });

  const getUtenteNome = (utenteId: string | null): string => {
    if (!utenteId) return "-";
    const utente = utenti.find(u => u.id === utenteId);
    return utente ? `${utente.nome} ${utente.cognome}` : "-";
  };

  const getRowColor = (scadenza: Scadenza770): string => {
    // Priorità: Conferma Riga > Ricevuta > default
    if (scadenza.conferma_riga) return "bg-green-50";
    if (scadenza.ricevuta) return "bg-green-50";
    return "bg-white hover:bg-gray-50";
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
              <h1 className="text-3xl font-bold text-gray-900">Scadenzario 770</h1>
              <p className="text-gray-500 mt-1">Gestione dichiarazione annuale 770</p>
            </div>

            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Totale Clienti</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{stats.totale}</div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-green-600">Confermate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{stats.confermate}</div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-orange-600">Non Confermate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">{stats.nonConfermate}</div>
                </CardContent>
              </Card>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Filtri e Ricerca</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

                  <div className="space-y-2">
                    <Label>Utente Professionista</Label>
                    <Select value={filterProfessionista} onValueChange={setFilterProfessionista}>
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

                  <div className="space-y-2">
                    <Label>Stato Conferma</Label>
                    <Select value={filterConferma} onValueChange={setFilterConferma}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tutti" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Tutti</SelectItem>
                        <SelectItem value="true">Solo Confermate</SelectItem>
                        <SelectItem value="false">Solo Non Confermate</SelectItem>
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
                        <TableHead className="min-w-[150px]">Professionista</TableHead>
                        <TableHead className="min-w-[150px]">Operatore</TableHead>
                        <TableHead className="min-w-[150px]">Tipo Invio</TableHead>
                        <TableHead className="min-w-[150px]">Modelli 770</TableHead>
                        <TableHead className="text-center min-w-[120px]">Mod Compilato</TableHead>
                        <TableHead className="text-center min-w-[120px]">Mod Definitivo</TableHead>
                        <TableHead className="text-center min-w-[120px]">Mod Inviato</TableHead>
                        <TableHead className="text-center min-w-[140px]">Data Invio</TableHead>
                        <TableHead className="text-center min-w-[100px]">Ricevuta</TableHead>
                        <TableHead className="min-w-[200px]">Note</TableHead>
                        <TableHead className="text-center min-w-[120px]">Conf. Riga</TableHead>
                        <TableHead className="text-center min-w-[100px]">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredScadenze.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={13} className="text-center py-8 text-gray-500">
                            Nessuna scadenza trovata
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredScadenze.map((scadenza) => {
                          const isConfermata = scadenza.conferma_riga || false;
                          const isModInviato = scadenza.mod_inviato || false;
                          
                          return (
                            <TableRow 
                              key={scadenza.id}
                              className={getRowColor(scadenza)}
                            >
                              <TableCell className="font-medium sticky left-0 bg-inherit z-10 border-r">
                                {scadenza.nominativo}
                              </TableCell>
                              <TableCell className="text-sm">
                                {getUtenteNome(scadenza.utente_professionista_id)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {getUtenteNome(scadenza.utente_operatore_id)}
                              </TableCell>
                              
                              {/* Sezione Configurazione */}
                              <TableCell>
                                <Select
                                  value={scadenza.tipo_invio || "__none__"}
                                  onValueChange={(value) => handleUpdateField(scadenza.id, "tipo_invio", value === "__none__" ? null : value)}
                                  disabled={isConfermata}
                                >
                                  <SelectTrigger className="w-full text-xs">
                                    <SelectValue placeholder="Seleziona..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">-</SelectItem>
                                    {TIPO_INVIO_OPTIONS.map((opt) => (
                                      <SelectItem key={opt} value={opt}>
                                        {opt}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              
                              <TableCell>
                                <Select
                                  value={scadenza.modelli_770 || "__none__"}
                                  onValueChange={(value) => handleUpdateField(scadenza.id, "modelli_770", value === "__none__" ? null : value)}
                                  disabled={isConfermata}
                                >
                                  <SelectTrigger className="w-full text-xs">
                                    <SelectValue placeholder="Seleziona..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">-</SelectItem>
                                    {MODELLI_770_OPTIONS.map((opt) => (
                                      <SelectItem key={opt} value={opt}>
                                        {opt}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>

                              {/* Sezione Modulistica */}
                              <TableCell className="text-center">
                                <input
                                  type="checkbox"
                                  checked={scadenza.mod_compilato || false}
                                  onChange={() => handleToggleField(scadenza.id, "mod_compilato", scadenza.mod_compilato)}
                                  className="rounded w-4 h-4 cursor-pointer"
                                  disabled={isConfermata}
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <input
                                  type="checkbox"
                                  checked={scadenza.mod_definitivo || false}
                                  onChange={() => handleToggleField(scadenza.id, "mod_definitivo", scadenza.mod_definitivo)}
                                  className="rounded w-4 h-4 cursor-pointer"
                                  disabled={isConfermata}
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <input
                                  type="checkbox"
                                  checked={isModInviato}
                                  onChange={() => handleToggleField(scadenza.id, "mod_inviato", scadenza.mod_inviato)}
                                  className="rounded w-4 h-4 cursor-pointer"
                                  disabled={isConfermata}
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Input
                                  type="date"
                                  value={scadenza.data_invio || ""}
                                  onChange={(e) => handleUpdateField(scadenza.id, "data_invio", e.target.value)}
                                  className="w-36 text-xs"
                                  disabled={!isModInviato || isConfermata}
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <input
                                  type="checkbox"
                                  checked={scadenza.ricevuta || false}
                                  onChange={() => handleToggleField(scadenza.id, "ricevuta", scadenza.ricevuta)}
                                  className="rounded w-4 h-4 cursor-pointer"
                                  disabled={isConfermata}
                                />
                              </TableCell>

                              {/* Note */}
                              <TableCell>
                                <Textarea
                                  value={scadenza.note || ""}
                                  onChange={(e) => handleUpdateField(scadenza.id, "note", e.target.value)}
                                  className="min-h-[60px] text-xs"
                                  disabled={isConfermata}
                                  placeholder="Note..."
                                />
                              </TableCell>

                              {/* Conferma Riga */}
                              <TableCell className="text-center">
                                <Button
                                  variant={isConfermata ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handleToggleField(scadenza.id, "conferma_riga", scadenza.conferma_riga)}
                                  className="w-full"
                                >
                                  {isConfermata ? "✓ Chiusa" : "○ Aperta"}
                                </Button>
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
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Legenda */}
            <Card className="mt-4">
              <CardContent className="py-4">
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-green-50 border border-green-200 rounded"></div>
                    <span>Conferma Riga = True o Ricevuta = True (Verde)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-white border border-gray-200 rounded"></div>
                    <span>Default (Bianco)</span>
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