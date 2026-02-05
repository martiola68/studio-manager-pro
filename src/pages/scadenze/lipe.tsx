import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  const [filterTipoLiq, setFilterTipoLiq] = useState("__all__");

  const [stats, setStats] = useState({
    totale: 0,
    conLipe: 0,
    senzaLipe: 0
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
      
      const conLipe = scadenzeData.filter(s => s.tipo_liq && s.tipo_liq !== "N").length;
      setStats({
        totale: scadenzeData.length,
        conLipe,
        senzaLipe: scadenzeData.length - conLipe
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

  const handleToggleField = async (scadenzaId: string, field: keyof ScadenzaLipe, currentValue: any) => {
    try {
      const newValue = !currentValue;
      
      setScadenze(prev => prev.map(s => 
        s.id === scadenzaId ? { ...s, [field]: newValue } : s
      ));
      
      const updates: any = { [field]: newValue };
      const { error } = await supabase
        .from("tbscadlipe")
        .update(updates)
        .eq("id", scadenzaId);

      if (error) throw error;
    } catch (error) {
      console.error("Errore aggiornamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il campo",
        variant: "destructive"
      });
      await loadData();
    }
  };

  const handleUpdateField = async (scadenzaId: string, field: keyof ScadenzaLipe, value: any) => {
    try {
      setScadenze(prev => prev.map(s => 
        s.id === scadenzaId ? { ...s, [field]: value } : s
      ));

      const updates: any = { [field]: value || null };
      
      const { error } = await supabase
        .from("tbscadlipe")
        .update(updates)
        .eq("id", scadenzaId);

      if (error) throw error;
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
    const matchTipoLiq = filterTipoLiq === "__all__" || s.tipo_liq === filterTipoLiq;
    return matchSearch && matchOperatore && matchProfessionista && matchTipoLiq;
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
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario LIPE</h1>
          <p className="text-gray-500 mt-1">Gestione liquidazioni IVA periodiche</p>
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
            <div className="text-3xl font-bold text-green-600">{stats.conLipe}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Senza LIPE</div>
            <div className="text-3xl font-bold text-orange-600">{stats.senzaLipe}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtri e Ricerca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Cerca Nominativo</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
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
                  {utenti.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome} {u.cognome}</SelectItem>
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
                  {utenti.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome} {u.cognome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Tipo Liquidazione</label>
              <Select value={filterTipoLiq} onValueChange={setFilterTipoLiq}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti</SelectItem>
                  <SelectItem value="M">Mensile</SelectItem>
                  <SelectItem value="T">Trimestrale</SelectItem>
                  <SelectItem value="N">Nessuna</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {/* Header fisso separato */}
            <div className="sticky top-0 z-10 bg-white border-b">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="sticky left-0 z-20 bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-900 min-w-[200px] border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      Nominativo
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 min-w-[150px]">Professionista</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 min-w-[150px]">Operatore</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 min-w-[100px]">Tipo Liq</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[80px]">Gen</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[80px]">Feb</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[80px]">Mar</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[120px]">Lipe 1T</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[150px]">Data Invio 1T</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[80px]">Apr</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[80px]">Mag</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[80px]">Giu</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[120px]">Lipe 2T</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[150px]">Data Invio 2T</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[80px]">Lug</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[80px]">Ago</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[80px]">Set</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[120px]">Lipe 3T</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[150px]">Data Invio 3T</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[80px]">Ott</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[80px]">Nov</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[80px]">Dic</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[120px]">Lipe 4T</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[150px]">Data Invio 4T</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[100px]">Azioni</th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* Body scrollabile */}
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <tbody>
                  {filteredScadenze.length === 0 ? (
                    <tr>
                      <td colSpan={25} className="text-center py-8 text-gray-500">
                        Nessun record trovato
                      </td>
                    </tr>
                  ) : (
                    filteredScadenze.map((scadenza) => (
                      <tr key={scadenza.id} className="border-b hover:bg-gray-50">
                        <td className="sticky left-0 z-10 bg-inherit px-4 py-3 font-medium text-sm min-w-[200px] border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                          {scadenza.nominativo}
                        </td>
                        <td className="px-4 py-3 text-sm min-w-[150px]">{getUtenteNome(scadenza.utente_professionista_id)}</td>
                        <td className="px-4 py-3 text-sm min-w-[150px]">{getUtenteNome(scadenza.utente_operatore_id)}</td>
                        <td className="px-4 py-3 text-sm min-w-[100px]">
                          <Select
                            value={scadenza.tipo_liq || "N"}
                            onValueChange={(value) => handleUpdateField(scadenza.id, "tipo_liq", value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="M">Mensile</SelectItem>
                              <SelectItem value="T">Trimestrale</SelectItem>
                              <SelectItem value="N">Nessuna</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3 text-center min-w-[80px]">
                          <input
                            type="checkbox"
                            checked={scadenza.gen || false}
                            onChange={() => handleToggleField(scadenza.id, "gen", scadenza.gen)}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[80px]">
                          <input
                            type="checkbox"
                            checked={scadenza.feb || false}
                            onChange={() => handleToggleField(scadenza.id, "feb", scadenza.feb)}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[80px]">
                          <input
                            type="checkbox"
                            checked={scadenza.mar || false}
                            onChange={() => handleToggleField(scadenza.id, "mar", scadenza.mar)}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[120px]">
                          <input
                            type="checkbox"
                            checked={scadenza.lipe1t || false}
                            onChange={() => handleToggleField(scadenza.id, "lipe1t", scadenza.lipe1t)}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[150px]">
                          <Input
                            type="date"
                            value={scadenza.lipe1t_invio || ""}
                            onChange={(e) => handleUpdateField(scadenza.id, "lipe1t_invio", e.target.value)}
                            className="w-full text-xs"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[80px]">
                          <input
                            type="checkbox"
                            checked={scadenza.apr || false}
                            onChange={() => handleToggleField(scadenza.id, "apr", scadenza.apr)}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[80px]">
                          <input
                            type="checkbox"
                            checked={scadenza.mag || false}
                            onChange={() => handleToggleField(scadenza.id, "mag", scadenza.mag)}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[80px]">
                          <input
                            type="checkbox"
                            checked={scadenza.giu || false}
                            onChange={() => handleToggleField(scadenza.id, "giu", scadenza.giu)}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[120px]">
                          <input
                            type="checkbox"
                            checked={scadenza.lipe2t || false}
                            onChange={() => handleToggleField(scadenza.id, "lipe2t", scadenza.lipe2t)}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[150px]">
                          <Input
                            type="date"
                            value={scadenza.lipe2t_invio || ""}
                            onChange={(e) => handleUpdateField(scadenza.id, "lipe2t_invio", e.target.value)}
                            className="w-full text-xs"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[80px]">
                          <input
                            type="checkbox"
                            checked={scadenza.lug || false}
                            onChange={() => handleToggleField(scadenza.id, "lug", scadenza.lug)}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[80px]">
                          <input
                            type="checkbox"
                            checked={scadenza.ago || false}
                            onChange={() => handleToggleField(scadenza.id, "ago", scadenza.ago)}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[80px]">
                          <input
                            type="checkbox"
                            checked={scadenza.set || false}
                            onChange={() => handleToggleField(scadenza.id, "set", scadenza.set)}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[120px]">
                          <input
                            type="checkbox"
                            checked={scadenza.lipe3t || false}
                            onChange={() => handleToggleField(scadenza.id, "lipe3t", scadenza.lipe3t)}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[150px]">
                          <Input
                            type="date"
                            value={scadenza.lipe3t_invio || ""}
                            onChange={(e) => handleUpdateField(scadenza.id, "lipe3t_invio", e.target.value)}
                            className="w-full text-xs"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[80px]">
                          <input
                            type="checkbox"
                            checked={scadenza.ott || false}
                            onChange={() => handleToggleField(scadenza.id, "ott", scadenza.ott)}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[80px]">
                          <input
                            type="checkbox"
                            checked={scadenza.nov || false}
                            onChange={() => handleToggleField(scadenza.id, "nov", scadenza.nov)}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[80px]">
                          <input
                            type="checkbox"
                            checked={scadenza.dic || false}
                            onChange={() => handleToggleField(scadenza.id, "dic", scadenza.dic)}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[120px]">
                          <input
                            type="checkbox"
                            checked={scadenza.lipe4t || false}
                            onChange={() => handleToggleField(scadenza.id, "lipe4t", scadenza.lipe4t)}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[150px]">
                          <Input
                            type="date"
                            value={scadenza.lipe4t_invio || ""}
                            onChange={(e) => handleUpdateField(scadenza.id, "lipe4t_invio", e.target.value)}
                            className="w-full text-xs"
                          />
                        </td>
                        <td className="px-4 py-3 text-center min-w-[100px]">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(scadenza.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}