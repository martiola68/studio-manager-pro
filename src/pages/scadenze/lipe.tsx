import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/router";
import type { Database } from "@/integrations/supabase/types";

type LipeRow = Database["public"]["Tables"]["tbscadlipe"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

type TipoLiqValue = "Mensile" | "Trimestrale" | "Esterna";

type LipeRecord = LipeRow & {
  nominativo: string;
  utente_professionista_id?: string | null;
  utente_operatore_id?: string | null;
  TipoLiq?: string | null;
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

type CampoMese =
  | "gen"
  | "feb"
  | "mar"
  | "apr"
  | "mag"
  | "giu"
  | "lug"
  | "ago"
  | "set"
  | "ott"
  | "nov"
  | "dic";

const mesiDisabilitatiPerTipo: Record<TipoLiqValue, CampoMese[]> = {
  Mensile: [],
  Trimestrale: ["gen", "feb", "apr", "mag", "lug", "ago", "ott", "nov"],
  Esterna: ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"],
};

const baseHeaderClass =
  "h-10 px-2 text-center align-middle font-medium text-muted-foreground border-r border-gray-300";

const baseCellClass = "p-2 align-middle border-r border-gray-300";

const groupHeaderQ1 = "bg-sky-100";
const groupCellQ1 = "bg-sky-50";

const groupHeaderQ2 = "bg-emerald-100";
const groupCellQ2 = "bg-emerald-50";

const groupHeaderQ3 = "bg-amber-100";
const groupCellQ3 = "bg-amber-50";

const groupHeaderQ4 = "bg-violet-100";
const groupCellQ4 = "bg-violet-50";

export default function ScadenzeLipePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<LipeRecord[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
 const [filterTipoLiq, setFilterTipoLiq] = useState("__all__");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [scadenzeData, utentiData] = await Promise.all([loadScadenze(), loadUtenti()]);
      setScadenze(scadenzeData);
      setUtenti(utentiData);
    } catch (error) {
      console.error("Errore caricamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive",
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

    return (data || []).map((record) => ({
      ...record,
      professionista: record.professionista
        ? `${record.professionista.nome} ${record.professionista.cognome}`
        : "-",
      operatore: record.operatore
        ? `${record.operatore.nome} ${record.operatore.cognome}`
        : "-",
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

  const getTipoLiq = (record: LipeRecord): TipoLiqValue => {
    const value = record.TipoLiq;
    if (value === "Trimestrale" || value === "Esterna") return value;
    return "Mensile";
  };

  const isMonthDisabled = (record: LipeRecord, month: CampoMese) => {
    const tipo = getTipoLiq(record);
    return mesiDisabilitatiPerTipo[tipo].includes(month);
  };

  const handleToggleField = async (
    recordId: string,
    field: keyof LipeRecord,
    currentValue: boolean | null
  ) => {
    try {
      const record = scadenze.find((r) => r.id === recordId);

      if (
        record &&
        ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"].includes(
          field as string
        ) &&
        isMonthDisabled(record, field as CampoMese)
      ) {
        return;
      }

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
        prev.map((r) => (r.id === recordId ? { ...r, [field]: value || null } : r))
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

const filteredScadenze = scadenze.filter((s) => {
  const matchSearch = (s.nominativo || "")
    .toLowerCase()
    .includes(searchQuery.toLowerCase());

  const matchOperatore =
    filterOperatore === "__all__" || s.utente_operatore_id === filterOperatore;

  const tipoLiq = s.TipoLiq || "Mensile";
  const matchTipoLiq =
    filterTipoLiq === "__all__" || tipoLiq === filterTipoLiq;

  return matchSearch && matchOperatore && matchTipoLiq;
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
          <h1 className="text-3xl font-bold text-gray-900">Scadenzario Liquidazioni IVA e LIPE</h1>
          <p className="text-gray-500 mt-1">Gestione liquidazioni IVA periodiche e LIPE</p>
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
        {utenti.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.nome} {u.cognome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  <div className="space-y-2">
    <label className="text-sm font-medium">Tipo liquidazione</label>
    <Select value={filterTipoLiq} onValueChange={setFilterTipoLiq}>
      <SelectTrigger>
        <SelectValue placeholder="Tutti i tipi" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">Tutti i tipi</SelectItem>
        <SelectItem value="Mensile">Mensile</SelectItem>
        <SelectItem value="Trimestrale">Trimestrale</SelectItem>
        <SelectItem value="Esterna">Esterna</SelectItem>
      </SelectContent>
    </Select>
  </div>
</div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Utente Professionista</label>
              <Select value={filterProfessionista} onValueChange={setFilterProfessionista}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti i professionisti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti i professionisti</SelectItem>
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
          <div className="relative w-full overflow-auto max-h-[600px]">
            <table className="w-full caption-bottom text-sm border-collapse">
              <thead className="sticky top-0 z-30 bg-white">
                <tr className="border-b border-gray-300">
                  <th className="sticky-col-header h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[200px] border-r border-gray-300 bg-white">
                    Nominativo
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[180px] border-r border-gray-300 bg-white">
                    Professionista
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[180px] border-r border-gray-300 bg-white">
                    Operatore
                  </th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[170px] border-r border-gray-300 bg-white">
                    Tipo liquidazione
                  </th>

                  <th className={`${baseHeaderClass} ${groupHeaderQ1} min-w-[60px]`}>Gen</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ1} min-w-[60px]`}>Feb</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ1} min-w-[60px]`}>Mar</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ1} min-w-[80px]`}>LIPE 1T</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ1} min-w-[140px]`}>Data Invio 1T</th>

                  <th className={`${baseHeaderClass} ${groupHeaderQ2} min-w-[60px]`}>Apr</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ2} min-w-[60px]`}>Mag</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ2} min-w-[60px]`}>Giu</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ2} min-w-[80px]`}>LIPE 2T</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ2} min-w-[140px]`}>Data Invio 2T</th>

                  <th className={`${baseHeaderClass} ${groupHeaderQ3} min-w-[60px]`}>Lug</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ3} min-w-[60px]`}>Ago</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ3} min-w-[60px]`}>Set</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ3} min-w-[80px]`}>LIPE 3T</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ3} min-w-[140px]`}>Data Invio 3T</th>

                  <th className={`${baseHeaderClass} ${groupHeaderQ4} min-w-[60px]`}>Ott</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ4} min-w-[60px]`}>Nov</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ4} min-w-[60px]`}>Dic</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ4} min-w-[120px]`}>Acconto</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ4} min-w-[100px]`}>Acconto Com</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ4} min-w-[80px]`}>LIPE 4T</th>
                  <th className={`${baseHeaderClass} ${groupHeaderQ4} min-w-[140px] border-r-0`}>
                    Data Invio 4T
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredScadenze.length === 0 ? (
                  <tr className="border-b border-gray-300">
                    <td colSpan={26} className="p-4 text-center text-gray-500">
                      Nessun record trovato
                    </td>
                  </tr>
                ) : (
                  filteredScadenze.map((scadenza) => (
                    <tr key={scadenza.id} className="border-b border-gray-300 hover:bg-green-50/40">
                      <td className="sticky-col-cell p-2 align-middle font-medium min-w-[200px] border-r border-gray-300 bg-white">
                        {scadenza.nominativo}
                      </td>
                      <td className="p-2 align-middle min-w-[180px] border-r border-gray-300">
                        {scadenza.professionista}
                      </td>
                      <td className="p-2 align-middle min-w-[180px] border-r border-gray-300">
                        {scadenza.operatore}
                      </td>

                      <td className="p-2 align-middle min-w-[170px] border-r border-gray-300">
                        <Select
                          value={getTipoLiq(scadenza)}
                          onValueChange={(value: TipoLiqValue) =>
                            handleUpdateValue(scadenza.id, "TipoLiq", value)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs bg-white">
                            <SelectValue placeholder="Seleziona tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Mensile">Mensile</SelectItem>
                            <SelectItem value="Trimestrale">Trimestrale</SelectItem>
                            <SelectItem value="Esterna">Esterna</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      <td className={`${baseCellClass} ${groupCellQ1} text-center min-w-[60px]`}>
                        <Checkbox
                          checked={scadenza.gen || false}
                          disabled={isMonthDisabled(scadenza, "gen")}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "gen", scadenza.gen || false)
                          }
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ1} text-center min-w-[60px]`}>
                        <Checkbox
                          checked={scadenza.feb || false}
                          disabled={isMonthDisabled(scadenza, "feb")}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "feb", scadenza.feb || false)
                          }
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ1} text-center min-w-[60px]`}>
                        <Checkbox
                          checked={scadenza.mar || false}
                          disabled={isMonthDisabled(scadenza, "mar")}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "mar", scadenza.mar || false)
                          }
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ1} text-center min-w-[80px]`}>
                        <Checkbox
                          checked={scadenza.lipe1t || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "lipe1t", scadenza.lipe1t || false)
                          }
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ1} min-w-[140px]`}>
                        <Input
                          type="date"
                          value={scadenza.lipe1t_invio || ""}
                          onChange={(e) =>
                            handleUpdateValue(scadenza.id, "lipe1t_invio", e.target.value)
                          }
                          className="h-8 text-xs bg-white"
                        />
                      </td>

                      <td className={`${baseCellClass} ${groupCellQ2} text-center min-w-[60px]`}>
                        <Checkbox
                          checked={scadenza.apr || false}
                          disabled={isMonthDisabled(scadenza, "apr")}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "apr", scadenza.apr || false)
                          }
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ2} text-center min-w-[60px]`}>
                        <Checkbox
                          checked={scadenza.mag || false}
                          disabled={isMonthDisabled(scadenza, "mag")}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "mag", scadenza.mag || false)
                          }
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ2} text-center min-w-[60px]`}>
                        <Checkbox
                          checked={scadenza.giu || false}
                          disabled={isMonthDisabled(scadenza, "giu")}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "giu", scadenza.giu || false)
                          }
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ2} text-center min-w-[80px]`}>
                        <Checkbox
                          checked={scadenza.lipe2t || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "lipe2t", scadenza.lipe2t || false)
                          }
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ2} min-w-[140px]`}>
                        <Input
                          type="date"
                          value={scadenza.lipe2t_invio || ""}
                          onChange={(e) =>
                            handleUpdateValue(scadenza.id, "lipe2t_invio", e.target.value)
                          }
                          className="h-8 text-xs bg-white"
                        />
                      </td>

                      <td className={`${baseCellClass} ${groupCellQ3} text-center min-w-[60px]`}>
                        <Checkbox
                          checked={scadenza.lug || false}
                          disabled={isMonthDisabled(scadenza, "lug")}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "lug", scadenza.lug || false)
                          }
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ3} text-center min-w-[60px]`}>
                        <Checkbox
                          checked={scadenza.ago || false}
                          disabled={isMonthDisabled(scadenza, "ago")}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "ago", scadenza.ago || false)
                          }
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ3} text-center min-w-[60px]`}>
                        <Checkbox
                          checked={scadenza.set || false}
                          disabled={isMonthDisabled(scadenza, "set")}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "set", scadenza.set || false)
                          }
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ3} text-center min-w-[80px]`}>
                        <Checkbox
                          checked={scadenza.lipe3t || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "lipe3t", scadenza.lipe3t || false)
                          }
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ3} min-w-[140px]`}>
                        <Input
                          type="date"
                          value={scadenza.lipe3t_invio || ""}
                          onChange={(e) =>
                            handleUpdateValue(scadenza.id, "lipe3t_invio", e.target.value)
                          }
                          className="h-8 text-xs bg-white"
                        />
                      </td>

                      <td className={`${baseCellClass} ${groupCellQ4} text-center min-w-[60px]`}>
                        <Checkbox
                          checked={scadenza.ott || false}
                          disabled={isMonthDisabled(scadenza, "ott")}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "ott", scadenza.ott || false)
                          }
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ4} text-center min-w-[60px]`}>
                        <Checkbox
                          checked={scadenza.nov || false}
                          disabled={isMonthDisabled(scadenza, "nov")}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "nov", scadenza.nov || false)
                          }
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ4} text-center min-w-[60px]`}>
                        <Checkbox
                          checked={scadenza.dic || false}
                          disabled={isMonthDisabled(scadenza, "dic")}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "dic", scadenza.dic || false)
                          }
                        />
                      </td>

                      <td className={`${baseCellClass} ${groupCellQ4} min-w-[120px]`}>
                        <Input
                          type="text"
                          value={scadenza.acconto || ""}
                          onChange={(e) =>
                            handleUpdateValue(scadenza.id, "acconto", e.target.value)
                          }
                          className="h-8 text-xs bg-white"
                          placeholder="Metodo"
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ4} text-center min-w-[100px]`}>
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

                      <td className={`${baseCellClass} ${groupCellQ4} text-center min-w-[80px]`}>
                        <Checkbox
                          checked={scadenza.lipe4t || false}
                          onCheckedChange={() =>
                            handleToggleField(scadenza.id, "lipe4t", scadenza.lipe4t || false)
                          }
                        />
                      </td>
                      <td className={`${baseCellClass} ${groupCellQ4} min-w-[140px] border-r-0`}>
                        <Input
                          type="date"
                          value={scadenza.lipe4t_invio || ""}
                          onChange={(e) =>
                            handleUpdateValue(scadenza.id, "lipe4t_invio", e.target.value)
                          }
                          className="h-8 text-xs bg-white"
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
