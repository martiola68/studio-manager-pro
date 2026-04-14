import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Trash2, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ScadenzaImuBase = Database["public"]["Tables"]["tbscadimu"]["Row"];

type ScadenzaImu = ScadenzaImuBase & {
  anno_riferimento: number | null;
  archiviato: boolean | null;
  data_archiviazione: string | null;
  utente_operatore_id: string | null;
};

type UtenteLight = {
  id: string;
  nome: string | null;
  cognome: string | null;
};

export default function ImuPage() {
  const router = useRouter();
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [scadenze, setScadenze] = useState<ScadenzaImu[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterConferma, setFilterConferma] = useState("__all__");
  const [filterAnno, setFilterAnno] = useState(String(currentYear));
  const [filterOperatore, setFilterOperatore] = useState("__all__");
  const [operatoriMap, setOperatoriMap] = useState<Record<string, string>>({});

  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [noteTimers, setNoteTimers] = useState<Record<string, NodeJS.Timeout>>(
    {}
  );

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  useEffect(() => {
    return () => {
      Object.values(noteTimers).forEach((timer) => clearTimeout(timer));
    };
  }, [noteTimers]);

  const checkAuthAndLoad = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    await loadScadenze();
  };

  const loadScadenze = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("tbscadimu")
        .select("*")
        .order("anno_riferimento", { ascending: false })
        .order("nominativo", { ascending: true });

      if (error) throw error;

      const rows = ((data || []) as unknown) as ScadenzaImu[];
      setScadenze(rows);

      const operatoreIds = Array.from(
        new Set(
          rows
            .map((r) => r.utente_operatore_id)
            .filter((v): v is string => !!v)
        )
      );

      if (operatoreIds.length > 0) {
        const { data: utentiData, error: utentiError } = await supabase
          .from("tbutenti")
          .select("id, nome, cognome")
          .in("id", operatoreIds);

        if (utentiError) throw utentiError;

        const map: Record<string, string> = {};
        ((utentiData || []) as UtenteLight[]).forEach((u) => {
          map[u.id] = `${u.nome || ""} ${u.cognome || ""}`.trim();
        });

        setOperatoriMap(map);
      } else {
        setOperatoriMap({});
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const anniDisponibili = useMemo(() => {
    const years = Array.from(
      new Set(
        scadenze
          .map((s: ScadenzaImu) => s.anno_riferimento)
          .filter((v): v is number => typeof v === "number")
      )
    ).sort((a, b) => b - a);

    return years.length > 0 ? years : [currentYear];
  }, [scadenze, currentYear]);

  const sortByCognome = (a: string, b: string) => {
    const splitA = a.trim().split(/\s+/);
    const splitB = b.trim().split(/\s+/);

    const cognomeA =
      splitA.length > 1 ? splitA[splitA.length - 1] : splitA[0] || "";
    const cognomeB =
      splitB.length > 1 ? splitB[splitB.length - 1] : splitB[0] || "";

    const bySurname = cognomeA.localeCompare(cognomeB, "it");
    if (bySurname !== 0) return bySurname;

    return a.localeCompare(b, "it");
  };

  const operatoriDisponibili = useMemo(() => {
    const operatori = Array.from(
      new Set(
        scadenze
          .map((s: ScadenzaImu) => {
            const id = s.utente_operatore_id || "";
            return id && operatoriMap[id] ? operatoriMap[id] : "";
          })
          .filter((v) => v.length > 0)
      )
    ).sort(sortByCognome);

    return operatori;
  }, [scadenze, operatoriMap]);

  const filteredScadenze = useMemo(() => {
    return scadenze.filter((s: ScadenzaImu) => {
      const q = searchQuery.trim().toLowerCase();
      const operatoreNome =
        (s.utente_operatore_id && operatoriMap[s.utente_operatore_id]) || "";

      const matchSearch =
        !q ||
        (s.nominativo || "").toLowerCase().includes(q) ||
        operatoreNome.toLowerCase().includes(q);

      const matchConferma =
        filterConferma === "__all__" ||
        (filterConferma === "true" ? !!s.conferma_riga : !s.conferma_riga);

      const matchAnno = String(s.anno_riferimento || "") === filterAnno;

      const matchOperatore =
        filterOperatore === "__all__" || operatoreNome === filterOperatore;

      return matchSearch && matchConferma && matchAnno && matchOperatore;
    });
  }, [
    scadenze,
    searchQuery,
    filterConferma,
    filterAnno,
    filterOperatore,
    operatoriMap,
  ]);

  const stats = useMemo(() => {
    return {
      totale: filteredScadenze.length,
      confermate: filteredScadenze.filter((s: ScadenzaImu) => !!s.conferma_riga)
        .length,
      nonConfermate: filteredScadenze.filter(
        (s: ScadenzaImu) => !s.conferma_riga
      ).length,
    };
  }, [filteredScadenze]);

  const handleToggleField = async (
    id: string,
    field: keyof ScadenzaImu,
    currentValue: boolean | null
  ) => {
    try {
      const newValue = !currentValue;

      setScadenze((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [field]: newValue } : s))
      );

      const { error } = await supabase
        .from("tbscadimu")
        .update({ [field]: newValue })
        .eq("id", id);

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Errore aggiornamento",
        description: error.message,
        variant: "destructive",
      });
      await loadScadenze();
    }
  };

  const handleUpdateField = async (
    id: string,
    field: keyof ScadenzaImu,
    value: any
  ) => {
    try {
      const { error } = await supabase
        .from("tbscadimu")
        .update({ [field]: value || null })
        .eq("id", id);

      if (error) throw error;

      setScadenze((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
      );
    } catch (error: any) {
      toast({
        title: "Errore aggiornamento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleNoteChange = (scadenzaId: string, value: string) => {
    setLocalNotes((prev) => ({ ...prev, [scadenzaId]: value }));

    if (noteTimers[scadenzaId]) {
      clearTimeout(noteTimers[scadenzaId]);
    }

    const timer = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("tbscadimu")
          .update({ note: value || null })
          .eq("id", scadenzaId);

        if (error) throw error;

        setScadenze((prev) =>
          prev.map((s) =>
            s.id === scadenzaId ? { ...s, note: value } : s
          )
        );
      } catch (error) {
        console.error("Errore salvataggio nota:", error);
        toast({
          title: "Errore",
          description: "Impossibile salvare la nota",
          variant: "destructive",
        });
      }
    }, 1000);

    setNoteTimers((prev) => ({ ...prev, [scadenzaId]: timer }));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo record?")) return;

    try {
      const { error } = await supabase.from("tbscadimu").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Record eliminato",
      });

      await loadScadenze();
    } catch (error: any) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il record",
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    window.print();
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

  const dateInputClass = (value?: string | null) =>
    [
      "w-full",
      !value ? "text-transparent caret-transparent" : "",
      "focus:text-gray-900 focus:caret-auto",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <>
      <style jsx global>{`
        .sticky-col-header {
          position: sticky;
          left: 0;
          z-index: 40;
          background: white;
        }

        .sticky-col-cell {
          position: sticky;
          left: 0;
          z-index: 20;
          background: white;
        }

        @media print {
          body * {
            visibility: hidden;
          }

          #imu-print-area,
          #imu-print-area * {
            visibility: visible;
          }

          #imu-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
          }

          .no-print {
            display: none !important;
          }

          .print-hide {
            display: none !important;
          }

          .print-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }

          .print-table th,
          .print-table td {
            border: 1px solid #d1d5db;
            padding: 6px 8px;
            text-align: center;
          }

          .print-table th {
            background: #f3f4f6 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="space-y-6">
        <div className="flex items-center justify-between no-print">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Scadenzario IMU</h1>
            <p className="text-gray-500 mt-1">
              Gestione dichiarazioni e versamenti IMU
            </p>
          </div>

          {filterOperatore !== "__all__" && (
            <Button
              type="button"
              onClick={handlePrint}
              className="bg-black hover:bg-neutral-800 text-white"
            >
              <Printer className="h-4 w-4 mr-2" />
              Stampa elenco operatore
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600 mb-1">
                Totale Dichiarazioni
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {stats.totale}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600 mb-1">Confermate</div>
              <div className="text-3xl font-bold text-green-600">
                {stats.confermate}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600 mb-1">Non Confermate</div>
              <div className="text-3xl font-bold text-orange-600">
                {stats.nonConfermate}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="no-print">
          <CardHeader>
            <CardTitle>Filtri e Ricerca</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Cerca</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Cerca per nominativo o operatore..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Operatore
                </label>
                <Select
                  value={filterOperatore}
                  onValueChange={setFilterOperatore}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tutti gli operatori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tutti gli operatori</SelectItem>
                    {operatoriDisponibili.map((operatore) => (
                      <SelectItem key={operatore} value={operatore}>
                        {operatore}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Stato Conferma
                </label>
                <Select value={filterConferma} onValueChange={setFilterConferma}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tutti" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tutti</SelectItem>
                    <SelectItem value="true">Confermate</SelectItem>
                    <SelectItem value="false">Non Confermate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Anno consultazione
                </label>
                <Select value={filterAnno} onValueChange={setFilterAnno}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona anno" />
                  </SelectTrigger>
                  <SelectContent>
                    {anniDisponibili.map((anno) => (
                      <SelectItem key={anno} value={String(anno)}>
                        {anno}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="imu-print-area">
          <CardContent className="p-0">
            <div className="hidden print:block p-4">
              <h2 className="text-xl font-bold text-center mb-1">
                Scadenzario IMU
              </h2>
              <p className="text-sm text-center text-gray-600 mb-4">
                Anno: {filterAnno}
                {filterOperatore !== "__all__"
                  ? ` - Operatore: ${filterOperatore}`
                  : ""}
              </p>
            </div>

            <div className="w-full overflow-x-auto no-print">
              <div className="relative min-w-max overflow-y-auto max-h-[600px]">
                <table className="w-full caption-bottom text-sm">
                  <thead className="[&_tr]:border-b sticky top-0 z-30 bg-white shadow-sm">
                    <tr className="border-b border-gray-400 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                      <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground sticky-col-header border-r min-w-[220px]">
                        Nominativo
                      </th>
                      <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[150px]">
                        Operatore
                      </th>
                      <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px]">
                        Acconto IMU
                      </th>
                      <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px] print-hide">
                        Dovuto
                      </th>
                      <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px]">
                        Comunicato
                      </th>
                      <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[160px] print-hide">
                        Data comunicazione
                      </th>
                      <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px]">
                        Saldo IMU
                      </th>
                      <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px] print-hide">
                        Dovuto
                      </th>
                      <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[120px]">
                        Comunicato
                      </th>
                      <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[160px] print-hide">
                        Data comunicazione
                      </th>
                      <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[140px] print-hide">
                        Con dic. IMU
                      </th>
                      <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[170px] print-hide">
                        Data scadenza dic.
                      </th>
                      <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[140px] print-hide">
                        Dic. presentata
                      </th>
                      <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground min-w-[300px] print-hide">
                        Note
                      </th>
                      <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[140px]">
                        Conferma dati
                      </th>
                      <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground min-w-[100px] print-hide">
                        Azioni
                      </th>
                    </tr>
                  </thead>

                  <tbody className="[&_tr:last-child]:border-0">
                    {filteredScadenze.length === 0 ? (
                      <tr className="border-b border-gray-400 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <td
                          colSpan={16}
                          className="p-2 align-middle text-center py-8 text-gray-500"
                        >
                          Nessun record trovato
                        </td>
                      </tr>
                    ) : (
                      filteredScadenze.map((scadenza) => {
                        const isGreenRow = scadenza.conferma_riga === true;

                        return (
                          <tr
                            key={scadenza.id}
                            className={`border-b border-gray-400 transition-colors data-[state=selected]:bg-muted ${
                              isGreenRow
                                ? "bg-green-300 hover:bg-green-300"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            <td
                              className={`p-2 align-middle sticky-col-cell border-r font-medium min-w-[220px] ${
                                isGreenRow ? "!bg-green-300" : ""
                              }`}
                            >
                              {scadenza.nominativo}
                            </td>

                            <td className="p-2 align-middle min-w-[150px]">
                              {(scadenza.utente_operatore_id &&
                                operatoriMap[scadenza.utente_operatore_id]) ||
                                "-"}
                            </td>

                            <td className="p-2 align-middle text-center min-w-[120px]">
                              <Checkbox
                                checked={scadenza.acconto_imu || false}
                                onCheckedChange={() =>
                                  handleToggleField(
                                    scadenza.id,
                                    "acconto_imu",
                                    scadenza.acconto_imu
                                  )
                                }
                              />
                            </td>

                            <td className="p-2 align-middle text-center min-w-[120px] print-hide">
                              <Checkbox
                                checked={scadenza.acconto_dovuto || false}
                                onCheckedChange={() =>
                                  handleToggleField(
                                    scadenza.id,
                                    "acconto_dovuto",
                                    scadenza.acconto_dovuto
                                  )
                                }
                              />
                            </td>

                            <td className="p-2 align-middle text-center min-w-[120px]">
                              <Checkbox
                                checked={scadenza.acconto_comunicato || false}
                                onCheckedChange={() =>
                                  handleToggleField(
                                    scadenza.id,
                                    "acconto_comunicato",
                                    scadenza.acconto_comunicato
                                  )
                                }
                              />
                            </td>

                            <td className="p-2 align-middle min-w-[160px] print-hide">
                              <Input
                                type="date"
                                value={scadenza.data_com_acconto || ""}
                                onChange={(e) =>
                                  handleUpdateField(
                                    scadenza.id,
                                    "data_com_acconto",
                                    e.target.value
                                  )
                                }
                                className={dateInputClass(
                                  scadenza.data_com_acconto
                                )}
                              />
                            </td>

                            <td className="p-2 align-middle text-center min-w-[120px]">
                              <Checkbox
                                checked={scadenza.saldo_imu || false}
                                onCheckedChange={() =>
                                  handleToggleField(
                                    scadenza.id,
                                    "saldo_imu",
                                    scadenza.saldo_imu
                                  )
                                }
                              />
                            </td>

                            <td className="p-2 align-middle text-center min-w-[120px] print-hide">
                              <Checkbox
                                checked={scadenza.saldo_dovuto || false}
                                onCheckedChange={() =>
                                  handleToggleField(
                                    scadenza.id,
                                    "saldo_dovuto",
                                    scadenza.saldo_dovuto
                                  )
                                }
                              />
                            </td>

                            <td className="p-2 align-middle text-center min-w-[120px]">
                              <Checkbox
                                checked={scadenza.saldo_comunicato || false}
                                onCheckedChange={() =>
                                  handleToggleField(
                                    scadenza.id,
                                    "saldo_comunicato",
                                    scadenza.saldo_comunicato
                                  )
                                }
                              />
                            </td>

                            <td className="p-2 align-middle min-w-[160px] print-hide">
                              <Input
                                type="date"
                                value={scadenza.data_com_saldo || ""}
                                onChange={(e) =>
                                  handleUpdateField(
                                    scadenza.id,
                                    "data_com_saldo",
                                    e.target.value
                                  )
                                }
                                className={dateInputClass(
                                  scadenza.data_com_saldo
                                )}
                              />
                            </td>

                            <td className="p-2 align-middle text-center min-w-[140px] print-hide">
                              <Checkbox
                                checked={scadenza.dichiarazione_imu || false}
                                onCheckedChange={() =>
                                  handleToggleField(
                                    scadenza.id,
                                    "dichiarazione_imu",
                                    scadenza.dichiarazione_imu
                                  )
                                }
                              />
                            </td>

                            <td className="p-2 align-middle min-w-[170px] print-hide">
                              <Input
                                type="date"
                                value={scadenza.data_scad_dichiarazione || ""}
                                onChange={(e) =>
                                  handleUpdateField(
                                    scadenza.id,
                                    "data_scad_dichiarazione",
                                    e.target.value
                                  )
                                }
                                className={dateInputClass(
                                  scadenza.data_scad_dichiarazione
                                )}
                              />
                            </td>

                            <td className="p-2 align-middle text-center min-w-[140px] print-hide">
                              <Checkbox
                                checked={scadenza.dichiarazione_presentata || false}
                                onCheckedChange={() =>
                                  handleToggleField(
                                    scadenza.id,
                                    "dichiarazione_presentata",
                                    scadenza.dichiarazione_presentata
                                  )
                                }
                              />
                            </td>

                            <td className="p-2 align-middle min-w-[300px] print-hide">
                              <Textarea
                                value={localNotes[scadenza.id] ?? scadenza.note ?? ""}
                                onChange={(e) =>
                                  handleNoteChange(scadenza.id, e.target.value)
                                }
                                placeholder="Aggiungi note..."
                                className="min-h-[60px] resize-none"
                              />
                            </td>

                            <td className="p-2 align-middle text-center min-w-[140px]">
                              <Checkbox
                                checked={scadenza.conferma_riga || false}
                                onCheckedChange={() =>
                                  handleToggleField(
                                    scadenza.id,
                                    "conferma_riga",
                                    scadenza.conferma_riga
                                  )
                                }
                              />
                            </td>

                            <td className="p-2 align-middle text-center min-w-[100px] print-hide">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(scadenza.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="hidden print:block p-4">
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Nominativo</th>
                    <th>Acconto IMU</th>
                    <th>Comunicato</th>
                    <th>Saldo IMU</th>
                    <th>Comunicato</th>
                    <th>Conferma</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScadenze.length === 0 ? (
                    <tr>
                      <td colSpan={6}>Nessun record trovato</td>
                    </tr>
                  ) : (
                    filteredScadenze.map((scadenza) => (
                      <tr key={scadenza.id}>
                        <td style={{ textAlign: "left" }}>
                          {scadenza.nominativo || "-"}
                        </td>
                        <td>{scadenza.acconto_imu ? "Sì" : "No"}</td>
                        <td>{scadenza.acconto_comunicato ? "Sì" : "No"}</td>
                        <td>{scadenza.saldo_imu ? "Sì" : "No"}</td>
                        <td>{scadenza.saldo_comunicato ? "Sì" : "No"}</td>
                        <td>{scadenza.conferma_riga ? "Sì" : "No"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
