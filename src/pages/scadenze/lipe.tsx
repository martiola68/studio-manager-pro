import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/supabase/types";

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

  const [stats, setStats] = useState({
    totale: 0,
    lipeInviate: 0,
    lipeDaInviare: 0
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
      
      const lipeInviate = scadenzeData.filter(s => 
        s.lipe1t || s.lipe2t || s.lipe3t || s.lipe4t
      ).length;
      
      setStats({
        totale: scadenzeData.length,
        lipeInviate,
        lipeDaInviare: scadenzeData.length - lipeInviate
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

  const handleToggleField = async (scadenzaId: string, field: keyof ScadenzaLipe, currentValue: boolean | null) => {
    try {
      const newValue = !currentValue;
      
      setScadenze(prev => prev.map(s => 
        s.id === scadenzaId ? { ...s, [field]: newValue } : s
      ));
      
      const { error } = await supabase
        .from("tbscadlipe")
        .update({ [field]: newValue })
        .eq("id", scadenzaId);

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Errore aggiornamento",
        description: error.message,
        variant: "destructive"
      });
      await loadData();
    }
  };

  const handleUpdateField = async (scadenzaId: string, field: keyof ScadenzaLipe, value: any) => {
    try {
      const { error } = await supabase
        .from("tbscadlipe")
        .update({ [field]: value || null })
        .eq("id", scadenzaId);
      
      if (error) throw error;
      
      setScadenze(prev => prev.map(s => 
        s.id === scadenzaId ? { ...s, [field]: value } : s
      ));
    } catch (error: any) {
      toast({
        title: "Errore aggiornamento",
        description: error.message,
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

  const isMeseEnabled = (scadenza: ScadenzaLipe, mese: string): boolean => {
    const tipoLiq = scadenza.tipo_liq;
    if (tipoLiq === "CL") return false;
    if (tipoLiq === "M") return true;
    if (tipoLiq === "T") {
      return ["mar", "giu", "set", "dic"].includes(mese);
    }
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">LIPE</h1>
          <p className="text-gray-500 mt-1">Liquidazioni Periodiche IVA</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Totale Contribuenti</div>
            <div className="text-3xl font-bold text-gray-900">{stats.totale}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Con LIPE Inviate</div>
            <div className="text-3xl font-bold text-green-600">{stats.lipeInviate}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Senza LIPE</div>
            <div className="text-3xl font-bold text-orange-600">{stats.lipeDaInviare}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtri e Ricerca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Cerca Nominativo</label>
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

            <div>
              <label className="text-sm font-medium mb-2 block">Utente Operatore</label>
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

            <div>
              <label className="text-sm font-medium mb-2 block">Utente Professionista</label>
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
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="sticky top-0 z-20 bg-white border-b">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-30 bg-white min-w-[200px] border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Nominativo</TableHead>
                      <TableHead className="min-w-[150px]">Professionista</TableHead>
                      <TableHead className="min-w-[150px]">Operatore</TableHead>
                      <TableHead className="text-center min-w-[100px]">Tipo Liq</TableHead>
                      <TableHead className="text-center min-w-[80px] bg-blue-50">Gen</TableHead>
                      <TableHead className="text-center min-w-[80px] bg-blue-50">Feb</TableHead>
                      <TableHead className="text-center min-w-[80px] bg-blue-50">Mar</TableHead>
                      <TableHead className="text-center min-w-[100px] bg-blue-100">Lipe 1T</TableHead>
                      <TableHead className="text-center min-w-[140px] bg-blue-100">Data Invio 1T</TableHead>
                      <TableHead className="text-center min-w-[80px] bg-green-50">Apr</TableHead>
                      <TableHead className="text-center min-w-[80px] bg-green-50">Mag</TableHead>
                      <TableHead className="text-center min-w-[80px] bg-green-50">Giu</TableHead>
                      <TableHead className="text-center min-w-[100px] bg-green-100">Lipe 2T</TableHead>
                      <TableHead className="text-center min-w-[140px] bg-green-100">Data Invio 2T</TableHead>
                      <TableHead className="text-center min-w-[80px] bg-yellow-50">Lug</TableHead>
                      <TableHead className="text-center min-w-[80px] bg-yellow-50">Ago</TableHead>
                      <TableHead className="text-center min-w-[80px] bg-yellow-50">Set</TableHead>
                      <TableHead className="text-center min-w-[100px] bg-yellow-100">Lipe 3T</TableHead>
                      <TableHead className="text-center min-w-[140px] bg-yellow-100">Data Invio 3T</TableHead>
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
                </Table>
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableBody>
                    {filteredScadenze.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={27} className="text-center py-8 text-gray-500">
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
                            <TableCell className="font-medium sticky left-0 z-10 bg-white min-w-[200px] border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                              {scadenza.nominativo}
                            </TableCell>
                            <TableCell className="min-w-[150px]">
                              {getUtenteNome(scadenza.utente_professionista_id)}
                            </TableCell>
                            <TableCell className="min-w-[150px]">
                              {getUtenteNome(scadenza.utente_operatore_id)}
                            </TableCell>
                            <TableCell className="text-center min-w-[100px]">
                              <Select
                                value={tipoLiq}
                                onValueChange={(value) => handleUpdateField(scadenza.id, "tipo_liq", value)}
                              >
                                <SelectTrigger className="w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="M">M</SelectItem>
                                  <SelectItem value="T">T</SelectItem>
                                  <SelectItem value="CL">CL</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-center min-w-[80px] bg-blue-50">
                              <Checkbox
                                checked={scadenza.gen || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "gen", scadenza.gen)}
                                disabled={!isMeseEnabled(scadenza, "gen")}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[80px] bg-blue-50">
                              <Checkbox
                                checked={scadenza.feb || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "feb", scadenza.feb)}
                                disabled={!isMeseEnabled(scadenza, "feb")}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[80px] bg-blue-50">
                              <Checkbox
                                checked={scadenza.mar || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "mar", scadenza.mar)}
                                disabled={!isMeseEnabled(scadenza, "mar")}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[100px] bg-blue-100">
                              <Checkbox
                                checked={scadenza.lipe1t || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "lipe1t", scadenza.lipe1t)}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[140px] bg-blue-100">
                              <Input
                                type="date"
                                value={scadenza.lipe1t_invio || ""}
                                onChange={(e) => handleUpdateField(scadenza.id, "lipe1t_invio", e.target.value)}
                                className="w-full"
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[80px] bg-green-50">
                              <Checkbox
                                checked={scadenza.apr || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "apr", scadenza.apr)}
                                disabled={!isMeseEnabled(scadenza, "apr")}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[80px] bg-green-50">
                              <Checkbox
                                checked={scadenza.mag || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "mag", scadenza.mag)}
                                disabled={!isMeseEnabled(scadenza, "mag")}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[80px] bg-green-50">
                              <Checkbox
                                checked={scadenza.giu || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "giu", scadenza.giu)}
                                disabled={!isMeseEnabled(scadenza, "giu")}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[100px] bg-green-100">
                              <Checkbox
                                checked={scadenza.lipe2t || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "lipe2t", scadenza.lipe2t)}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[140px] bg-green-100">
                              <Input
                                type="date"
                                value={scadenza.lipe2t_invio || ""}
                                onChange={(e) => handleUpdateField(scadenza.id, "lipe2t_invio", e.target.value)}
                                className="w-full"
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[80px] bg-yellow-50">
                              <Checkbox
                                checked={scadenza.lug || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "lug", scadenza.lug)}
                                disabled={!isMeseEnabled(scadenza, "lug")}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[80px] bg-yellow-50">
                              <Checkbox
                                checked={scadenza.ago || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "ago", scadenza.ago)}
                                disabled={!isMeseEnabled(scadenza, "ago")}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[80px] bg-yellow-50">
                              <Checkbox
                                checked={scadenza.set || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "set", scadenza.set)}
                                disabled={!isMeseEnabled(scadenza, "set")}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[100px] bg-yellow-100">
                              <Checkbox
                                checked={scadenza.lipe3t || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "lipe3t", scadenza.lipe3t)}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[140px] bg-yellow-100">
                              <Input
                                type="date"
                                value={scadenza.lipe3t_invio || ""}
                                onChange={(e) => handleUpdateField(scadenza.id, "lipe3t_invio", e.target.value)}
                                className="w-full"
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[80px] bg-red-50">
                              <Checkbox
                                checked={scadenza.ott || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "ott", scadenza.ott)}
                                disabled={!isMeseEnabled(scadenza, "ott")}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[80px] bg-red-50">
                              <Checkbox
                                checked={scadenza.nov || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "nov", scadenza.nov)}
                                disabled={!isMeseEnabled(scadenza, "nov")}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[120px] bg-orange-100">
                              <Select
                                value={acconto}
                                onValueChange={(value) => handleUpdateField(scadenza.id, "acconto", value)}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Dovuto">Dovuto</SelectItem>
                                  <SelectItem value="Non dovuto">Non dovuto</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-center min-w-[120px] bg-orange-100">
                              <Checkbox
                                checked={scadenza.acconto_com || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "acconto_com", scadenza.acconto_com)}
                                disabled={!isAccontoComEnabled}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[80px] bg-red-50">
                              <Checkbox
                                checked={scadenza.dic || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "dic", scadenza.dic)}
                                disabled={!isMeseEnabled(scadenza, "dic")}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[100px] bg-red-100">
                              <Checkbox
                                checked={scadenza.lipe4t || false}
                                onCheckedChange={() => handleToggleField(scadenza.id, "lipe4t", scadenza.lipe4t)}
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[140px] bg-red-100">
                              <Input
                                type="date"
                                value={scadenza.lipe4t_invio || ""}
                                onChange={(e) => handleUpdateField(scadenza.id, "lipe4t_invio", e.target.value)}
                                className="w-full"
                              />
                            </TableCell>
                            <TableCell className="text-center min-w-[100px]">
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
            </div>
          </div>
        </CardContent>
      </Card>

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
                  <li><strong>CL</strong>: Campo Acconto attivo</li>
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
  );
}