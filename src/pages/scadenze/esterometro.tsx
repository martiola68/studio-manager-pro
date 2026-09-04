import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type ScadenzaEsterometroRow =
  Database["public"]["Tables"]["tbscadestero"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

type ScadenzaEsterometro = ScadenzaEsterometroRow & {
  professionista?: string;
  operatore?: string;
  anno_riferimento?: number | null;
  archiviato?: boolean | null;
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
 ] as const;

function BooleanSelect({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <select
      value={value ? "SI" : "NO"}
      onChange={(e) => onChange(e.target.value === "SI")}
      className="h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700"
    >
      <option value="NO">NO</option>
      <option value="SI">SI</option>
    </select>
  );
}

export default function ScadenzeEsterometroPage() {
  const router = useRouter();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaEsterometro[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [annoConsultazione, setAnnoConsultazione] = useState(currentYear);
  const [anniDisponibili, setAnniDisponibili] = useState<number[]>([]);

  const [stats, setStats] = useState({
    totale: 0,
    confermate: 0,
  });

  useEffect(() => {
    checkAuthAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annoConsultazione]);

  const checkAuthAndLoad = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

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
        loadUtenti(),
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
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadScadenze = async (): Promise<ScadenzaEsterometro[]> => {
    const { data: anniData, error: anniError } = await supabase
      .from("tbscadestero" as any)
      .select("anno_riferimento")
      .order("anno_riferimento", { ascending: true });

    if (anniError) throw anniError;

    const anni = Array.from(
      new Set(
        (((anniData ?? []) as any[]) || [])
          .map((r) => r.anno_riferimento)
          .filter((a): a is number => typeof a === "number")
      )
    ).sort((a, b) => a - b);

    setAnniDisponibili(anni);

    const annoDaUsare =
      anni.length > 0 && !anni.includes(annoConsultazione)
        ? anni[anni.length - 1]
        : annoConsultazione;

    if (annoDaUsare !== annoConsultazione) {
      setAnnoConsultazione(annoDaUsare);
    }

    const { data, error } = await supabase
      .from("tbscadestero" as any)
      .select(
        `
        *,
        professionista:tbutenti!tbscadestero_utente_professionista_id_fkey(nome, cognome),
        operatore:tbutenti!tbscadestero_utente_operatore_id_fkey(nome, cognome)
      `
      )
      .eq("anno_riferimento", annoDaUsare)
      .order("nominativo", { ascending: true });

    if (error) {
      console.error("Errore query:", error);
      throw error;
    }

    return ((data || []) as any[]).map((record: any) => ({
      ...record,
      professionista: record.professionista
        ? `${record.professionista.nome} ${record.professionista.cognome}`
        : "-",
      operatore: record.operatore
        ? `${record.operatore.nome} ${record.operatore.cognome}`
        : "-",
    })) as ScadenzaEsterometro[];
  };

  const loadUtenti = async (): Promise<Utente[]> => {
    const { data, error } = await supabase
      .from("tbutenti")
      .select("*")
      .order("nome", { ascending: true }).order("cognome", { ascending: true });

    if (error) throw error;
    return data || [];
  };

  const handleToggleField = async (
    scadenzaId: string,
    field: keyof ScadenzaEsterometro,
    currentValue: boolean | null
  ) => {
    try {
      const newValue = !currentValue;

      setScadenze((prev) =>
        prev.map((s) => (s.id === scadenzaId ? { ...s, [field]: newValue } : s))
      );

      const { error } = await supabase
        .from("tbscadestero")
        .update({ [field]: newValue })
        .eq("id", scadenzaId);

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Errore aggiornamento",
        description: error.message,
        variant: "destructive",
      });
      await loadData();
    }
  };

  const handleUpdateField = async (
    scadenzaId: string,
    field: keyof ScadenzaEsterometro,
    value: any
  ) => {
    try {
      const normalizedValue = value === "" ? null : Number(value);

      const { error } = await supabase
        .from("tbscadestero")
        .update({ [field]: normalizedValue })
        .eq("id", scadenzaId);

      if (error) throw error;

      setScadenze((prev) =>
        prev.map((s) =>
          s.id === scadenzaId ? { ...s, [field]: normalizedValue } : s
        )
      );
    } catch (error: any) {
      toast({
        title: "Errore aggiornamento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo record?")) return;

    try {
      const { error } = await supabase.from("tbscadestero").delete().eq("id", id);

      if (error) throw error;

        setScadenze((prev) => prev.filter((s) => s.id !== id));

      setStats((prev) => ({
        ...prev,
        totale: Math.max(0, prev.totale - 1),
      }));

      toast({
        title: "Successo",
        description: "Record eliminato",
      });
      
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile eliminare il record",
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

    return matchSearch && matchOperatore;
  });

  const calculateTotalDocs = (row: ScadenzaEsterometro) => {
    let sum = 0;

    for (let i = 1; i <= 12; i++) {
      const val = row[`nmese${i}` as keyof ScadenzaEsterometro];
      if (typeof val === "number") {
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
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-slate-200/70 px-3 pb-3 pt-2">
      <div className="flex shrink-0 items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Scadenzario Esterometro
          </h1>
          <p className="text-gray-500 mt-1">
            Gestione scadenze Esterometro mensili
          </p>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border border-sky-200 bg-slate-50 shadow-sm">
          <CardContent className="pt-5">
            <div className="text-sm text-gray-600 mb-1">Totale Record</div>
            <div className="text-3xl font-bold text-gray-900">
              {stats.totale}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shrink-0 border border-sky-200 bg-slate-50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Filtri e Ricerca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Cerca nominativo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 border-slate-300 bg-white pl-10"
              />
            </div>

            <div>
              <Select value={filterOperatore} onValueChange={setFilterOperatore}>
                <SelectTrigger className="h-9 border-slate-300 bg-white">
                  <SelectValue placeholder="Utente Operatore" />
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

            <div>
              <Select
                value={annoConsultazione.toString()}
                onValueChange={(value) => setAnnoConsultazione(parseInt(value))}
              >
                <SelectTrigger className="h-9 border-slate-300 bg-white">
                  <SelectValue placeholder="Anno consultazione" />
                </SelectTrigger>
                <SelectContent>
                  {anniDisponibili.map((anno) => (
                    <SelectItem key={anno} value={anno.toString()}>
                      {anno}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border border-sky-200 bg-slate-50 shadow-sm">
        <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
          <div className="h-full w-full overflow-auto">
            <table className="w-full caption-bottom text-sm border-collapse">
              <thead className="sticky top-0 z-30 bg-slate-600 text-white shadow-sm [&_tr]:border-b [&_tr]:border-slate-500">
                <tr className="border-b border-slate-500">
                  <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 sticky left-0 z-40 min-w-[260px] !bg-slate-600 border-r border-slate-500 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    Nominativo
                  </th>
                  <th className="h-9 px-2 text-left align-middle font-semibold text-slate-50 min-w-[170px] border-r border-slate-500 bg-slate-600">
                    Operatore
                  </th>

                  {MONTHS.map((month) => (
                    <th
                      key={month.prefix}
                      colSpan={3}
                      className="h-9 px-2 text-center align-middle font-semibold text-slate-50 border-r border-l border-slate-500 bg-slate-600"
                    >
                      {month.label}
                    </th>
                  ))}

                  <th className="h-9 px-2 text-center align-middle font-semibold text-slate-50 min-w-[80px] bg-slate-600 border-r border-slate-500">
                    Tot Doc
                  </th>
                  <th className="h-9 px-2 text-center align-middle font-semibold text-slate-50 min-w-[90px] bg-slate-600">
                    Azioni
                  </th>
                </tr>

                <tr className="border-b border-slate-500 bg-slate-700 text-xs text-slate-100">
                  <th className="sticky left-0 z-40 border-r border-slate-500 !bg-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"></th>
                  <th className="border-r border-slate-500 bg-slate-700"></th>

                  {MONTHS.map((month) => (
                    <th
                      key={`head-${month.prefix}`}
                      colSpan={3}
                      className="p-0"
                    >
                      <div className="grid grid-cols-3">
                        <div
                          className="px-1 py-1 text-center font-medium border-l border-slate-500"
                          style={{ width: "60px", minWidth: "60px" }}
                        >
                          Prev
                        </div>
                        <div
                          className="px-1 py-1 text-center font-medium"
                          style={{ width: "60px", minWidth: "60px" }}
                        >
                          Inv
                        </div>
                        <div
                          className="px-1 py-1 text-center font-medium border-r border-slate-500"
                          style={{ width: "60px", minWidth: "60px" }}
                        >
                          N. Doc
                        </div>
                      </div>
                    </th>
                  ))}

                  <th className="bg-slate-700 border-r border-slate-500"></th>
                  <th className="bg-slate-700"></th>
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
                    <tr
                      key={scadenza.id}
                      className="group border-b border-slate-200 hover:bg-slate-100"
                    >
                      <td className="px-2 py-1 align-middle sticky left-0 z-20 border-r border-slate-200 font-medium min-w-[260px] bg-slate-50 group-hover:bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        {scadenza.nominativo}
                      </td>

                      <td className="px-2 py-1 align-middle min-w-[170px] border-r border-slate-200 text-xs">
                        {scadenza.operatore}
                      </td>

                      {MONTHS.map((month) => {
                        const isInviato =
                          (scadenza as any)[`${month.prefix}_invio`] || false;
                        const monthBgClass = isInviato
                          ? "bg-green-100"
                          : "bg-slate-50";

                        return (
                          <React.Fragment key={`${scadenza.id}-${month.prefix}`}>
                            <td
                              className={`p-1 align-middle text-center border-l ${monthBgClass}`}
                              style={{ width: "60px", minWidth: "60px" }}
                            >
                              <BooleanSelect
                                value={Boolean(
                                  (scadenza as any)[`${month.prefix}_previsto`]
                                )}
                                onChange={(nextValue) => {
                                  const currentValue = Boolean(
                                    (scadenza as any)[`${month.prefix}_previsto`]
                                  );
                                  if (nextValue !== currentValue) {
                                    handleToggleField(
                                      scadenza.id,
                                      `${month.prefix}_previsto` as keyof ScadenzaEsterometro,
                                      currentValue
                                    );
                                  }
                                }}
                              />
                            </td>

                            <td
                              className={`p-1 align-middle text-center ${monthBgClass}`}
                              style={{ width: "60px", minWidth: "60px" }}
                            >
                              <BooleanSelect
                                value={Boolean(
                                  (scadenza as any)[`${month.prefix}_invio`]
                                )}
                                onChange={(nextValue) => {
                                  const currentValue = Boolean(
                                    (scadenza as any)[`${month.prefix}_invio`]
                                  );
                                  if (nextValue !== currentValue) {
                                    handleToggleField(
                                      scadenza.id,
                                      `${month.prefix}_invio` as keyof ScadenzaEsterometro,
                                      currentValue
                                    );
                                  }
                                }}
                              />
                            </td>

                            <td
                              className={`p-1 align-middle border-r ${monthBgClass}`}
                              style={{ width: "60px", minWidth: "60px" }}
                            >
                              <Input
                                type="number"
                                className="h-8 w-full border-slate-300 bg-white px-1 text-center"
                                style={{ width: "60px", minWidth: "60px" }}
                                value={
                                  (scadenza as any)[`nmese${month.index}`] ?? ""
                                }
                                onChange={(e) =>
                                  handleUpdateField(
                                    scadenza.id,
                                    `nmese${month.index}` as keyof ScadenzaEsterometro,
                                    e.target.value
                                  )
                                }
                              />
                            </td>
                          </React.Fragment>
                        );
                      })}

                      <td className="p-2 align-middle text-center font-bold bg-gray-100 min-w-[80px]">
                        {calculateTotalDocs(scadenza)}
                      </td>

                      <td className="p-2 align-middle text-center min-w-[90px]">
                        <button
                          type="button"
                          onClick={() => handleDelete(scadenza.id)}
                          className="inline-flex items-center justify-center text-red-600 hover:text-red-700"
                          title="Elimina record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
