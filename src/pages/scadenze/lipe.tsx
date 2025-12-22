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
import { Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type ScadenzaLipe = Database["public"]["Tables"]["tbscadlipe"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

export default function ScadenzeLipePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaLipe[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [filterProfessionista, setFilterProfessionista] = useState("__all__");

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

  const loadScadenze = async (): Promise<ScadenzaLipe[]> => {
    const { data, error } = await supabase
      .from("tbscadlipe")
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
        .from("tbscadlipe")
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
        .from("tbscadlipe")
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
        .from("tbscadlipe")
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
    return matchSearch && matchOperatore && matchProfessionista;
  });

  const getUtenteNome = (utenteId: string | null): string => {
    if (!utenteId) return "-";
    const utente = utenti.find(u => u.id === utenteId);
    return utente ? `${utente.nome} ${utente.cognome}` : "-";
  };

  // Determina se un mese è abilitato in base al tipo di liquidazione
  const isMeseEnabled = (scadenza: ScadenzaLipe, mese: string): boolean => {
    const tipoLiq = scadenza.tipo_liq;
    
    // Se CL (Contribuenti Lipe), TUTTI i mesi sono disabilitati
    if (tipoLiq === "CL") return false;
    
    // Se Mensile (M), tutti i mesi sono attivi
    if (tipoLiq === "M") return true;
    
    // Se Trimestrale (T), solo i mesi di chiusura trimestre sono attivi
    if (tipoLiq === "T") {
      return ["mar", "giu", "set", "dic"].includes(mese);
    }
    
    // Default: abilitato
    return true;
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
              <h1 className="text-3xl font-bold text-gray-900">Scadenzario Liq. Iva e Lipe</h1>
              <p className="text-gray-500 mt-1">Gestione liquidazioni IVA mensili/trimestrali e comunicazioni LIPE</p>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Filtri e Ricerca</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        <TableHead className="text-center min-w-[100px]">Tipo Liq</TableHead>
                        
                        {/* Trimestre 1 */}
                        <TableHead className="text-center min-w-[80px] bg-blue-50">Gen</TableHead>
                        <TableHead className="text-center min-w-[80px] bg-blue-50">Feb</TableHead>
                        <TableHead className="text-center min-w-[80px] bg-blue-50">Mar</TableHead>
                        <TableHead className="text-center min-w-[100px] bg-blue-100">Lipe 1T</TableHead>
                        <TableHead className="text-center min-w-[140px] bg-blue-100">Data Invio 1T</TableHead>
                        
                        {/* Trimestre 2 */}
                        <TableHead className="text-center min-w-[80px] bg-green-50">Apr</TableHead>
                        <TableHead className="text-center min-w-[80px] bg-green-50">Mag</TableHead>
                        <TableHead className="text-center min-w-[80px] bg-green-50">Giu</TableHead>
                        <TableHead className="text-center min-w-[100px] bg-green-100">Lipe 2T</TableHead>
                        <TableHead className="text-center min-w-[140px] bg-green-100">Data Invio 2T</TableHead>
                        
                        {/* Trimestre 3 */}
                        <TableHead className="text-center min-w-[80px] bg-yellow-50">Lug</TableHead>
                        <TableHead className="text-center min-w-[80px] bg-yellow-50">Ago</TableHead>
                        <TableHead className="text-center min-w-[80px] bg-yellow-50">Set</TableHead>
                        <TableHead className="text-center min-w-[100px] bg-yellow-100">Lipe 3T</TableHead>
                        <TableHead className="text-center min-w-[140px] bg-yellow-100">Data Invio 3T</TableHead>
                        
                        {/* Trimestre 4 + Acconto */}
                        <TableHead className="text-center min-w-[80px] bg-red-50">Ott</TableHead>
                        <TableHead className="text-center min-w-[80px] bg-red-50">Nov</TableHead>
                        <TableHead className="text-center min-w-[120px] bg-orange-100">Acconto</TableHead>
                        <TableHead className="text-center min-w-[120px] bg-orange-100">Acc. Com</TableHead>
                        <TableHead className="text-center min-w-[80px] bg-red-50">Dic</TableHead>
                        <TableHead className="text-center min-w-[100px] bg-red-100">Lipe 4T</TableHead>
                        <TableHead className="text-center min-w-[140px] bg-red-100">Data Invio 4T</TableHead>
                        
                        <TableHead className="text-center min-w-[100px]">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredScadenze.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={28} className="text-center py-8 text-gray-500">
                            Nessuna scadenza trovata
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredScadenze.map((scadenza) => {
                          const tipoLiq = scadenza.tipo_liq || "M";
                          const acconto = scadenza.acconto || "Non dovuto";
                          const isAccontoComEnabled = acconto === "Dovuto";
                          
                          return (
                            <TableRow key={scadenza.id}>
                              <TableCell className="font-medium sticky left-0 bg-white z-10 border-r">
                                {scadenza.nominativo}
                              </TableCell>
                              <TableCell className="text-sm">
                                {getUtenteNome(scadenza.utente_professionista_id)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {getUtenteNome(scadenza.utente_operatore_id)}
                              </TableCell>
                              
                              {/* Tipo Liq */}
                              <TableCell className="text-center">
                                <Select
                                  value={tipoLiq}
                                  onValueChange={(value) => handleUpdateField(scadenza.id, "tipo_liq", value)}
                                >
                                  <SelectTrigger className="w-20 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="M">M</SelectItem>
                                    <SelectItem value="T">T</SelectItem>
                                    <SelectItem value="CL">CL</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>

                              {/* TRIMESTRE 1 */}
                              <TableCell className="text-center bg-blue-50">
                                <input
                                  type="checkbox"
                                  checked={scadenza.gen || false}
                                  onChange={() => handleToggleField(scadenza.id, "gen", scadenza.gen)}
                                  disabled={!isMeseEnabled(scadenza, "gen")}
                                  className="rounded w-4 h-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </TableCell>
                              <TableCell className="text-center bg-blue-50">
                                <input
                                  type="checkbox"
                                  checked={scadenza.feb || false}
                                  onChange={() => handleToggleField(scadenza.id, "feb", scadenza.feb)}
                                  disabled={!isMeseEnabled(scadenza, "feb")}
                                  className="rounded w-4 h-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </TableCell>
                              <TableCell className="text-center bg-blue-50">
                                <input
                                  type="checkbox"
                                  checked={scadenza.mar || false}
                                  onChange={() => handleToggleField(scadenza.id, "mar", scadenza.mar)}
                                  disabled={!isMeseEnabled(scadenza, "mar")}
                                  className="rounded w-4 h-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </TableCell>
                              <TableCell className="text-center bg-blue-100">
                                <input
                                  type="checkbox"
                                  checked={scadenza.lipe1t || false}
                                  onChange={() => handleToggleField(scadenza.id, "lipe1t", scadenza.lipe1t)}
                                  className="rounded w-4 h-4 cursor-pointer"
                                />
                              </TableCell>
                              <TableCell className="text-center bg-blue-100">
                                <Input
                                  type="date"
                                  value={scadenza.lipe1t_invio || ""}
                                  onChange={(e) => handleUpdateField(scadenza.id, "lipe1t_invio", e.target.value)}
                                  className="w-36 text-xs"
                                />
                              </TableCell>

                              {/* TRIMESTRE 2 */}
                              <TableCell className="text-center bg-green-50">
                                <input
                                  type="checkbox"
                                  checked={scadenza.apr || false}
                                  onChange={() => handleToggleField(scadenza.id, "apr", scadenza.apr)}
                                  disabled={!isMeseEnabled(scadenza, "apr")}
                                  className="rounded w-4 h-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </TableCell>
                              <TableCell className="text-center bg-green-50">
                                <input
                                  type="checkbox"
                                  checked={scadenza.mag || false}
                                  onChange={() => handleToggleField(scadenza.id, "mag", scadenza.mag)}
                                  disabled={!isMeseEnabled(scadenza, "mag")}
                                  className="rounded w-4 h-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </TableCell>
                              <TableCell className="text-center bg-green-50">
                                <input
                                  type="checkbox"
                                  checked={scadenza.giu || false}
                                  onChange={() => handleToggleField(scadenza.id, "giu", scadenza.giu)}
                                  disabled={!isMeseEnabled(scadenza, "giu")}
                                  className="rounded w-4 h-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </TableCell>
                              <TableCell className="text-center bg-green-100">
                                <input
                                  type="checkbox"
                                  checked={scadenza.lipe2t || false}
                                  onChange={() => handleToggleField(scadenza.id, "lipe2t", scadenza.lipe2t)}
                                  className="rounded w-4 h-4 cursor-pointer"
                                />
                              </TableCell>
                              <TableCell className="text-center bg-green-100">
                                <Input
                                  type="date"
                                  value={scadenza.lipe2t_invio || ""}
                                  onChange={(e) => handleUpdateField(scadenza.id, "lipe2t_invio", e.target.value)}
                                  className="w-36 text-xs"
                                />
                              </TableCell>

                              {/* TRIMESTRE 3 */}
                              <TableCell className="text-center bg-yellow-50">
                                <input
                                  type="checkbox"
                                  checked={scadenza.lug || false}
                                  onChange={() => handleToggleField(scadenza.id, "lug", scadenza.lug)}
                                  disabled={!isMeseEnabled(scadenza, "lug")}
                                  className="rounded w-4 h-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </TableCell>
                              <TableCell className="text-center bg-yellow-50">
                                <input
                                  type="checkbox"
                                  checked={scadenza.ago || false}
                                  onChange={() => handleToggleField(scadenza.id, "ago", scadenza.ago)}
                                  disabled={!isMeseEnabled(scadenza, "ago")}
                                  className="rounded w-4 h-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </TableCell>
                              <TableCell className="text-center bg-yellow-50">
                                <input
                                  type="checkbox"
                                  checked={scadenza.set || false}
                                  onChange={() => handleToggleField(scadenza.id, "set", scadenza.set)}
                                  disabled={!isMeseEnabled(scadenza, "set")}
                                  className="rounded w-4 h-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </TableCell>
                              <TableCell className="text-center bg-yellow-100">
                                <input
                                  type="checkbox"
                                  checked={scadenza.lipe3t || false}
                                  onChange={() => handleToggleField(scadenza.id, "lipe3t", scadenza.lipe3t)}
                                  className="rounded w-4 h-4 cursor-pointer"
                                />
                              </TableCell>
                              <TableCell className="text-center bg-yellow-100">
                                <Input
                                  type="date"
                                  value={scadenza.lipe3t_invio || ""}
                                  onChange={(e) => handleUpdateField(scadenza.id, "lipe3t_invio", e.target.value)}
                                  className="w-36 text-xs"
                                />
                              </TableCell>

                              {/* TRIMESTRE 4 + ACCONTO */}
                              <TableCell className="text-center bg-red-50">
                                <input
                                  type="checkbox"
                                  checked={scadenza.ott || false}
                                  onChange={() => handleToggleField(scadenza.id, "ott", scadenza.ott)}
                                  disabled={!isMeseEnabled(scadenza, "ott")}
                                  className="rounded w-4 h-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </TableCell>
                              <TableCell className="text-center bg-red-50">
                                <input
                                  type="checkbox"
                                  checked={scadenza.nov || false}
                                  onChange={() => handleToggleField(scadenza.id, "nov", scadenza.nov)}
                                  disabled={!isMeseEnabled(scadenza, "nov")}
                                  className="rounded w-4 h-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </TableCell>
                              
                              {/* Acconto */}
                              <TableCell className="text-center bg-orange-100">
                                <Select
                                  value={acconto}
                                  onValueChange={(value) => handleUpdateField(scadenza.id, "acconto", value)}
                                  disabled={tipoLiq === "CL"}
                                >
                                  <SelectTrigger className="w-full text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Dovuto">Dovuto</SelectItem>
                                    <SelectItem value="Non dovuto">Non dovuto</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-center bg-orange-100">
                                <input
                                  type="checkbox"
                                  checked={scadenza.acconto_com || false}
                                  onChange={() => handleToggleField(scadenza.id, "acconto_com", scadenza.acconto_com)}
                                  disabled={!isAccontoComEnabled || tipoLiq === "CL"}
                                  className="rounded w-4 h-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </TableCell>
                              
                              <TableCell className="text-center bg-red-50">
                                <input
                                  type="checkbox"
                                  checked={scadenza.dic || false}
                                  onChange={() => handleToggleField(scadenza.id, "dic", scadenza.dic)}
                                  disabled={!isMeseEnabled(scadenza, "dic")}
                                  className="rounded w-4 h-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </TableCell>
                              <TableCell className="text-center bg-red-100">
                                <input
                                  type="checkbox"
                                  checked={scadenza.lipe4t || false}
                                  onChange={() => handleToggleField(scadenza.id, "lipe4t", scadenza.lipe4t)}
                                  className="rounded w-4 h-4 cursor-pointer"
                                />
                              </TableCell>
                              <TableCell className="text-center bg-red-100">
                                <Input
                                  type="date"
                                  value={scadenza.lipe4t_invio || ""}
                                  onChange={(e) => handleUpdateField(scadenza.id, "lipe4t_invio", e.target.value)}
                                  className="w-36 text-xs"
                                />
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
                <div className="space-y-3">
                  <div className="font-semibold text-gray-900 mb-2">📋 Legenda Colori e Funzionalità:</div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium mb-1">Tipo Liquidazione:</p>
                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                        <li><strong>M (Mensile)</strong>: Tutti i mesi attivi</li>
                        <li><strong>T (Trimestrale)</strong>: Solo Mar, Giu, Set, Dic attivi</li>
                        <li><strong>CL (Contribuenti Lipe)</strong>: Solo Lipe attivi, mesi disabilitati</li>
                      </ul>
                    </div>
                    
                    <div>
                      <p className="font-medium mb-1">Acconto IVA (4° Trimestre):</p>
                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                        <li><strong>Dovuto</strong>: Acconto Com abilitato</li>
                        <li><strong>Non dovuto</strong>: Acconto Com disabilitato</li>
                        <li><strong>CL</strong>: Campo Acconto disabilitato</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-100 border border-blue-200 rounded"></div>
                      <span>Trimestre 1 (Gen-Feb-Mar)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-green-100 border border-green-200 rounded"></div>
                      <span>Trimestre 2 (Apr-Mag-Giu)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-yellow-100 border border-yellow-200 rounded"></div>
                      <span>Trimestre 3 (Lug-Ago-Set)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-red-100 border border-red-200 rounded"></div>
                      <span>Trimestre 4 (Ott-Nov-Dic)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-orange-100 border border-orange-200 rounded"></div>
                      <span>Acconto IVA</span>
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