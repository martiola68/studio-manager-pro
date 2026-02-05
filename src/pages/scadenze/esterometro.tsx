import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/supabase/types";

type ScadenzaEstero = Database["public"]["Tables"]["tbscadestero"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

export default function ScadenzeEsterometroPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaEstero[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [filterProfessionista, setFilterProfessionista] = useState("__all__");

  const [stats, setStats] = useState({
    totale: 0,
    docTotali: 0
  });

  const mesi = [
    { key: "gen", label: "Gen" },
    { key: "feb", label: "Feb" },
    { key: "mar", label: "Mar" },
    { key: "apr", label: "Apr" },
    { key: "mag", label: "Mag" },
    { key: "giu", label: "Giu" },
    { key: "lug", label: "Lug" },
    { key: "ago", label: "Ago" },
    { key: "set", label: "Set" },
    { key: "ott", label: "Ott" },
    { key: "nov", label: "Nov" },
    { key: "dic", label: "Dic" }
  ];

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
      
      const docTotali = scadenzeData.reduce((acc, curr) => acc + (curr.tot_doc || 0), 0);
      setStats({
        totale: scadenzeData.length,
        docTotali
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

  const loadScadenze = async (): Promise<ScadenzaEstero[]> => {
    const { data, error } = await supabase
      .from("tbscadestero")
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

  const handleToggleField = async (scadenzaId: string, field: keyof ScadenzaEstero, currentValue: any) => {
    try {
      const newValue = !currentValue;
      
      setScadenze(prev => prev.map(s => 
        s.id === scadenzaId ? { ...s, [field]: newValue } : s
      ));
      
      const updates: any = { [field]: newValue };
      const { error } = await supabase
        .from("tbscadestero")
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

  const handleUpdateNumDoc = async (scadenzaId: string, meseKey: string, value: string) => {
    try {
      const numValue = parseInt(value) || 0;
      const field = `nmese${mesi.findIndex(m => m.key === meseKey) + 1}` as keyof ScadenzaEstero;
      
      setScadenze(prev => prev.map(s => 
        s.id === scadenzaId ? { ...s, [field]: numValue } : s
      ));

      const updates: any = { [field]: numValue };
      const { error } = await supabase
        .from("tbscadestero")
        .update(updates)
        .eq("id", scadenzaId);

      if (error) throw error;
    } catch (error) {
      console.error("Errore aggiornamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il numero documenti",
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
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario Esterometro</h1>
          <p className="text-gray-500 mt-1">Gestione comunicazioni operazioni transfrontaliere</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Totale Clienti</div>
            <div className="text-3xl font-bold text-gray-900">{stats.totale}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Documenti Totali</div>
            <div className="text-3xl font-bold text-blue-600">{stats.docTotali}</div>
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
                      <TableHead className="sticky left-0 z-30 bg-white border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[200px]">Nominativo</TableHead>
                      <TableHead className="min-w-[180px]">Professionista</TableHead>
                      <TableHead className="min-w-[180px]">Operatore</TableHead>
                      {mesi.map(mese => (
                        <TableHead key={mese.key} className="min-w-[120px] text-center border-l bg-gray-50/50">
                          {mese.label}
                          <div className="flex justify-between text-[10px] font-normal text-gray-500 px-1 mt-1">
                            <span>Prev.</span>
                            <span>Invio</span>
                            <span>N.Doc</span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableBody>
                    {filteredScadenze.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={15} className="text-center py-8 text-gray-500">
                          Nessun record trovato
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredScadenze.map((scadenza) => (
                        <TableRow key={scadenza.id}>
                          <TableCell className="sticky left-0 z-10 bg-inherit border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-medium min-w-[200px]">
                            {scadenza.nominativo}
                          </TableCell>
                          <TableCell className="min-w-[180px]">{getUtenteNome(scadenza.utente_professionista_id)}</TableCell>
                          <TableCell className="min-w-[180px]">{getUtenteNome(scadenza.utente_operatore_id)}</TableCell>
                          {mesi.map((mese, index) => {
                            const prevField = `${mese.key}_previsto` as keyof ScadenzaEstero;
                            const invioField = `${mese.key}_invio` as keyof ScadenzaEstero;
                            const numField = `nmese${index + 1}` as keyof ScadenzaEstero;
                            
                            return (
                              <TableCell key={mese.key} className="min-w-[120px] border-l p-1">
                                <div className="flex items-center justify-between gap-1">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(scadenza[prevField])}
                                    onChange={() => handleToggleField(scadenza.id, prevField, scadenza[prevField])}
                                    className="rounded w-3 h-3 cursor-pointer"
                                  />
                                  <input
                                    type="checkbox"
                                    checked={Boolean(scadenza[invioField])}
                                    onChange={() => handleToggleField(scadenza.id, invioField, scadenza[invioField])}
                                    className="rounded w-3 h-3 cursor-pointer"
                                  />
                                  <input
                                    type="number"
                                    value={Number(scadenza[numField]) || 0}
                                    onChange={(e) => handleUpdateNumDoc(scadenza.id, mese.key, e.target.value)}
                                    className="w-8 h-6 text-xs text-center border rounded p-0"
                                    min="0"
                                  />
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}