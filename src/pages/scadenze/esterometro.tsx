import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type ScadenzaEstero = Database["public"]["Tables"]["tbscadestero"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

const MESI = [
  { nome: "Gennaio", previsto: "gen_previsto", invio: "gen_invio", ndoc: "nmese1" },
  { nome: "Febbraio", previsto: "feb_previsto", invio: "feb_invio", ndoc: "nmese2" },
  { nome: "Marzo", previsto: "mar_previsto", invio: "mar_invio", ndoc: "nmese3" },
  { nome: "Aprile", previsto: "apr_previsto", invio: "apr_invio", ndoc: "nmese4" },
  { nome: "Maggio", previsto: "mag_previsto", invio: "mag_invio", ndoc: "nmese5" },
  { nome: "Giugno", previsto: "giu_previsto", invio: "giu_invio", ndoc: "nmese6" },
  { nome: "Luglio", previsto: "lug_previsto", invio: "lug_invio", ndoc: "nmese7" },
  { nome: "Agosto", previsto: "ago_previsto", invio: "ago_invio", ndoc: "nmese8" },
  { nome: "Settembre", previsto: "set_previsto", invio: "set_invio", ndoc: "nmese9" },
  { nome: "Ottobre", previsto: "ott_previsto", invio: "ott_invio", ndoc: "nmese10" },
  { nome: "Novembre", previsto: "nov_previsto", invio: "nov_invio", ndoc: "nmese11" },
  { nome: "Dicembre", previsto: "dic_previsto", invio: "dic_invio", ndoc: "nmese12" }
];

export default function ScadenzeEsterometroPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaEstero[]>([]);
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

  const handleToggleField = async (scadenzaId: string, field: string, currentValue: boolean | null) => {
    try {
      const updates: any = {};
      updates[field] = !currentValue;
      
      const { error } = await supabase
        .from("tbscadestero")
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

  const handleUpdateNumeric = async (scadenzaId: string, field: string, value: string) => {
    try {
      const numValue = value === "" ? 0 : parseInt(value, 10);
      if (isNaN(numValue)) return;

      const updates: any = {};
      updates[field] = numValue;
      
      const { error } = await supabase
        .from("tbscadestero")
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
        .from("tbscadestero")
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
          <h1 className="text-3xl font-bold text-gray-900">Esterometro</h1>
          <p className="text-gray-500 mt-1">Gestione comunicazioni operazioni transfrontaliere</p>
        </div>
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
                  
                  {MESI.map((mese) => (
                    <TableHead key={mese.nome} className="text-center min-w-[180px] border-l">
                      <div className="font-bold">{mese.nome}</div>
                      <div className="grid grid-cols-3 gap-1 text-xs font-normal mt-1">
                        <span>Prev.</span>
                        <span>Inv.</span>
                        <span>N.Doc</span>
                      </div>
                    </TableHead>
                  ))}
                  
                  <TableHead className="text-center min-w-[100px] bg-blue-50 border-l-4 border-blue-400">
                    <div className="font-bold text-blue-900">Tot Doc</div>
                  </TableHead>
                  <TableHead className="text-center min-w-[100px]">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredScadenze.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={17} className="text-center py-8 text-gray-500">
                      Nessuna scadenza trovata
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredScadenze.map((scadenza) => (
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
                      
                      {MESI.map((mese) => {
                        const previsto = scadenza[mese.previsto as keyof ScadenzaEstero] as boolean;
                        const invio = scadenza[mese.invio as keyof ScadenzaEstero] as boolean;
                        const ndoc = scadenza[mese.ndoc as keyof ScadenzaEstero] as number;
                        
                        return (
                          <TableCell 
                            key={mese.nome} 
                            className={`text-center border-l ${invio ? 'bg-green-50' : ''}`}
                          >
                            <div className="grid grid-cols-3 gap-1 items-center">
                              {/* Previsto */}
                              <div className="flex justify-center">
                                <input
                                  type="checkbox"
                                  checked={previsto || false}
                                  onChange={() => handleToggleField(scadenza.id, mese.previsto, previsto)}
                                  className="rounded w-4 h-4 cursor-pointer"
                                  title="Previsto"
                                />
                              </div>
                              
                              {/* Invio */}
                              <div className="flex justify-center">
                                <input
                                  type="checkbox"
                                  checked={invio || false}
                                  onChange={() => handleToggleField(scadenza.id, mese.invio, invio)}
                                  className="rounded w-4 h-4 cursor-pointer"
                                  title="Inviato"
                                  disabled={!previsto}
                                />
                              </div>
                              
                              {/* N.Doc */}
                              <div className="flex justify-center">
                                <Input
                                  type="number"
                                  value={ndoc || 0}
                                  onChange={(e) => handleUpdateNumeric(scadenza.id, mese.ndoc, e.target.value)}
                                  className="w-16 h-7 text-xs text-center p-1"
                                  min="0"
                                />
                              </div>
                            </div>
                          </TableCell>
                        );
                      })}
                      
                      {/* Totale Documenti (calcolato automaticamente) */}
                      <TableCell className="text-center bg-blue-50 border-l-4 border-blue-400">
                        <div className="font-bold text-blue-900 text-lg">
                          {scadenza.tot_doc || 0}
                        </div>
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
            <div className="font-semibold text-gray-900 mb-2">📋 Legenda Funzionalità:</div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium mb-1">Per ogni mese:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li><strong>Prev.</strong> (Previsto): Indica se il mese è previsto per la comunicazione</li>
                  <li><strong>Inv.</strong> (Invio): Attivo solo se "Previsto" è checked - Indica invio effettivo</li>
                  <li><strong>N.Doc</strong>: Numero documenti del mese (numerico, min: 0)</li>
                </ul>
              </div>
              
              <div>
                <p className="font-medium mb-1">Calcolo Automatico:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li><strong>Tot Doc</strong>: Somma automatica di tutti i documenti mensili</li>
                  <li>Aggiornato in tempo reale ad ogni modifica</li>
                  <li>Campo readonly (sola lettura)</li>
                </ul>
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-sm pt-2 border-t">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-50 border border-green-200 rounded"></div>
                <span>Mese Inviato (verde chiaro)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-50 border border-blue-200 rounded"></div>
                <span>Totale Documenti (azzurro)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}