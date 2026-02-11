import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Search, Calendar } from "lucide-react";

// Tipo locale basato sui campi reali del database tbscadlipe (senza tipo_liq)
type LipeRow = Database["public"]["Tables"]["tbscadlipe"]["Row"];
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
};

export default function Lipe() {
  const [records, setRecords] = useState<LipeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("tbscadlipe")
        .select("*")
        .order("nominativo", { ascending: true });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error("Errore caricamento LIPE:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati LIPE",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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

      setRecords((prev) =>
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

      setRecords((prev) =>
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

  const filteredRecords = records.filter((record) =>
    record.nominativo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Caricamento LIPE...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Scadenzario LIPE</CardTitle>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per nominativo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              <Button onClick={loadRecords} variant="outline">
                Ricarica
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto max-h-[600px]">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b sticky top-0 z-30 bg-white">
                <tr className="border-b transition-colors hover:bg-muted/50">
                  <th className="sticky-col-header h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[200px]">
                    Nominativo
                  </th>
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
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[80px]">Acconto</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[100px]">Acconto Com</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[80px]">LIPE 4T</th>
                  <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[140px]">Data Invio 4T</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={23} className="p-4 text-center text-muted-foreground">
                      Nessun record trovato
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b transition-colors hover:bg-green-50"
                    >
                      <td className="sticky-col-cell p-2 align-middle font-medium min-w-[200px]">
                        {record.nominativo}
                      </td>
                      
                      {/* Mesi Trimestre 1 */}
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={record.gen || false}
                          onCheckedChange={() =>
                            handleToggleField(record.id, "gen", record.gen || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={record.feb || false}
                          onCheckedChange={() =>
                            handleToggleField(record.id, "feb", record.feb || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={record.mar || false}
                          onCheckedChange={() =>
                            handleToggleField(record.id, "mar", record.mar || false)
                          }
                        />
                      </td>
                      
                      {/* LIPE 1T */}
                      <td className="p-2 align-middle text-center min-w-[80px]">
                        <Checkbox
                          checked={record.lipe1t || false}
                          onCheckedChange={() =>
                            handleToggleField(record.id, "lipe1t", record.lipe1t || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle min-w-[140px]">
                        <Input
                          type="date"
                          value={record.lipe1t_invio || ""}
                          onChange={(e) =>
                            handleUpdateValue(record.id, "lipe1t_invio", e.target.value)
                          }
                          className="h-8 text-xs"
                        />
                      </td>

                      {/* Mesi Trimestre 2 */}
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={record.apr || false}
                          onCheckedChange={() =>
                            handleToggleField(record.id, "apr", record.apr || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={record.mag || false}
                          onCheckedChange={() =>
                            handleToggleField(record.id, "mag", record.mag || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={record.giu || false}
                          onCheckedChange={() =>
                            handleToggleField(record.id, "giu", record.giu || false)
                          }
                        />
                      </td>

                      {/* LIPE 2T */}
                      <td className="p-2 align-middle text-center min-w-[80px]">
                        <Checkbox
                          checked={record.lipe2t || false}
                          onCheckedChange={() =>
                            handleToggleField(record.id, "lipe2t", record.lipe2t || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle min-w-[140px]">
                        <Input
                          type="date"
                          value={record.lipe2t_invio || ""}
                          onChange={(e) =>
                            handleUpdateValue(record.id, "lipe2t_invio", e.target.value)
                          }
                          className="h-8 text-xs"
                        />
                      </td>

                      {/* Mesi Trimestre 3 */}
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={record.lug || false}
                          onCheckedChange={() =>
                            handleToggleField(record.id, "lug", record.lug || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={record.ago || false}
                          onCheckedChange={() =>
                            handleToggleField(record.id, "ago", record.ago || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={record.set || false}
                          onCheckedChange={() =>
                            handleToggleField(record.id, "set", record.set || false)
                          }
                        />
                      </td>

                      {/* LIPE 3T */}
                      <td className="p-2 align-middle text-center min-w-[80px]">
                        <Checkbox
                          checked={record.lipe3t || false}
                          onCheckedChange={() =>
                            handleToggleField(record.id, "lipe3t", record.lipe3t || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle min-w-[140px]">
                        <Input
                          type="date"
                          value={record.lipe3t_invio || ""}
                          onChange={(e) =>
                            handleUpdateValue(record.id, "lipe3t_invio", e.target.value)
                          }
                          className="h-8 text-xs"
                        />
                      </td>

                      {/* Mesi Trimestre 4 */}
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={record.ott || false}
                          onCheckedChange={() =>
                            handleToggleField(record.id, "ott", record.ott || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={record.nov || false}
                          onCheckedChange={() =>
                            handleToggleField(record.id, "nov", record.nov || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[60px]">
                        <Checkbox
                          checked={record.dic || false}
                          onCheckedChange={() =>
                            handleToggleField(record.id, "dic", record.dic || false)
                          }
                        />
                      </td>

                      {/* Acconto */}
                      <td className="p-2 align-middle min-w-[120px]">
                        <Input
                          type="text"
                          value={record.acconto || ""}
                          onChange={(e) =>
                            handleUpdateValue(record.id, "acconto", e.target.value)
                          }
                          className="h-8 text-xs"
                          placeholder="Metodo"
                        />
                      </td>
                      <td className="p-2 align-middle text-center min-w-[100px]">
                        <Checkbox
                          checked={record.acconto_com || false}
                          onCheckedChange={() =>
                            handleToggleField(
                              record.id,
                              "acconto_com",
                              record.acconto_com || false
                            )
                          }
                        />
                      </td>

                      {/* LIPE 4T */}
                      <td className="p-2 align-middle text-center min-w-[80px]">
                        <Checkbox
                          checked={record.lipe4t || false}
                          onCheckedChange={() =>
                            handleToggleField(record.id, "lipe4t", record.lipe4t || false)
                          }
                        />
                      </td>
                      <td className="p-2 align-middle min-w-[140px]">
                        <Input
                          type="date"
                          value={record.lipe4t_invio || ""}
                          onChange={(e) =>
                            handleUpdateValue(record.id, "lipe4t_invio", e.target.value)
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