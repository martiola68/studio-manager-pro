import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Search, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/supabase/types";

type ScadenzaImu = Database["public"]["Tables"]["tbscadimu"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

export default function ScadenzeImuPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaImu[]>([]);
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

  const loadScadenze = async (): Promise<ScadenzaImu[]> => {
    const { data, error } = await supabase
      .from("tbscadimu")
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
        .from("tbscadimu")
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
        .from("tbscadimu")
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
        .from("tbscadimu")
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
    const matchSearch = s.nominativo?.toLowerCase().includes(searchQuery.toLowerCase());
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario IMU</h1>
          <p className="text-gray-500 mt-1">Gestione dichiarazioni e versamenti IMU</p>
        </div>
      </div>

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
                  
                  {/* Acconto IMU */}
                  <TableHead className="text-center min-w-[120px]">Acconto IMU</TableHead>
                  <TableHead className="text-center min-w-[120px]">Acconto Dovuto</TableHead>
                  <TableHead className="text-center min-w-[140px]">Acconto Comunicato</TableHead>
                  <TableHead className="text-center min-w-[140px]">Data Com. Acconto</TableHead>
                  
                  {/* Saldo IMU */}
                  <TableHead className="text-center min-w-[120px]">Saldo IMU</TableHead>
                  <TableHead className="text-center min-w-[120px]">Saldo Dovuto</TableHead>
                  <TableHead className="text-center min-w-[140px]">Saldo Comunicato</TableHead>
                  <TableHead className="text-center min-w-[140px]">Data Com. Saldo</TableHead>
                  
                  {/* Dichiarazione IMU */}
                  <TableHead className="text-center min-w-[140px]">Dichiarazione IMU</TableHead>
                  <TableHead className="text-center min-w-[140px]">Data Scad. Dich.</TableHead>
                  <TableHead className="text-center min-w-[140px]">Dich. Presentata</TableHead>
                  <TableHead className="text-center min-w-[140px]">Data Presentazione</TableHead>
                  
                  <TableHead className="min-w-[200px]">Note</TableHead>
                  <TableHead className="text-center min-w-[120px]">Conferma</TableHead>
                  <TableHead className="text-center min-w-[100px]">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredScadenze.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={18} className="text-center py-8 text-gray-500">
                      Nessuna scadenza trovata
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredScadenze.map((scadenza) => {
                    const isConfermata = scadenza.conferma_riga || false;
                    
                    return (
                      <TableRow 
                        key={scadenza.id}
                        className={isConfermata ? "bg-green-50" : "bg-white hover:bg-gray-50"}
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
                        
                        {/* Acconto IMU */}
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={scadenza.acconto_imu || false}
                            onChange={() => handleToggleField(scadenza.id, "acconto_imu", scadenza.acconto_imu)}
                            className="rounded w-4 h-4 cursor-pointer"
                            disabled={isConfermata}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={scadenza.acconto_dovuto || false}
                            onChange={() => handleToggleField(scadenza.id, "acconto_dovuto", scadenza.acconto_dovuto)}
                            className="rounded w-4 h-4 cursor-pointer"
                            disabled={isConfermata}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={scadenza.acconto_comunicato || false}
                            onChange={() => handleToggleField(scadenza.id, "acconto_comunicato", scadenza.acconto_comunicato)}
                            className="rounded w-4 h-4 cursor-pointer"
                            disabled={isConfermata}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="date"
                            value={scadenza.acconto_data || ""}
                            onChange={(e) => handleUpdateField(scadenza.id, "acconto_data", e.target.value)}
                            className="w-36 text-xs"
                            disabled={isConfermata}
                          />
                        </TableCell>
                        
                        {/* Saldo IMU */}
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={scadenza.saldo_imu || false}
                            onChange={() => handleToggleField(scadenza.id, "saldo_imu", scadenza.saldo_imu)}
                            className="rounded w-4 h-4 cursor-pointer"
                            disabled={isConfermata}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={scadenza.saldo_dovuto || false}
                            onChange={() => handleToggleField(scadenza.id, "saldo_dovuto", scadenza.saldo_dovuto)}
                            className="rounded w-4 h-4 cursor-pointer"
                            disabled={isConfermata}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={scadenza.saldo_comunicato || false}
                            onChange={() => handleToggleField(scadenza.id, "saldo_comunicato", scadenza.saldo_comunicato)}
                            className="rounded w-4 h-4 cursor-pointer"
                            disabled={isConfermata}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="date"
                            value={scadenza.saldo_data || ""}
                            onChange={(e) => handleUpdateField(scadenza.id, "saldo_data", e.target.value)}
                            className="w-36 text-xs"
                            disabled={isConfermata}
                          />
                        </TableCell>
                        
                        {/* Dichiarazione IMU */}
                        <TableCell className="text-center">
                          <Select
                            value={scadenza.dichiarazione_imu || "NO"}
                            onValueChange={(value) => handleUpdateField(scadenza.id, "dichiarazione_imu", value)}
                            disabled={isConfermata}
                          >
                            <SelectTrigger className="w-20 text-xs mx-auto">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SI">SI</SelectItem>
                              <SelectItem value="NO">NO</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="date"
                            value={scadenza.dichiarazione_scadenza || ""}
                            onChange={(e) => handleUpdateField(scadenza.id, "dichiarazione_scadenza", e.target.value)}
                            className="w-36 text-xs"
                            disabled={isConfermata || scadenza.dichiarazione_imu === "NO"}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={scadenza.dichiarazione_presentazione || false}
                            onChange={() => handleToggleField(scadenza.id, "dichiarazione_presentazione", scadenza.dichiarazione_presentazione)}
                            className="rounded w-4 h-4 cursor-pointer"
                            disabled={isConfermata || scadenza.dichiarazione_imu === "NO"}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="date"
                            value={scadenza.dichiarazione_data_pres || ""}
                            onChange={(e) => handleUpdateField(scadenza.id, "dichiarazione_data_pres", e.target.value)}
                            className="w-36 text-xs"
                            disabled={isConfermata || scadenza.dichiarazione_imu === "NO"}
                          />
                        </TableCell>
                        
                        <TableCell>
                          <Textarea
                            value={scadenza.note || ""}
                            onChange={(e) => handleUpdateField(scadenza.id, "note", e.target.value)}
                            className="min-h-[60px] text-xs"
                            disabled={isConfermata}
                            placeholder="Note..."
                          />
                        </TableCell>
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
    </div>
  );
}