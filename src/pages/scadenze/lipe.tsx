import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/router";
import type { Database } from "@/integrations/supabase/types";

type LipeRow = Database["public"]["Tables"]["tbscadlipe"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

type LipeRecord = LipeRow & {
  nominativo: string;
  utente_professionista_id?: string | null;
  utente_operatore_id?: string | null;
  gen?: boolean | null;
  feb?: boolean | null;
  mar?: boolean | null;
  apr?: boolean | null;
  mag?: boolean | null;
  giu?: boolean | null;
  lug?: boolean | null;
  ago?: boolean | null;
  set?: boolean | null;
  ott?: boolean | null;
  nov?: boolean | null;
  dic?: boolean | null;
  lipe1t?: boolean | null;
  lipe1t_invio?: string | null;
  lipe2t?: boolean | null;
  lipe2t_invio?: string | null;
  lipe3t?: boolean | null;
  lipe3t_invio?: string | null;
  lipe4t?: boolean | null;
  lipe4t_invio?: string | null;
  acconto?: string | null;
  acconto_com?: boolean | null;
  professionista?: string;
  operatore?: string;
};

export default function ScadenzeLipePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<LipeRecord[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [filterProfessionista, setFilterProfessionista] = useState("__all__");

  useEffect(() => {
    loadData();
  }, []);

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

  const loadScadenze = async (): Promise<LipeRecord[]> => {
    const { data, error } = await supabase
      .from("tbscadlipe")
      .select(`
        *,
        professionista:tbutenti!tbscadlipe_utente_professionista_id_fkey(nome, cognome),
        operatore:tbutenti!tbscadlipe_utente_operatore_id_fkey(nome, cognome)
      `)
      .order("nominativo", { ascending: true });

    if (error) throw error;
    
    return (data || []).map(record => ({
      ...record,
      professionista: record.professionista 
        ? `${record.professionista.nome} ${record.professionista.cognome}`
        : "-",
      operatore: record.operatore
        ? `${record.operatore.nome} ${record.operatore.cognome}`
        : "-"
    })) as LipeRecord[];
  };

  const loadUtenti = async (): Promise<Utente[]> => {
    const { data, error } = await supabase
      .from("tbutenti")
      .select("*")
      .order("cognome", { ascending: true });
    
    if (error) throw error;
    return data || [];
  };

  const handleToggleField = async (
    recordId: string,
    field: keyof LipeRecord,
    currentValue: boolean | null
  ) => {
    try {
      const newValue = !currentValue;
      const { error } = await supabase
        .from("tbscadlipe")
        .update({ [field]: newValue })
        .eq("id", recordId);

      if (error) throw error;

      setScadenze((prev) =>
        prev.map((r) => (r.id === recordId ? { ...r, [field]: newValue } : r))
      );

      toast({
        title: "Aggiornato",
        description: `Campo ${field} aggiornato con successo`,
      });
    } catch (error) {
      console.error(`Errore aggiornamento ${field}:`, error);
      toast({
        title: "Errore",
        description: `Impossibile aggiornare ${field}`,
        variant: "destructive",
      });
    }
  };

  const handleUpdateValue = async (
    recordId: string,
    field: keyof LipeRecord,
    value: string
  ) => {
    try {
      const { error } = await supabase
        .from("tbscadlipe")
        .update({ [field]: value || null })
        .eq("id", recordId);

      if (error) throw error;

      setScadenze((prev) =>
        prev.map((r) => (r.id === recordId ? { ...r, [field]: value } : r))
      );

      toast({
        title: "Aggiornato",
        description: `Campo ${field} aggiornato con successo`,
      });
    } catch (error) {
      console.error(`Errore aggiornamento ${field}:`, error);
      toast({
        title: "Errore",
        description: `Impossibile aggiornare ${field}`,
        variant: "destructive",
      });
    }
  };

  const filteredScadenze = scadenze.filter(s => {
    const matchSearch = (s.nominativo || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchOperatore = filterOperatore === "__all__" || s.utente_operatore_id === filterOperatore;
    const matchProfessionista = filterProfessionista === "__all__" || s.utente_professionista_id === filterProfessionista;
    return matchSearch && matchOperatore && matchProfessionista;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Caricamento LIPE...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario LIPE</h1>
          <p className="text-gray-500 mt-1">Gestione Liquidazioni Periodiche IVA</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtri e Ricerca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cerca Nominativo</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cerca per nominativo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Utente Operatore</label>
              <Select value={filterOperatore} onValueChange={setFilterOperatore}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti gli operatori" />
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
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Utente Professionista</label>
              <Select value={filterProfessionista} onValueChange={setFilterProfessionista}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti i professionisti" />
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
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b sticky top-0 z-30 bg-white">
                <tr className="border-b transition-colors hover:bg-muted/50">
                  <th className="sticky-col-header h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[200px]">
                    Nominativo
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[180px]">Professionista</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[180px]">Operatore</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[60px]">Gen</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[60px]">Feb</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[60px]">Mar</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[80px]">LIPE 1T</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[140px]">Data Invio 1T</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[60px]">Apr</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[60px]">Mag</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[60px]">Giu</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[80px]">LIPE 2T</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[140px]">Data Invio 2T</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[60px]">Lug</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[60px]">Ago</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[60px]">Set</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[80px]">LIPE 3T</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[140px]">Data Invio 3T</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[60px]">Ott</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[60px]">Nov</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[60px]">Dic</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px]">Acconto</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[100px]">Acconto Com</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[80px]">LIPE 4T</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[140px]">Data Invio 4T</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {filteredScadenze.length === 0 ? (
                  <tr className="border-b transition-colors hover:bg-muted/50">
                    <td colSpan={20} className="p-4 text-center text-gray-500">
                      Nessun record trovato
                    </td>
                  </tr>
                ) : (
                  filteredScadenze.map((scadenza) => (
                    <tr
                      key={scadenza.id}
                      className="border-b transition-colors hover:bg-green-50"
                    >
                      <td className="sticky-col-cell p-2 align-middle font-medium min-w-[200px]">
                        {scadenza.nominativo}
                      </td>
                      <td className="p-2 align-middle min-w-[180px]">{scadenza.professionista}</td>
                      <td className="p-2 align-middle min-w-[180px]">{scadenza.operatore}</td>
                      
                      {/* Mesi Trimestre 1 */}
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={scadenza.gen || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "gen", scadenza.gen || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={scadenza.feb || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "feb", scadenza.feb || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={scadenza.mar || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "mar", scadenza.mar || false)
                          }
                        />
                      </td>
                      
                      {/* LIPE 1T */}
                      <td className="p-2 align-middle text-center min-w-[80px]">
                        <Checkbox
                          checked={scadenza.lipe1t || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "lipe1t", scadenza.lipe1t || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle min-w-[140px]">
                        <Input
                          type="date"
                          value={scadenza.lipe1t_invio || ""}
                          onChange={(e) =>
                            handleUpdateValue(scadenza.id, "lipe1t_invio", e.target.value)
                          }
                          className="h-8 text-xs"
                        />
                      </td>

                      {/* Mesi Trimestre 2 */}
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={scadenza.apr || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "apr", scadenza.apr || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={scadenza.mag || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "mag", scadenza.mag || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={scadenza.giu || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "giu", scadenza.giu || false)
                          }
                        />
                      </td>

                      {/* LIPE 2T */}
                      <td className="p-2 align-middle text-center min-w-[80px]">
                        <Checkbox
                          checked={scadenza.lipe2t || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "lipe2t", scadenza.lipe2t || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle min-w-[140px]">
                        <Input
                          type="date"
                          value={scadenza.lipe2t_invio || ""}
                          onChange={(e) =>
                            handleUpdateValue(scadenza.id, "lipe2t_invio", e.target.value)
                          }
                          className="h-8 text-xs"
                        />
                      </td>

                      {/* Mesi Trimestre 3 */}
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={scadenza.lug || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "lug", scadenza.lug || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={scadenza.ago || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "ago", scadenza.ago || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={scadenza.set || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "set", scadenza.set || false)
                          }
                        />
                      </td>

                      {/* LIPE 3T */}
                      <td className="p-2 align-middle text-center min-w-[80px]">
                        <Checkbox
                          checked={scadenza.lipe3t || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "lipe3t", scadenza.lipe3t || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle min-w-[140px]">
                        <Input
                          type="date"
                          value={scadenza.lipe3t_invio || ""}
                          onChange={(e) =>
                            handleUpdateValue(scadenza.id, "lipe3t_invio", e.target.value)
                          }
                          className="h-8 text-xs"
                        />
                      </td>

                      {/* Mesi Trimestre 4 */}
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={scadenza.ott || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "ott", scadenza.ott || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={scadenza.nov || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "nov", scadenza.nov || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={scadenza.dic || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "dic", scadenza.dic || false)
                          }
                        />
                      </td>

                      {/* Acconto */}
                      <td className="p-2 align-middle min-w-[120px]">
                        <Input
                          type="text"
                          value={scadenza.acconto || ""}
                          onChange={(e) =>
                            handleUpdateValue(scadenza.id, "acconto", e.target.value)
                          }
                          className="h-8 text-xs"
                          placeholder="Metodo"
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[100px]">
                        <Checkbox
                          checked={scadenza.acconto_com || false}
                          onCheckedChange={() =>
                            handleToggleField(
                              scadenza.id,
                              "acconto_com",
                              scadenza.acconto_com || false
                            )
                          }
                        />
                      </td>

                      {/* LIPE 4T */}
                      <td className="p-2 align-middle text-center min-w-[80px]">
                        <Checkbox
                          checked={scadenza.lipe4t || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "lipe4t", scadenza.lipe4t || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle min-w-[140px]">
                        <Input
                          type="date"
                          value={scadenza.lipe4t_invio || ""}
                          onChange={(e) =>
                            handleUpdateValue(scadenza.id, "lipe4t_invio", e.target.value)
                          }
                          className="h-8 text-xs"
                        />
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