import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type ScadenzaEsterometroRow = Database["public"]["Tables"]["tbscadestero"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

type ScadenzaEsterometro = ScadenzaEsterometroRow & {
  professionista?: string;
  operatore?: string;
};

const MONTHS = [
  { prefix: "gen", label: "Gen", index: 1 },
  { prefix: "feb", label: "Feb", index: 2 },
  { prefix: "mar", label: "Mar", index: 3 },
  { prefix: "apr", label: "Apr", index: 4 },
  { prefix: "mag", label: "Mag", index: 5 },
  { prefix: "giu", label: "Giu", index: 6 },
  { prefix: "lug", label: "Lug", index: 7 },
  { prefix: "ago", label: "Ago", index: 8 },
  { prefix: "set", label: "Set", index: 9 },
  { prefix: "ott", label: "Ott", index: 10 },
  { prefix: "nov", label: "Nov", index: 11 },
  { prefix: "dic", label: "Dic", index: 12 },
];

export default function ScadenzeEsterometroPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaEsterometro[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [filterProfessionista, setFilterProfessionista] = useState("__all__");
  
  const [stats, setStats] = useState({
    totale: 0,
    confermate: 0,
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
      
      setStats({
        totale: scadenzeData.length,
        confermate: 0,
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

  const loadScadenze = async (): Promise<ScadenzaEsterometro[]> => {
    const { data, error } = await supabase
      .from("tbscadestero")
      .select(`
        *,
        professionista:tbutenti!tbscadestero_utente_professionista_id_fkey(nome, cognome),
        operatore:tbutenti!tbscadestero_utente_operatore_id_fkey(nome, cognome)
      `)
      .order("nominativo", { ascending: true });
    
    if (error) {
      console.error("Errore query:", error);
      throw error;
    }
    
    return (data || []).map((record: any) => ({
      ...record,
      professionista: record.professionista 
        ? `${record.professionista.nome} ${record.professionista.cognome}`
        : "-",
      operatore: record.operatore
        ? `${record.operatore.nome} ${record.operatore.cognome}`
        : "-"
    })) as ScadenzaEsterometro[];
  };

  const loadUtenti = async (): Promise<Utente[]> => {
    const { data, error } = await supabase
      .from("tbutenti")
      .select("*")
      .order("cognome", { ascending: true });
    
    if (error) throw error;
    return data || [];
  };

  const handleToggleField = async (scadenzaId: string, field: keyof ScadenzaEsterometro, currentValue: boolean | null) => {
    try {
      const newValue = !currentValue;
      
      setScadenze(prev => prev.map(s => 
        s.id === scadenzaId ? { ...s, [field]: newValue } : s
      ));
      
      const { error } = await supabase
        .from("tbscadestero")
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

  const handleUpdateField = async (scadenzaId: string, field: keyof ScadenzaEsterometro, value: any) => {
    try {
      const { error } = await supabase
        .from("tbscadestero")
        .update({ [field]: value === "" ? null : value })
        .eq("id", scadenzaId);
      
      if (error) throw error;
      
      setScadenze(prev => prev.map(s => 
        s.id === scadenzaId ? { ...s, [field]: value === "" ? null : value } : s
      ));
    } catch (error: any) {
      toast({
        title: "Errore aggiornamento",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const filteredScadenze = scadenze.filter(s => {
    const matchSearch = (s.nominativo || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchOperatore = filterOperatore === "__all__" || s.utente_operatore_id === filterOperatore;
    const matchProfessionista = filterProfessionista === "__all__" || s.utente_professionista_id === filterProfessionista;
    return matchSearch && matchOperatore && matchProfessionista;
  });

  const calculateTotalDocs = (row: ScadenzaEsterometro) => {
    let sum = 0;
    for (let i = 1; i <= 12; i++) {
      const val = row[`nmese${i}` as keyof ScadenzaEsterometro];
      if (typeof val === 'number') {
        sum += val;
      }
    }
    return sum;
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
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario Esterometro</h1>
          <p className="text-gray-500 mt-1">Gestione scadenze Esterometro mensili</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Totale Record</div>
            <div className="text-3xl font-bold text-gray-900">{stats.totale}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtri e Ricerca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Cerca nominativo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div>
              <Select value={filterOperatore} onValueChange={setFilterOperatore}>
                <SelectTrigger>
                  <SelectValue placeholder="Utente Operatore" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti gli operatori</SelectItem>
                  {utenti.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} {u.cognome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={filterProfessionista} onValueChange={setFilterProfessionista}>
                <SelectTrigger>
                  <SelectValue placeholder="Utente Professionista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti i professionisti</SelectItem>
                  {utenti.map(u => (
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
          <div className="relative w-full overflow-auto max-h-[600px]">
            <table className="w-full caption-bottom text-sm border-collapse">
              <thead className="[&_tr]:border-b sticky top-0 z-30 bg-white shadow-sm">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 sticky left-0 z-40 min-w-[200px] bg-white border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Nominativo</th>
                  <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 min-w-[150px] border-r">Operatore</th>
                  <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 min-w-[150px] border-r">Professionista</th>
                  
                  {MONTHS.map(month => (
                    <th key={month.prefix} colSpan={3} className="h-12 px-2 text-center align-middle font-medium text-muted-foreground border-r border-l border-gray-200 bg-gray-50/50">
                      {month.label}
                    </th>
                  ))}
                  
                  <th className="h-12 px-2 text-center align-middle font-bold text-gray-900 [&:has([role=checkbox])]:pr-0 min-w-[80px] bg-gray-100">Tot Doc</th>
                </tr>
                <tr className="border-b text-xs text-gray-500 bg-gray-50">
                  <th className="bg-white sticky left-0 z-40 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"></th>
                  <th className="bg-white border-r"></th>
                  <th className="bg-white border-r"></th>
                  {MONTHS.map(month => (
                    <>
                      <th key={`${month.prefix}-prev`} className="px-1 py-1 text-center font-normal border-l" style={{ width: '60px', minWidth: '60px' }}>Prev</th>
                      <th key={`${month.prefix}-inv`} className="px-1 py-1 text-center font-normal" style={{ width: '60px', minWidth: '60px' }}>Inv</th>
                      <th key={`${month.prefix}-num`} className="px-1 py-1 text-center font-normal border-r" style={{ width: '60px', minWidth: '60px' }}>N. Doc</th>
                    </>
                  ))}
                  <th className="bg-gray-100"></th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {filteredScadenze.length === 0 ? (
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td colSpan={40} className="p-4 text-center text-gray-500">
                      Nessun record trovato
                    </td>
                  </tr>
                ) : (
                  filteredScadenze.map((scadenza) => (
                    <tr key={scadenza.id} className="border-b transition-colors hover:bg-green-50 data-[state=selected]:bg-muted group">
                      <td className="p-2 align-middle sticky left-0 z-20 border-r font-medium min-w-[200px] bg-white group-hover:bg-green-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        {scadenza.nominativo}
                      </td>
                      <td className="p-2 align-middle min-w-[150px] border-r text-xs">{scadenza.operatore}</td>
                      <td className="p-2 align-middle min-w-[150px] border-r text-xs">{scadenza.professionista}</td>

                      {MONTHS.map(month => (
                        <>
                          <td key={`${scadenza.id}-${month.prefix}-prev`} className="p-1 align-middle text-center border-l bg-gray-50/30" style={{ width: '60px', minWidth: '60px' }}>
                            <Checkbox
                              checked={(scadenza as any)[`${month.prefix}_previsto`] || false}
                              onCheckedChange={() => handleToggleField(scadenza.id, `${month.prefix}_previsto` as keyof ScadenzaEsterometro, (scadenza as any)[`${month.prefix}_previsto`])}
                            />
                          </td>
                          <td key={`${scadenza.id}-${month.prefix}-inv`} className="p-1 align-middle text-center bg-gray-50/30" style={{ width: '60px', minWidth: '60px' }}>
                            <Checkbox
                              checked={(scadenza as any)[`${month.prefix}_invio`] || false}
                              onCheckedChange={() => handleToggleField(scadenza.id, `${month.prefix}_invio` as keyof ScadenzaEsterometro, (scadenza as any)[`${month.prefix}_invio`])}
                            />
                          </td>
                          <td key={`${scadenza.id}-${month.prefix}-num`} className="p-1 align-middle border-r bg-gray-50/30" style={{ width: '60px', minWidth: '60px' }}>
                            <Input
                              type="number"
                              className="h-8 w-full text-center px-1"
                              style={{ width: '60px', minWidth: '60px' }}
                              value={(scadenza as any)[`nmese${month.index}`] ?? ""}
                              onChange={(e) => handleUpdateField(scadenza.id, `nmese${month.index}` as keyof ScadenzaEsterometro, e.target.value)}
                            />
                          </td>
                        </>
                      ))}

                      <td className="p-2 align-middle text-center font-bold bg-gray-100 min-w-[80px]">
                        {calculateTotalDocs(scadenza)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}